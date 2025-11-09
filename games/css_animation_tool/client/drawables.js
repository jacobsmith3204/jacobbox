class drawable {
    x;
    y;
    drawTo(ctx) { }
}


class sinBar extends drawable {
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

class node extends drawable {
    constructor(x, y) {
        super();
        this.x = x;
        this.y = y;
    }
}

class anchor extends node {
    size = 5;
    lineWidth = 3; 
    style = `rgba(190, 16, 68, 1)`;
    // the nodes for the timelines. 
    constructor(x, y) {
        super(x, y);
    }
    drawTo(ctx) {
        ctx.lineWidth = this.lineWidth;
        ctx.fillStyle = this.style;
        ctx.drawCenteredRotatedRect(this.x, this.y, this.size, this.size, 0);  
    }
}

class handle extends node {
    size = 5;
    lineWidth = 3; 
    connectingLineWidth = 1; 
    style = `rgba(219, 167, 23, 1)`;
    // the handles for the timelines
    constructor(x, y, node) {
        super(x, y);
        this.node = node; 
    }


    drawTo(ctx) { 
        ctx.lineWidth = this.lineWidth;
        ctx.fillStyle = this.style;
        ctx.drawCenteredRotatedRect(this.x, this.y, this.size, this.size, 45 * Math.PI / 180);
        ctx.lineWidth = this.connectingLineWidth;
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.node.x, this.node.y);
        ctx.stroke();


    }

    /*
     const time = new Date();
        
        var t1 = Math.sin((2 * Math.PI) * time.getMilliseconds() / 1000);
        var t2 = Math.cos((2 * Math.PI) * time.getMilliseconds() / 1000);

        this.x = this.baseX + (t1 * 10);
        this.y = this.baseY + (t2 * 10);
    */
}






class curve extends drawable {
    lineWidth = 3;

    constructor(n1, handle1, handle2, n2, style) {
        super();
        this.n1 = n1;
        this.n2 = n2;
        this.handle1 = handle1;
        this.handle2 = handle2;
        this.style = style;

    }

    drawTo(ctx) {
        ctx.strokeStyle = this.style;
        ctx.lineWidth = this.lineWidth;
        ctx.beginPath();
        ctx.moveTo(this.n1.x, this.n1.y);
        ctx.bezierCurveTo(this.handle1.x, this.handle1.y, this.handle2.x, this.handle2.y, this.n2.x, this.n2.y);
        ctx.stroke();
    }
}

CanvasRenderingContext2D.prototype.drawRotatedRect =  function (x, y, width, height,originX,originY, angle) {
    this.save();
    this.translate(x, y);
    this.rotate(angle);
    this.strokeRect(-originX, -originY, width, height);
    this.restore();
}

CanvasRenderingContext2D.prototype.drawCenteredRotatedRect =  function (x, y, width, height, angle) {
    this.save();
    this.translate(x, y);
    this.rotate(angle);
    this.strokeRect(-width / 2, -height / 2, width, height);
    this.restore();
}