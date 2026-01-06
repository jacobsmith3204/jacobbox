import { AnimProperty } from "../core/objects.js";

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


export function createAnimPropertiesFromDocument() {
    const animVals = document.getElementsByClassName("animVal");
    return Array.from(animVals).map(el => new AnimProperty(el.getAttribute("name"), el.getAttribute("property"), el.getAttribute("default"), el.getAttribute("extention")));
}

