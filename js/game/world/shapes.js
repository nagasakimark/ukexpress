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
    merge(other) { this.list.push(...other.list); return this; }
    geometry() {
        const g = mergeGeometries(this.list, false);
        g.computeBoundingBox();
        return g;
    }
}
//# sourceMappingURL=shapes.js.map