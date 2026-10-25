// Trees, villages, farms, sheep and rocks across the countryside — Kenney Nature and City kits (CC0) plus a few
// procedural pieces. Everything is merged into chunked batches, so thousands of objects cost only a few draw calls.
import * as THREE from 'three';
import { board, project, WORLD_W, WORLD_H } from '../../core/map.js';
import { STATION_BY_ID } from '../../core/content/stations.js';
import { has } from './models.js';
import { Shape } from './shapes.js';
import { fbm, heightAt, isForeign, lakeAmount, sdfAt, trackDistAt } from './terrain.js';
import { gfx } from './gfx.js';
const DECIDUOUS = ['nature/tree-default', 'nature/tree-oak', 'nature/tree-fat', 'nature/tree-detailed', 'nature/tree-simple'];
const CONIFER = ['nature/tree-pinetalla', 'nature/tree-pinetallb', 'nature/tree-pinerounda', 'nature/tree-cone'];
const HOUSES = ['suburban/building-type-a', 'suburban/building-type-b', 'suburban/building-type-c', 'suburban/building-type-d', 'suburban/building-type-e', 'suburban/building-type-f', 'suburban/building-type-g', 'suburban/building-type-h', 'suburban/building-type-k', 'suburban/building-type-m'];
const CITY = ['city/low-detail-building-a', 'city/low-detail-building-b', 'city/low-detail-building-c', 'city/low-detail-building-d', 'city/low-detail-building-e', 'city/low-detail-building-f', 'city/low-detail-building-wide-a', 'city/low-detail-building-wide-b'];
const ROCKS = ['nature/rock-largea', 'nature/rock-largeb', 'nature/rock-talla', 'nature/stone-largea'];
export const SCENERY_MODELS = [...DECIDUOUS, ...CONIFER, ...HOUSES, ...CITY, ...ROCKS, 'nature/plant-bushdetailed', 'graveyard/hay-bale', 'cube/animal-cow', 'cube/animal-pig', 'cube/animal-chick'];
const BIG = new Set(['kingscross', 'paddington', 'waterloo', 'greenwich', 'birmingham', 'manchester', 'liverpool', 'leeds', 'glasgow', 'edinburgh', 'cardiff', 'belfast', 'newcastle', 'bristol', 'sheffield']);
function rand(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
/** Decides where everything goes. Pure data, so the ground painter can draw soft shadows under each item first. */
export function planScenery(spots) {
    const items = [];
    const r = rand(20261003);
    const k = gfx.preset.scenery;
    const blocked = spots.map((s) => ({ x: s.x, z: s.z, r: 64 }));
    for (const n of board.nodes)
        if (n.stationId)
            blocked.push({ x: n.x, z: n.y, r: 58 });
    const free = (x, z, rad) => {
        for (const b of blocked)
            if ((b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + rad) ** 2)
                return false;
        return true;
    };
    const scotland = project(0, 55.8).y; // north of this line is Scotland's latitude
    // ---- towns round each station
    for (const n of board.nodes) {
        if (!n.stationId)
            continue;
        const st = STATION_BY_ID[n.stationId];
        const big = BIG.has(st.id) || st.capital;
        const count = Math.round((big ? 14 : 7) * Math.max(0.5, k));
        let placed = 0;
        for (let tries = 0; tries < count * 10 && placed < count; tries++) {
            const a = r() * Math.PI * 2, d = 78 + r() * (big ? 120 : 80);
            const x = n.x + Math.cos(a) * d, z = n.y + Math.sin(a) * d * 0.9;
            if (sdfAt(x, z) < 14 || lakeAmount(x, z) > 0 || trackDistAt(x, z) < 34 || !free(x, z, 16) || heightAt(x, z) > 22)
                continue;
            const city = big && d < 150 && r() < 0.6;
            const path = city ? CITY[Math.floor(r() * CITY.length)] : r() < 0.65 ? 'house' : HOUSES[Math.floor(r() * HOUSES.length)];
            items.push({ path, x, z, s: city ? 21 : 17, ry: r(), shadow: 15 });
            blocked.push({ x, z, r: 14 });
            placed++;
        }
    }
    // ---- countryside: forests, single trees, rocks, farms
    const STEP = 20 / Math.sqrt(Math.max(0.3, k));
    for (let gz = 0; gz < WORLD_H; gz += STEP)
        for (let gx = 0; gx < WORLD_W; gx += STEP) {
            const x = gx + (r() - 0.5) * STEP, z = gz + (r() - 0.5) * STEP;
            const d = sdfAt(x, z);
            if (d < 10)
                continue;
            const td = trackDistAt(x, z);
            if (td < 30 || lakeAmount(x, z) > 0)
                continue;
            const foreign = isForeign(x, z);
            const h = heightAt(x, z);
            const forest = fbm(x / 230 + 7, z / 230 + 3);
            const north = z < scotland;
            let p = 0.02;
            if (forest > 0.58)
                p = 0.55;
            else if (forest > 0.5)
                p = 0.18;
            if (foreign)
                p *= 0.35;
            if (h > 40)
                p *= 0.2;
            const roll = r();
            if (roll < p) {
                if (!free(x, z, 8))
                    continue;
                const conifer = north || h > 18 ? r() < 0.8 : r() < 0.12;
                const list = conifer ? CONIFER : DECIDUOUS;
                const s = 15 + r() * 10;
                items.push({ path: list[Math.floor(r() * list.length)], x, z, s, ry: r() * 6.28, shadow: s * 0.45 });
                continue;
            }
            if (roll < p + 0.012 && h > 16) {
                items.push({ path: ROCKS[Math.floor(r() * ROCKS.length)], x, z, s: 14 + r() * 12, ry: r() * 6.28, shadow: 10 });
                continue;
            }
            // farms: sheep on the hills, cows in the valleys
            if (!foreign && roll > 0.993 && h < 26 && free(x, z, 30)) {
                const sheep = north || h > 10 || r() < 0.5;
                const nAnimals = 3 + Math.floor(r() * 4);
                for (let i = 0; i < nAnimals; i++) {
                    const ax = x + (r() - 0.5) * 40, az = z + (r() - 0.5) * 30;
                    if (trackDistAt(ax, az) < 26)
                        continue;
                    items.push({ path: sheep ? 'sheep' : (r() < 0.8 ? 'cube/animal-cow' : 'cube/animal-pig'), x: ax, z: az, s: sheep ? 1 : 6.5, ry: r() * 6.28, shadow: 5 });
                }
                if (!sheep || r() < 0.4)
                    items.push({ path: 'graveyard/hay-bale', x: x + 18, z: z - 8, s: 8, ry: r(), shadow: 6 });
                blocked.push({ x, z, r: 30 });
            }
        }
    return items;
}
/** British houses: red-brick terraces, cream cottages and stone houses with slate roofs. */
const houseGeos = [];
function houseGeo(v) {
    if (houseGeos[v])
        return houseGeos[v];
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
    houseGeos[v] = sh.geometry();
    return houseGeos[v];
}
let sheepGeo = null;
function sheep() {
    if (sheepGeo)
        return sheepGeo;
    const s = new Shape();
    s.box(5, 4.2, 7, '#f7f5ef', 0, 1.6, 0);
    s.sphere(2.6, '#ffffff', 0, 5.4, -1, 6);
    s.sphere(2.4, '#ffffff', 0, 5.2, 1.6, 6);
    s.box(2.4, 2.6, 2.4, '#2b2b2b', 0, 3.8, 4.4);
    for (const [lx, lz] of [[-1.5, -2.5], [1.5, -2.5], [-1.5, 2.5], [1.5, 2.5]])
        s.box(0.9, 1.8, 0.9, '#2b2b2b', lx, 0, lz);
    sheepGeo = s.geometry();
    return sheepGeo;
}
export function batchScenery(b, items) {
    for (const it of items) {
        const y = heightAt(it.x, it.z) - 0.6;
        if (it.path === 'house') {
            b.addGeo(houseGeo(Math.floor(it.ry * 1000) % 8), new THREE.Matrix4().makeTranslation(it.x, y + 0.4, it.z));
            continue;
        }
        if (it.path === 'sheep') {
            b.addGeo(sheep(), new THREE.Matrix4().compose(new THREE.Vector3(it.x, y + 0.5, it.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.ry), new THREE.Vector3(1, 1, 1)));
            continue;
        }
        if (!has(it.path))
            continue;
        b.addModel(it.path, it.x, y, it.z, it.ry, it.path.startsWith('city/low-detail') ? [it.s, it.s * 0.55, it.s] : it.s, it.tint);
    }
}
/** Soft contact shadows painted into the ground texture (they also help when real-time shadows are off). */
export function paintSceneryShadows(g, items, spots) {
    // paved ground for towns
    for (const n of board.nodes) {
        if (!n.stationId)
            continue;
        const big = BIG.has(n.stationId) || STATION_BY_ID[n.stationId].capital;
        const rr = big ? 190 : 130;
        const grd = g.createRadialGradient(n.x, n.y, 20, n.x, n.y, rr);
        grd.addColorStop(0, 'rgba(214,205,182,0.75)');
        grd.addColorStop(0.55, 'rgba(214,205,182,0.45)');
        grd.addColorStop(1, 'rgba(214,205,182,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(n.x, n.y, rr, 0, 7);
        g.fill();
    }
    for (const s of spots) {
        const grd = g.createRadialGradient(s.x, s.z, 10, s.x, s.z, 70);
        grd.addColorStop(0, 'rgba(60,60,40,0.22)');
        grd.addColorStop(1, 'rgba(60,60,40,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(s.x, s.z, 70, 0, 7);
        g.fill();
    }
    g.fillStyle = 'rgba(30,50,20,0.22)';
    for (const it of items) {
        g.beginPath();
        g.ellipse(it.x + it.shadow * 0.35, it.z + it.shadow * 0.25, it.shadow, it.shadow * 0.75, 0, 0, 7);
        g.fill();
    }
}
//# sourceMappingURL=scenery.js.map