export class Input {
    constructor( renderer) {

        const canvas = renderer.canvas;
        const context = renderer;
        const input = this; 

        function handleEvent(event) { input.handleEvent(event, context); }

        canvas.addEventListener('mousedown', handleEvent);
        canvas.addEventListener('mousemove', handleEvent);
        canvas.addEventListener('mouseleave', handleEvent);
        canvas.addEventListener('mouseup', handleEvent);
        canvas.addEventListener('contextmenu', handleEvent);
        canvas.addEventListener('wheel', handleEvent);
    }


    static mouseMove(event) {
        // only gets called if the pointer is inside.  
        //console.log(event);

        if (this.dragStartX) {
            this.dragX = event.clientX - this.dragStartX,
                this.dragY = event.clientY - this.dragStartY
            //console.log(`Mouse X: ${pointerX}, Mouse Y: ${pointerY}`);
        }
    }


    handleEvent(event, context) {


        if (!context.state) {
            // chooses what state it should be in. 
            switch (event.type) {

                case 'contextmenu':
                    this.handleContextMenu(event, context);
                    event.preventDefault();
                    break;
                case 'mousedown':
                    //console.log(event); // 
                    var node = context.findNode(event);
                    if (node) {
                        this.handleAnchorMovement(event, context);
                        this.handleHandleMovement(event, context);
                    }
                    else {
                        this.handleNavigation(event, context);
                    }
                    break;

                case 'wheel':
                    this.handleZoom(event, context);
                    break; // since its one off return so it doesnt set context.state

                case 'mousemove':
                    //console.log(event);
                    var el = context.elements[0];

                    // mouse position in canvas
                    const [mx, my] = this.getMousePosition(event, context);

                    el.x = mx / context.scale;
                    el.y = my / context.scale;

                    break;
                default:

                    return;
            }
        }

        if (context.state)
            context.state[event.type]?.bind(context)(event);
        //console.log("input context state", context.state);
    }


    getMousePosition(event, context) {
        const x = (event.clientX - context.canvas.offsetLeft) - context.xpos();
        const y = (event.clientY - context.canvas.offsetTop) - context.ypos();
        return [x, y];
    }


    handleZoom(event, context) {

        //console.log("Window scrolled!", event);

        // non-linear zoom.  
        var zoom = (event.wheelDelta) / (1000 + context.scale);

        // gets the mouse position relative to the canvas position
        const [mx, my] = this.getMousePosition(event, context);

        // adjusts the zoom level
        context.scale += zoom;

        // change origin to center zoom on cursor 
        context.originX -= (mx * zoom) / context.scale;
        context.originY -= (my * zoom) / context.scale;

        //console.log(context.originX, context.originY);
    }




    handleNavigation(event, context) {
        context.state = {
            type: 'navigation',
            mouseup: event => { Input.mouseUp.bind(context)(event); context.state = null; }, //  (event => { console.log(this.state, event);  })
            mousemove: Input.mouseMove.bind(context),
            mouseleave: event => { Input.mouseLeave.bind(context)(event); context.state = null; },
        }
        Input.mouseDown.bind(context)(event);
        //console.log(context);
    }
    handleContextMenu(context) {
        console.log("handling context menu");

        context.state = null;
    }




    static getMousePosition(event) {
        // gets the position of the mouse on screen
        const rect = this.canvas.getBoundingClientRect();

        const mouseX = (event.clientX - rect.left);
        const mouseY = (event.clientY - rect.top);

        const pointerX = mouseX - ((this.canvas.width / 2) + this.originX);
        const pointerY = mouseY - ((this.canvas.height / 2) + this.originY);

        return [pointerX, pointerY];
    }

    static mouseDown(event) {
        //console.log(event);
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;
    }
    static mouseUp(event) {
        if (!this.dragStartX)
            return;
        //console.log(event);

        this.originX += event.clientX - this.dragStartX;
        this.originY += event.clientY - this.dragStartY;

        this.dragX = 0;
        this.dragY = 0;

        this.dragStartX = null;
        this.dragStartY = null;
    }

    static mouseLeave(event) {
        //console.log("LEAVE", event);
        if (this.dragStartX)
            Input.mouseUp.bind(this)(event);
    }
}