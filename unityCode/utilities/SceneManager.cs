using System;
using UnityEngine;
using UnityEngine.SceneManagement;

public partial class MenuSceneManager
{
    static public Promise WaitForPlayerInput() => new Promise((resolve) => { if (Input.anyKeyDown) resolve(); });
    static public Promise LoadScene(int scene) => DoThingWhenFinishedLoaded(SceneManager.LoadSceneAsync((int)scene, LoadSceneMode.Additive), p => Debug.Log(p));
    static public Promise UnloadScene(int scene) => DoThingWhenFinishedLoaded(SceneManager.UnloadSceneAsync((int)scene), p => Debug.Log(p));
    static public Promise DoThingWhenFinishedLoaded(AsyncOperation a, Action<float> update = null) => new Promise((resolve) => { if (a.isDone) resolve(); else update?.Invoke(a.progress); });
    static public Promise ReloadScene(int scene) => new Promise(resolve => { UnloadScene(scene).then(() => { LoadScene(scene).then(() => { resolve(); }); }); });
}