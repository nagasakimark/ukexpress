// Canvas setup: a fixed 1280x720 virtual resolution, letterboxed to any window.
export const W = 1280;
export const H = 720;
export class Screen {
    constructor(canvas) {
        this.scale = 1;
        this.ox = 0;
        this.oy = 0;
        this.dpr = 1;
        this.pattern = null;
        /** Called after every resize with the game area in CSS pixels (used to line up the 3D canvas). */
        this.onLayout = null;
        this.cap = 1.5;
        this.q = 1;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.pattern = this.makePattern();
    }
    /** Slow machines: lower the pixel density (cap) and the render scale (q); the picture is stretched to fit by CSS. */
    setQuality(cap, q) { this.cap = cap; this.q = q; this.resize(); }
    resize() {
        this.dpr = Math.min(window.devicePixelRatio || 1, this.cap) * this.q;
        const cw = window.innerWidth;
        const ch = window.innerHeight;
        this.canvas.width = Math.round(cw * this.dpr);
        this.canvas.height = Math.round(ch * this.dpr);
        this.canvas.style.width = cw + 'px';
        this.canvas.style.height = ch + 'px';
        this.scale = Math.min(cw / W, ch / H);
        this.ox = (cw - W * this.scale) / 2;
        this.oy = (ch - H * this.scale) / 2;
        this.onLayout?.(this.ox, this.oy, W * this.scale, H * this.scale);
    }
    // A railway-ticket pattern for the letterbox border, so there is never plain empty space.
    makePattern() {
        const c = document.createElement('canvas');
        c.width = 48;
        c.height = 48;
        const g = c.getContext('2d');
        g.fillStyle = '#123d27';
        g.fillRect(0, 0, 48, 48);
        g.strokeStyle = 'rgba(201,161,59,0.18)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, 24);
        g.lineTo(24, 0);
        g.moveTo(24, 48);
        g.lineTo(48, 24);
        g.stroke();
        g.fillStyle = 'rgba(246,238,216,0.06)';
        g.beginPath();
        g.arc(24, 24, 4, 0, Math.PI * 2);
        g.fill();
        return this.ctx.createPattern(c, 'repeat');
    }
    /** transparent: leave the game area see-through so the 3D canvas behind shows; only the letterbox is painted. */
    begin(transparent = false) {
        const { ctx, dpr } = this;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const cw = this.canvas.width / dpr, ch = this.canvas.height / dpr;
        const x1 = this.ox + W * this.scale, y1 = this.oy + H * this.scale;
        if (transparent) {
            ctx.clearRect(0, 0, cw, ch);
            ctx.fillStyle = this.pattern || '#123d27';
            ctx.fillRect(0, 0, cw, Math.ceil(this.oy));
            ctx.fillRect(0, Math.floor(y1), cw, ch - y1 + 1);
            ctx.fillRect(0, 0, Math.ceil(this.ox), ch);
            ctx.fillRect(Math.floor(x1), 0, cw - x1 + 1, ch);
        }
        else {
            // Every scene repaints the whole game area each frame, so the (slow) ticket pattern is only
            // needed on the small letterbox bars; the game area gets one cheap solid fill as a backstop.
            ctx.fillStyle = '#123d27';
            ctx.fillRect(0, 0, cw, ch);
            if (this.pattern && (this.ox > 0.5 || this.oy > 0.5)) {
                ctx.fillStyle = this.pattern;
                if (this.oy > 0.5) {
                    ctx.fillRect(0, 0, cw, Math.ceil(this.oy));
                    ctx.fillRect(0, Math.floor(y1), cw, ch - y1 + 1);
                }
                if (this.ox > 0.5) {
                    ctx.fillRect(0, 0, Math.ceil(this.ox), ch);
                    ctx.fillRect(Math.floor(x1), 0, cw - x1 + 1, ch);
                }
            }
        }
        ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, dpr * this.ox, dpr * this.oy);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.clip();
    }
    end() {
        this.ctx.restore();
    }
    toVirtual(clientX, clientY) {
        return { x: (clientX - this.ox) / this.scale, y: (clientY - this.oy) / this.scale };
    }
}
//# sourceMappingURL=screen.js.map