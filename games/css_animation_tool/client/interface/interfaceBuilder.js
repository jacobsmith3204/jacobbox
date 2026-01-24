import { AnimProperty } from "../core/animation.js";



// dropdown for adding a target object to assign the animations to. 
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












// if there is no local timeline data we can use this as a demo to create the animation properties 
const propertyAttributes = ["name", "syntax", "initialValue", "typeExtention", "target", "targetFunction"];

export function createAnimPropertiesFromDocument() {
    const animVals = Array.from(document.getElementById("animVals").children);
    return animVals.map(el => {
        const property = new AnimProperty({});

        for (const attribute of propertyAttributes) {
            property[attribute] = el.getAttribute(attribute);
        }
        BindPropertyControls(el);
        return property;
    });
}

// if there was local timeline data we can use this to bind the correct property labels and controls etc. 
export function UpdateDocumentToCurrentAnimation(currentAnimationTimeline) {
    // clear all documents currently in anim vals 
    const parent = document.getElementById("animVals");
    parent.innerHTML = "";

    // for each of the properties in current animation timeline. 
    // create a new element and bind it to the property 
    // push to the parent el. 
    for (const property of currentAnimationTimeline.properties) {
        const el = CreatePropertyElement(property);
        BindPropertyControls(el); 
        parent.appendChild(el);
    }
}


// TODO: allows us to make the property checkbox control the visiblity of the graph 
function BindPropertyControls(el) {
    el.childNodes.item(0).addEventListener("change", ToggleTimelineGraphView)
    el.addEventListener("contextmenu", ShowContextMenu);

    function ToggleTimelineGraphView(event) {
        if (event.target.checked) {
            // make nodes on graph visible
            console.log("input was enabled");
        }
        else {
            // make nodes on graph invisible
        }
    }
    function ShowContextMenu(event) {
        event.preventDefault(); 
        /// show form/dropdown to adjust defaults. 
    }
}





//<li class="animVal" name="tx" property="length" ,="" default="0" extention="px"> <input type="checkbox">  tx  <colorswatch></colorswatch> </li>

// pass in a property and it will create the object. 
function CreatePropertyElement(property) {
    const el = document.createElement("li");
    // adds elements 
    for (const attribute of propertyAttributes) {
        el.setAttribute(attribute, property[attribute]);
    }
    // adds input
    const input = document.createElement("input");
    input.setAttribute("type", "checkbox");

    el.appendChild(input);
    el.appendChild(document.createTextNode(property.name)); 
    el.appendChild(document.createElement("colorSwatch"));

    return el; 
}





//createAnimPropertiesFromDocument().map(property => {timeline.addProperty(property)})
window.createAnimPropertiesFromDocument = createAnimPropertiesFromDocument; 