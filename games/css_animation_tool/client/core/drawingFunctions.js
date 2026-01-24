import { AnimProperty } from "./animation.js";
import {curve, Handle, Anchor, svg} from "./objects.js";



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
Object.assign(curve, {
    strokeStyle: `rgba(190, 16, 68, 1)`,
    lineWidth: 1,
    drawCurve(ctx, n1, h1, h2, n2) {
        ctx.strokeStyle = curve.strokeStyle;
        ctx.lineWidth = curve.lineWidth;
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.bezierCurveTo(h1.x, h1.y, h2.x, h2.y, n2.x, n2.y);
        ctx.stroke();
    }
});

// ===  dynamic functions  === //
Object.assign(Handle.prototype, {
    drawTo(ctx) {
        ctx.lineWidth = this.lineWidth;
        ctx.fillStyle = this.style;
        ctx.drawCenteredRotatedRect(this.x, this.y, this.size, this.size, 45 * Math.PI / 180);
        ctx.lineWidth = this.connectingLineWidth;
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.node.x, this.node.y);
        ctx.stroke();
    }
});
// Anchor
Object.assign(Anchor.prototype, {
    drawTo(ctx) {
        ctx.lineWidth = this.lineWidth;
        ctx.fillStyle = this.style;
        ctx.drawCenteredRotatedRect(this.x, this.y, this.size, this.size, 0);
    }
});
// svg
Object.assign(svg.prototype, {
    drawTo(ctx) {
        ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    }
});
// curve
Object.assign(curve.prototype, {

    drawTo(ctx) {
        ctx.strokeStyle = this.style;
        ctx.lineWidth = this.lineWidth;
        ctx.beginPath();
        ctx.moveTo(this.n1.x, this.n1.y);
        ctx.bezierCurveTo(this.handle1.x, this.handle1.y, this.handle2.x, this.handle2.y, this.n2.x, this.n2.y);
        ctx.stroke();
    }
});
// AnimProperty
Object.assign(AnimProperty.prototype, {
    drawTo(ctx) {

        if (!this.keyframes || this.keyframes.length <= 0)
            return;

        // creates a node to draw a line to the first keyframe node.  
        var lastKeyframe = {
            anchor: { x: 0, y: this.keyframes[0].anchor.y },
            handleRight: { x: 0, y: this.keyframes[0].anchor.y }
        };

        // draws all the nodes. 
        for (var i = 0; i < this.keyframes.length; i++) {
            const keyframe = this.keyframes[i];
            curve.drawCurve(ctx, lastKeyframe.anchor, lastKeyframe.handleRight || lastKeyframe.anchor, keyframe.handleLeft || keyframe.anchor, keyframe.anchor);

            //console.log(keyframe);
            // draws the nodes
            keyframe.anchor?.drawTo(ctx);

            if (this.showHandles) {
                keyframe.handleRight?.drawTo(ctx);
                keyframe.handleLeft?.drawTo(ctx);
            }
            lastKeyframe = keyframe;
        }

        // ends the curve. 
        curve.drawCurve(ctx, lastKeyframe.anchor, lastKeyframe.handleRight, { x: 1000, y: lastKeyframe.anchor.y }, { x: 1000, y: lastKeyframe.anchor.y });
    }
});

