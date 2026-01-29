import { StateSystem, StateList, State } from "./StateMachine.js";
import { ShowContextMenu } from "./interface/interfaceBuilder.js";



export class Input {
    renderer;
    canvas;

    mouseX;
    mouseY;



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
                input.mouseX = e.clientX;
                input.mouseY = e.clientY;
                //console.log(input, "updated mouse positions");
            });

        // adds the events based on their label
        const events = ['mousedown', 'mousemove', 'mouseleave','mouseenter', 'mouseup', 'contextmenu', 'wheel', 'focus'];
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
            mouseleave: function () { console.log("left context");  this.state = "default" },
            mouseup: function () { console.log("context mouseup"); this.state = "default" }, 

        }), 
    });


    static mousedownDecideNextState(event) {
        //console.log(event)
        
        if (event.button !== 0) // not left button pressed 
            return;

        this.nodeTarget = this.MouseOnNode(event);
        if (this.nodeTarget) {
            // if clicking on a node
            this.state = "movingNode";
        }
        else {
            // if not clicking on anything important then we do normal canvas navigation
            this.state = "navigatingCanvas";
        }
    }


    static ContextMenu(event){
        ShowContextMenu(event); 
        this.state = "contextMenu"; 
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

        const [mx, my] = this.getMousePosition(event);

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
        this.dragStartX = this.mouseX;
        this.dragStartY = this.mouseY;
    }
    static updateNavigation() {
        this.renderer.dragX = this.mouseX - this.dragStartX;
        this.renderer.dragY = this.mouseY - this.dragStartY;


    }
    static endNavigation() {

        // adds the most up to date dragX and Y to origin
        this.renderer.originX += this.mouseX - this.dragStartX;
        this.renderer.originY += this.mouseY - this.dragStartY;
        // resets 
        this.renderer.dragX = 0;
        this.renderer.dragY = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;

        //console.log("end ", this.renderer.xpos, this.renderer.ypos);
    }
    //#endregion




    nodeTarget;
    static dragNode(event) {
        //console.log("dragging node ", event);

        var el = this.nodeTarget;

        // mouse position in canvas
        const [mx, my] = this.getMousePosition(event);

        el.x = mx / this.renderer.gridSizeX;
        el.y = my / this.renderer.gridSizeY;
    }


    getMousePosition() {
        const x = (this.mouseX - this.renderer.canvas.offsetLeft) - this.renderer.xpos;
        const y = (this.mouseY - this.renderer.canvas.offsetTop) - this.renderer.ypos;
        return [x, y];
    }


    newKeyframe(){

    }


    MouseOnNode(event) {
        const timeline = this.renderer.timeline;

        for (const property of Object.values(timeline.properties)) {
            if (!property.showHandles)
                continue;

            for (const keyframe of property.keyframes) {

                if (this.testPositionOfNode(keyframe.anchor))
                    return keyframe.anchor;
                if (this.testPositionOfNode(keyframe.handleLeft))
                    return keyframe.handleLeft;
                if (this.testPositionOfNode(keyframe.handleRight))
                    return keyframe.handleRight;
            }
        }
    }

    testPositionOfNode({ x, y }) {
        const [mx, my] = this.getMousePosition();

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