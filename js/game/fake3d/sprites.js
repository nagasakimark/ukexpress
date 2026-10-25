// Pre-rendered sprites (assets/sprites, made by tools/render_sprites.py) and the scenery that uses them:
// forests, villages, city blocks, farms and a landmark for every station. Everything stands upright and is
// drawn back to front, scaled by the perspective camera.
import { board } from '../../core/map.js';
import { STATION_BY_ID } from '../../core/content/stations.js';
import { UNITS_PER_CELL } from './proj.js';
import { isDryLand, townRadius, BIG_CITIES, setPaving } from './ground.js';
export const sprites = {
    atlases: [],
    defs: {},
    ready: false,
    async load(base = 'assets/sprites/') {
        const r = await fetch(base + 'sprites.json', { cache: 'no-cache' });
        const j = await r.json();
        this.defs = j.sprites;
        this.atlases = await Promise.all(j.atlases.map((f) => new Promise((ok, bad) => {
            const im = new Image();
            im.onload = () => ok(im);
            im.onerror = bad;
            im.src = base + f;
        })));
        this.ready = true;
    },
    has(name) { return !!this.defs[name]; },
};
const tmp = { x: 0, y: 0, s: 0, depth: 0 };
/** Draws a sprite standing on the ground at (x, z), optionally lifted by y cells. Returns false if missing. */
export function drawSprite(ctx, cam, name, x, z, scale = 1, y = 0, alpha = 1) {
    const d = sprites.defs[name];
    if (!d)
        return false;
    const p = cam.project(x, y, z, tmp);
    const k = (p.s / (UNITS_PER_CELL * d.ppu)) * scale;
    const w = d.w * k, h = d.h * k;
    const dx = p.x - d.ax * k, dy = p.y - d.ay * k;
    if (dx > 1300 || dx + w < -20 || dy > 740 || dy + h < -20)
        return true;
    if (alpha !== 1)
        ctx.globalAlpha = alpha;
    ctx.drawImage(sprites.atlases[d.a], d.x, d.y, d.w, d.h, dx, dy, w, h);
    if (alpha !== 1)
        ctx.globalAlpha = 1;
    return true;
}
import { hash, landUse } from './noise.js';
// ---------- scenery ----------
const DECID = ['puff-a', 'puff-b', 'puff-a', 'puff-b', 'tree-fat', 'tree-oak'];
const CONIF = ['fir', 'fir', 'fir', 'tree-pinerounda'];
const HOUSES = ['house/brit-0', 'house/brit-1', 'house/brit-2', 'house/brit-3', 'house/brit-4', 'house/brit-5', 'house/brit-6', 'house/brit-7'];
const CITY = Array.from({ length: 24 }, (_, i) => 'city/blk-' + i);
const SKY = Array.from({ length: 8 }, (_, i) => 'city/tall-' + i);
export class Scenery {
    constructor() {
        this.items = [];
        this.rowStart = new Int32Array(0);
        this.z0 = 0;
        /** Things that are drawn even if their sprite is missing (stations' landmark spots), for debugging. */
        this.landmarks = [];
    }
    build() {
        const g = board.grid;
        const RES = 10; // mask pixels per cell
        const W = g.w * RES, H = g.h * RES;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const m = c.getContext('2d', { willReadFrequently: true });
        m.setTransform(RES, 0, 0, RES, RES / 2, RES / 2); // cell centre (x, y) -> pixel (x*RES + RES/2)
        // keep-out areas: track, squares, signs, landmarks
        m.strokeStyle = '#fff';
        m.lineWidth = 0.5;
        m.lineCap = 'square';
        for (const [x, y, bits] of g.cells) {
            m.fillStyle = '#fff';
            if (bits & 1)
                m.fillRect(x, y - 0.22, 1, 0.68); // horizontal line: keep the strip in front of it clear too
            if (bits & 4)
                m.fillRect(x - 0.24, y, 0.48, 1);
            m.fillRect(x - 0.3, y - 0.3, 0.6, 0.76);
        }
        for (const [sid, s] of Object.entries(g.stations)) {
            m.fillStyle = '#fff';
            const sx = s.x + (s.sign === 'r' ? 0.75 : s.sign === 'l' ? -0.75 : 0), sy = s.y + (s.sign === 'b' ? 0.55 : s.sign === 't' ? -0.5 : 0);
            const nm = STATION_BY_ID[sid]?.name.en.length ?? 8;
            const hw = Math.min(0.95, 0.12 + nm * 0.035);
            m.fillRect(sx - hw, sy - 0.3, hw * 2, 0.5);
            if (s.lm) {
                m.beginPath();
                m.ellipse(s.lm[0], s.lm[1] + 0.05, 0.85, 0.75, 0, 0, Math.PI * 2);
                m.fill();
                this.landmarks.push({ sid, x: s.lm[0], z: s.lm[1] });
            }
        }
        const keep = m.getImageData(0, 0, W, H).data;
        const blocked = (x, y, r = 0) => {
            for (const [ox, oy] of r ? [[0, 0], [r, 0], [-r, 0], [0, r * 0.6], [0, -r * 0.6]] : [[0, 0]]) {
                const px = Math.round((x + ox) * RES + RES / 2), py = Math.round((y + oy) * RES + RES / 2);
                if (px < 0 || py < 0 || px >= W || py >= H)
                    return true;
                if (keep[(py * W + px) * 4 + 3] > 0)
                    return true;
            }
            return false;
        };
        // towns
        const towns = Object.entries(g.stations).map(([sid, s]) => ({ sid, x: s.x, y: s.y, r: townRadius(sid) })).filter((t) => t.r > 0);
        const townAt = (x, y) => towns.find((t) => Math.abs(x - t.x) < t.r - 0.08 && Math.abs(y - t.y) < t.r - 0.08);
        const nearStation = (x, y, r) => Object.values(g.stations).some((s) => Math.hypot(s.x - x, s.y - y) < r);
        const mountains = g.mountains ?? [];
        const scotland = (x, y) => { const n = board.cellNode[Math.round(y) * g.w + Math.round(x)]; return n >= 0 && board.nodes[n].region === 'scotland'; };
        const items = [];
        const pave = [];
        const add = (x, z, kind, name, s = 1) => items.push({ x, z, kind, name, s });
        // mountains first (they are big)
        const peaks = mountains.filter((mt) => !blocked(mt.x, mt.y, 0.45) && isDryLand(mt.x, mt.y) && !towns.some((t) => Math.hypot(t.x - mt.x, t.y - mt.y) < t.r + 1.2));
        for (const mt of peaks)
            add(mt.x, mt.y, 2, 'deco/mountain', 0.5 + mt.s * 0.22);
        // (the board view swaps this for the season's version)
        const nearMountain = (x, y) => peaks.some((mt) => Math.hypot(mt.x - x, (mt.y - y) * 1.4) < 0.55 + mt.s * 0.25);
        for (let cy = 0; cy < g.h; cy++)
            for (let cx = 0; cx < g.w; cx++) {
                const N = townAt(cx, cy) ? 5 : 4;
                for (let j = 0; j < N; j++)
                    for (let i = 0; i < N; i++) {
                        const u = cx * N + i, v = cy * N + j;
                        const x = cx - 0.5 + (i + 0.5 + (hash(u, v, 1) - 0.5) * 0.6) / N;
                        const y = cy - 0.5 + (j + 0.5 + (hash(u, v, 2) - 0.5) * 0.6) / N;
                        if (!isDryLand(x, y))
                            continue;
                        const r = hash(u, v, 4);
                        const t = townAt(x, y);
                        if (t && !nearMountain(x, y)) {
                            if (blocked(x, y, 0.1))
                                continue;
                            const big = BIG_CITIES.has(t.sid) || STATION_BY_ID[t.sid].capital;
                            const dc = Math.hypot(x - t.x, y - t.y);
                            const name = big ? (dc < 0.95 && r < 0.45 ? SKY[Math.floor(r * 1000) % SKY.length] : CITY[Math.floor(r * 1000) % CITY.length])
                                : r < 0.55 ? HOUSES[Math.floor(r * 1000) % HOUSES.length] : CITY[Math.floor(r * 1000) % CITY.length];
                            add(x, y, 2, name, big ? 1.55 : 1.35);
                            pave.push([cx - 0.5 + (i + 0.5) / N, cy - 0.5 + (j + 0.5) / N, 1 / N]);
                            continue;
                        }
                        if (nearMountain(x, y))
                            continue;
                        if (blocked(x, y, 0.1))
                            continue;
                        const use = landUse(cx, cy);
                        const north = scotland(x, y);
                        const p = use === 'forest' ? 0.97 : use === 'edge' ? 0.5 : use === 'meadow' ? 0.1 : 0.03;
                        if (r < p) {
                            const conifer = north ? hash(cx, cy, 9) < 0.7 : hash(u, v, 9) < 0.12;
                            const list = conifer ? CONIF : DECID;
                            add(x, y, conifer ? 1 : 0, list[Math.floor(hash(u, v, 5) * list.length)], 1.15 + hash(u, v, 6) * 0.35);
                            continue;
                        }
                        if (use !== 'field' && use !== 'meadow')
                            continue;
                        // villages near country stations, animals in the fields
                        if (r > 0.93 && nearStation(x, y, 2.0)) {
                            add(x, y, 2, HOUSES[Math.floor(r * 997) % HOUSES.length], 1);
                            continue;
                        }
                        if (r > 0.965)
                            add(x, y, 2, north ? 'deco/sheep' : ['deco/sheep', 'deco/cow', 'deco/hay', 'deco/sheep', 'deco/cow'][Math.floor(r * 3000) % 5], 1.4);
                    }
            }
        setPaving(pave);
        items.sort((a, b) => a.z - b.z || a.x - b.x);
        this.items = items;
        // row index for fast culling
        this.z0 = -2;
        const rows = g.h + 4;
        this.rowStart = new Int32Array(rows + 1).fill(items.length);
        for (let i = items.length - 1; i >= 0; i--) {
            const r = Math.max(0, Math.min(rows - 1, Math.floor(items[i].z - this.z0)));
            this.rowStart[r] = i;
        }
        for (let r = rows - 1; r >= 0; r--)
            if (this.rowStart[r] > this.rowStart[r + 1])
                this.rowStart[r] = this.rowStart[r + 1];
    }
    /** Index range of items with z between za and zb. */
    range(za, zb) {
        const rows = this.rowStart.length - 1;
        const r0 = Math.max(0, Math.min(rows, Math.floor(za - this.z0))), r1 = Math.max(0, Math.min(rows, Math.floor(zb - this.z0) + 1));
        return [this.rowStart[r0], this.rowStart[r1]];
    }
}
/** The sprite name for a tree in a season (deciduous trees change colour; conifers only get snow). */
export function treeSprite(name, conifer, season, month, x, z) {
    if (conifer)
        return `tree/${name}/${season === 'winter' ? 'wi' : 'su'}`;
    const h = hash(Math.round(x * 31), Math.round(z * 17), 11);
    switch (season) {
        case 'spring': return `tree/${name}/sp`;
        case 'summer': return `tree/${name}/su`;
        case 'autumn': return `tree/${name}/${month === 5 ? (h < 0.3 ? 'ay' : 'su') : h < 0.5 ? 'au' : 'ay'}`;
        default: return `tree/${name}/wi`;
    }
}
//# sourceMappingURL=sprites.js.map