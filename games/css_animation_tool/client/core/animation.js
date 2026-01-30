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
    color;
    showHandles;

    constructor({ name, target, targetFunction = undefined, syntax, initialValue = undefined, typeExtention = undefined, color = undefined, keyframes = undefined }) {
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
        this.color = color;

        // could be infered by extention (length, angle, color, etc)
        this.syntax = syntax;

        if (keyframes)
            for (const keyframe of keyframes) {
                this.keyframes.push(this.parseKeyframe(keyframe));
            }
    }


    parseKeyframe({ anchor, handleLeft, handleRight, handlesParallel }) {
        return new AnimKeyframe(
            new Anchor(anchor.x, anchor.y),
            new Handle(handleLeft.x, handleLeft.y),
            new Handle(handleRight.x, handleRight.y),
            handlesParallel);
    }

    addKeyframe(x, y) {
        const indexForX = this.findIndex(x);

        const node = new Anchor(x, y);
        const handle1 = new Handle(x - 1, y);
        const handle2 = new Handle(x + 1, y);

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

    sampleAnimation(x) {
        // if there no animation we default to the initial value

        //console.log(`sampling animation ${this.name}: ${this.keyframes.length} at ${x}`); 

        const keyframes = this.keyframes; 
        if (keyframes.length == 0){
            //console.log("returned inital value"); 
            return this.initialValue;
        }

        const index = this.findIndex(x);
        //console.log(`${x} gives index ${index}`); 

        
        // if its before the first keyframe
        if(index <= 0)
            return keyframes[0].anchor.y; 
        // if its beyond the last keyframe 
        if (index >= keyframes.length){
            //console.log("returned last value"); 
            return keyframes[keyframes.length - 1].anchor.y;
        }
       
        // sample the curve between these points
        return sampleCurve();

        function sampleCurve() {
            const first = keyframes[index - 1];
            const last = keyframes[index];

            // gets nodes
            const n1 = first.anchor; 
            const h1 = first.handleRight; 
            const h2 = last.handleLeft; 
            const n2 = last.anchor; 
            
            
            const curve1D = makeCurve(n1, h1, h2, n2);
            return  curve1D.eval(x); 
        }
    }
}


function makeCurve(n1, h1, h2, n2) {
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    if (Math.abs(dx) < 1e-6) return null;

    const cx1 = (h1.x - n1.x) / dx;
    const cx2 = (h2.x - n1.x) / dx;

    const cy1 = (h1.y - n1.y) / dy;
    const cy2 = (h2.y - n1.y) / dy;

    const ease = makeEase(cx1, cy1, cx2, cy2);

    return {
        x0: n1.x,
        x1: n2.x,
        y0: n1.y,
        y1: n2.y,

        eval(x) {
            const t = (x - this.x0) / (this.x1 - this.x0);
            const y = ease(t);
            return this.y0 + y * (this.y1 - this.y0);
        }
    };
}

function makeEase(cx1, cy1, cx2, cy2) {
    const cx = 3 * cx1;
    const bx = 3 * (cx2 - cx1) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * cy1;
    const by = 3 * (cy2 - cy1) - cy;
    const ay = 1 - cy - by;

    function sampleX(t) {
        return ((ax * t + bx) * t + cx) * t;
    }

    function sampleY(t) {
        return ((ay * t + by) * t + cy) * t;
    }

    function sampleXDerivative(t) {
        return (3 * ax * t + 2 * bx) * t + cx;
    }

    return function ease(x) {
        let t = x;
        for (let i = 0; i < 5; i++) {
            const d = sampleXDerivative(t);
            if (Math.abs(d) < 1e-6) break;
            t -= (sampleX(t) - x) / d;
        }
        return sampleY(t);
    };
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
