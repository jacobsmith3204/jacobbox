
// handles the exporting of the animation curves to css
var globalChanges = {}; 
export function GenerateCSS(animationTimeline, _globalChanges = {}) {
    globalChanges = _globalChanges; 

    var cssStringbuilder = [];
    var cssAnimationStringbuilder = [];
    // retrieve the AnimVal values and calls toString

    const properties = Object.values(animationTimeline.properties); 

    for (const property of properties) {
        console.log(property);


        // adds the animation property values to the generated string; 
        cssStringbuilder.push(propertyString(property));
        cssStringbuilder.push(keyframesString(property));
        cssAnimationStringbuilder.push(animationString(property));
    }
    // adds the portion of the code that maps the variables to the transform/color/etc 
    const targets = bindTargets(properties);
    

    // final string of everything for this one timeline ready to copy into the css file. 
    return `
        ${cssStringbuilder.join('\n')}
        #${animationTimeline.id} {
            ${targets}
            animation: ${cssAnimationStringbuilder.filter(Boolean).join(',')};
            animation-itteration-count: ${animationTimeline.canLoop ? "infinite" : "1"}; 
            animation-composition: ${animationTimeline.animationComposition}; 
        }
    `;
}

// needs to generate something like
// transform: translateX(var(--tx)) translateY(var(--ty)) rotate(var(--r));
// but should also be able to handle color etc
function bindTargets(properties) {
    const targets = {};

    // creates lists per targeted css variable, adding each property variable. 
    for (const property of properties) {
        // get the array at targets[name of target] or creates one and gets it 
        const targetArray = targets[property.target] || (targets[property.target] = []);

        // if its transform: 'translateX()' then we need to wrap it in a 
        if (property.targetFunction)
            targetArray.push(`${property.targetFunction}(var(--${property.name}))`);
        else
            targetArray.push(`var(--${property.name})`);
    }
    console.log(targets);

    // then we create the variable bindings, with their new values and turn in all into a string. 
    return Object.entries(targets).map(([key, value]) => `${key}: ${value.filter(Boolean).join(" ")};`).join("\n");
}


function propertyString(property) {
    return `@property ${property.name} { syntax: '<${property.syntax}>'; inherits: true; initial-value:${property.initialValue}${property.typeExtention} }`;

}
function keyframesString(property) {
    const keyframes = property.keyframes;
    const list = [];
    for (var i = 0; i < keyframes.length; i++) {
        list.push(`@keyframes ${property.name}${i} {to {--${property.name}:${keyframes[i].anchor.y}${property.extention} }}`);
    }
    return list.join("\n");
}


function animationString(property) {
    // calculates 
    const list = [];
    const keyframes = property.keyframes;

    for (var i = 0; i < keyframes.length; i++) {
        const secondsToNextKeyframe = CalculateSecondsToNextFrame(keyframes[i], keyframes[i + 1] || undefined);
        const curve = CalculateCurve(keyframes[i], keyframes[i + 1] || undefined);
        const offset = CalculateOffset(keyframes[i]);

        list.push(`${property.name}${i} ${secondsToNextKeyframe}ms ${curve} ${offset}ms forwards`);
    }
    return list.filter(Boolean).join(`,`);



    // some helper functions for generating the correct values; 
    function CalculateOffset(keyframe1) {
        return (globalChanges?.["offset"] || 0) + keyframe1.anchor.x;
    }
    function CalculateSecondsToNextFrame(frame1, frame2) {
        if (!frame2)
            return 0;
        var node1x = frame1.anchor.x;
        var node2x = frame2.anchor.x;
        return node2x - node1x;
    }

    // curve to css besier-curve 
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
}