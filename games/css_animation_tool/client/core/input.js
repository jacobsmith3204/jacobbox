import { StateSystem, StateList, State } from "./StateMachine.js";
import { ShowContextMenu } from "../interface/interfaceBuilder.js";



export class Input {
    renderer;
    canvas;

    mouseX;
    mouseY;
    rawMouseX;
    rawMouseY;



    stateSystem = new StateSystem(this);
    set state(newState) { this.stateSystem.set(newState) };
    get state() { return this.stateSystem.currentState };




    constructor(renderer) {
        const canvas = this.canvas = renderer.canvas;
        this.renderer = renderer;
        const input = this;


        // needed an up to date mouse x and y, as the onStart dont have a referance. 
        canvas.addEventListener("mousemove",
            (e) => {

                const mx = input.rawMouseX = e.clientX;
                const my = input.rawMouseY = e.clientY;

                input.mouseX = (mx - canvas.offsetLeft) - input.renderer.xpos;
                input.mouseY = (my - canvas.offsetTop) - input.renderer.ypos;
                //console.log(input, "updated mouse positions");
            });

        // adds the events based on their label
        const events = ['mousedown', 'mousemove', 'mouseleave', 'mouseenter', 'mouseup', 'contextmenu', 'wheel', 'focus'];
        events.map(e => {
            const label = e;
            canvas.addEventListener(label, (event) => {
                //console.log("captured event: ", event);
                input.stateSystem.call(label, event);
            });
        });
        // sets the initial state to 0/(default); 
        input.state = 0;
    }


    // allows us to define spesific states the 
    static STATES = new StateList({
        default: new State("default", {
            wheel: this.handleScrollWheel,
            mousedown: this.mousedownDecideNextState,
            contextmenu: this.ContextMenu
        }),
        navigatingCanvas: new State("navigatingCanvas", {

            onStart: this.startNavigation,
            onExit: this.endNavigation,
            mousemove: this.updateNavigation,
            mouseleave: function () { this.state = "default" },
            mouseup: function () { this.state = "default" },
            wheel: this.handleScrollWheel,

        }),
        movingNode: new State("movingNode", {
            mousemove: this.dragNode,
            mouseleave: function () { this.state = "default" },
            mouseup: function () { this.state = "default" },
            update: function () { this.testPositionOfNode(Object.values(this.renderer.timeline.properties)[0].keyframes[0].anchor) }
        }),
        contextMenu: new State("contextMenu", {
            mouseleave: function () { console.log("left context"); this.state = "default" },
            mouseup: function () { console.log("context mouseup"); this.state = "default" },

        }),
    });


    static mousedownDecideNextState(event) {
        //console.log(event)

        if (event.button !== 0) // not left button pressed 
            return;

        this.nodeTarget = this.MouseOnNode(true);
        if (this.nodeTarget) {
            // if clicking on a node
            this.state = "movingNode";
        }
        else {
            // if not clicking on anything important then we do normal canvas navigation
            this.state = "navigatingCanvas";
        }
    }


    static ContextMenu(event) {
        // based on the context we add buttons. 
        // get buttons from context; 
        const buttons = [];
        // x and y should be in object space 
        const x = this.mouseX; 
        const y = this.mouseY;
        const node = this.MouseOnNode(false);

        if (!node)
            buttons.push({ label: 'Add node', onClick: ()=> this.insertKeyframeAnchorsOnSelectedAt(x) });
        if (node) {
            buttons.push({ label: 'Remove node', onClick: ()=> this.removeKeyframeAnchor(x,y) });
        }

        // then we show the context menu; 
        ShowContextMenu(event, buttons);
        this.state = "contextMenu";
    }


    insertKeyframeAnchorsOnSelectedAt(x) {

        // for each property selected, find y at current x. and insert a keyframe at that point. 
        const timeline = this.renderer.timeline;
        for (const property of Object.values(timeline.properties)) {
            if (!property.showHandles)
                continue;
            const y = property.sampleAnimation(x / this.renderer.gridSizeX);
            property.addKeyframe(x,y); 
        }
    }

    removeKeyframeAnchor() {
        const timeline = this.renderer.timeline;
        for (const property of Object.values(timeline.properties)) {
            if (!property.showHandles)
                continue;

            for (const i in property.keyframes) {
                if (this.testPositionOfNode(property.keyframes[i].anchor)) {
                    // removes the overlapping node the returns as to only effect 1 node. 
                    property.keyframes.splice(i, 1);
                    return; 
                }
            }
        }
    }




    // #region STANDARD NAVIGATION 
    static handleScrollWheel(event) {

        if (event.altKey) {
            event.preventDefault();
            this.handleScrollMovement(event);
        }
        else
            this.handleZoom(event);
    }

    handleScrollMovement(event) {
        //console.log("Window scrolled!", event);
        this.renderer.originX += event.wheelDelta * this.renderer.scaleX;
    }


    handleZoom(event) {
        event.preventDefault();

        const mx = this.mouseX;
        const my = this.mouseY;

        const sensitivity = 0.001;
        const zoomFactor = Math.exp(event.wheelDelta * sensitivity);

        const oldScaleX = this.renderer.scaleX;
        const oldScaleY = this.renderer.scaleY;

        const newScaleX = oldScaleX * zoomFactor;
        const newScaleY = oldScaleY * zoomFactor;

        // world position under mouse (origin already removed)
        const wx = mx / oldScaleX;
        const wy = my / oldScaleY;


        //update and re-anchor origin (screen space) 
        // allows shift and ctrl to isolate scales

        if (!event.shiftKey) {
            this.renderer.scaleX = newScaleX;
            this.renderer.originX -= wx * (newScaleX - oldScaleX);
        }
        if (!event.ctrlKey) {
            this.renderer.scaleY = newScaleY;
            this.renderer.originY -= wy * (newScaleY - oldScaleY);

        }

    }


    dragStartX;
    dragStartY;
    static startNavigation() {
        //console.log("start" , this.renderer.xpos, this.renderer.ypos);
        this.dragStartX = this.rawMouseX;
        this.dragStartY = this.rawMouseY;
    }
    static updateNavigation() {
        this.renderer.dragX = this.rawMouseX - this.dragStartX;
        this.renderer.dragY = this.rawMouseY - this.dragStartY;


    }
    static endNavigation() {

        // adds the most up to date dragX and Y to origin
        this.renderer.originX += this.rawMouseX - this.dragStartX;
        this.renderer.originY += this.rawMouseY - this.dragStartY;
        // resets 
        this.renderer.dragX = 0;
        this.renderer.dragY = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;

        //console.log("end ", this.renderer.xpos, this.renderer.ypos);
    }
    //#endregion




    nodeTarget;
    static dragNode() {
        //console.log("dragging node ", event);

        var el = this.nodeTarget;

        // mouse position in canvas
        const mx = this.mouseX;
        const my = this.mouseY;

        el.x = mx / this.renderer.gridSizeX;
        el.y = my / this.renderer.gridSizeY;
    }




    MouseOnNode(includeHandles = false) {
        const timeline = this.renderer.timeline;

        for (const property of Object.values(timeline.properties)) {
            if (!property.showHandles)
                continue;

            for (const keyframe of property.keyframes) {

                if (this.testPositionOfNode(keyframe.anchor))
                    return keyframe.anchor;
            }
            if (includeHandles)
                for (const keyframe of property.keyframes) {
                    if (this.testPositionOfNode(keyframe.handleLeft))
                        return keyframe.handleLeft;
                    if (this.testPositionOfNode(keyframe.handleRight))
                        return keyframe.handleRight;
                }
        }
    }

    testPositionOfNode({ x, y }, mx, my) {
        // sets mx to mouseX if no value is passed in
        mx ||= this.mouseX; 
        my ||= this.mouseY; 
        /*
        // debugging purposes
        this.renderer.ctx.resetTransform();
        this.renderer.ctx.fillText("BB", mx + this.renderer.xpos, my + this.renderer.ypos);
        this.renderer.ctx.fillText("AA", (x * this.renderer.gridSizeX) + this.renderer.xpos, (y * this.renderer.gridSizeY) + this.renderer.ypos); 
        this.renderer.ctx.fillText(`${mx} ${my}`, 100, 100);
        this.renderer.ctx.restore(); 
        //*/

        const a = (x * this.renderer.gridSizeX) - mx;
        const b = (y * this.renderer.gridSizeY) - my;
        // distance in screen space
        const c = Math.sqrt((a * a) + (b * b));
        //console.log(c, c < 10);
        return c < 10;
    }
}