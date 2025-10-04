using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Reflection;
using System.Runtime.Serialization.Formatters.Binary;
using System.Text;
using System.Linq;
using System.IO;
using UnityEngine;
using System;

public class NetSyncClass : MonoBehaviour
{
    public static int rollingFixedFrameCount = 0; // should only be set in one place
    public static List<NetSyncClass> syncClasses = new List<NetSyncClass>();
    static int classIndex = 0;
    int id = 0;

    static void OnProjectChanged()
    {
        Debug.Log("clearing classes");
        syncClasses.Clear();
    }

    public void Start()
    {
        if (classIndex == 0)
            syncClasses.Clear();

        syncClasses.Add(this);
        id = classIndex++;
        Debug.Log(id + "  " + syncClasses.Count);
        var fields = GetType().GetFields();
        for (int i = 0; i < fields.Length; i++)
            AddItem(fields[i], this);
        orderListBySize();
        void orderListBySize() { }
    }


    int objectCompressedSize;
    public FieldInfo GetFieldInfo(int x, int y) => referancedData[x][y];
    public int GetFieldTypeCount(int x) => referancedData[x].Count;

    List<List<FieldInfo>> referancedData = new List<List<FieldInfo>>();
    List<System.Type> listOfTypes = new List<System.Type>();
    void AddItem(FieldInfo info, object obj)
    {
        if (!IsUnManaged(info)) return;

        for (int i = 0; i < listOfTypes.Count; i++)
            if (listOfTypes[i].Equals(info.FieldType))
            {
                referancedData[i].Add(info);
                return;
            }

        listOfTypes.Add(info.FieldType);
        referancedData.Add(new List<FieldInfo>());
        referancedData[referancedData.Count - 1].Add(info);

        bool IsUnManaged(FieldInfo info)
        {
            System.Type t = info.FieldType;
            return (t.IsGenericType || t.IsGenericParameter || t.IsConstructedGenericType || t.IsPrimitive || t.IsPointer || t.IsEnum || t.IsValueType);
        }
    }

    public byte[] addByteArrays(byte[][] arrays)
    {
        List<byte> finalArray = new List<byte>();
        foreach (byte[] bytes in arrays)
            finalArray.AddRange(bytes);
        return finalArray.ToArray();
    }





    static NetSyncClass GetObjectById(int id) =>  syncClasses[id];
    public static void ApplyFromByteArray(byte[] bytes)
    {
        NetSyncClass toSync = GetObjectById(BitConverter.ToInt32(bytes, 0));
        Debug.Log("applying bytes to " + toSync.gameObject.name);
        toSync.FromByteArray(bytes);
    }

    public void FromByteArray(byte[] bytes)
    {
        int curentByte = 5;
        while (curentByte < bytes.Length)
        {
            int x = bytes[curentByte];
            Debug.Log("index" + x + " is " + listOfTypes[x].Name + " from: " + curentByte);
            curentByte++;
            switch (listOfTypes[x].Name) // allows special compression
            {
                case "Boolean":
                    Debug.Log("caught bools");
                    for (int i = 0; i < referancedData[x].Count; i++)
                        referancedData[x][i].SetValue(this, ((bytes[curentByte + (i / 8)] & (byte)(1 << i % 8)) != 0));
                    curentByte += Mathf.CeilToInt(referancedData[x].Count / 8f);
                    break;
                default:
                    curentByte += DecompressType(x, curentByte, listOfTypes[x].Name, bytes);
                    break;
            }
        }
    }
    public virtual int DecompressType(int x, int byteStart, string name, byte[] bytes)
    {
        Debug.Log("decompressing base type: " + byteStart + " " + name);
        switch (name)
        {
            case "Int32":
                for (int i = 0; i < referancedData[x].Count; i++)
                    referancedData[x][i].SetValue(this , BitConverter.ToInt32(bytes, byteStart + (i * 4)));
                return referancedData[x].Count * 4;
            case "Single":
                for (int i = 0; i < referancedData[x].Count; i++)
                    referancedData[x][i].SetValue(this, (float)BitConverter.ToSingle(bytes, byteStart + (i * 4)));
                return referancedData[x].Count * 4;
            case "Vector2":
                for (int i = 0; i < referancedData[x].Count; i++)
                    referancedData[x][i].SetValue(this, new Vector2(BitConverter.ToSingle(bytes, byteStart + (i * 8)), BitConverter.ToSingle(bytes, byteStart + (i * 8) + 4)));
                return referancedData[x].Count * 8;
            case "Vector3":
                for (int i = 0; i < referancedData[x].Count; i++)
                    referancedData[x][i].SetValue(this, new Vector3(BitConverter.ToSingle(bytes, byteStart + (i * 12)), BitConverter.ToSingle(bytes, byteStart + (i * 12) + 4), BitConverter.ToSingle(bytes, byteStart + (i * 12) + 8)));
                return referancedData[x].Count * 12;

            default:
                Debug.Log(name + " wasnt caught in switch(t.Name)");
                break;
        }
        return 1; // 1 to avoid getting stuck in an infinite loop
    }


    // to array 

    public byte[] ToByteArray(Type[] types)
    {
        List<byte> bytes = new List<byte>();
        bytes.AddRange(BitConverter.GetBytes(id));
        bytes.Add((byte)rollingFixedFrameCount);
        foreach (Type t in types)
            bytes.AddRange(Compress(t));
        return bytes.ToArray();
    }

    public byte[] Compress(System.Type t)
    {
        int x = listOfTypes.IndexOf(t);
        if (x == -1)
            return new byte[0];
        List<byte> bytes = new List<byte>();

        switch (t.Name) // allows special compression
        {
            case "Boolean":
                bytes.AddRange(new byte[Mathf.CeilToInt(referancedData[x].Count / 8f)]);
                for (int i = 0; i < referancedData[x].Count; i++)
                {
                    int byteIndex = i / 8;
                    byte mask = (byte)(1 << i % 8);
                    if ((bool)(referancedData[x][i].GetValue(this)))
                        bytes[byteIndex] |= mask;
                    else
                        bytes[byteIndex] &= (byte)~mask;
                }
                break;
            default:
                for (int i = 0; i < referancedData[x].Count; i++)
                    bytes.AddRange(CompressType(x, i, t.Name));
                break;
        }
        bytes.Insert(0, (byte)x);
        return bytes.ToArray();
    }


    public virtual byte[] CompressType(int x, int y, string name)
    {
        var val = referancedData[x][y].GetValue(this);
        switch (name)
        {
            case "Int32":
                return BitConverter.GetBytes((int)val);           
            case "Single":
                return BitConverter.GetBytes((float)val);
            case "Vector2":
                return addByteArrays(new byte[][] { BitConverter.GetBytes(((Vector2)val).x), BitConverter.GetBytes(((Vector2)val).y) }); 
            case "Vector3":
                return addByteArrays(new byte[][] { BitConverter.GetBytes(((Vector3)val).x), BitConverter.GetBytes(((Vector3)val).y), BitConverter.GetBytes(((Vector3)val).z) });
            default:
                Debug.Log(name + " wasnt caught in switch(t.Name)");
            return new byte[0];
        }
    }
}



