import {TimelineRenderer} from "./renderer.js";  
import { Timeline, AnimProperty} from "./core/objects.js";
import {} from "./core/drawingFunctions.js"; // initialises some stuff 



// add functionallity to buttons 
const dropdown = document.getElementById("objectDropdown");
const field = document.getElementById("addObjectField");
const newObjectIdInput = document.getElementById("newObjectId");


dropdown.addEventListener('onchange', ToggleAddObjectField);
function ToggleAddObjectField() {
    // checks if the selected option is "addObject" and makes it visible based on that 
    console.log("changed");
    const option = dropdown.options[dropdown.options.selectedIndex];
    field.style = option.value == "addObject" ? "" : "display:none;";
}
ToggleAddObjectField();



field.addEventListener('onSubmit', (event)=> { 
    event.preventDefault(); 
    AddObjectFromId(Object.fromEntries(new FormData(this)).id);
});
function AddObjectFromId(id) {
    console.log("adding", id);
    // makes sure there won't be duplicates
    for (let i = 0; i < dropdown.options.length; i++) {
        if (dropdown.options[i].value === id) {
            console.warn("object already exists")
            return;
        }
    }
    // adds the item to the list

    var el = document.createElement("option", { value: id });
    el.innerText = id;
    dropdown.appendChild(el);

    newObjectIdInput.value = "";
    dropdown.selectedIndex = dropdown.options.length - 1;
    ToggleAddObjectField();
}





const renderer = new TimelineRenderer(document.getElementById("timelineCanvas"));
const timeline = new Timeline();


const animVals = document.getElementsByClassName("animVal"); 
Array.from(animVals).forEach(el => {
    console.log(el);

    var animProperty = new AnimProperty(el.getAttribute("name"), el.getAttribute("property"), el.getAttribute("default"), el.getAttribute("extention"));
    timeline.animProperties[el.getAttribute("name")] = animProperty;
});



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