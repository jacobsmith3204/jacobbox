import { Input } from "./input.js";


export class Renderer {
    canvas;
    ctx;
    originX;
    originY;
    input;
    scaleX = 1;
    scaleY = -1;
    fontsize;

    constructor(canvas) {
        // input
        this.dragX = this.dragY = 0;
        this.dragStartX = this.dragStartY = null;
        this.originX = (canvas.width);
        this.originY = (canvas.height);
        // canvas 
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.initialiseCanvas();
    }

    initialiseCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', (this.resizeCanvas).bind(this));
        window.requestAnimationFrame(this.renderLoop.bind(this));

        const input = this.input = window.input = new Input(this); // adds input
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
        this.fontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    }

    get xpos() { return this.originX + this.dragX; }
    get ypos() { return this.originY + this.dragY; }

    get gridSizeX() { return 5 * this.fontSize * this.scaleX; }
    get gridSizeY() { return 5 * this.fontSize * this.scaleY; }






    positionOnCanvas(x, y) {
        const em = this.fontSize;
        x *= 5 * em;
        y *= 5 * em;
        return { x, y };
    }
    positionOnCanvasWithScale(x, y) {
        const em = this.fontSize;

        x *= 5 * em * this.scaleX;
        y *= 5 * em * this.scaleY;

        x += this.xpos;
        y += this.ypos;
        return { x, y };
    }

    renderLoop() {
        console.warn("renderLoop not setup for", typeof (this));
    }
}




export class TimelineRenderer extends Renderer {
    timeline;


    renderLoop() {


        const canvas = this.canvas;
        const ctx = this.ctx;
        const renderer = this;

        // start context at a known location and clears the rect
        this.ctx.resetTransform();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);


        // calculates world offset and gets the canvas position offset (x,y) and saves it as the default
        const [x, y, scaleX, scaleY, em] = [this.xpos, this.ypos, this.scaleX, this.scaleY, this.fontSize];
        const gridSizeX = this.gridSizeX;
        const gridSizeY = this.gridSizeY;

        ctx.scale(scaleX, scaleY);
        ctx.translate(x / scaleX, y / scaleY);// center canvas

        this.ctx.font = "2em serif";
        ctx.save();

        // updates the background css gradent
        DrawGrid();
        // draws a list of elements
        DrawTimelineProperties();
        // draws the numbers along the axes. 


        DrawAxisScale();
        this.input.stateSystem.call("update");

        // invokes the next render loop// could defer to a promise/timer, to set a fixed framerate. 
        window.requestAnimationFrame(this.renderLoop.bind(this));







        function DrawGrid() {
            const axisScale = GetAxisScale(gridSizeX);
            const s = gridSizeX * axisScale;

            canvas.style = ` background: 
            repeating-linear-gradient(90deg,  transparent 0px, rgba(0, 0, 0, 0.13) 2px, transparent 0px, transparent ${s}px)   
            ${x % s}px ${y % s}px`;
        }

        function DrawTimelineProperties() {
            for (const property of Object.values(renderer.timeline.properties))
                property.drawTo(renderer);
        }

        function DrawAxisScale() {
           
            ctx.fillStyle = "#000";

            DrawAxisScaleX();
            DrawAxisScaleY();

            function DrawAxisScaleX() {
                const axisScale = GetAxisScale(gridSizeX);
                // get grid bounds 
                ctx.resetTransform();

                // calculate start based on position where the canvas is positioned in the world, then draw from where it intersects the screen. 
                const offset = (x / gridSizeX % axisScale);
                const start = -x / gridSizeX / axisScale;

                // draws only the amount needed to fit on screen
                const count = Math.abs(Math.trunc(canvas.width / gridSizeX / axisScale));
                for (let i = -1; i <= count; i++) {
                    const charX = (offset + (i * axisScale)) * gridSizeX;
                    const charY = 2 * em;
                    ctx.fillText(`${(Math.trunc(start) + i) * axisScale}`, charX, charY);
                }
            }

            function DrawAxisScaleY() {
                const axisScale = GetAxisScale(gridSizeY);
                // get grid bounds 
                ctx.resetTransform();

                // calculate start based on position where the canvas is positioned in the world, then draw from where it intersects the screen. 
                const offset = (y / gridSizeY % axisScale);
                const start = -y / gridSizeY / axisScale;

                // draws only the amount needed to fit on screen
                const count = Math.abs(Math.trunc(canvas.height / gridSizeY / axisScale));
                for (let i = -1; i <= count; i++) {
                    const charX = em;
                    const charY = (offset + (i * -axisScale)) * gridSizeY;
                    ctx.fillText(`${(Math.trunc(start) - i) * axisScale}`, charX, charY);
                }
            }
        }

        function GetAxisScale(_gridSize) {
            const roundingMargins = [1, 2, 5, 10, 20, 50, 100];
            const gridSize = Math.abs(_gridSize);
            var axisScale = 1;
            for (const margin of roundingMargins) {
                // if the scale gets too cramped
                if (gridSize * axisScale > ((1 + (`${axisScale}`).length) * em))
                    return axisScale;
                axisScale = margin;
            }
            return axisScale;
        }
    }
}