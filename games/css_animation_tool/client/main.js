import { TimelineRenderer } from "./renderer.js";
import { } from "./core/objects.js";
import { } from "./core/drawingFunctions.js"; // initialises some stuff 
import {LoadFromLocalStorage, SaveToLocalStorage} from "./core/io_localStorage.js";
import { GenerateCSS } from "./core/exporter.js";
import {  } from "./interface/interfaceBuilder.js";
import {AnimationTimeline} from "./core/animation.js";


// add functionallity to buttons 
const addObjectButton = document.getElementById("addObjectButton");
const addObjectForm = document.getElementById("addObjectForm");
const newObjectIdInput = document.getElementById("newObjectId");
const saveButton = document.getElementById("saveButton");


addObjectButton.addEventListener('click', ()=> console.warn("button does nothing..."));


saveButton.addEventListener("click", () => {
    SaveToLocalStorage(timeline); // saved version will be in json
    // copied version is the full css to paste
    const cssText = GenerateCSS(timeline);
    navigator.clipboard.writeText(cssText)
        .then(() => console.log("saved sucessfully: ", cssText.toString()))
        .catch(err => console.error("couldnt copy text: ", err))
});



const renderer = window.renderer = new TimelineRenderer(document.getElementById("timelineCanvas"));
const timeline = window.timeline = new AnimationTimeline(document.getElementById("object"));


LoadFromLocalStorage(timeline);



timeline.properties["tx"].addKeyframe(1,1);
timeline.properties["tx"].addKeyframe(100,1);

console.log(timeline.properties["tx"]);
