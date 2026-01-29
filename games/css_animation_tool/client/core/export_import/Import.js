import { AnimProperty } from "../animation.js";
import { StartLocalAutoSave } from "./Export.js";

window.loadFromFile = await loadFromFile;
window.LoadFromLocalStorage = LoadFromLocalStorage;





export function LoadFromLocalStorage(timeline) {
    const existingJSONProperties = JSON.parse(localStorage.getItem("timeline") || "{}")["properties"];
    // if it was able to load in an object with properties
    if (existingJSONProperties) {
        // goes through the entries and assigns them to a new animProperty so we can treat it like a class with local functions
        Object.entries(existingJSONProperties).map(([label, object]) => timeline.properties[label] = new AnimProperty(object));
    }
    return timeline;
}




export async function loadToTimelineFromFile(timeline) {
    const data = await loadFromFile();
    // TODO: write to timeline

    
}

export async function loadFromFile() {
    var file;

    // async gets file then returns 
    try {
        file = await NewLoad();
        ShowSaveIcon();
    } catch (err) {
        if (err.name != "AbortError") {
            file = await OldLoad(); // FALLBACK FOR FIREFOX/UNSUPPORTED BROWSERS
            ShowSaveIcon();
        }
        else
            console.warn(err);
    }
    return file;



    // CHROME ALLOWS ADVANCED SAVE FEATURES 
    async function NewLoad() {
        const [handle] = await window.showOpenFilePicker({
            types: [
                {
                    description: "JSON",
                    accept: { "application/json": [".json"] }
                }
            ]
        });
        const file = await handle.getFile();
        const text = await file.text();
        StartLocalAutoSave();
        return JSON.parse(text);
    }

    // FALLBACK FOR FIREFOX/UNSUPPORTED BROWSERS
    async function OldLoad() {
        return await new Promise(resolve => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = () => {
                resolve(JSON.parse(input.files[0]));
            };

            input.click();
        });
    }

}