// The WebGL layer. It sits behind the 2D UI canvas and is only shown while the 3D board is on screen.
// Quality presets keep student Chromebooks smooth: 'auto' picks a level from the GPU and then watches the frame rate.
import * as THREE from 'three';
export const PRESETS = {
    high: { pixelRatio: 1.5, shadows: true, scenery: 1, terrainCell: 12, texScale: 1 },
    medium: { pixelRatio: 1, shadows: false, scenery: 0.8, terrainCell: 14, texScale: 0.75 },
    low: { pixelRatio: 0.75, shadows: false, scenery: 0.45, terrainCell: 20, texScale: 0.5 },
};
class Gfx {
    constructor() {
        this.canvas = null;
        this.renderer = null;
        this.quality = 'medium';
        this.setting = 'auto';
        this.gpu = '';
        this.visible = false;
        /** Rectangle of the 1280x720 game area in CSS pixels (kept in sync with the 2D canvas letterbox). */
        this.rect = { x: 0, y: 0, w: 1280, h: 720 };
        this.frameTimes = [];
        this.onQualityChange = null;
    }
    get preset() { return PRESETS[this.quality]; }
    /** Creates the renderer. Returns false when WebGL is not available (the game then uses the flat 2D map). */
    init(setting) {
        if (this.renderer)
            return true;
        try {
            const c = document.createElement('canvas');
            c.id = 'world';
            c.setAttribute('aria-hidden', 'true');
            const game = document.getElementById('game');
            document.body.insertBefore(c, game);
            this.canvas = c;
            this.setting = setting;
            const test = document.createElement('canvas').getContext('webgl2');
            if (!test)
                throw new Error('no webgl2');
            const dbg = test.getExtension('WEBGL_debug_renderer_info');
            this.gpu = String(dbg ? test.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : test.getParameter(test.RENDERER));
            test.getExtension('WEBGL_lose_context')?.loseContext();
            this.quality = setting === 'auto' ? this.guess() : setting;
            this.renderer = new THREE.WebGLRenderer({ canvas: c, antialias: this.quality !== 'low', powerPreference: 'high-performance' });
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.shadowMap.autoUpdate = false;
            this.show(false);
            return true;
        }
        catch (e) {
            console.warn('3D view unavailable, using the flat map', e);
            this.canvas?.remove();
            this.canvas = null;
            this.renderer = null;
            return false;
        }
    }
    /** A first guess from the GPU name: software renderers and small mobile GPUs start on low. */
    guess() {
        const g = this.gpu.toLowerCase();
        if (/swiftshader|llvmpipe|software|mali-[gt]5|mali-4|powervr|adreno \(tm\) [1-5]\d\d\b/.test(g))
            return 'low';
        if (/intel|mali|adreno|apple gpu|mesa/.test(g) || (navigator.hardwareConcurrency || 4) <= 4)
            return 'medium';
        return 'high';
    }
    setQuality(q) {
        if (q === this.quality)
            return;
        this.quality = q;
        this.frameTimes = [];
        this.layout(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        this.onQualityChange?.(q);
    }
    show(on) {
        this.visible = on;
        if (this.canvas)
            this.canvas.style.display = on ? 'block' : 'none';
    }
    layout(x, y, w, h) {
        this.rect = { x, y, w, h };
        if (!this.renderer || !this.canvas)
            return;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.preset.pixelRatio));
        this.renderer.setSize(Math.round(w), Math.round(h), false);
        Object.assign(this.canvas.style, { position: 'fixed', left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, inset: 'auto' });
    }
    /** Called once per frame while the 3D board is showing. In 'auto' mode, steps quality down if frames are slow. */
    watch(dt) {
        if (this.setting !== 'auto' || document.hidden)
            return;
        this.frameTimes.push(dt);
        if (this.frameTimes.length < 150)
            return;
        const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.frameTimes = [];
        if (avg > 26 && this.quality !== 'low')
            this.setQuality(this.quality === 'high' ? 'medium' : 'low');
    }
}
export const gfx = new Gfx();
//# sourceMappingURL=gfx.js.map