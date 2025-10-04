using System;
using System.Collections;
using System.Collections.Generic; 
using UnityEngine;
using UnityEngine.SceneManagement;


public class SceneCoordinator 
{
    static Dictionary<string,int> sceneDictionary = new (); 




    public static int curentLevel = -1;
    public static int loadingScreen =-1;
    public delegate void SceneChangeEvent();
    static public SceneChangeEvent cleanUpOnSceneExit;

    public static void Initialise()
    {
        GetUnloadedSceneInfo();
        curentLevel = -1;

        for (int i = 0; i < SceneManager.sceneCount; i++)
        {
            //Debug.LogError(UnityEngine.SceneManagement.SceneManager.GetSceneAt(i).name);
            var scene = SceneManager.GetSceneAt(i);
            if (scene.name != "Persistant")
                curentLevel = scene.buildIndex;
        }
        Debug.Log("curent level is " + curentLevel);
    }


    public static void GetUnloadedSceneInfo() {
        int sceneCount = SceneManager.sceneCountInBuildSettings;
        for (int i = 0; i < sceneCount; i++) {
            string scenePath = SceneUtility.GetScenePathByBuildIndex(i);
            sceneDictionary[System.IO.Path.GetFileNameWithoutExtension(scenePath)] = i;
        }
    }


    static public Promise WaitForPlayerInput() => Promise.WaitUntil(() => Input.anyKeyDown);

    static public AsyncOperation LoadScene(int scene) => SceneManager.LoadSceneAsync(scene, LoadSceneMode.Additive);
    static public AsyncOperation LoadScene(string scene) => LoadScene(GetSceneIndex(scene));

    static public AsyncOperation UnloadScene(int scene) => SceneManager.UnloadSceneAsync(scene); 
    static public AsyncOperation UnloadScene(string scene) => UnloadScene(GetSceneIndex(scene));



    public static bool SceneAlreadyOpened(string scene) => SceneAlreadyOpened(GetSceneIndex(scene));
        public static bool SceneAlreadyOpened(int sceneBuildIndex) {
        for (int i = 0; i < SceneManager.sceneCount; i++) 
            if (SceneManager.GetSceneAt(i).buildIndex == sceneBuildIndex)
                return true; 
        return false; 
    }


    public static int GetSceneIndex(string scene) => sceneDictionary[scene];
   


    static public Promise ReloadScene() {
        var p = new Promise();
        if (curentLevel > 1) {
            UnloadScene(curentLevel).completed += (e) => {
                LoadScene(curentLevel).completed += (e) => p.Resolve();
            };
        }
        else {
            Promise.Wait(0f).then(p.Resolve);
        }
        return p;
    }

    static public Promise LoadLevel(string scene, bool becomesActiveScene = true) => LoadLevel(GetSceneIndex(scene),  becomesActiveScene);
    static public Promise LoadLevel(int scene, bool becomesActiveScene = true) {

        Debug.Log($"Loading level  {scene})");

        var p = new Promise();
        int loaded = 0;

        // adds the loading screen 
        var currentLoadingScreen = loadingScreen;
        LoadScene(currentLoadingScreen).completed += (e) => {
            Debug.Log("showing the loading screen");
            Debug.Log("unloading scene" + curentLevel);

         

          
            if (curentLevel < 0 || !SceneAlreadyOpened(curentLevel))
                loaded++;
            else {
                var async = UnloadScene(curentLevel);
                async.completed += (e) => { loaded++; Debug.Log("unloaded the curent scene"); };
            }
            
            LoadScene(scene).completed += (e) => { loaded++; Debug.Log("loaded the new scene"); };
        };

    

        // promise waits for new scene to be loaded and old scene to be unloaded before removing the loading screen and finally resolving
        Promise.WaitUntil(() => loaded == 2).then(() => {
            curentLevel = scene;
            UnloadScene(currentLoadingScreen).completed += (e) => p.Resolve();
        });
        return p;
    }


    /*
     // DEGUGGING PUROSES
     
         for (int i = 0; i < SceneManager.sceneCount; i++) {

             var s = SceneManager.GetSceneAt(i);
             if (s.buildIndex == curentLevel) {
                 Debug.Log($"active Scenes have {s.name} : {s.buildIndex} , is loaded = {s.isLoaded} ");
             }
         }
         */



    /*
    the idea is that we load the cutscene and play it while unload the current scene and loading in the next one. 
    then when its finished you need to resolve "resolveWhenFinishedWithCutscene"
    in order to unload the cutscene and transition back to the final screen. 
     */
    static public Promise TransitionScene(int transition , int scene, ref Promise resolveWhenFinishedWithCutscene) {

        Debug.Log($"Loading transition {transition} then level {scene})");
        var p = new Promise();
        int loaded = 0;

        // adds the loading screen 
        LoadScene(transition).completed += (e) => {
            Debug.Log("showing the loading screen");
            UnloadScene(curentLevel).completed += (e) => { loaded++; Debug.Log("unloaded the curent scene"); };
            LoadScene(scene).completed += (e) => { loaded++; Debug.Log("loaded the new scene"); };
        };

        // promise waits for new scene to be loaded and old scene to be unloaded before removing the loading screen and finally resolving
        resolveWhenFinishedWithCutscene.then(() => { loaded++; }); 


        Promise.WaitUntil(() => loaded == 3).then(() => {
            curentLevel = scene; 
            UnloadScene(transition).completed += (e) => p.Resolve();
        });

        return p;
    }

}
