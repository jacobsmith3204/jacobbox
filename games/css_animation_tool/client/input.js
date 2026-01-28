import { StateSystem, StateList, State } from "./StateMachine.js";



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
        const events = ['mousedown', 'mousemove', 'mouseleave', 'mouseup', 'contextmenu', 'wheel'];
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

        }),
    });


    static mousedownDecideNextState(event) {
        //console.log(event)
        if (event.button !== 0) // not left button pressed 
            return;


        if (false) {
            // if clicking on a node
            this.state = "movingNode";
        }
        else {
            // if not clicking on anything important then we do normal canvas navigation
            this.state = "navigatingCanvas";
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
        //console.log("start" , this.renderer.xpos(), this.renderer.ypos());
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

        //console.log("end ", this.renderer.xpos(), this.renderer.ypos());
    }
    //#endregion










    dragNode(event) {
        console.log("dragging node ", event);
        var el = context.elements[0];

        // mouse position in canvas
        const [mx, my] = this.getMousePosition(event);

        el.x = mx / this.renderer.scale;
        el.y = my / this.renderer.scale;
    }


    getMousePosition(event) {
        const x = (event.clientX - this.renderer.canvas.offsetLeft) - this.renderer.xpos();
        const y = (event.clientY - this.renderer.canvas.offsetTop) - this.renderer.ypos();
        return [x, y];
    }
}