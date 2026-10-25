// Helpers for small procedural models in the same flat-coloured, chunky style as the Kenney kits.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paint } from './models.js';
/** A triangular prism (a pitched roof): length w along x, depth d along z, height h, base at y = 0. */
export function prismGeo(w, h, d) {
    const s = new THREE.Shape();
    s.moveTo(-d / 2, 0);
    s.lineTo(d / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.translate(0, 0, -w / 2);
    g.rotateY(Math.PI / 2);
    return g;
}
/** Builds one vertex-coloured geometry out of many coloured primitives. */
export class Shape {
    constructor() {
        this.list = [];
        /** Open water this shape wants beside it: [x, z, w, d, round]. The sprite studio leaves it out of the sprite and the board paints it instead. */
        this.waters = [];
    }
    water(w, d, x = 0, z = 0, round = false, color = '#5fb6e6') {
        this.waters.push([x, z, w, d, round ? 1 : 0]);
        if (Shape.drawWater) {
            if (round)
                this.cyl(w / 2, w / 2, 0.6, color, x, 0, z, 20);
            else
                this.box(w, 0.6, d, color, x, 0, z);
        }
        return this;
    }
    add(g, color, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
        const gg = g.index ? g.toNonIndexed() : g.clone();
        if (rx || ry || rz)
            gg.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
        gg.translate(x, y, z);
        this.list.push(paint(gg, new THREE.Color(color)));
        return this;
    }
    box(w, h, d, color, x = 0, y = 0, z = 0, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, ry); }
    cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 10) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y + h / 2, z); }
    /** A cylinder lying along x (a boiler) or z (axis = 'z'). */
    tube(r, len, color, x = 0, y = 0, z = 0, axis = 'x', seg = 12) {
        const g = new THREE.CylinderGeometry(r, r, len, seg);
        return this.add(g, color, x, y, z, 0, axis === 'z' ? Math.PI / 2 : 0, axis === 'x' ? Math.PI / 2 : 0);
    }
    cone(r, h, color, x = 0, y = 0, z = 0, seg = 10) { return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z); }
    sphere(r, color, x = 0, y = 0, z = 0, seg = 8) { return this.add(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)), color, x, y, z); }
    roof(w, h, d, color, x = 0, y = 0, z = 0, ry = 0) { return this.add(prismGeo(w, h, d), color, x, y, z, ry); }
    merge(other) { this.list.push(...other.list); this.waters.push(...other.waters); return this; }
    /** Copies another shape in, turned about y by ry and moved to (x, y, z). */
    place(other, x, y, z, ry = 0) {
        const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
        for (const g of other.list)
            this.list.push(g.clone().applyMatrix4(m));
        for (const [wx, wz, w, d, r] of other.waters) {
            const c = Math.cos(ry), sn = Math.sin(ry);
            this.waters.push([x + wx * c + wz * sn, z - wx * sn + wz * c, Math.abs(c) > 0.7 ? w : d, Math.abs(c) > 0.7 ? d : w, r]);
        }
        return this;
    }
    /** A round clock dial (white face, dark rim, 12 ticks, two hands) standing upright, facing +z, centred at (x, y, z). */
    clock(r, x = 0, y = 0, z = 0) {
        this.tube(r + 0.9, 1.3, '#3a3a40', x, y, z - 0.2, 'z', 20);
        this.tube(r, 1.7, '#fffaf0', x, y, z, 'z', 20);
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            this.add(new THREE.BoxGeometry(0.5, r * 0.18, 0.5), '#3a3a40', x + Math.sin(a) * r * 0.82, y + Math.cos(a) * r * 0.82, z + 1, 0, 0, -a);
        }
        this.add(new THREE.BoxGeometry(0.7, r * 0.78, 0.5), '#2a2a30', x + r * 0.1, y + r * 0.34, z + 1.2, 0, 0, -0.25);
        this.add(new THREE.BoxGeometry(0.55, r * 0.55, 0.5), '#2a2a30', x - r * 0.2, y + r * 0.04, z + 1.2, 0, 0, 1.0);
        return this;
    }
    /** The same clock on the front and back of a square tower of half-width `half`. */
    clock4(r, x, y, z, half) {
        const c = new Shape().clock(r);
        return this.place(c, x, y, z + half + 0.5, 0).place(c, x, y, z - half - 0.5, Math.PI);
    }
    geometry() {
        const g = mergeGeometries(this.list, false);
        g.computeBoundingBox();
        return g;
    }
}
Shape.drawWater = true;
//# sourceMappingURL=shapes.js.map