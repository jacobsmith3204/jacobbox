class Renderer {
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

        // add input
        const canvas = this.canvas;

        const input = new Input();
        const context = this;

        function handleEvent(event) { input.handleEvent(event, context); }

        canvas.addEventListener('mousedown', handleEvent);
        canvas.addEventListener('mousemove', handleEvent);
        canvas.addEventListener('mouseleave', handleEvent);
        canvas.addEventListener('mouseup', handleEvent);
        canvas.addEventListener('contextmenu', handleEvent);
        canvas.addEventListener("wheel", handleEvent);
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

    drawElements() {
        if (!this.elements)
            return;
        this.elements.forEach(el => {
            el.drawTo(this.ctx);
        })?.bind(this);
    }

    addElements(array) {
        array.forEach((el => { this.addElement(el) }).bind(this));
    }
    addElement(el) {
        this.elements.push(el);
    }

    findNode(event){
        

    }
}




class Timeline extends Renderer {

    renderLoop() {
        this.ctx.resetTransform();
        // clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // allow world offset
        const [x, y] = [this.xpos(), this.ypos()];
        //const y = this.ypos();
        this.ctx.scale(this.scale, this.scale);
        this.ctx.translate(x/this.scale, y/this.scale);// center canvas
        
        const em = parseFloat(window.getComputedStyle(document.documentElement).fontSize); 

        const gridSize = 5 * em * this.scale;
        this.canvas.style = ` background: 
            repeating-linear-gradient(90deg,  transparent 0px, rgba(0, 0, 0, 0.13) 2px, transparent 0px, transparent ${gridSize}px)   
            ${x % gridSize}px ${y % gridSize}px 
            
            `;

        //this.canvas.style = `background-position: ${x % 22}px ${y % 22}px;`;
        this.ctx.save();
        this.drawElements();


        // invokes the next render loop// could defer to a promise/timer, to set a fixed framerate. 
        window.requestAnimationFrame(this.renderLoop.bind(this))

        // draws a list of elements
    }
}

/*class Display extends Renderer {
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
}*/
