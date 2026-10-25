// The 3D board world: builds the scene once, then the board scene moves the camera and trains around it.
import * as THREE from 'three';
import { board } from '../../core/map.js';
import { gfx } from './gfx.js';
import { Batcher, loadModels, materialFor, seasonUniforms } from './models.js';
import { buildFields, buildSea, buildTerrain, groundUniforms, railHeight, seaUniforms } from './terrain.js';
import { buildBoardMeshes, ST } from './boardmeshes.js';
import { buildLandmarks, LANDMARK_MODELS } from './landmarks.js';
import { planScenery, batchScenery, paintSceneryShadows, SCENERY_MODELS } from './scenery.js';
import { Train3D, Smoke, KENNEY_TRAINS } from './trains3d.js';
const TRAIN_MODELS = ['train/track-detailed', ...KENNEY_TRAINS];
const tick = () => new Promise((r) => setTimeout(r, 0));
export class World3D {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(32, 1280 / 720, 8, 9000);
        this.sun = new THREE.DirectionalLight('#fff6e6', 2.3);
        this.hemi = new THREE.HemisphereLight('#e8f4ff', '#6f8a5a', 1.35);
        this.ready = false;
        this.failed = false;
        this.anims = [];
        this.spots = [];
        this.trains = new Map();
        this.smoke = new Smoke();
        this.beacon = new THREE.Group();
        this.flags = new THREE.Group();
        this.dyn = new THREE.Group();
        this.target = new THREE.Vector3();
        this.dist = 700;
        this.pitch = 0.95;
        this.shadowAnchor = new THREE.Vector3(1e9, 0, 0);
        this.ray = new THREE.Raycaster();
        this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -6);
        this.v = new THREE.Vector3();
        this.building = null;
    }
    /** Loads models and builds the world. Safe to call more than once. */
    build(onProgress) {
        if (!this.building)
            this.building = this.doBuild(onProgress).catch((e) => { console.error('3D world failed', e); this.failed = true; });
        return this.building;
    }
    async doBuild(onProgress) {
        const p = (f, l) => onProgress?.(f, l);
        p(0.02, 'models');
        await loadModels([...new Set([...TRAIN_MODELS, ...LANDMARK_MODELS, ...SCENERY_MODELS])], (d, n) => p(0.05 + 0.45 * d / n, 'models'));
        p(0.5, 'land');
        await tick();
        buildFields();
        p(0.6, 'landmarks');
        await tick();
        const lm = new Batcher();
        this.scene.add(this.dyn);
        this.spots = buildLandmarks(lm, this.anims, this.dyn);
        const items = planScenery(this.spots);
        p(0.7, 'ground');
        await tick();
        const terrain = buildTerrain((g) => paintSceneryShadows(g, items, this.spots));
        this.scene.add(terrain);
        this.scene.add(buildSea());
        p(0.85, 'scenery');
        await tick();
        batchScenery(lm, items);
        for (const m of lm.build(materialFor, { cast: true, receive: true }))
            this.scene.add(m);
        p(0.93, 'railway');
        await tick();
        this.meshes = buildBoardMeshes();
        this.scene.add(this.meshes.group);
        this.scene.add(this.beacon, this.flags, this.smoke.mesh);
        this.makeBeacon();
        // light
        this.scene.add(this.hemi);
        this.sun.position.set(-260, 700, 380);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        const sc = this.sun.shadow.camera;
        sc.left = -760;
        sc.right = 760;
        sc.top = 760;
        sc.bottom = -760;
        sc.near = 10;
        sc.far = 2200;
        this.sun.shadow.bias = -0.0008;
        this.sun.shadow.normalBias = 1.5;
        this.scene.add(this.sun, this.sun.target);
        this.scene.background = new THREE.Color('#2a74bf');
        this.applyQuality();
        gfx.onQualityChange = () => this.applyQuality();
        p(1, 'done');
        this.ready = true;
    }
    applyQuality() {
        const r = gfx.renderer;
        if (!r)
            return;
        r.shadowMap.enabled = gfx.preset.shadows;
        this.sun.castShadow = gfx.preset.shadows;
        this.shadowAnchor.set(1e9, 0, 0);
        this.scene.traverse((o) => { const m = o.material; if (m)
            m.needsUpdate = true; });
    }
    // ---------- camera ----------
    /** zoom 1 = the normal close-up view; smaller zooms pull back and look more from above (map view). */
    setCamera(x, z, zoom) {
        this.dist = 450 / zoom;
        const t = Math.max(0, Math.min(1, (1.0 - zoom) / 0.6));
        this.pitch = 0.88 + t * 0.42; // ~50° close up → ~75° from far away
        this.target.set(x, railHeight(x, z) * 0.6 + 4, z);
        this.camera.position.set(x, this.target.y + Math.sin(this.pitch) * this.dist, z + Math.cos(this.pitch) * this.dist);
        this.camera.lookAt(this.target);
        this.camera.updateMatrixWorld();
    }
    /** World (board x, ground z, height h) → 1280x720 screen coordinates. */
    project(x, z, h = 0) {
        this.v.set(x, railHeight(x, z) + h, z).project(this.camera);
        return { x: (this.v.x + 1) * 640, y: (1 - this.v.y) * 360, behind: this.v.z > 1 };
    }
    projectV(p) { this.v.copy(p).project(this.camera); return { x: (this.v.x + 1) * 640, y: (1 - this.v.y) * 360 }; }
    /** Screen → board coordinates on the ground. */
    unproject(sx, sy) {
        this.ray.setFromCamera(new THREE.Vector2(sx / 640 - 1, 1 - sy / 360), this.camera);
        const hit = new THREE.Vector3();
        if (!this.ray.ray.intersectPlane(this.plane, hit))
            return { x: this.target.x, y: this.target.z };
        return { x: hit.x, y: hit.z };
    }
    /** Pixels per world unit at a point (for sizing signs and arrows). */
    pxPerUnit(x, z) {
        const a = this.project(x - 20, z), b = this.project(x + 20, z);
        return Math.hypot(b.x - a.x, b.y - a.y) / 40;
    }
    // ---------- board state ----------
    train(id, color) {
        let t = this.trains.get(id);
        if (!t) {
            t = new Train3D(color);
            this.trains.set(id, t);
            this.scene.add(t.group);
        }
        return t;
    }
    setDestination(node) {
        const n = board.nodes[node];
        this.beacon.position.set(n.x, railHeight(n.x, n.y) + 6, n.y);
        this.beacon.visible = true;
    }
    makeBeacon() {
        const c = document.createElement('canvas');
        c.width = 4;
        c.height = 128;
        const g = c.getContext('2d');
        const grd = g.createLinearGradient(0, 0, 0, 128);
        grd.addColorStop(0, 'rgba(255,214,60,0)');
        grd.addColorStop(0.55, 'rgba(255,214,60,0.08)');
        grd.addColorStop(0.9, 'rgba(255,214,60,0.3)');
        grd.addColorStop(1, 'rgba(255,214,60,0.45)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 4, 128);
        const tex = new THREE.CanvasTexture(c);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(ST * 0.95, ST * 1.05, 260, 24, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
        beam.position.y = 130;
        beam.renderOrder = 5;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(ST + 4, 2.4, 6, 40), new THREE.MeshBasicMaterial({ color: '#ffd84a' }));
        ring.rotation.x = Math.PI / 2;
        ring.name = 'ring';
        this.beacon.add(beam, ring);
        this.beacon.visible = false;
    }
    /** Big flags in the owner's colour on stations where one player owns everything. */
    setMonopolies(list) {
        const key = list.map((l) => l.node + l.color).join();
        if (this.flags.userData.key === key)
            return;
        this.flags.userData.key = key;
        this.flags.clear();
        for (const l of list) {
            const n = board.nodes[l.node];
            const g = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 40, 6), new THREE.MeshLambertMaterial({ color: '#3a3a40' }));
            pole.position.y = 20;
            const fl = new THREE.Mesh(new THREE.BoxGeometry(22, 13, 0.8), new THREE.MeshLambertMaterial({ color: l.color }));
            fl.position.set(11, 33, 0);
            fl.name = 'cloth';
            const ball = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), new THREE.MeshLambertMaterial({ color: '#f2c440' }));
            ball.position.y = 41;
            g.add(pole, fl, ball);
            g.position.set(n.x + ST - 8, railHeight(n.x, n.y) + 5, n.y - ST + 8);
            this.flags.add(g);
        }
    }
    setSeason(month) {
        // month 0 = April. Spring: fresh, summer: normal, autumn: orange, winter: frosty.
        const S = [
            ['#9be06a', 0.25, '#b9e07a', 0.12], ['#8fdc5e', 0.12, '#b9e07a', 0.06], ['#7ccf4e', 0, '#a8d468', 0], ['#7ccf4e', 0, '#c9d47a', 0.12], ['#7ccf4e', 0.05, '#d2cf78', 0.18],
            ['#f0b03a', 0.45, '#cfc67a', 0.2], ['#e8862e', 0.75, '#d0b46e', 0.3], ['#c86a32', 0.85, '#c4b07a', 0.35],
            ['#e2ece8', 0.55, '#e4ece2', 0.38], ['#eef4f2', 0.7, '#eef3ea', 0.5], ['#e2ece8', 0.5, '#e4ece2', 0.3], ['#b8e890', 0.22, '#c4e48a', 0.12],
        ];
        const [lt, la, gt, ga] = S[((month % 12) + 12) % 12];
        seasonUniforms.uSeasonTint.value.set(lt);
        seasonUniforms.uSeasonAmt.value = la;
        groundUniforms.uSeasonTint.value.set(gt);
        groundUniforms.uSeasonAmt.value = ga;
    }
    // ---------- frame ----------
    render(t, dt) {
        const r = gfx.renderer;
        if (!r || !this.ready)
            return;
        seaUniforms.uTime.value = t / 1000;
        for (const a of this.anims)
            a.update(t);
        if (this.meshes.buoys) {
            const m = new THREE.Matrix4();
            this.meshes.buoyBase.forEach((b, i) => {
                m.makeRotationZ(Math.sin(t / 700 + i) * 0.08).setPosition(b.x, b.y - 2 + Math.sin(t / 500 + i * 1.7) * 1.2, b.z);
                this.meshes.buoys.setMatrixAt(i, m);
            });
            this.meshes.buoys.instanceMatrix.needsUpdate = true;
        }
        const ring = this.beacon.getObjectByName('ring');
        if (ring) {
            const s = 1 + Math.sin(t / 260) * 0.06;
            ring.scale.set(s, s, s);
        }
        for (const f of this.flags.children) {
            const c = f.getObjectByName('cloth');
            if (c)
                c.rotation.y = Math.sin(t / 300 + f.position.x) * 0.2;
        }
        this.smoke.update(dt);
        // shadows: re-render the shadow map only when the view has moved a fair way (cheap on Chromebooks)
        if (gfx.preset.shadows) {
            const sx = Math.round(this.target.x / 120) * 120, sz = Math.round(this.target.z / 120) * 120;
            const far = this.dist > 900;
            if (sx !== this.shadowAnchor.x || sz !== this.shadowAnchor.z || far !== (this.shadowAnchor.y === 1)) {
                this.shadowAnchor.set(sx, far ? 1 : 0, sz);
                const span = far ? 1400 : 760;
                const sc = this.sun.shadow.camera;
                sc.left = -span;
                sc.right = span;
                sc.top = span;
                sc.bottom = -span;
                sc.updateProjectionMatrix();
                this.sun.target.position.set(sx, 0, sz - 60);
                this.sun.position.set(sx - 260, 700, sz + 320);
                this.sun.target.updateMatrixWorld();
                r.shadowMap.needsUpdate = true;
            }
        }
        r.render(this.scene, this.camera);
    }
}
export const world = new World3D();
//# sourceMappingURL=world.js.map