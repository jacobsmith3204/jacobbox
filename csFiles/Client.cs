using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Net;
using System.Net.Sockets;
using System.Net.Http;

using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
#endif

public class Client : MonoBehaviour
{   
    Socket socket;
    [SerializeField]string ipAddress; 
    EndPoint endPoint;
    void Start(){
        endPoint = new IPEndPoint(IPAddress.Parse(ipAddress), 8000);
        socket = new Socket(AddressFamily.Unspecified, SocketType.Stream, ProtocolType.Tcp);
        Task.Run(()=>{
            socket.Connect(endPoint);  
            Send("GET /gameConnection HTTP/1.1 \r\n\r\n");
        });
    }

    public void Send(string message){
        socket.Send(GetBytes(message));
    }

    public static byte[] GetBytes(string str){
        return Encoding.ASCII.GetBytes(str);
    }
}

#if UNITY_EDITOR
[CustomEditor(typeof(Client))]
public class ClientEditor : Editor
{
    string message = "hello world";
    public override void OnInspectorGUI()
    {
        Client client = (Client)target; // gets the infomation of the curent node from

        base.OnInspectorGUI();
        // Restore the default transparent GUI background

        GUILayout.BeginHorizontal(EditorStyles.helpBox);
        message = EditorGUILayout.TextField(message);

        if (GUILayout.Button("send Message", GUILayout.Width(100)))
        {
            client.Send( client.gameObject.name + ": "+  message);
        }
       
        GUILayout.EndHorizontal();
    }
}
#endif
