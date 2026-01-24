import { Anchor, Handle } from "./objects.js";




export class AnimationTimeline {
    target;
    id;
    animationComposition;
    properties = {}; 
    canLoop = false; 

    constructor(targetEl, animationComposition = "add") {
        this.target = targetEl;
        this.animationComposition = animationComposition;
        this.id = targetEl.getAttribute("id");

        console.assert(this.id, "animation target needs an id");
    }
    addProperty(property) {
        this.properties[property.name] = property;
    }
    removeProperty(name) {
        delete this.properties[name];
    }
}




export class AnimProperty {
    name;
    keyframes = [];
    typeExtention;
    initialValue;
    target;
    targetFunction; 
    syntax;

    constructor({name, target, targetFunction= undefined, syntax, initialValue = undefined, typeExtention = undefined}) {
        // name of the property (can be user defined or made to follow some formula) xPos yPos etc 
        this.name = name;
        // type extention is (deg, px, rem, etc)
        this.typeExtention = typeExtention;
        // starting value (as the animations are additive by default, this should be 0 unless you need to alter its value)
        this.initialValue = initialValue;
        // target is the value its trying to change 
        // formatted as target:"transform" targetFunction:translateX 
        // to become transform: translateX(var(--${this.name})); 
        this.target = target;
        this.targetFunction = targetFunction; 

        // could be infered by extention (length, angle, color, etc)
        this.syntax = syntax;
    }

    addKeyframe(x, y) {
        const indexForX = this.findIndex(x);

        const node = new Anchor(x, y);
        const handle1 = new Handle(x - 10, y);
        const handle2 = new Handle(x + 10, y);

        const keyframe = new AnimKeyframe(node, handle1, handle2, true);

        if (indexForX < this.keyframes.length)
            this.keyframes.splice(indexForX, 0, keyframe);
        else
            this.keyframes.push(keyframe);
    }

    findIndex(x) {
        for (var i = 0; i < this.keyframes.length; i++) {
            if (x < this.keyframes[i].anchor.x)
                return i;
        }
        return this.keyframes.length;
    }
    bindPropertyInterface() {

    }

}


class AnimKeyframe {
    anchor;
    handleLeft; // handles
    handleRight; // handles 
    handlesParallel; // makes both handles aligned to the same point. 


    constructor(anchor, handleLeft, handleRight, handlesParallel = false) {
        this.anchor = anchor;
        this.handleLeft = handleLeft;
        this.handleRight = handleRight;
        this.handlesParallel = handlesParallel;
    }
}
