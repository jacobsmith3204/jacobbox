export class sinBar {
    drawTo(ctx) {
        // draw animated bar thing
        const time = new Date();
        var t1 = Math.sin((2 * Math.PI) * time.getMilliseconds() / 1000);
        ctx.fillRect(t1 * 100, -12, 40, 24);
    }
}

export class svg {
    x;
    y;
    img;
    width;
    height;
    constructor(img, x, y, width, height) {
        this.img = img;
        this.x = x;
        this.y = y;
        this.width = width ? width : img.width;
        this.height = height ? height : img.height;
    }

    static loadImage(src, onload) {
        const img = new Image();
        img.onload = (() => {
            onload(new svg(img, 10, 10, 100, 50));
        });
        img.src = src;
    }
}

export class curve {
    lineWidth = 3;

    constructor(n1, handle1, handle2, n2, style) {
        this.n1 = n1;
        this.n2 = n2;
        this.handle1 = handle1;
        this.handle2 = handle2;
        this.style = style;
    }
}

// 
export class Anchor {
    size = 5;
    lineWidth = 3;
    style = `rgba(190, 16, 68, 1)`;
    // the nodes for the timelines. 
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

// 
export class Handle {
    size = 5;
    lineWidth = 3;
    connectingLineWidth = 1;
    style = `rgba(219, 167, 23, 1)`;
    // the handles for the timelines
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}


