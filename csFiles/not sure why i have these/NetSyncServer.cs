using System;
using System.IO;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

#if UNITY_EDITOR
using UnityEditor;
#endif

public class NetSyncServer : MonoBehaviour
{
    Server server;

    public void HostServer(){
        server = new Server();
    }
    
    public void JoinServer(){

    }

    public void OpenPage(string url){
        Application.OpenURL(url);
    }
}

#if UNITY_EDITOR
[CustomEditor(typeof(NetSyncServer))]
public class NetSyncServerEditor : Editor
{
    public override void OnInspectorGUI()
    {
        NetSyncServer s = (NetSyncServer)target; // gets the infomation of the curent node from
        base.OnInspectorGUI();
        if(GUILayout.Button("Localtunnel host server"))
        {    
            System.Diagnostics.Process cmd = new System.Diagnostics.Process();
            System.Diagnostics.ProcessStartInfo startInfo = new System.Diagnostics.ProcessStartInfo();
            startInfo.FileName ="python3";// Application.dataPath + "/RemotePlayTestingSystem/pagekite.py";
            //startInfo.UseShellExecute = false; startInfo.RedirectStandardInput = true;
            string args = "python3 pagekyte.py"; // ; timeout 5 > NUL
            Debug.Log(args);
            startInfo.Arguments = Application.dataPath + "/RemotePlayTestingSystem/pagekite.py";
            //startInfo.Arguments = "/C lt --port " + Server.port;

            cmd.StartInfo = startInfo;
            cmd.Start();

            //cmd.StandardInput.Write(args);   
            //Debug.Log(cmd.StandardOutput.ReadToEnd());
        
        }

        if (GUILayout.Button("open hosted page, http"))
            s.OpenPage("http://" + Server.ipAddress + ":" + Server.port + "/index.html");
        if (GUILayout.Button("open hosted page, https"))
            s.OpenPage("https://" + Server.ipAddress + ":" +Server.port + "/index.html");
    
    }
}
#endif
