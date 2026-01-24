import {AnimProperty } from "./animation.js";


export function LoadFromLocalStorage(timeline) {
    const existingJSONProperties = JSON.parse(localStorage.getItem("timeline") || "{}")["properties"];
    // if it was able to load in an object with properties
    if (existingJSONProperties) {
        // goes through the entries and assigns them to a new animProperty so we can treat it like a class with local functions
        Object.entries(existingJSONProperties).map(([label, object]) =>   timeline.properties[label] = new AnimProperty(object));
    }
}
export function SaveToLocalStorage(timeline) {
    localStorage.setItem("timeline", JSON.stringify(timeline));
}





window.LoadFromLocalStorage  = LoadFromLocalStorage; 
window.SaveToLocalStorage = SaveToLocalStorage; 
