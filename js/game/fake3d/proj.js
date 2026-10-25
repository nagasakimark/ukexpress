// The fixed Momotetsu-style camera: it only ever slides and zooms, never turns, so every object can be a
// picture rendered once from this same angle (see tools/studio.html). The ground is drawn in true perspective.
//
// World units are grid cells: x grows to the east, z grows to the south (towards the viewer), y is up.
/** Angle between the centre view ray and the ground. Sprites are pre-rendered at exactly this angle. */
export const PITCH = 42 * Math.PI / 180;
/** Focal length in screen pixels (a long lens gives gentle perspective, like Momotetsu). */
export const FOCAL = 2000;
/** Screen pixels per cell at the look-at point when zoom = 1. */
export const BASE_PPC = 190;
/** Model units per cell (the 3D models are built in these units). */
export const UNITS_PER_CELL = 100;
export class Camera {
    constructor() {
        /** Look-at point on the ground, in cells. */
        this.x = 0;
        this.z = 0;
        this.zoom = 1;
        /** Where on the screen the look-at point appears. */
        this.cx = 640;
        this.cy = 400;
        this.sin = Math.sin(PITCH);
        this.cos = Math.cos(PITCH);
        this.D = 10;
        this.Cx = 0;
        this.Cy = 0;
        this.Cz = 0;
    }
    /** Call after changing x, z or zoom. */
    update() {
        this.D = FOCAL / (BASE_PPC * this.zoom);
        this.Cx = this.x;
        this.Cy = this.D * this.sin;
        this.Cz = this.z + this.D * this.cos;
    }
    project(X, Y, Z, out = { x: 0, y: 0, s: 0, depth: 0 }) {
        const rx = X - this.Cx, ry = Y - this.Cy, rz = Z - this.Cz;
        const depth = -ry * this.sin - rz * this.cos;
        const yc = ry * this.cos - rz * this.sin;
        const k = FOCAL / Math.max(0.05, depth);
        out.x = this.cx + rx * k;
        out.y = this.cy - yc * k;
        out.s = k;
        out.depth = depth;
        return out;
    }
    /** The ground row seen at screen row sy: its z and how many pixels one cell is wide there. Null above the horizon. */
    groundRow(sy) {
        const v = (this.cy - sy) / FOCAL;
        const dy = -this.sin + v * this.cos;
        if (dy >= -1e-4)
            return null;
        const t = -this.Cy / dy;
        return { z: this.Cz + t * (-this.cos - v * this.sin), s: FOCAL / t };
    }
    /** The point on the ground under a screen pixel. */
    unproject(sx, sy) {
        const v = (this.cy - sy) / FOCAL;
        const dy = -this.sin + v * this.cos;
        const t = -this.Cy / Math.min(-1e-4, dy);
        return { x: this.Cx + t * (sx - this.cx) / FOCAL, z: this.Cz + t * (-this.cos - v * this.sin) };
    }
}
//# sourceMappingURL=proj.js.map