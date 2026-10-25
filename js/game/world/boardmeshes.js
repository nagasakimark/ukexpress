// The railway itself in 3D: Kenney track pieces, chunky coloured squares, station platforms, ports, buoys and ferry routes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { board } from '../../core/map.js';
import { REGIONS } from '../../core/content/game-data.js';
import { STATION_BY_ID } from '../../core/content/stations.js';
import { proto, kitTextures, prim, Batcher } from './models.js';
import { railHeight } from './terrain.js';
import { prismGeo } from './shapes.js';
export const TRACK_SCALE = 16; // a 1x1 Kenney track piece becomes 16x16 world units
export const SQ = 14; // half-size of a square tile
export const ST = 25; // half-size of a station tile
export const TILE_COLORS = {
    blue: '#2f6fe0', red: '#e0383b', card: '#f5c400', quiz: '#9b59d0', event: '#ff8c1a', shop: '#17a2a2', port: '#7d8b99',
};
function roundedRect(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
}
/** A rounded tile, lying flat, with its top face at y = height. */
export function tileGeo(w, r, height, bevel = 1.6) {
    const g = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, w - bevel * 2, Math.max(1, r - bevel)), { depth: height - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, bevel, 0);
    return g;
}
export function buildBoardMeshes() {
    const group = new THREE.Group();
    for (const t of buildTrack())
        group.add(t);
    const sq = buildSquares();
    for (const m of sq)
        group.add(m);
    group.add(buildIcons());
    const st = new Batcher(640);
    buildStations(st);
    for (const m of st.build((k) => stationMat(k), { cast: true, receive: true }))
        group.add(m);
    group.add(buildFerryRoutes());
    const b = buildBuoys();
    if (b.mesh)
        group.add(b.mesh);
    return { group, buoys: b.mesh, buoyBase: b.base };
}
const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
function stationMat(key) { return key.startsWith('tex:') ? new THREE.MeshLambertMaterial({ map: kitTextures.get(key.slice(4)) ?? null }) : vcMat; }
// ---------- track ----------
function buildTrack() {
    const p = proto('train/track-detailed');
    const placements = [];
    for (const e of board.edges) {
        if (e.sea)
            continue;
        // resample the curve at equal steps
        const pts = e.pts;
        const lens = [0];
        for (let i = 1; i < pts.length; i++)
            lens.push(lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
        const total = lens[lens.length - 1];
        const n = Math.max(1, Math.round(total / TRACK_SCALE));
        const step = total / n;
        const at = (d) => {
            let i = 1;
            while (i < lens.length - 1 && lens[i] < d)
                i++;
            const t = (d - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]);
            return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
        };
        for (let k = 0; k < n; k++) {
            const a = at(k * step), b = at((k + 1) * step);
            const cx = (a.x + b.x) / 2, cz = (a.y + b.y) / 2;
            const ang = Math.atan2(b.x - a.x, b.y - a.y);
            const ya = railHeight(a.x, a.y), yb = railHeight(b.x, b.y);
            const pitch = -Math.atan2(yb - ya, step);
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, ang, 0, 'YXZ'));
            placements.push(new THREE.Matrix4().compose(new THREE.Vector3(cx, (ya + yb) / 2 - 0.4, cz), q, new THREE.Vector3(TRACK_SCALE, TRACK_SCALE, step * 1.02)));
        }
    }
    let geo;
    let mat;
    if (p) {
        geo = mergeGeometries(p.parts.map((x) => x.geo), false);
        const c = p.box.getCenter(new THREE.Vector3());
        geo = geo.clone().translate(-c.x, -p.box.min.y, -c.z);
        const tex = kitTextures.get('train');
        mat = tex ? new THREE.MeshLambertMaterial({ map: tex }) : new THREE.MeshLambertMaterial({ vertexColors: true });
    }
    else {
        // fallback: simple sleepers and rails
        const sleeper = prim(new THREE.BoxGeometry(0.9, 0.06, 0.22), '#7a5a3a');
        const r1 = prim(new THREE.BoxGeometry(0.06, 0.08, 1), '#dfe3e6').translate(-0.3, 0.07, 0);
        const r2 = prim(new THREE.BoxGeometry(0.06, 0.08, 1), '#dfe3e6').translate(0.3, 0.07, 0);
        geo = mergeGeometries([sleeper.clone().translate(0, 0, -0.25), sleeper.clone().translate(0, 0, 0.25), r1, r2], false);
        mat = vcMat;
    }
    // one instanced mesh per map chunk, so track that is off screen is skipped
    const chunks = new Map();
    const v = new THREE.Vector3();
    for (const m of placements) {
        v.setFromMatrixPosition(m);
        const k = `${Math.floor(v.x / 640)},${Math.floor(v.z / 640)}`;
        (chunks.get(k) ?? chunks.set(k, []).get(k)).push(m);
    }
    const out = [];
    for (const list of chunks.values()) {
        const mesh = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        out.push(mesh);
    }
    return out;
}
// ---------- squares ----------
function buildSquares() {
    const nodes = board.nodes.filter((n) => n.type !== 'station' && n.type !== 'sea');
    const base = new THREE.InstancedMesh(tileGeo(SQ * 2 + 5, 8, 3.2, 1), new THREE.MeshLambertMaterial({ color: '#2a2016' }), nodes.length);
    const top = new THREE.InstancedMesh(tileGeo(SQ * 2, 6, 5.5, 1.4), new THREE.MeshLambertMaterial({ color: '#ffffff' }), nodes.length);
    const m = new THREE.Matrix4();
    nodes.forEach((n, i) => {
        const y = railHeight(n.x, n.y);
        m.makeTranslation(n.x, y, n.y);
        base.setMatrixAt(i, m);
        top.setMatrixAt(i, m);
        top.setColorAt(i, new THREE.Color(TILE_COLORS[n.type] ?? '#888'));
    });
    for (const x of [base, top]) {
        x.castShadow = true;
        x.receiveShadow = true;
        x.computeBoundingSphere();
    }
    return [base, top];
}
/** Square symbols are drawn once into a small texture atlas and laid on top of the tiles. */
const ICONS = ['blue', 'red', 'card', 'quiz', 'event', 'shop', 'port'];
function iconAtlas() {
    const c = document.createElement('canvas');
    c.width = 128 * ICONS.length;
    c.height = 128;
    const g = c.getContext('2d');
    ICONS.forEach((k, i) => {
        g.save();
        g.translate(i * 128 + 64, 64);
        g.lineJoin = 'round';
        const glyph = (s, size) => {
            g.font = `900 ${size}px "Arial Rounded MT Bold", Arial, sans-serif`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.lineWidth = 14;
            g.strokeStyle = 'rgba(0,0,0,0.35)';
            g.strokeText(s, 0, 6);
            g.fillStyle = '#fff';
            g.fillText(s, 0, 6);
        };
        if (k === 'blue') {
            g.fillStyle = '#fff';
            g.strokeStyle = 'rgba(0,0,0,0.3)';
            g.lineWidth = 8;
            g.beginPath();
            g.rect(-12, -40, 24, 80);
            g.rect(-40, -12, 80, 24);
            g.stroke();
            g.fill();
        }
        else if (k === 'red') {
            g.fillStyle = '#fff';
            g.strokeStyle = 'rgba(0,0,0,0.3)';
            g.lineWidth = 8;
            g.beginPath();
            g.rect(-40, -12, 80, 24);
            g.stroke();
            g.fill();
        }
        else if (k === 'card') {
            g.fillStyle = '#fff';
            g.strokeStyle = '#9a7a00';
            g.lineWidth = 7;
            g.beginPath();
            g.roundRect(-26, -38, 52, 76, 9);
            g.fill();
            g.stroke();
            g.fillStyle = '#f5c400';
            g.beginPath();
            g.arc(0, 0, 12, 0, 7);
            g.fill();
        }
        else if (k === 'quiz')
            glyph('?', 100);
        else if (k === 'event')
            glyph('★', 96);
        else {
            g.font = '80px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(k === 'shop' ? '🏪' : '⚓', 0, 6);
        }
        g.restore();
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}
function buildIcons() {
    const parts = [];
    for (const n of board.nodes) {
        const k = n.type;
        const i = ICONS.indexOf(k);
        if (i < 0)
            continue;
        const s = k === 'port' ? 26 : 22;
        const pg = new THREE.PlaneGeometry(s, s);
        pg.rotateX(-Math.PI / 2);
        const uv = pg.attributes.uv;
        for (let v = 0; v < uv.count; v++)
            uv.setX(v, (i + uv.getX(v)) / ICONS.length);
        pg.translate(n.x, railHeight(n.x, n.y) + (k === 'port' ? 5.2 : 5.7), n.y);
        parts.push(pg);
    }
    const mesh = new THREE.Mesh(mergeGeometries(parts, false), new THREE.MeshBasicMaterial({ map: iconAtlas(), transparent: true, alphaTest: 0.1, depthWrite: false }));
    mesh.renderOrder = 2;
    return mesh;
}
// ---------- stations ----------
function buildStations(b) {
    const at = (x, y, z, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    for (const n of board.nodes) {
        if (n.type === 'port') {
            const y = railHeight(n.x, n.y);
            b.addGeo(prim(tileGeo(38, 9, 3.2, 1), '#2a2016'), at(n.x, y, n.y));
            b.addGeo(prim(tileGeo(33, 7, 4.8, 1.4), TILE_COLORS.port), at(n.x, y, n.y));
            continue;
        }
        if (n.type !== 'station')
            continue;
        const st = STATION_BY_ID[n.stationId];
        const col = REGIONS[n.region].color;
        const y = railHeight(n.x, n.y);
        b.addGeo(prim(tileGeo(ST * 2 + 7, 14, 3, 1), '#2a2016'), at(n.x, y, n.y));
        b.addGeo(prim(tileGeo(ST * 2, 12, 5, 1.6), col), at(n.x, y, n.y));
        b.addGeo(prim(tileGeo(ST * 2 - 11, 8, 5.8, 1.2), '#ece5d3'), at(n.x, y, n.y));
        // paving lines
        for (const k of [-1, 1])
            b.addGeo(prim(new THREE.BoxGeometry(0.8, 0.3, ST * 2 - 16), '#d5ccb6'), at(n.x + k * 9, y + 5.9, n.y));
        // a little station house with a canopy at the back of the platform
        const roof = st.capital ? '#c0392b' : shadeHex(col, -0.06);
        const by = y + 5.8, bz = n.y - ST + 6;
        b.addGeo(prim(new THREE.BoxGeometry(32, 1.2, 12), '#d8c8a2'), at(n.x, by + 0.6, bz));
        b.addGeo(prim(new THREE.BoxGeometry(30, 13, 10), '#f4ead2'), at(n.x, by + 6.5, bz));
        b.addGeo(prim(prismGeo(33, 8, 13), roof), at(n.x, by + 13, bz));
        b.addGeo(prim(new THREE.BoxGeometry(8, 9, 8), '#f4ead2'), at(n.x, by + 17, bz + 1)); // clock tower
        b.addGeo(prim(new THREE.ConeGeometry(6.5, 7, 4).rotateY(Math.PI / 4), roof), at(n.x, by + 25, bz + 1));
        const clock = new THREE.CylinderGeometry(2.8, 2.8, 0.8, 14);
        clock.rotateX(Math.PI / 2);
        b.addGeo(prim(clock, '#ffffff'), at(n.x, by + 18, bz + 5.2));
        b.addGeo(prim(new THREE.BoxGeometry(0.5, 2.2, 0.3), '#1d1d1b'), at(n.x, by + 18.8, bz + 5.7));
        for (const dx of [-10, -5, 5, 10])
            b.addGeo(prim(new THREE.BoxGeometry(3.2, 4.4, 0.6), '#8fd3ff'), at(n.x + dx, by + 6.5, bz + 5.1));
        b.addGeo(prim(new THREE.BoxGeometry(5, 7, 0.6), '#7a4a2a'), at(n.x, by + 3.5, bz + 5.1));
        b.addGeo(prim(new THREE.BoxGeometry(14, 1.2, 4), roof), at(n.x, by + 8, bz + 6.5)); // door canopy
    }
}
export function shadeHex(hex, amt) {
    const c = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
    return '#' + c.getHexString();
}
// ---------- ferries and buoys ----------
function buildFerryRoutes() {
    const parts = [];
    for (const e of board.edges) {
        if (!e.sea)
            continue;
        const pts = e.pts;
        const lens = [0];
        for (let i = 1; i < pts.length; i++)
            lens.push(lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
        const total = lens[lens.length - 1];
        for (let d = 26; d < total - 26; d += 16) {
            let i = 1;
            while (i < lens.length - 1 && lens[i] < d)
                i++;
            const a = pts[i - 1], b = pts[i];
            const t = (d - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]);
            const q = new THREE.PlaneGeometry(3.2, 9);
            q.rotateX(-Math.PI / 2);
            q.rotateY(Math.atan2(b.x - a.x, b.y - a.y));
            q.translate(a.x + (b.x - a.x) * t, 0.3, a.y + (b.y - a.y) * t);
            parts.push(q);
        }
    }
    const g = parts.length ? mergeGeometries(parts, false) : new THREE.BufferGeometry();
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false }));
}
function buildBuoys() {
    const sea = board.nodes.filter((n) => n.type === 'sea');
    if (!sea.length)
        return { mesh: null, base: [] };
    const parts = [
        prim(new THREE.CylinderGeometry(7, 8, 6, 12), '#e0383b').translate(0, 1, 0),
        prim(new THREE.CylinderGeometry(5.5, 7, 5, 12), '#ffffff').translate(0, 6.5, 0),
        prim(new THREE.ConeGeometry(5.5, 7, 12), '#e0383b').translate(0, 12.5, 0),
        prim(new THREE.SphereGeometry(2, 8, 6), '#ffd84a').translate(0, 17, 0),
    ];
    const geo = mergeGeometries(parts, false);
    const mesh = new THREE.InstancedMesh(geo, vcMat, sea.length);
    const base = sea.map((n) => ({ x: n.x, y: 0, z: n.y }));
    base.forEach((p, i) => mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    mesh.castShadow = true;
    mesh.computeBoundingSphere();
    return { mesh, base };
}
//# sourceMappingURL=boardmeshes.js.map