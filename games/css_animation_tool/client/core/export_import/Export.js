

window.SaveToLocalStorage = SaveToLocalStorage;
window.SaveToFile = SaveToFile;

// ctrl + s: to save 
window.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();

        // ctrl + shift + s :  to save as. 
        if (e.shiftKey)
            SaveAsFile();
        else
            SaveToFile();
    }
});


function GetSaveContent() {
    return JSON.stringify({ test: "hello world" });
}






export function SaveToLocalStorage(timeline) {
    localStorage.setItem("timeline", JSON.stringify(timeline));
}





//#region  AUTOSAVE 
var runningAutoSave = undefined;
export function StartLocalAutoSave() {
    if (!runningAutoSave)
        runningAutoSave = setInterval(LocalAutoSave, 20000, 20000);
}
function LocalAutoSave() {
    content = GetSaveContent();
    localStorage.setItem("localAutoSave", JSON.stringify(content)); 
}

function StartAutoSave() {
    if (!runningAutoSave)
        runningAutoSave = setInterval(AutoSave, 20000, 20000); 
}
function AutoSave() {
    // saves whatever is in the current handle. 
    if (saveHandle)
        SaveToFile();
    else {
        clearInterval(runningAutoSave);
        runningAutoSave = undefined;
    }
}
//#endregion 

// Loading ICON
document.getElementById("loading-icon").style.opacity = "0";
function ShowSaveIcon() {
    document.getElementById("loading-icon").style.opacity = "1";
    setTimeout(() => { document.getElementById("loading-icon").style.opacity = "0"; }, 1000);
}



//#region  SAVE TO DEVICE 
var saveHandle;
// force shows a display window
export async function SaveAsFile(content) {
    saveHandle = undefined; // resets to guarantee prompt
    return SaveToFile(content);
}


export async function SaveToFile(content, suggestedName = "animation.json") {
    // pulls the current timeline in the correct json.stringified format
    content ||= GetSaveContent();
    const blob = new Blob([content], { type: "application/json" });
    // attempts the new save otherwise fallback to old
    try {
        await NewSave();
        ShowSaveIcon();
    } catch (err) {
        console.log(err);
        if (err.name != "AbortError" && err.name != "SecurityError") {
            // if the user didnt cancel the request then we use the fallback version
            OldSave();
            ShowSaveIcon();
        }
        else
            console.warn(err);
    }


    // CHROME ALLOWS ADVANCED SAVE FEATURES 
    async function NewSave() {
        // saveHandle allows it to skip the context window the next time we try save; 
        const handle = saveHandle || (saveHandle = await window.showSaveFilePicker({
            suggestedName,
        }));

        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();

        // starts an autosave every 20 seconds if not already running 
        StartAutoSave();
    }

    // FALLBACK FOR FIREFOX/UNSUPPORTED BROWSERS
    function OldSave() {
        console.warn("using save fallback (no autosave functionality)");
        const a = document.createElement("a");
        const url = URL.createObjectURL(blob);

        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}
//#endregion