// Loads the Kenney models (CC0, kenney.nl) and turns them into plain geometry that can be merged into a few big meshes.
// Every Kenney kit uses one small palette texture, so all models from a kit can share a single material and draw call.
// The Nature Kit uses flat colours instead; those are turned into vertex colours with our own, brighter palette.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
/** Our palette for the Nature Kit's named colours (sRGB hex). */
const NATURE = {
    leafsGreen: '#5dbb46', leafsDark: '#2f8f4e', leafsFall: '#e8902e',
    woodBark: '#8a5a36', woodBarkDark: '#6e4427', wood: '#b27a4a', woodDark: '#7b4f2c', woodInner: '#e9cfa6', woodBirch: '#f2ece0',
    grass: '#62b84a', dirt: '#a07450', dirtDark: '#7a5638', stone: '#a9b0b3', stoneDark: '#868e92', water: '#7fd0f0', corn: '#f2c35a',
    colorRed: '#e04a4f', colorRedDark: '#b83338', colorPurple: '#9b7fe8', colorTan: '#f2b27a', colorWhite: '#ffffff', colorYellow: '#ffc84a',
    _defaultMat: '#dddddd',
};
const LEAF = new Set(['leafsGreen', 'leafsDark', 'leafsFall']);
const loader = new GLTFLoader();
const protos = new Map();
export const kitTextures = new Map();
let BASE = 'assets/models/';
export function setModelBase(b) { BASE = b; }
function kitOf(path) { return path.split('/')[0]; }
/** Loads every model in the list (paths relative to assets/models/, without .glb). Missing files are skipped. */
export async function loadModels(paths, onProgress) {
    let done = 0;
    const todo = paths.filter((p) => !protos.has(p));
    const queue = todo.slice();
    const worker = async () => {
        for (;;) {
            const path = queue.shift();
            if (!path)
                return;
            try {
                const g = await loader.loadAsync(BASE + path + '.glb');
                protos.set(path, toProto(g.scene, kitOf(path)));
            }
            catch (e) {
                console.warn('model missing', path, e);
            }
            onProgress?.(++done, todo.length);
        }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
}
export function has(path) { return protos.has(path); }
export function proto(path) { return protos.get(path); }
function toProto(root, kit) {
    root.updateMatrixWorld(true);
    const parts = [];
    root.traverse((o) => {
        const m = o;
        if (!m.isMesh)
            return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const src = m.geometry;
        const groups = src.groups.length ? src.groups : [{ start: 0, count: src.index ? src.index.count : src.attributes.position.count, materialIndex: 0 }];
        for (const gr of groups) {
            const mat = mats[gr.materialIndex ?? 0];
            let geo = src.index ? src.toNonIndexed() : src.clone();
            if (src.groups.length) {
                // keep only this group's triangles
                const start = src.index ? gr.start : gr.start, count = gr.count;
                geo = sliceGeo(geo, start, count);
            }
            geo.applyMatrix4(m.matrixWorld);
            if (mat.map) {
                if (!kitTextures.has(kit)) {
                    const t = mat.map;
                    t.colorSpace = THREE.SRGBColorSpace;
                    t.magFilter = THREE.NearestFilter; // palette textures stay crisp
                    t.minFilter = THREE.NearestMipmapLinearFilter;
                    kitTextures.set(kit, t);
                }
                keep(geo, ['position', 'normal', 'uv']);
                parts.push({ geo, key: 'tex:' + kit });
            }
            else {
                const name = mat.name || '';
                const hex = NATURE[name] ?? '#' + mat.color.getHexString(THREE.SRGBColorSpace);
                paint(geo, new THREE.Color(hex));
                parts.push({ geo, key: LEAF.has(name) ? 'leaf' : 'vc' });
            }
        }
    });
    const box = new THREE.Box3();
    for (const p of parts) {
        p.geo.computeBoundingBox();
        box.union(p.geo.boundingBox);
    }
    return { parts, box, size: box.getSize(new THREE.Vector3()) };
}
function sliceGeo(g, start, count) {
    const out = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(g.attributes)) {
        const at = a;
        out.setAttribute(k, new THREE.BufferAttribute(at.array.slice(start * at.itemSize, (start + count) * at.itemSize), at.itemSize, at.normalized));
    }
    return out;
}
/** Keeps only the named attributes, so geometries from different models can be merged. */
export function keep(g, names) {
    for (const k of Object.keys(g.attributes))
        if (!names.includes(k))
            g.deleteAttribute(k);
    if (!g.attributes.normal)
        g.computeVertexNormals();
}
/** Gives a geometry one flat vertex colour (for the 'vc' batch). */
export function paint(g, c) {
    keep(g, ['position', 'normal']);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    const lin = c.clone(); // THREE.Color stores linear values already
    for (let i = 0; i < n; i++) {
        arr[i * 3] = lin.r;
        arr[i * 3 + 1] = lin.g;
        arr[i * 3 + 2] = lin.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
}
/**
 * Collects transformed geometry into batches, split into square chunks so that off-screen parts
 * of the map are skipped by the GPU. build() turns every batch into one mesh.
 */
export class Batcher {
    constructor(chunk = 640) {
        this.chunk = chunk;
        this.map = new Map();
    }
    bucket(key, x, z) {
        const k = `${Math.floor(x / this.chunk)},${Math.floor(z / this.chunk)}|${key}`;
        let a = this.map.get(k);
        if (!a)
            this.map.set(k, (a = []));
        return a;
    }
    /** Adds a model at (x, y, z), turned by rotY and scaled. scale may be a number or [sx, sy, sz]. */
    addModel(path, x, y, z, rotY = 0, scale = 1, tint) {
        const p = protos.get(path);
        if (!p)
            return false;
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), Array.isArray(scale) ? new THREE.Vector3(...scale) : new THREE.Vector3(scale, scale, scale));
        for (const part of p.parts) {
            const g = part.geo.clone().applyMatrix4(m);
            if (tint && part.key !== 'tex:' + kitOf(path)) {
                const col = g.attributes.color;
                if (col)
                    for (let i = 0; i < col.count; i++)
                        col.setXYZ(i, col.getX(i) * tint.r, col.getY(i) * tint.g, col.getZ(i) * tint.b);
            }
            this.bucket(part.key, x, z).push(g);
        }
        return true;
    }
    /** Adds an already-coloured geometry (see paint()) with a transform. */
    addGeo(g, m, key = 'vc') {
        const gg = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
        const e = new THREE.Vector3().setFromMatrixPosition(m);
        this.bucket(key, e.x, e.z).push(gg);
    }
    build(material, opts = {}) {
        const out = [];
        for (const [k, geos] of this.map) {
            if (!geos.length)
                continue;
            const key = k.split('|')[1];
            const merged = mergeGeometries(geos, false);
            if (!merged) {
                console.warn('merge failed', k);
                continue;
            }
            merged.computeBoundingSphere();
            const mesh = new THREE.Mesh(merged, material(key));
            mesh.castShadow = !!opts.cast;
            mesh.receiveShadow = !!opts.receive;
            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();
            out.push(mesh);
            for (const g of geos)
                g.dispose();
        }
        this.map.clear();
        return out;
    }
}
/** One shared material per batch key. Leaves get a season tint that can change every month. */
export const seasonUniforms = { uSeasonTint: { value: new THREE.Color(1, 1, 1) }, uSeasonAmt: { value: 0 } };
const mats = new Map();
export function materialFor(key) {
    let m = mats.get(key);
    if (m)
        return m;
    if (key.startsWith('tex:')) {
        m = new THREE.MeshLambertMaterial({ map: kitTextures.get(key.slice(4)) ?? null });
    }
    else if (key === 'leaf') {
        const lm = new THREE.MeshLambertMaterial({ vertexColors: true });
        lm.onBeforeCompile = (sh) => {
            Object.assign(sh.uniforms, seasonUniforms);
            sh.fragmentShader = 'uniform vec3 uSeasonTint;\nuniform float uSeasonAmt;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  float lum = dot(diffuseColor.rgb, vec3(0.35, 0.5, 0.15));\n  diffuseColor.rgb = mix(diffuseColor.rgb, uSeasonTint * (0.55 + lum * 1.6), uSeasonAmt);');
        };
        m = lm;
    }
    else {
        m = new THREE.MeshLambertMaterial({ vertexColors: true });
    }
    mats.set(key, m);
    return m;
}
/** A small helper for procedural, Kenney-style shapes: a coloured primitive, ready for Batcher.addGeo. */
export function prim(g, color) {
    const gg = g.index ? g.toNonIndexed() : g;
    return paint(gg, new THREE.Color(color));
}
export function mergeColored(list) {
    return mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false);
}
//# sourceMappingURL=models.js.map