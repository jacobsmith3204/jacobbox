import { TimelineRenderer } from "./renderer.js";
import { Timeline } from "./core/objects.js";
import { } from "./core/drawingFunctions.js"; // initialises some stuff 
import { LoadFromLocalStorage, SaveToLocalStorage, GenerateCSS } from "./core/exporter.js";
import { createAnimPropertiesFromDocument } from "./interface/interfaceBuilder.js";



// add functionallity to buttons 
const addObjectButton = document.getElementById("addObjectButton");
const addObjectForm = document.getElementById("addObjectForm");
const newObjectIdInput = document.getElementById("newObjectId");
const saveButton = document.getElementById("saveButton");


addObjectButton.addEventListener('click', ShowAddObjectForm);
function ShowAddObjectForm() { 
    console.warn("button does nothing...");
}

saveButton.addEventListener("click", () => {
    SaveToLocalStorage(timeline); // saved version will be in json
    // copied version is the full css to paste
    const cssText = GenerateCSS(timeline);
    navigator.clipboard.writeText(cssText)
        .then(() => console.log("saved sucessfully: ", cssText.toString()))
        .catch(err => console.error("couldnt copy text: ", err))

});


/*
addObjectForm.addEventListener('onSubmit', (event)=> { 
    event.preventDefault(); 
    AddObjectFromId(Object.fromEntries(new FormData(this)).id);
});
*/








const renderer = window.renderer = new TimelineRenderer(document.getElementById("timelineCanvas"));
const timeline = window.timeline = new Timeline();


LoadFromLocalStorage(timeline);



timeline.animProperties["tx"].addKeyframe(1,1);
timeline.animProperties["tx"].addKeyframe(100,1);

console.log(timeline.animProperties["tx"]);


// 
//createAnimPropertiesFromDocument().forEach(animProperty => timeline.animProperties[animProperty.name] = animProperty);










/*

var xValProperty = timeline.animProperties["tx"];

xValProperty.showHandles = true;
xValProperty.addKeyframe(0, 0);
xValProperty.addKeyframe(210, 20);
xValProperty.addKeyframe(300, -20);
xValProperty.addKeyframe(500, 40);

renderer.addElements([xValProperty]);
v


*/