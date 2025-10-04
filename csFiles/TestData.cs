using System.Collections;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;
using System.IO;
using System;
using System.Reflection;
#if UNITY_EDITOR
using UnityEditor;
#endif


public class TestData : NetSyncClass
{
    //public TestData():base(){}
    public bool bool1;
    public bool bool2;
    public bool bool4;
    public bool bool3;
    public bool bool5;
    public bool bool6;
    public bool bool7;
    public bool bool8;
    public Vector2 vector2;
    public Emu enum1;



    public enum Emu
    {
        value1,
        value2,
        value3,
        value4,
    }

    public struct Struc
    {
        public bool bool1;
        public bool bool2;
        public bool bool4;
        public bool bool3;
        public bool bool5;
        public bool bool6;
        public bool bool7;
        public bool bool8;
    }


    public float float1 = 0.1f;
    public int int1 = 1;

    [SerializeField] string _string1 = "hello world";
    public string string2 = "hello world";
    public string string1
    {
        get => string1;
        set => string1 = value;
    }

    byte[] bytes;
    public void Awake()
    {
        ConvertToBytes();
    }

    public void ConvertToBytes()
    {
        bytes = ToByteArray(new System.Type[] { typeof(bool), typeof(Emu), typeof(float), typeof(Vector2)});

        StringBuilder sb = new StringBuilder();
        foreach (byte b in bytes)
            sb.Append(b + ",");
        Debug.Log(sb.ToString() + " count :" + bytes.Length);

        //for(int i = 0; i < 10000; i++)
        //{
        //    new GameObject("test:" + i).AddComponent<NetSyncClass>().CompressToStream();
        //}
    }
    public void RevertToByteArray()
    {
        ApplyFromByteArray(bytes);
    }

    public override int DecompressType(int x, int byteStart, string name, byte[] bytes)
    {
        switch (name)
        {
            case "Emu":
                Debug.Log("found type of Emu" );
                for (int i = 0; i < GetFieldTypeCount(x); i++)
                    GetFieldInfo(x, i).SetValue(this,((Emu)bytes[byteStart + i]));
                return GetFieldTypeCount(x);
            default:  
                return base.DecompressType(x, byteStart, name, bytes);
        } 
    }

    public override byte[] CompressType(int x, int y, string name)
    {
        var val = GetFieldInfo(x, y).GetValue(this);
        switch (name)
        {
            case "Emu":
                return new byte[] { (byte)(Emu)val };
            default:
                return base.CompressType(x, y, name);   
        }
    }

}

#if UNITY_EDITOR
[CustomEditor(typeof(TestData))]
public class TestDataEditor : Editor
{
    public override void OnInspectorGUI()
    {
        TestData s = (TestData)target; // gets the infomation of the curent node from
        base.OnInspectorGUI();

        if (GUILayout.Button("compress to byte array"))
            s.ConvertToBytes();
        if (GUILayout.Button("revert"))
            s.RevertToByteArray();
    }
}
#endif
