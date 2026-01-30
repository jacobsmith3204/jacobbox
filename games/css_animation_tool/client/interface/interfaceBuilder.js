import { AnimProperty } from "../core/animation.js";

window.createAnimPropertiesFromDocument = createAnimPropertiesFromDocument;

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
const propertyAttributes = ["name", "syntax", "initialValue", "typeExtention", "target", "targetFunction", "color"];


export function UpdateDocumentToExistingProperties(timeline) {

    // adds the created properties to the timeline.
    createAnimPropertiesFromDocument().map(property => { timeline.addProperty(property) });
}
export function createAnimPropertiesFromDocument() {
    // creates properties by fetching all children of animVals. and getting the propertyAttrinbutes from them
    const animVals = Array.from(document.getElementById("animVals").children);
    return animVals.map(el => {
        const property = new AnimProperty({});

        for (const attribute of propertyAttributes) {
            property[attribute] = el.getAttribute(attribute);
        }
        BindPropertyControls(el, property);
        UpdateProperty(el, property);
        return property;
    });
}


// if there was local timeline data we can use this to bind the correct property labels and controls etc. 
export function UpdateDocumentToCurrentAnimation(timeline) {
    // clear all documents currently in anim vals 
    const parent = document.getElementById("animVals");
    parent.innerHTML = "";

    // for each of the properties in current animation timeline. 
    // create a new element and bind it to the property 
    // push to the parent el. 
    for (const property of Object.values(timeline.properties)) {
        const el = CreatePropertyElement(property);
        BindPropertyControls(el, property);
        UpdateProperty(el, property);
        parent.appendChild(el);
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

    UpdateProperty(el, property);

    return el;
}

function UpdateProperty(el, property) {
    el.childNodes.item(1).innerText = property.name;
    el.childNodes.item(2).style = `background: ${property.color || `#F00`}`;
}




function BindPropertyControls(el, property) {
    if (!property)
        return;

    el.childNodes.item(0).addEventListener("change", ToggleTimelineGraphView);


    el.addEventListener("contextmenu", ShowContextMenu);

    function ToggleTimelineGraphView(event) {
        if (event.target.checked) {
            // make nodes on graph visible
            console.log("input was enabled");
            property.showHandles = true;

        }
        else {
            property.showHandles = false;
            // make nodes on graph invisible
        }
    }

    function ShowContextMenu(event) {
        event.preventDefault();
        /// show form/dropdown to adjust defaults. 
    }
}






// popup using <dialog> 
const popup = document.getElementById('popup');

// Close when clicking outside content
popup.addEventListener('click', (e) => {
    popup.close();
});

// Optional: close on Esc
popup.addEventListener('cancel', (e) => {
    popup.close();
});


export function ShowContextMenu(event, buttons) {
    event.preventDefault();
    // place at cursor  
    console.log(event);
    popup.showModal();

    const rect = popup.getBoundingClientRect();
    const dx = event.clientX - (window.innerWidth / 2);
    const dy = event.clientY - (window.innerHeight / 2);
    popup.style.transform = `translate(${dx}px, ${dy}px)`;

    // Clear previous button elements
    const btnContainer = document.getElementById("popupOptions");
    btnContainer.querySelectorAll('button').forEach(btn => {
        btn.remove();
    });

    // Add new button elements. 
    buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.textContent = b.label;
        btn.onclick = b.onClick;
        btnContainer.appendChild(btn);
    });
}

