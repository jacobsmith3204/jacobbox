import { AnimProperty } from "./animation.js";
import { curve, Handle, Anchor, svg } from "./objects.js";



CanvasRenderingContext2D.prototype.drawRotatedRect = function (x, y, width, height, originX, originY, angle) {
    this.save();
    this.translate(x, y);
    this.rotate(angle);
    this.strokeRect(-originX, -originY, width, height);
    this.restore();
}

CanvasRenderingContext2D.prototype.drawCenteredRotatedRect = function (x, y, width, height, angle) {
    this.save();
    this.translate(x, y);
    this.rotate(angle);
    this.strokeRect(-width / 2, -height / 2, width, height);
    this.restore();
}


// static functions; 
/*Object.assign(curve, {
    strokeStyle: `rgba(190, 16, 68, 1)`,
    lineWidth: 1,
    drawCurve(renderer, n1, h1, h2, n2) {
        [n1, h1, h2, n2] = [n1, h1, h2, n2].map((el) => renderer.positionOnCanvasWithScale(el.x, el.y));
        const ctx = renderer.ctx;

        ctx.resetTransform();
        ctx.strokeStyle = curve.strokeStyle;
        ctx.lineWidth = curve.lineWidth;
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.bezierCurveTo(h1.x, h1.y, h2.x, h2.y, n2.x, n2.y);
        ctx.stroke();
        ctx.restore();
    }
});
*/

Object.assign(curve, {
    drawCurve(renderer, n1, h1, h2, n2) {
        [n1, h1, h2, n2] = [n1, h1, h2, n2].map((el) => renderer.positionOnCanvasWithScale(el.x, el.y));

        const curve1D = makeCurve(n1, h1, h2, n2);
        const ctx = renderer.ctx;

        ctx.save();
        ctx.resetTransform();
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        const steps = Math.ceil(n2.x - n1.x);
        for (let i = 0; i <= steps; i++) {
            const x = n1.x + (i / steps) * (n2.x - n1.x);
            ctx.lineTo(x, curve1D.eval(x));
        }
        ctx.stroke();
        ctx.restore();
    }
});


function makeCurve(n1, h1, h2, n2) {
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    if (Math.abs(dx) < 1e-6) return null;

    const cx1 = (h1.x - n1.x) / dx;
    const cx2 = (h2.x - n1.x) / dx;

    const cy1 = (h1.y - n1.y) / dy;
    const cy2 = (h2.y - n1.y) / dy;

    const ease = makeEase(cx1, cy1, cx2, cy2);

    return {
        x0: n1.x,
        x1: n2.x,
        y0: n1.y,
        y1: n2.y,

        eval(x) {
            const t = (x - this.x0) / (this.x1 - this.x0);
            const y = ease(t);
            return this.y0 + y * (this.y1 - this.y0);
        }
    };
}

function makeEase(cx1, cy1, cx2, cy2) {
    const cx = 3 * cx1;
    const bx = 3 * (cx2 - cx1) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * cy1;
    const by = 3 * (cy2 - cy1) - cy;
    const ay = 1 - cy - by;

    function sampleX(t) {
        return ((ax * t + bx) * t + cx) * t;
    }

    function sampleY(t) {
        return ((ay * t + by) * t + cy) * t;
    }

    function sampleXDerivative(t) {
        return (3 * ax * t + 2 * bx) * t + cx;
    }

    return function ease(x) {
        let t = x;
        for (let i = 0; i < 5; i++) {
            const d = sampleXDerivative(t);
            if (Math.abs(d) < 1e-6) break;
            t -= (sampleX(t) - x) / d;
        }
        return sampleY(t);
    };
}




// ===  dynamic functions  === //
Object.assign(Handle.prototype, {
    drawTo(renderer, anchor) {


        const pos = renderer.positionOnCanvasWithScale(this.x, this.y);
        const anchorNode = renderer.positionOnCanvasWithScale(anchor.x, anchor.y);

        const ctx = renderer.ctx;


        ctx.save();
        ctx.resetTransform();
        ctx.lineWidth = this.lineWidth;
        ctx.fillStyle = this.style;
        ctx.lineWidth = this.connectingLineWidth;
        ctx.drawCenteredRotatedRect(pos.x, pos.y, this.size, this.size, 45 * Math.PI / 180);
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(anchorNode.x, anchorNode.y);
        ctx.stroke();
        ctx.restore();
    }
});
// Anchor
Object.assign(Anchor.prototype, {
    drawTo(renderer) {
        const pos = renderer.positionOnCanvasWithScale(this.x, this.y);
        const ctx = renderer.ctx;

        ctx.save();
        ctx.lineWidth = this.lineWidth;
        ctx.fillStyle = this.style;
        ctx.resetTransform();
        ctx.drawCenteredRotatedRect(pos.x, pos.y, this.size, this.size, 0);
        ctx.restore();
    }
});
// svg
Object.assign(svg.prototype, {
    drawTo(renderer) {
        const pos = renderer.positionOnCanvas(this.x, this.y);
        renderer.ctx.drawImage(this.img, pos.x, pos.y, this.width, this.height);
    }
});






// curve
/*Object.assign(curve.prototype, {

    drawTo(renderer) {


        // maps the variables to draw them using the correct positional scale
        const [n1, handle1, handle2, n2] = [this.n1, this.handle1, this.handle2, this.n2].map((el) => renderer.positionOnCanvasWithScale(el.x, el.y));

        const ctx = renderer.ctx;
        ctx.resetTransform();
        ctx.strokeStyle = this.style;
        ctx.lineWidth = this.lineWidth;
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.bezierCurveTo(handle1.x, handle1.y, handle2.x, handle2.y, n2.x, n2.y);
        ctx.stroke();
        ctx.restore();
    }
});
*/




// AnimProperty
Object.assign(AnimProperty.prototype, {
    drawTo(renderer) {
        const ctx = renderer.ctx;
        const timeline = renderer.timeline;

        if (!this.keyframes || this.keyframes.length <= 0)
            return;


        ctx.strokeStyle = this.color || `rgb(211, 0, 0)`;


        // draw line to first; 
        const first = this.keyframes[0].anchor;
        var pos = renderer.positionOnCanvasWithScale(first.x, first.y);
        ctx.save();
        ctx.resetTransform(); 
        ctx.globalAlpha = 0.2; 
        ctx.moveTo(0, pos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        ctx.restore();

        // draws the curves.  
        if (this.keyframes.length > 1){
            for (let i = 1; i < this.keyframes.length; i++) {
                const keyframe = this.keyframes[i];
                const lastKeyframe = this.keyframes[i - 1];
                curve.drawCurve(renderer, lastKeyframe.anchor, lastKeyframe.handleRight || lastKeyframe.anchor, keyframe.handleLeft || keyframe.anchor, keyframe.anchor);
            }
        }

        // draws the nodes
        if (this.showHandles) {
            for (const i in this.keyframes) {
                const keyframe = this.keyframes[i]; 
                keyframe.anchor?.drawTo(renderer);

                // draws the handles, clips the ones that would be out of bounds
                if (i + 1 < this.keyframes.length)
                    keyframe.handleRight?.drawTo(renderer, keyframe.anchor);
                if (i != 0)
                    keyframe.handleLeft?.drawTo(renderer, keyframe.anchor);
            }
        }

        // draw line from last 
        const last = this.keyframes[this.keyframes.length - 1].anchor;
        pos = renderer.positionOnCanvasWithScale(last.x, last.y);
        ctx.save();
        ctx.resetTransform();
        ctx.globalAlpha = 0.2; 
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(renderer.canvas.width, pos.y);
        ctx.stroke();
        ctx.restore();

    }
});
