class Renderer {
    canvas;
    ctx;
    elements;

    originX;
    originY;



    constructor(canvas) {
        // input
        this.dragX = this.dragY = 0;
        this.dragStartX = this.dragStartY = null;
        this.originX = this.originY = 0;
        // canvas 
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.initialiseCanvas();
        // adding items
        this.populateCanvas();
    }


    populateCanvas() {
        // adds some initial elements
        this.addElement(new SinBar(this.canvas));
        svg.loadImage("speachbubble.svg", (el) => display.addElement(el));
    }


    initialiseCanvas() {
        this.elements = [];
        this.resizeCanvas();
        window.addEventListener('resize', (this.resizeCanvas).bind(this));
        window.requestAnimationFrame(this.renderLoop.bind(this));

        // add input
        const canvas = this.canvas;

        const input = new Input();
        const context = this; 

        function handleEvent(event){ input.handleEvent(event, context);} 
        
        canvas.addEventListener('mousedown', handleEvent);
        canvas.addEventListener('mousemove', handleEvent);
        canvas.addEventListener('mouseleave', handleEvent);
        canvas.addEventListener('mouseup', handleEvent);
        canvas.addEventListener('contextmenu', handleEvent);

        /*
        canvas.addEventListener('mousedown', Input.mouseDown.bind(this));
        canvas.addEventListener('mousemove', Input.mouseMove.bind(this));
        canvas.addEventListener('mouseleave', Input.mouseLeave.bind(this));
        canvas.addEventListener('mouseup', Input.mouseUp.bind(this));*/
    }

    resizeCanvas() {
        // Get the CSS size
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        // Handle high-DPI screens
        const dpr = 1; // window.devicePixelRatio || 1;

        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;

        // Scale context to ensure correct drawing
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    xpos = () => (this.canvas.width / 2) + this.originX + this.dragX;
    ypos = () => (this.canvas.height / 2) + this.originY + this.dragY;

    renderLoop() {
        this.ctx.resetTransform();
        // clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // allow world offset
        const [x, y] = [this.xpos(), this.ypos()];
        //const y = this.ypos();
        this.ctx.translate(x, y);// center canvas
        this.canvas.style = `background-position: ${x % 22}px ${y % 22}px;`;

        this.ctx.save();
        this.drawElements();


        // invokes the next render loop// could defer to a promise/timer, to set a fixed framerate. 
        window.requestAnimationFrame(this.renderLoop.bind(this))

        // draws a list of elements

    }
    drawElements() {
        if (!this.elements)
            return;
        this.elements.forEach(el => {
            el.drawTo(this.ctx);
        })?.bind(this);
    }

    addElements(array) {
        const arr = this;
        array.forEach(el => { r.addElement(el) });
    }
    addElement(el) {
        this.elements.push(el);
    }


    fillBg(color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
}


class Input {

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
                case 'mousedown':
                    console.log(event);
                    this.handleNavigation(event, context);
                    break;
                case 'contextmenu':
                    this.handleContextMenu(event, context);
                    event.preventDefault();
                    break;
                default:
                    return;
            }
        }

        if(context.state)
            context.state[event.type]?.bind(context)(event);
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
        //console.log("handling context menu");
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



class drawable {
    x;
    y;
    drawTo(ctx) { }
}


class SinBar extends drawable {
    drawTo(ctx) {
        // draw animated bar thing
        const time = new Date();
        var t1 = Math.sin((2 * Math.PI) * time.getMilliseconds() / 1000);
        ctx.fillRect(t1 * 100, -12, 40, 24);
    }
}







class svg extends drawable {
    img;
    width;
    height;
    constructor(img, x, y, width, height) {
        super();
        this.img = img;
        this.x = x;
        this.y = y;
        this.width = width ? width : img.width;
        this.height = height ? height : img.height;
    }
    drawTo(ctx) {
        ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    }

    static loadImage(src, onload) {
        const img = new Image();
        img.onload = (() => {
            onload(new svg(img, 10, 10, 100, 50));
        });
        img.src = src;
    }
}


class Display extends Renderer {





}

/*class Timeline extends Renderer(input) {

}*/

