// Sprite studio: builds every 3D model (Kenney kits + our own procedural shapes) and renders it once with an
// orthographic camera at the board camera's fixed angle (fake3d/proj.ts PITCH). The game then only draws pictures,
// so the board costs no more than a 2D game on a school Chromebook. Driven by tools/render_sprites.py.
import * as THREE from 'three';
import { loadModels, setModelBase, materialFor, seasonUniforms, Batcher, has } from '../game/world/models.js';
import { Shape } from '../game/world/shapes.js';
import { LANDMARKS, LANDMARK_MODELS, G, SEASON_LOOK } from '../game/world/landmarks.js';
import { LOOKS, LOOK_MODELS, STATION_BUILDERS } from '../game/world/looks.js';
import { kenneyLoco, kenneyCarriage, locoShape, KENNEY_TRAINS } from '../game/world/trains3d.js';
import { PITCH } from '../game/fake3d/proj.js';
import { C } from '../engine/draw.js';
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight(0xffffff, 0xb8a888, 1.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0006;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.26 }));
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);
const LIGHT_DIR = new THREE.Vector3(-0.55, 1, 0.45).normalize();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000);
const camDir = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
/** Renders one object (origin on the ground = the sprite's anchor) and returns it as a PNG. */
function shoot(name, obj, ppu = 2.4, shadow = true, pitch = PITCH) {
    scene.add(obj);
    obj.updateMatrixWorld(true);
    obj.traverse((o) => { const m = o; if (m.isMesh) {
        m.castShadow = shadow;
        m.receiveShadow = false;
    } });
    shadowPlane.visible = shadow;
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty())
        box.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 5, 5));
    // extend the box by the shadow cast on the ground
    const hgt = Math.max(1, box.max.y);
    const sl = hgt / LIGHT_DIR.y;
    const sb = box.clone();
    sb.expandByPoint(new THREE.Vector3(box.min.x - LIGHT_DIR.x * sl, 0, box.min.z - LIGHT_DIR.z * sl));
    sb.expandByPoint(new THREE.Vector3(box.max.x - LIGHT_DIR.x * sl, 0, box.max.z - LIGHT_DIR.z * sl));
    sb.min.y = Math.min(0, sb.min.y);
    // screen axes of the orthographic camera
    const s = Math.sin(pitch), c = Math.cos(pitch);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const x of [sb.min.x, sb.max.x])
        for (const y of [sb.min.y, sb.max.y])
            for (const z of [sb.min.z, sb.max.z]) {
                const u = x, v = y * c - z * s;
                u0 = Math.min(u0, u);
                u1 = Math.max(u1, u);
                v0 = Math.min(v0, v);
                v1 = Math.max(v1, v);
            }
    const pad = 4;
    u0 -= pad;
    u1 += pad;
    v0 -= pad;
    v1 += pad;
    const w = Math.min(2048, Math.ceil((u1 - u0) * ppu)), h = Math.min(2048, Math.ceil((v1 - v0) * ppu));
    renderer.setSize(w, h, false);
    cam.left = u0;
    cam.right = u0 + w / ppu;
    cam.top = v1;
    cam.bottom = v1 - h / ppu;
    cam.position.set(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(3000);
    cam.up.set(0, Math.cos(pitch), -Math.sin(pitch));
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    // light that follows the object
    const ctr = box.getCenter(new THREE.Vector3());
    sun.target.position.copy(ctr).setY(0);
    sun.position.copy(ctr).setY(0).addScaledVector(LIGHT_DIR, 800);
    const r = box.getSize(new THREE.Vector3()).length() / 2 + sl + 20;
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 2000 });
    sun.shadow.camera.updateProjectionMatrix();
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(obj);
    return { name, w, h, ax: (0 - u0) * ppu, ay: (v1 - 0) * ppu, ppu, url };
}
function batchToGroup(b) {
    const g = new THREE.Group();
    for (const m of b.build(materialFor))
        g.add(m);
    return g;
}
function model(path, scale, ry = 0, tint) {
    const b = new Batcher(1e6);
    b.addModel(path, 0, 0, 0, ry, scale, tint);
    return batchToGroup(b);
}
function landmark(id) {
    const build = STATION_BUILDERS[id] ?? LANDMARKS[id];
    if (!build)
        return null;
    const b = new Batcher(1e6);
    const group = new THREE.Group();
    const vc = materialFor('vc');
    const ctx = {
        b, anims: [], x: 0, z: 0, y: 0, sea: null,
        model: (path, dx, dz, s = 24, ry = 0, dy = 0, tint) => {
            if (path === 'cube/animal-cow') {
                b.addGeo(cowGeo(tint ? '#' + tint.getHexString() : null), new THREE.Matrix4().compose(new THREE.Vector3(dx, dy, dz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s / 8, s / 8, s / 8)));
                return;
            }
            b.addModel(path, dx, dy, dz, ry, s, tint);
        },
        seaModel: () => { }, seaShape: () => { }, animAt: () => { },
        shape: (sh, dx = 0, dz = 0, dy = 0) => b.addGeo(sh.geometry(), new THREE.Matrix4().makeTranslation(dx, dy, dz)),
        anim: (sh, dx, dz, dy, update) => { const m = new THREE.Mesh(sh.geometry(), vc); m.position.set(dx, dy, dz); update(m, 0); group.add(m); },
    };
    build(ctx);
    group.add(batchToGroup(b));
    return group;
}
// ---------- seasons for trees ----------
const SEASON = { su: ['#ffffff', 0], sp: ['#9be06a', 0.3], bl: ['#ffb3d1', 0.85], au: ['#f0902a', 0.85], ay: ['#f5c432', 0.85], wi: ['#eef3f6', 0.72] };
function setSeason(k) { const [c, a] = SEASON[k]; seasonUniforms.uSeasonTint.value.set(c); seasonUniforms.uSeasonAmt.value = a; }
function setLook(k) { Object.assign(G, SEASON_LOOK[k]); }
const DECID = ['tree-default', 'tree-oak', 'tree-fat', 'tree-detailed', 'tree-simple'];
const CONIF = ['tree-pinetalla', 'tree-pinetallb', 'tree-pinerounda', 'tree-cone'];
const LEAN_STEP = 3 * Math.PI / 180;
const LEAN_MAX = 6;
function jobs() {
    const out = [];
    // trees, per season: deciduous change colour, conifers only get snow
    for (const t of DECID)
        for (const se of ['su', 'sp', 'au', 'ay', 'wi'])
            out.push({ name: `tree/${t}/${se}`, make: () => model('nature/' + t, 30), season: se });
    for (const t of CONIF)
        for (const se of ['su', 'wi'])
            out.push({ name: `tree/${t}/${se}`, make: () => model('nature/' + t, 32), season: se });
    for (const t of ['palm-straight', 'palm-bend'])
        out.push({ name: `tree/${t}/su`, make: () => model('pirate/' + t, 28) });
    // countryside
    for (const [n, p, s] of [['rock-a', 'nature/rock-largea', 22], ['rock-b', 'nature/rock-largeb', 22], ['rock-tall', 'nature/rock-talla', 22], ['bush', 'nature/plant-bushdetailed', 18],
        ['pig', 'cube/animal-pig', 6], ['hay', 'graveyard/hay-bale', 8], ['flowers-r', 'nature/flower-redb', 16], ['flowers-y', 'nature/flower-yellowb', 16], ['flowers-p', 'nature/flower-purpleb', 16],
        ['corn', 'nature/crops-cornstagec', 16], ['wheat', 'nature/crops-wheatstageb', 16], ['fence', 'nature/fence-simple', 14],
        ['ship-large', 'pirate/ship-large', 5.5], ['ship-medium', 'pirate/ship-medium', 4.5], ['ship-small', 'pirate/ship-small', 3.4], ['boat', 'pirate/boat-row-small', 6],
        ['bus', 'car/van', 6], ['taxi', 'car/taxi', 6], ['tractor', 'car/tractor', 6]])
        out.push({ name: 'deco/' + n, make: () => model(p, s) });
    out.push({ name: 'deco/sheep', make: () => sheep() });
    out.push({ name: 'deco/cow', make: () => { const g = new THREE.Group(); const m = new THREE.Mesh(cowGeo(null), materialFor('vc')); m.scale.setScalar(1.1); m.rotation.y = 0.6; g.add(m); return g; } });
    for (const [d, a] of [['s', 0], ['e', Math.PI / 2], ['n', Math.PI], ['w', -Math.PI / 2]])
        out.push({ name: 'ferry/' + d, make: () => ferry(a), ppu: 2.6 });
    for (const k of ['su', 'sp', 'au', 'wi'])
        out.push({ name: 'deco/mountain/' + k, make: () => mountainSprite(k), ppu: 2.2, season: 'su', look: k });
    for (const se of ['su', 'sp', 'au', 'ay', 'wi']) {
        out.push({ name: `tree/puff-a/${se}`, make: () => puffTree(se, 0) });
        out.push({ name: `tree/puff-b/${se}`, make: () => puffTree(se, 1) });
    }
    for (const se of ['su', 'wi'])
        out.push({ name: `tree/fir/${se}`, make: () => firTree(se) });
    // houses and city blocks
    const SUB = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u'];
    for (const k of SUB)
        out.push({ name: 'house/sub-' + k, make: () => model('suburban/building-type-' + k, 17) });
    for (let v = 0; v < 8; v++)
        out.push({ name: 'house/brit-' + v, make: () => { const g = new THREE.Group(); g.add(new THREE.Mesh(houseGeo(v), materialFor('vc'))); return g; } });
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'])
        out.push({ name: 'city/low-' + k, make: () => model('city/low-detail-building-' + k, 19) });
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'])
        out.push({ name: 'city/bld-' + k, make: () => model('city/building-' + k, 17) });
    for (const k of ['a', 'b', 'c', 'd', 'e'])
        out.push({ name: 'city/sky-' + k, make: () => model('city/building-skyscraper-' + k, 17) });
    for (let i = 0; i < 24; i++)
        out.push({ name: 'city/blk-' + i, make: () => cityBlock(i, false) });
    for (let i = 0; i < 8; i++)
        out.push({ name: 'city/tall-' + i, make: () => cityBlock(i, true) });
    // landmarks: one per station
    for (const id of Object.keys({ ...LANDMARKS, ...STATION_BUILDERS }))
        out.push({ name: 'lm/' + id, make: () => landmark(id) });
    // landmarks with baked hills/lawns/snow also get autumn and winter versions
    for (const id of Object.keys({ ...LANDMARKS, ...STATION_BUILDERS }))
        for (const k of ['au', 'wi'])
            out.push({ name: `lm/${id}/${k}`, make: () => landmark(id), look: k });
    for (const look of Object.keys(LOOKS))
        out.push({ name: 'look/' + look, make: () => { const b = new Batcher(1e6); const g = new THREE.Group(); LOOKS[look](ctxFor(b, g)); g.add(batchToGroup(b)); return g; } });
    // trains: 6 engines x 4 directions, carriages in each player's colour
    const DIRS = [['s', 0], ['e', Math.PI / 2], ['n', Math.PI], ['w', -Math.PI / 2]];
    for (let t = 0; t < 6; t++)
        C.players.forEach((col, i) => { for (const [d, a] of DIRS)
            out.push({ name: `train/${t}/${i}/${d}`, make: () => engine(t, a, col), ppu: 2.6 }); });
    C.players.forEach((col, i) => { for (const [d, a] of DIRS)
        out.push({ name: `car/${i}/${d}`, make: () => carriage(col, a), ppu: 2.6 }); });
    // up/down the screen the rails lean with the perspective, so the same trains are also drawn turned a few degrees (bins 1-6 either side)
    for (let b = -LEAN_MAX; b <= LEAN_MAX; b++) {
        if (!b)
            continue;
        const tag = (b > 0 ? 'p' : 'm') + Math.abs(b), da = b * LEAN_STEP;
        for (const [d, a] of [['s', 0], ['n', Math.PI]])
            C.players.forEach((col, i) => {
                out.push({ name: `train/0/${i}/${d}/${tag}`, make: () => engine(0, a + da, col), ppu: 2.6 });
                out.push({ name: `car/${i}/${d}/${tag}`, make: () => carriage(col, a + da), ppu: 2.6 });
            });
    }
    // the station-arrival scene: the same trains seen from the side, one long sprite per player colour (engine + carriages)
    C.players.forEach((col, i) => out.push({ name: `side/${i}`, make: () => consist(col, 3), ppu: 5, shadow: false, pitch: 0.12 }));
    return out;
}
/** A side view of the basic engine pulling `n` carriages, facing east (right). */
function consist(color, n) {
    const g = new THREE.Group();
    const loco = engine(0, Math.PI / 2, color);
    g.add(loco);
    const lb = new THREE.Box3().setFromObject(loco);
    let x = lb.min.x - 0.6;
    for (let k = 0; k < n; k++) {
        const car = carriage(color, Math.PI / 2);
        const cb = new THREE.Box3().setFromObject(car);
        car.position.x = x - cb.max.x;
        g.add(car);
        x = x - (cb.max.x - cb.min.x) - 0.6;
    }
    return g;
}
function ctxFor(b, group) {
    const vc = materialFor('vc');
    return {
        b, anims: [], x: 0, z: 0, y: 0, sea: null,
        model: (path, dx, dz, s = 24, ry = 0, dy = 0, tint) => {
            if (path === 'cube/animal-cow') {
                b.addGeo(cowGeo(tint ? '#' + tint.getHexString() : null), new THREE.Matrix4().compose(new THREE.Vector3(dx, dy, dz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s / 8, s / 8, s / 8)));
                return;
            }
            b.addModel(path, dx, dy, dz, ry, s, tint);
        },
        seaModel: () => { }, seaShape: () => { }, animAt: () => { },
        shape: (sh, dx = 0, dz = 0, dy = 0) => b.addGeo(sh.geometry(), new THREE.Matrix4().makeTranslation(dx, dy, dz)),
        anim: (sh, dx, dz, dy, update) => { const m = new THREE.Mesh(sh.geometry(), vc); m.position.set(dx, dy, dz); update(m, 0); group.add(m); },
    };
}
function engine(type, ry, color) {
    const g = new THREE.Group();
    const m = kenneyLoco(type, color) ?? new THREE.Mesh(locoShape(type, color).geometry(), materialFor('vc'));
    m.rotation.y = ry;
    g.add(m);
    return g;
}
function carriage(color, ry) {
    const g = new THREE.Group();
    const m = kenneyCarriage(color);
    if (m) {
        m.rotation.y = ry;
        g.add(m);
    }
    return g;
}
const LEAVES = { su: ['#4fbf3a', '#2f9a3a'], sp: ['#86d957', '#5cbf45'], bl: ['#ffb3d1', '#f58ab5'], au: ['#f39a2a', '#d9661c'], ay: ['#f7cf3a', '#e0a61f'], wi: ['#eef4f8', '#c9d8e2'] };
/** Round, puffy Momotetsu-style broadleaf trees. */
function puffTree(se, v) {
    const [a, b] = LEAVES[se];
    const s = new Shape();
    s.cyl(1.8, 2.4, 9, '#8a5a36', 0, 0, 0, 7);
    const blobs = v ? [[0, 16, 0, 8.5], [-5, 12, 2, 6], [5, 13, -1, 6.5], [1, 21, 1, 5.5]] : [[0, 15, 0, 9.5], [-4, 19, 1, 6.5], [4, 18, -2, 6]];
    blobs.forEach(([x, y, z, r], i) => s.add(new THREE.IcosahedronGeometry(r, 1), i % 2 ? b : a, x, y, z));
    const g = new THREE.Group();
    const m = new THREE.Mesh(s.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    m.scale.setScalar(1.25);
    g.add(m);
    return g;
}
/** A layered conifer. */
function firTree(se) {
    const s = new Shape();
    s.cyl(1.6, 2, 6, '#7a4e2e', 0, 0, 0, 6);
    const c = se === 'wi' ? ['#e9f1f5', '#cfdde6'] : ['#2f8f4e', '#257a42'];
    for (let i = 0; i < 4; i++)
        s.cone(9 - i * 1.8, 9, c[i % 2], 0, 5 + i * 6, 0, 8);
    const g = new THREE.Group();
    const m = new THREE.Mesh(s.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    m.scale.setScalar(1.3);
    g.add(m);
    return g;
}
/** Momotetsu-style city buildings: bright roofs, rows of windows, little roof-top boxes. */
function cityBlock(seed, tall) {
    let st = seed * 7919 + (tall ? 104729 : 1);
    const r = () => { st = (st * 16807) % 2147483647; return st / 2147483647; };
    const WALL = ['#eef1f4', '#dfe6ee', '#cdd8e4', '#f3ead8', '#e7d2b8', '#d8dde2', '#f6f6f2'];
    const ROOF = ['#4a8fe0', '#6cbcef', '#e9edf0', '#8b98a6', '#f0a35a', '#5fbfa8', '#3f6fb8', '#d9dfe4'];
    const WIN = '#3d5f8f';
    const s = new Shape();
    const n = tall ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2);
    const spots = [[-7, -6], [7, 5], [-6, 7], [7, -7]];
    for (let k = 0; k < n; k++) {
        const [ox, oz] = n === 1 ? [0, 0] : spots[k];
        const w = (tall ? 14 : 9) + r() * (tall ? 6 : 6), d = (tall ? 14 : 9) + r() * 6;
        const h = tall ? 32 + r() * 34 : 7 + r() * 14;
        const wall = WALL[Math.floor(r() * WALL.length)], roof = ROOF[Math.floor(r() * ROOF.length)];
        s.box(w, h, d, wall, ox, 0, oz);
        s.box(w + 0.6, 1.4, d + 0.6, roof, ox, h, oz);
        const floors = Math.floor((h - 2) / 4);
        for (let f = 0; f < floors; f++) {
            const y = 2.2 + f * 4;
            s.box(w * 0.86, 1.6, 0.3, WIN, ox, y, oz + d / 2 + 0.05);
            s.box(0.3, 1.6, d * 0.86, WIN, ox + w / 2 + 0.05, y, oz);
        }
        if (r() < 0.7)
            s.box(w * 0.3, 2, d * 0.3, '#b8c0c8', ox + w * 0.15, h + 1.4, oz - d * 0.1);
        if (r() < 0.4)
            s.cyl(1.6, 1.6, 3, '#9aa4ae', ox - w * 0.25, h + 1.4, oz + d * 0.2, 8);
    }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(s.geometry(), materialFor('vc')));
    return g;
}
/** A big Highland mountain with a snowy top. */
function mountainSprite(k = 'su') {
    const L = SEASON_LOOK[k];
    const s = new Shape();
    const cap = L.cap / 0.42; // 1 = the original cap size
    s.add(new THREE.ConeGeometry(70, 95, 7), L.rock, 0, 47.5, 0, 0.2);
    s.add(new THREE.ConeGeometry(30 * cap, 41 * cap, 7), '#f6f8f8', 0, 95 - 20.5 * cap + 0.5, 0, 0.2);
    s.add(new THREE.ConeGeometry(48, 62, 6), L.rock, -46, 31, 14, 0.6);
    s.add(new THREE.ConeGeometry(18 * cap, 22 * cap, 6), '#f6f8f8', -46, 62 - 11 * cap + 0.5, 14, 0.6);
    s.add(new THREE.ConeGeometry(44, 54, 6), L.rock, 48, 27, 10, 1.1);
    if (k === 'wi')
        s.add(new THREE.ConeGeometry(30, 30, 6), '#f6f8f8', 48, 39, 10, 1.1);
    s.add(new THREE.ConeGeometry(78, 22, 9), L.grass, 0, 11, 8, 0.3);
    const g = new THREE.Group();
    const m = new THREE.Mesh(s.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    g.add(m);
    return g;
}
/** A black-and-white cow (or a Highland/Hereford cow when tinted). */
function cowGeo(tint) {
    const body = tint ?? '#ffffff';
    const s = new Shape();
    s.box(5, 4.4, 9, body, 0, 2.6, 0);
    if (!tint) {
        s.box(5.1, 2.4, 3, '#2b2b2b', 0, 4, -1.5);
        s.box(5.1, 2, 2, '#2b2b2b', 0, 3, 2.5);
    }
    s.box(3.6, 3.4, 3.4, tint ? body : '#ffffff', 0, 4.4, 5.6);
    s.box(3.8, 1.4, 1.6, '#f2a5a5', 0, 3.6, 7.4);
    s.box(1, 1, 0.6, tint ? '#f1e3c0' : '#dcd2b8', -2.2, 7.4, 5.2);
    s.box(1, 1, 0.6, tint ? '#f1e3c0' : '#dcd2b8', 2.2, 7.4, 5.2);
    for (const [lx, lz] of [[-1.6, -3.2], [1.6, -3.2], [-1.6, 3.2], [1.6, 3.2]])
        s.box(1.1, 2.6, 1.1, '#3a3a3a', lx, 0, lz);
    return s.geometry();
}
/** The car ferry a train turns into on a sea crossing. */
function ferry(ry) {
    const s = new Shape();
    s.box(12, 5, 34, '#ffffff', 0, 0, 0);
    s.box(12.4, 1.6, 34.4, '#1f4f8a', 0, 0.2, 0);
    s.box(10, 4, 20, '#f2f2f2', 0, 5, -2);
    s.box(10.2, 1.2, 20.2, '#3a6ea8', 0, 7, -2);
    s.box(8, 3, 9, '#ffffff', 0, 9, -6);
    for (let i = -1; i <= 1; i++)
        s.box(0.3, 1.2, 2, '#3a6ea8', 4.05, 10, -6 + i * 3);
    s.cyl(2, 2.2, 6, '#d83a3a', 0, 12, -8, 10);
    s.cyl(2.1, 2.1, 1.2, '#222', 0, 17.6, -8, 10);
    s.add(new THREE.ConeGeometry(6, 8, 4), '#ffffff', 0, 2.5, 19, Math.PI / 4, Math.PI / 2, 0);
    const g = new THREE.Group();
    const m = new THREE.Mesh(s.geometry(), materialFor('vc'));
    m.rotation.y = ry;
    g.add(m);
    return g;
}
function sheep() {
    const s = new Shape();
    s.box(5, 4.2, 7, '#f7f5ef', 0, 1.6, 0);
    s.sphere(2.6, '#ffffff', 0, 5.4, -1, 6);
    s.sphere(2.4, '#ffffff', 0, 5.2, 1.6, 6);
    s.box(2.4, 2.6, 2.4, '#2b2b2b', 0, 3.8, 4.4);
    for (const [lx, lz] of [[-1.5, -2.5], [1.5, -2.5], [-1.5, 2.5], [1.5, 2.5]])
        s.box(0.9, 1.8, 0.9, '#2b2b2b', lx, 0, lz);
    const g = new THREE.Group();
    const m = new THREE.Mesh(s.geometry(), materialFor('vc'));
    m.scale.setScalar(1.3);
    g.add(m);
    return g;
}
/** British houses: red-brick terraces, cream cottages and stone houses with slate roofs. */
function houseGeo(v) {
    const WALLS = ['#b5563e', '#c2694a', '#efe6cf', '#d9cfb4', '#a95a44', '#e8dcc0', '#c9b79a', '#b86048'];
    const ROOFS = ['#4d5866', '#5a4b44', '#46505c', '#7a4a36', '#4d5866', '#556070', '#5a4b44', '#46505c'];
    const sh = new Shape();
    const terrace = v % 3 === 0;
    const n = terrace ? 3 : 1;
    for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 11;
        sh.box(11, 9, 10, WALLS[(v + i) % WALLS.length], x, 0, 0);
        sh.box(2.6, 3.2, 0.4, '#8fd3ff', x - 2.5, 4, 5.1);
        sh.box(2.2, 4.4, 0.4, ['#2b4a8a', '#7a1f2a', '#1f5e3b'][(v + i) % 3], x + 2.6, 0, 5.1);
        sh.box(1.8, 3, 1.8, '#8a5040', x + 3, 12, -2);
    }
    sh.roof(11 * n + 1, 6, 11, ROOFS[v], 0, 9, 0);
    return sh.geometry();
}
// ---------- driver API (called from Playwright) ----------
const MODELS = [
    ...DECID.map((t) => 'nature/' + t), ...CONIF.map((t) => 'nature/' + t), 'pirate/palm-straight', 'pirate/palm-bend',
    'nature/rock-largea', 'nature/rock-largeb', 'nature/rock-talla', 'nature/plant-bushdetailed', 'nature/flower-redb', 'nature/flower-yellowb', 'nature/flower-purpleb',
    'nature/crops-cornstagec', 'nature/crops-wheatstageb', 'nature/fence-simple',
    'cube/animal-cow', 'cube/animal-pig', 'graveyard/hay-bale', 'pirate/ship-large', 'pirate/ship-medium', 'pirate/ship-small', 'pirate/boat-row-small',
    'car/van', 'car/taxi', 'car/tractor',
    ...'abcdefghijklmnopqrstu'.split('').map((k) => 'suburban/building-type-' + k),
    ...'abcdefghijklmn'.split('').map((k) => 'city/low-detail-building-' + k),
    ...'abcdefghijklmn'.split('').map((k) => 'city/building-' + k),
    ...'abcde'.split('').map((k) => 'city/building-skyscraper-' + k),
    ...LANDMARK_MODELS, ...LOOK_MODELS, ...KENNEY_TRAINS,
];
window.__studio = {
    ready: false,
    list: () => jobs().map((j) => j.name),
    async render(names) {
        const all = jobs();
        const res = [];
        for (const j of all) {
            if (!names.includes(j.name))
                continue;
            setSeason(j.season ?? (j.look === 'au' ? 'au' : j.look === 'wi' ? 'wi' : 'su'));
            setLook(j.look ?? 'su');
            const obj = j.make();
            if (!obj)
                continue;
            res.push(shoot(j.name, obj, j.ppu ?? 2.4, j.shadow ?? true, j.pitch ?? PITCH));
        }
        setSeason('su');
        setLook('su');
        return res;
    },
};
setModelBase(new URLSearchParams(location.search).get('base') || '/_kenney/studio/');
loadModels([...new Set(MODELS)]).then(() => {
    window.__studio.ready = true;
    window.__studio.missing = MODELS.filter((m) => !has(m));
});
//# sourceMappingURL=studio.js.map