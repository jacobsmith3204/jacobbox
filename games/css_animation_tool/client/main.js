import { TimelineRenderer } from "./core/renderer.js";
// initialises some stuff
import { } from "./core/objects.js";
import { } from "./core/drawingFunctions.js";  
// load and save scripts
import { SaveAsFile, SaveToLocalStorage } from "./core/export_import/Export.js";
import { loadFromFile, LoadFromLocalStorage, loadToTimelineFromFile } from "./core/export_import/Import.js";
import { GenerateCSS } from "./core/export_import/ExportCSS.js";

// 
import { UpdateDocumentToCurrentAnimation , UpdateDocumentToExistingProperties} from "./interface/interfaceBuilder.js";
import { AnimationTimeline } from "./core/animation.js";







const renderer = window.renderer = new TimelineRenderer(document.getElementById("timelineCanvas"));
const timeline = window.timeline = new AnimationTimeline(document.getElementById("object"));
renderer.timeline = timeline;





document.getElementById("loadFileBtn").addEventListener("click", () => {
   loadToTimelineFromFile(timeline); 
});

document.getElementById("saveFileBtn").addEventListener("click", () => {
   SaveAsFile(timeline); 
});

// click generates css and writes it to the clipboard 
document.getElementById("copyCssBtn").addEventListener("click", () => {
    SaveToLocalStorage(timeline); // saved version will be in json
    // copied version is the full css to paste
    const cssText = GenerateCSS(timeline);
    navigator.clipboard.writeText(cssText)
        .then(() => console.log("saved sucessfully: ", cssText.toString()))
        .catch(err => console.error("couldnt copy text: ", err))
});





const useLocalStorage = localStorage.getItem("timeline") != null;
console.log(` ${useLocalStorage? "loading from local storage": "creating new using document to get properties"}`); 

if (useLocalStorage){
    LoadFromLocalStorage(timeline);
    UpdateDocumentToCurrentAnimation(timeline);
}
else{
    UpdateDocumentToExistingProperties(timeline); 
    timeline.properties["tx"].addKeyframe(0,1);
    timeline.properties["tx"].addKeyframe(1,2);
}

   


// TODO: add playback feature. 








// adds some extra functionality to the console. 
window.clearKeyframes = ()=> Object.values(renderer.timeline.properties).map(property => property.keyframes = []); 