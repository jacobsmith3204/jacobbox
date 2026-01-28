import { Input } from "./input.js";


export class Renderer {
    canvas;
    ctx;
    elements = [];
    originX;
    originY;
    scale = 1;

    constructor(canvas) {
        // input
        this.dragX = this.dragY = 0;
        this.dragStartX = this.dragStartY = null;
        this.originX = (canvas.width / 2);
        this.originY = (canvas.height / 2);
        // canvas 
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.initialiseCanvas();
    }

    initialiseCanvas() {
        this.elements = [];
        this.resizeCanvas();
        window.addEventListener('resize', (this.resizeCanvas).bind(this));
        window.requestAnimationFrame(this.renderLoop.bind(this));

        const input = window.input = new Input(this); // adds input
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

    xpos = () => this.originX + this.dragX;
    ypos = () => this.originY + this.dragY;

    renderLoop() {
        console.warn("renderLoop not setup for", typeof (this));
    }



    addElements(array) {
        array.forEach((el => { this.addElement(el) }).bind(this));
    }
    addElement(el) {
        this.elements.push(el);
    }
    findNode(event) {

    }
}




export class TimelineRenderer extends Renderer {

    renderLoop() {


        const canvas = this.canvas;
        const ctx = this.ctx;
        const renderer = this;

        // start context at a known location and clears the rect
        this.ctx.resetTransform();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);


        // calculates world offset and gets the canvas position offset (x,y) and saves it as the default
        const [x, y, scale, em] = [this.xpos(), this.ypos(), this.scale, parseFloat(window.getComputedStyle(document.documentElement).fontSize)];
        const gridSize = 5 * em * scale;

        ctx.scale(scale, scale);
        ctx.translate(x / scale, y / scale);// center canvas

        this.ctx.font = "2em serif";
        ctx.save();

        // updates the background css gradent
        DrawGrid();
        // draws a list of elements
        DrawElements();
        // draws the numbers along the axes. 


        drawAxisScale();

        // invokes the next render loop// could defer to a promise/timer, to set a fixed framerate. 
        window.requestAnimationFrame(this.renderLoop.bind(this));







        function DrawGrid() {

            canvas.style = ` background: 
            repeating-linear-gradient(90deg,  transparent 0px, rgba(0, 0, 0, 0.13) 2px, transparent 0px, transparent ${gridSize}px)   
            ${x % gridSize}px ${y % gridSize}px`;
        }

        function DrawElements() {
            for (const el of renderer.elements)
                el.drawTo(ctx);

            ctx.fillText("hello world", 0, 0);
        }

        function drawAxisScale() {
            const roundingMargins = [1, 2, 5, 10, 20, 50, 100];
            var axisScale = 1;
            for (const margin of roundingMargins) {
                // if the scale gets too cramped
                if (gridSize * axisScale  > (2 * em))
                    break;
                axisScale = margin;
            }

            

            drawAxisScaleX();
            drawAxisScaleY();



            function drawAxisScaleX() {
                // get grid bounds 

                ctx.resetTransform();
                const count = Math.ceil(canvas.width / gridSize / axisScale);
                // calculate start based on position where the canvas is positioned in the world, then draw from where it intersects the screen. 
                const offset = (x / gridSize % axisScale);
                const start = -x / gridSize / axisScale;

                // draws only the amount needed to fit on screen
                for (let i = 0; i <= count; i++) {
                    const charX = (offset + (i * axisScale)) * gridSize;
                    const charY = 2 * em;
                    ctx.fillText(`${(Math.trunc(start) + i) * axisScale}`, charX, charY);
                }
            }

            function drawAxisScaleY() {
                // get grid bounds 

                ctx.resetTransform();
                const count = Math.ceil(canvas.height / gridSize / axisScale);
                // calculate start based on position where the canvas is positioned in the world, then draw from where it intersects the screen. 
                const offset = (y / gridSize % axisScale);
                const start = -y / gridSize / axisScale;

                // draws only the amount needed to fit on screen
                for (let i = 0; i <= count; i++) {
                    const charX = em;
                    const charY = (offset + (i * axisScale)) * gridSize ;
                    ctx.fillText(`${(Math.trunc(start) + i) * axisScale}`, charX, charY);
                }
            }
        }
    }
}