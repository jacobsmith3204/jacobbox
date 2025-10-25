using System.Collections;
using System.Collections.Generic;
//using UnityEngine;
using System.IO;
using System.Reflection;
//using Newtonsoft.Json.Linq;

public class Settings 
{
    // settings 
    public static float volume {
        get => _volume;
        set => AudioListener.volume = _volume = value;
    }

    public static float volume {
        get => _volume;
        set => AudioListener.volume = _volume = value;
    }
    public static string name = "s";

    // storage things that toggle
    static float _volume = 1;
    static string path = Application.persistentDataPath + "/settings.json";
    // load 
    public static void FromFile() {
        Debug.Log("settings at " + path);
        if (!File.Exists(path))
            return;

        string data = File.ReadAllText(path);
        JObject settings = JObject.Parse(data);

        foreach(var item in settings) {
            PropertyInfo property = typeof(Settings).GetProperty(item.Key, BindingFlags.Public | BindingFlags.Static);
            if (property != null)
                property.SetValue(null, item.Value.ToObject(property.PropertyType));

            FieldInfo field = typeof(Settings).GetField(item.Key, BindingFlags.Public | BindingFlags.Static);
            if (field != null)
                field.SetValue(null, item.Value.ToObject(field.FieldType));
        }
    }

    // save
    public static void ToFile() {
        JObject settings = new JObject();
        foreach (var item in typeof(Settings).GetFields(BindingFlags.Public | BindingFlags.Static))
            settings[item.Name] = JToken.FromObject(item.GetValue(null));
        foreach (var item in typeof(Settings).GetProperties(BindingFlags.Public | BindingFlags.Static))
            settings[item.Name] = JToken.FromObject(item.GetValue(null));

        File.WriteAllText( path, settings.ToString());
    }
}
