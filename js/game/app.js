// The App: owns the canvas, the game loop, the current scene and the stack of modal dialogs.
import { Screen, W, H } from '../engine/screen.js';
import { Input } from '../engine/input.js';
import { clock } from '../engine/tween.js';
import { fx } from '../engine/fx.js';
import { audio } from '../engine/audio.js';
class App {
    constructor() {
        this.scene = null;
        this.modals = [];
        this.last = 0;
        this.options = { muted: false, fast: false, calm: false, gfx: 'auto' };
        this.autoplay = false;
        this.snap = null;
        this.overlays = [];
    }
    boot(canvas) {
        this.screen = new Screen(canvas);
        this.input = new Input(this.screen, () => this.route());
        this.input.onFirstGesture = () => audio.unlock();
        try {
            const o = JSON.parse(localStorage.getItem('britainExpressOptions') || 'null');
            if (o)
                this.options = { ...this.options, ...o };
        }
        catch { /* storage unavailable */ }
        audio.setMuted(this.options.muted);
        window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse')
            window.__kbd = false; });
        requestAnimationFrame((t) => this.frame(t));
    }
    saveOptions() {
        try {
            localStorage.setItem('britainExpressOptions', JSON.stringify(this.options));
        }
        catch { /* ignore */ }
    }
    route() {
        const top = this.modals[this.modals.length - 1];
        if (top)
            return [top];
        return this.scene ? [this.scene] : [];
    }
    go(scene) {
        this.scene?.leave?.();
        this.modals = [];
        this.scene = scene;
        scene.enter?.();
    }
    show(m) {
        this.modals.push(m);
        m.open();
        return m.promise;
    }
    frame(t) {
        const dt = Math.min(50, this.last ? t - this.last : 16);
        this.last = t;
        clock.update(dt);
        fx.update(dt * clock.timeScale > 200 ? 200 : dt);
        this.scene?.update(dt);
        for (const m of this.modals)
            m.update(dt);
        this.modals = this.modals.filter((m) => !m.done);
        for (const o of this.overlays)
            o.update?.(dt);
        this.overlays = this.overlays.filter((o) => !o.done);
        const ctx = this.screen.ctx;
        this.screen.begin(!!this.scene?.transparent);
        const off = this.options.calm ? { x: 0, y: 0 } : fx.offset();
        ctx.save();
        ctx.translate(off.x, off.y);
        // Behind a dialog the board is only a dimmed backdrop: draw it once, then reuse the picture
        // (refreshed a few times a second) instead of re-rendering the whole map every frame.
        const cv = this.screen.canvas;
        if (this.modals.length && this.scene && !this.scene.transparent && this.snap && this.snap.width === cv.width && this.snap.height === cv.height && this.snapFor === this.modals[0]) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(this.snap, 0, 0);
            ctx.restore();
            ctx.restore();
        }
        else {
            this.scene?.draw(ctx);
            ctx.restore();
            if (this.modals.length && this.scene && !this.scene.transparent) {
                if (!this.snap)
                    this.snap = document.createElement('canvas');
                if (this.snap.width !== cv.width || this.snap.height !== cv.height) {
                    this.snap.width = cv.width;
                    this.snap.height = cv.height;
                }
                this.snap.getContext('2d').drawImage(cv, 0, 0);
                this.snapFor = this.modals[0];
            }
        }
        if (!this.modals.length)
            this.snapFor = undefined;
        for (const o of this.overlays)
            o.draw(ctx);
        for (const m of this.modals)
            m.draw(ctx);
        fx.draw(ctx);
        this.screen.end();
        requestAnimationFrame((tt) => this.frame(tt));
    }
    announce(s) {
        const el = document.getElementById('live');
        if (el)
            el.textContent = s;
    }
}
export const app = new App();
export { W, H };
//# sourceMappingURL=app.js.map