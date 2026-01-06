
import {AnimProperty } from "./objects.js";

export function LoadFromLocalStorage(timeline) {
    const existingJSONProperties = JSON.parse(localStorage.getItem("timeline") || "{}")["animProperties"];
    // if it was able to load in an object with animProperties
    if (existingJSONProperties) {
        // goes through the entries and assigns them to a new animProperty so we can treat it like a class with local functions
        Object.entries(existingJSONProperties).map(([label, object]) =>   timeline.animProperties[label] = Object.assign(new AnimProperty(), object));
    }
}

export function SaveToLocalStorage(timeline) {
    localStorage.setItem("timeline", JSON.stringify(timeline));
}





export function GenerateCSS(timeline, globalChanges = {}) {

    var cssStringbuilder = [];
    var cssAnimationStringbuilder = [];
    // retrieve the AnimVal values and calls toString

    const animProperties = timeline.animProperties;
    Object.values(animProperties).forEach(animProperty => {

        console.log(animProperty);
        // 
        const animVal = animProperty.animVal;
        const keyframes = animProperty.keyframes;

        // adds the animation property values to the generated string; 
        const str = animVal.toString();
        cssStringbuilder.push(str);
        //console.log(str);

        // 
        var keyFramesStringbuilder = [];
        var animationStringbuilder = [];

        var i = 0;
        for (var i = 0; i < keyframes.length; i++) {
            var name = `${animProperty.name}${i}`;
            // generates the individual keyframe points
            keyFramesStringbuilder.push(`@keyframes ${name} {to {--${animVal.name}:${keyframes[i].anchor.y}${animVal.extention} }}`);

            // calculates 
            var secondsToNextKeyframe = CalculateSecondsToNextFrame(keyframes[i], keyframes[i + 1] || undefined);
            var curve = CalculateCurve(keyframes[i], keyframes[i + 1] || undefined);
            var offset = CalculateOffset(keyframes[i]);

            //if(curve)
            animationStringbuilder.push(`${name} ${secondsToNextKeyframe}ms ${curve} ${offset}ms forwards`);
        };

        var animString = animationStringbuilder.join(',');
        var keyframesString = keyFramesStringbuilder.join('\n');

        //console.log(animString);
        //console.log(keyframesString);

        cssStringbuilder.push(keyframesString);
        if (animString.trim().length !== 0)
            cssAnimationStringbuilder.push(animString);
    });

    // joins the properties into a single string created with a newline character.
    cssStringbuilder.push(`animation: ${cssAnimationStringbuilder.join(`,`)};`);

    return cssStringbuilder.join('\n');

    function CalculateOffset(keyframe1) {
        return (globalChanges["offset"] || 0) + keyframe1.anchor.x;
    }
}


function CalculateSecondsToNextFrame(frame1, frame2) {
    if (!frame2)
        return 0;
    var node1x = frame1.anchor.x;
    var node2x = frame2.anchor.x;
    return node2x - node1x;
}
function CalculateCurve(frame1, frame2) {

    if (!frame2)
        return;

    const p1 = frame1.anchor;
    const h1 = frame1.handleRight;

    const p2 = frame2.anchor;
    const h2 = frame2.handleLeft;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    // Choose primary axis; here: X
    const x1 = (h1.x - p1.x) / dx;
    const y1 = (h1.y - p1.y) / dy;

    const x2 = (h2.x - p1.x) / dx;
    const y2 = (h2.y - p1.y) / dy;

    // CSS constrains x position
    const cx1 = Math.max(0, Math.min(1, x1));
    const cx2 = Math.max(0, Math.min(1, x2));

    return `cubic-bezier(${cx1}, ${y1}, ${cx2}, ${y2})`;
}
