// The players' trains in 3D. Each train type looks like the real engine it is named after;
// carriages and the roof pennant are painted in the player's colour so everyone can find their own train.
import * as THREE from 'three';
import { Shape } from './shapes.js';
import { has, proto, kitTextures, materialFor } from './models.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const BLACK = '#26262a', IRON = '#4a4d55', BRASS = '#d8b24a', WHEEL_RED = '#b8322e';
function wheels(sh, zs, r, color = BLACK, w = 13) {
    for (const z of zs)
        for (const x of [-w / 2, w / 2]) {
            sh.tube(r, 1.8, color, x, r, z, 'x', 12);
            sh.tube(r * 0.4, 2.0, '#c9c9c9', x * 1.04, r, z, 'x', 8);
        }
}
/** Builds a locomotive facing +z, length about 44, wheels on y = 0. */
export function locoShape(type, paint = '#f0c419') {
    const sh = new Shape();
    switch (type) {
        case 0: { // Puffing Billy, 1813
            sh.box(14, 3, 32, '#5a3c26', 0, 4, 0);
            wheels(sh, [-9, 9], 5);
            sh.tube(6, 24, '#3f3f45', 0, 13, 1, 'z');
            sh.cyl(1.8, 2.2, 26, BLACK, 0, 13, 13, 8);
            sh.box(16, 1.6, 2, '#6b4a2e', 0, 22, -2);
            for (const z of [-8, 6])
                sh.box(1.2, 9, 1.2, '#6b4a2e', 0, 19, z);
            sh.box(12, 6, 8, '#7a5a3a', 0, 7, -13);
            break;
        }
        case 1: { // Stephenson's Rocket, 1829
            sh.box(12, 2.5, 30, '#4a3a2a', 0, 4, 0);
            wheels(sh, [8], 8, '#e8c04a', 14);
            wheels(sh, [-8], 4.5, '#e8c04a', 14);
            sh.add(new THREE.CylinderGeometry(6, 6, 22, 14), paint, 0, 15, 0, 0, Math.PI / 2 - 0.12);
            sh.cyl(2, 2.6, 26, '#f4f4f0', 0, 14, 12, 10);
            sh.box(14, 1.2, 1.2, BRASS, 0, 39, 12);
            sh.box(10, 10, 6, paint, 0, 6, -11);
            for (const s of [-1, 1])
                sh.add(new THREE.BoxGeometry(1, 1, 16), IRON, s * 7, 13, 2, 0, 0.5);
            break;
        }
        case 2: { // Flying Scotsman, 1923
            sh.box(14, 4, 40, BLACK, 0, 4, 0);
            wheels(sh, [12, 4], 4, WHEEL_RED);
            wheels(sh, [-4, -12], 6.5, WHEEL_RED);
            sh.tube(7, 26, '#2e8b3e', 0, 16, 4, 'z');
            sh.tube(7.3, 6, '#2a2a2e', 0, 16, 18, 'z');
            sh.cyl(2.2, 2.6, 6, BLACK, 0, 22, 16, 10);
            sh.cyl(2.2, 2.4, 3, BRASS, 0, 22, 4, 10);
            sh.box(15, 17, 9, '#2e8b3e', 0, 8, -14);
            sh.box(16, 2, 11, BLACK, 0, 25, -14);
            sh.box(9, 5, 0.5, '#9fd3ff', 0, 17, -9.6);
            sh.box(16, 1.2, 40, '#2e8b3e', 0, 8, 0);
            break;
        }
        case 3: { // Mallard, 1938: streamlined and blue
            sh.box(15, 6, 42, '#24323f', 0, 3, 0);
            wheels(sh, [-12, -3, 6], 6, WHEEL_RED, 15);
            sh.box(16, 13, 26, '#2f5fa8', 0, 9, -4);
            sh.add(new THREE.SphereGeometry(8.2, 14, 10).scale(1, 0.95, 1.7), '#2f5fa8', 0, 13, 9);
            sh.box(16.2, 2, 30, '#d6283a', 0, 4, -4);
            sh.box(17, 2.2, 42, '#c0c6cc', 0, 7, 0);
            sh.box(16, 18, 8, '#2f5fa8', 0, 4, -16);
            sh.box(10, 5, 0.5, '#9fd3ff', 0, 15, -20.3);
            break;
        }
        case 4: { // InterCity 125, 1976
            sh.box(16, 4, 44, '#2b2b2b', 0, 2, 0);
            wheels(sh, [-14, -8, 8, 14], 3.2, BLACK, 14);
            sh.box(17, 16, 32, '#1f3a8a', 0, 6, -6);
            sh.box(17.2, 5, 32, '#e8e8e8', 0, 10, -6);
            sh.add(new THREE.BoxGeometry(17, 16, 14).translate(0, 0, 0), '#f2c230', 0, 14, 16, 0, -0.25);
            sh.box(14, 4.5, 0.6, BLACK, 0, 17, 22.6);
            sh.box(17.4, 1.4, 44, '#dfe3e6', 0, 22, -1);
            break;
        }
        default: { // Azuma (built by Hitachi): white with a red stripe and a long nose
            sh.box(16, 4, 44, '#3a3a3e', 0, 2, 0);
            wheels(sh, [-14, -8, 8, 14], 3.2, BLACK, 14);
            sh.box(17, 18, 28, '#f4f4f2', 0, 6, -8);
            sh.add(new THREE.SphereGeometry(9, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#f4f4f2', 0, 6, 6, 0, Math.PI / 2, 0);
            sh.add(new THREE.BoxGeometry(17, 14, 16), '#f4f4f2', 0, 13, 12, 0, -0.42);
            sh.box(17.4, 2.6, 40, '#d6283a', 0, 9, -2);
            sh.box(12, 5, 0.6, '#1d2733', 0, 18, 18.6);
            break;
        }
    }
    return sh;
}
function carriageShape(color) {
    const sh = new Shape();
    sh.box(15, 3, 34, '#2a2a2e', 0, 3, 0);
    wheels(sh, [-11, 11], 3, BLACK, 13);
    sh.box(16, 13, 34, color, 0, 6, 0);
    sh.box(16.4, 4, 30, '#eaf6ff', 0, 11, 0);
    for (let z = -12; z <= 12; z += 6)
        sh.box(16.6, 3.2, 1.2, color, 0, 11.4, z);
    sh.box(17, 2, 35, '#dfe3e6', 0, 19, 0);
    return sh;
}
const geoCache = new Map();
function cached(key, make) { let g = geoCache.get(key); if (!g)
    geoCache.set(key, (g = make())); return g; }
/** Kenney Train Kit models, used when present (drop the kit into assets/models/train/). */
const KENNEY_FOR_TYPE = {
    0: ['train/train-locomotive-b'], // Puffing Billy (Rocket stays home-made: yellow, tall chimney)
    2: ['train/train-locomotive-a'], // Flying Scotsman: green
    3: ['train/train-locomotive-c'], // Mallard: blue
    4: ['train/train-diesel-a'], // InterCity 125: yellow nose
    5: ['train/train-electric-city-a', 'train/train-electric-bullet-a', 'train/train-electric-square-a'], // Azuma: white and red
};
export const KENNEY_TRAINS = [...new Set(Object.values(KENNEY_FOR_TYPE).flat()), 'train/train-locomotive-passenger-a'];
/** Kenney's passenger carriage, with its orange paint swapped for the player's colour. */
export function kenneyCarriage(color) {
    const path = 'train/train-locomotive-passenger-a';
    if (!has(path))
        return null;
    const g = cached(path, () => normalise(path));
    const mat = new THREE.MeshLambertMaterial({ map: kitTextures.get('train') ?? null });
    const col = new THREE.Color(color);
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uPlayer = { value: col };
        sh.fragmentShader = 'uniform vec3 uPlayer;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  vec3 c0 = diffuseColor.rgb;
  float orange = step(0.35, c0.r - c0.b) * step(c0.g, c0.r * 0.8) * step(0.2, c0.r);
  float lum = dot(c0, vec3(0.3, 0.59, 0.11));
  float mx = max(c0.r, max(c0.g, c0.b)), mn = min(c0.r, min(c0.g, c0.b));
  float satv = (mx - mn) / max(mx, 0.001); float roof = step(0.2, satv) * step(satv, 0.62) * step(lum, 0.5) * step(0.1, lum);
  vec3 outc = mix(c0, uPlayer * (0.55 + c0.r * 0.6), orange);
  diffuseColor.rgb = mix(outc, uPlayer * (0.4 + lum * 1.5), roof * (1.0 - orange));`);
    };
    mat.customProgramCacheKey = () => 'carriage';
    return new THREE.Mesh(g, mat);
}
function normalise(path) {
    const p = proto(path);
    const m = mergeGeometries(p.parts.map((x) => x.geo), false).clone();
    const c = p.box.getCenter(new THREE.Vector3());
    const len = Math.max(p.size.x, p.size.z);
    m.translate(-c.x, -p.box.min.y, -c.z);
    if (p.size.x > p.size.z)
        m.rotateY(Math.PI / 2);
    m.scale(42 / len, 42 / len, 42 / len);
    return m;
}
/** Kenney's engines with their paint (reds, oranges, yellows, greens) swapped for the player's colour; windows and metal stay as they are. */
export function kenneyLoco(type, color) {
    const path = (KENNEY_FOR_TYPE[type] ?? []).find((p) => has(p));
    if (!path)
        return null;
    const g = cached(path, () => normalise(path));
    if (!color)
        return new THREE.Mesh(g, trainMat());
    const mat = new THREE.MeshLambertMaterial({ map: kitTextures.get('train') ?? null });
    const col = new THREE.Color(color);
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uPlayer = { value: col };
        sh.fragmentShader = 'uniform vec3 uPlayer;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  vec3 c0 = diffuseColor.rgb;
  float mx = max(c0.r, max(c0.g, c0.b)), mn = min(c0.r, min(c0.g, c0.b));
  float sat = (mx - mn) / max(mx, 0.001);
  float hue = 0.0;
  if (mx - mn > 0.001) {
    if (mx == c0.r) hue = mod((c0.g - c0.b) / (mx - mn), 6.0);
    else if (mx == c0.g) hue = (c0.b - c0.r) / (mx - mn) + 2.0;
    else hue = (c0.r - c0.g) / (mx - mn) + 4.0;
  }
  hue /= 6.0;
  float blue = ${type === 3 ? '0.0' : 'step(0.5, hue) * step(hue, 0.74)'};
  float paint = step(0.3, sat) * step(0.3, mx) * (1.0 - blue);
  float lum = dot(c0, vec3(0.3, 0.59, 0.11));
  diffuseColor.rgb = mix(c0, uPlayer * (0.45 + lum * 0.85), paint);`);
    };
    mat.customProgramCacheKey = () => 'locopaint' + type;
    return new THREE.Mesh(g, mat);
}
let tm = null;
function trainMat() { return (tm ?? (tm = new THREE.MeshLambertMaterial({ map: kitTextures.get('train') ?? null }))); }
let shadowTex = null;
function blobTexture() {
    if (shadowTex)
        return shadowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 31);
    grd.addColorStop(0, 'rgba(0,0,0,0.5)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
    return shadowTex;
}
let CAR_GAP = 38;
export class Train3D {
    constructor(color) {
        this.color = color;
        this.group = new THREE.Group();
        this.loco = new THREE.Group();
        this.cars = [];
        this.heading = 0;
        this.trail = [];
        this.type = -1;
        this.scale = 1;
        const vc = materialFor('vc');
        this.group.add(this.loco);
        const pole = new THREE.Mesh(cached('pole', () => new Shape().cyl(0.5, 0.5, 14, BLACK, 0, 0, 0, 6).geometry()), vc);
        const flagShape = new THREE.Shape();
        flagShape.moveTo(0, 0);
        flagShape.lineTo(12, -3.5);
        flagShape.lineTo(0, -7);
        flagShape.closePath();
        this.pennant = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
        this.pennant.position.set(0, 14, 0);
        pole.add(this.pennant);
        pole.name = 'pole';
        this.loco.add(pole);
        if (has('train/train-locomotive-passenger-a'))
            CAR_GAP = 44;
        for (let i = 0; i < 3; i++) {
            const car = new THREE.Group();
            const m = kenneyCarriage(color) ?? new THREE.Mesh(cached('car:' + color, () => carriageShape(color).geometry()), vc);
            m.castShadow = true;
            car.add(m);
            car.add(this.blob(36, 18));
            this.cars.push(car);
            this.group.add(car);
        }
        this.loco.add(this.blob(44, 20));
    }
    blob(l, w) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, l * 1.25), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.4;
        m.renderOrder = 1;
        return m;
    }
    setType(type) {
        if (type === this.type)
            return;
        this.type = type;
        for (const c of [...this.loco.children])
            if (c.name === 'loco')
                this.loco.remove(c);
        const k = kenneyLoco(type);
        const mesh = k ?? new THREE.Mesh(cached('loco' + type, () => locoShape(type).geometry()), materialFor('vc'));
        mesh.name = 'loco';
        mesh.castShadow = true;
        this.loco.add(mesh);
        const pole = this.loco.getObjectByName('pole');
        pole.position.set(-4, type <= 1 ? 14 : 20, -14);
    }
    setCarriages(n) { this.cars.forEach((c, i) => (c.visible = i < n)); }
    /** Moves the engine; carriages follow the path the engine has driven along. */
    place(x, y, z, t) {
        const last = this.trail[0];
        if (!last) {
            for (let i = 0; i < 60; i++)
                this.trail.push({ x: x - Math.sin(this.heading) * i * 2, z: z - Math.cos(this.heading) * i * 2, y });
        }
        else {
            const d = Math.hypot(x - last.x, z - last.z);
            if (d > 0.5) {
                this.heading = Math.atan2(x - last.x, z - last.z);
                if (d > 60) {
                    this.trail = [];
                    this.place(x, y, z, t);
                    return;
                }
                this.trail.unshift({ x, z, y });
                if (this.trail.length > 400)
                    this.trail.length = 400;
            }
        }
        const bob = Math.sin(t / 110 + this.color.length) * 0.25;
        this.loco.position.set(x, y + bob, z);
        this.loco.rotation.y = this.heading;
        this.loco.scale.setScalar(this.scale);
        this.pennant.rotation.y = Math.sin(t / 160) * 0.25;
        // carriages along the trail
        let acc = 0, idx = 0;
        const pts = this.trail;
        this.cars.forEach((car, i) => {
            if (!car.visible)
                return;
            const want = (i + 1) * CAR_GAP * this.scale + 2;
            while (idx < pts.length - 1 && acc + Math.hypot(pts[idx + 1].x - pts[idx].x, pts[idx + 1].z - pts[idx].z) < want) {
                acc += Math.hypot(pts[idx + 1].x - pts[idx].x, pts[idx + 1].z - pts[idx].z);
                idx++;
            }
            const a = pts[idx], b = pts[Math.min(idx + 1, pts.length - 1)];
            const seg = Math.max(1e-6, Math.hypot(b.x - a.x, b.z - a.z));
            const f = Math.min(1, (want - acc) / seg);
            const cx = a.x + (b.x - a.x) * f, cz = a.z + (b.z - a.z) * f;
            const ahead = pts[Math.max(0, idx - 4)];
            car.position.set(cx, a.y + (b.y - a.y) * f, cz);
            car.rotation.y = Math.atan2(ahead.x - cx, ahead.z - cz) || this.heading;
            car.scale.setScalar(this.scale);
        });
    }
    /** Where the chimney is (for steam puffs). */
    chimney() {
        const fwd = this.type <= 1 ? 12 : 16;
        return new THREE.Vector3(this.loco.position.x + Math.sin(this.heading) * fwd * this.scale, this.loco.position.y + (this.type === 1 ? 40 : 34) * this.scale, this.loco.position.z + Math.cos(this.heading) * fwd * this.scale);
    }
    get position() { return this.loco.position; }
}
/** Small white puffs from steam engines. One instanced mesh for all of them. */
export class Smoke {
    constructor(max = 48) {
        this.parts = [];
        this.m = new THREE.Matrix4();
        this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: '#f4f4f4', emissive: '#555555' }), max);
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
    }
    emit(at, size = 4) {
        if (this.parts.length >= this.mesh.instanceMatrix.count)
            this.parts.shift();
        this.parts.push({ p: at.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 0.01, 0.025 + Math.random() * 0.01, (Math.random() - 0.5) * 0.01), age: 0, life: 1400 + Math.random() * 500, s: size });
    }
    update(dt) {
        this.parts = this.parts.filter((q) => (q.age += dt) < q.life);
        this.parts.forEach((q, i) => {
            q.p.addScaledVector(q.v, dt);
            const k = q.age / q.life;
            const s = q.s * (0.6 + k * 1.6) * (k > 0.7 ? (1 - k) / 0.3 : 1);
            this.m.makeScale(s, s, s).setPosition(q.p);
            this.mesh.setMatrixAt(i, this.m);
        });
        this.mesh.count = this.parts.length;
        this.mesh.instanceMatrix.needsUpdate = true;
    }
}
//# sourceMappingURL=trains3d.js.map