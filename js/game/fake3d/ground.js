// The flat ground of the board, Momotetsu style: bright grass, blue sea with a cliff edge, grey city paving,
// black-and-white ladder track and raised coloured squares. It is painted once into small square chunks
// (cached), then drawn in perspective one thin screen row at a time - no WebGL needed.
import { board, R, L, D, U } from '../../core/map.js';
import { STATION_BY_ID } from '../../core/content/stations.js';
import { hash, landUse } from './noise.js';
export const P = 96; // texture pixels per cell
const CH = 4; // cells per chunk side
const CPX = P * CH;
export function seasonOf(month) {
    // month 0 = April (the school year)
    return [11, 0, 1].includes(month) ? 'spring' : [2, 3, 4].includes(month) ? 'summer' : [5, 6, 7].includes(month) ? 'autumn' : 'winter';
}
const GRASS = {
    spring: ['#7fd255', '#6cc447', '#93dc68'],
    summer: ['#5fc040', '#52b236', '#72cc52'],
    autumn: ['#d2b23c', '#c09e2c', '#ddc256'],
    winter: ['#f1f5f8', '#dfe8ee', '#ffffff'],
};
const FIELDS = {
    spring: ['#9ade6a', '#86d35a', '#b6e47a', '#7cc94f', '#d8e88a'],
    summer: ['#7ccd52', '#68bf45', '#e2d36a', '#9ad65e', '#c9dc6a'],
    autumn: ['#d8b54a', '#c9a23e', '#b8a050', '#e3c766', '#a89a48'],
    winter: ['#f4f7f9', '#e8eef2', '#fbfcfd', '#e2e9ee'],
};
const FOREIGN = { spring: '#b5d99a', summer: '#a9d08c', autumn: '#d6c690', winter: '#e9eef1' };
const HEDGE = { spring: '#3f9a3f', summer: '#3a8f38', autumn: '#8a6a2a', winter: '#b9c7cf' };
export const BIG_CITIES = new Set(['kingscross', 'westminster', 'paddington', 'waterloo', 'birmingham', 'manchester', 'liverpool', 'leeds', 'glasgow', 'edinburgh', 'cardiff', 'belfast', 'newcastle', 'bristol', 'sheffield', 'nottingham']);
/** How far the paved town spreads round a station, in cells (0 = a country station). */
export function townRadius(sid) {
    const st = STATION_BY_ID[sid];
    if (BIG_CITIES.has(sid) || st.capital)
        return 1.45;
    if (st.nature)
        return 0;
    return 0.75;
}
// ---------- shapes shared by every chunk ----------
/** City blocks: grey paving under the town buildings (filled in by the scenery planner). [x, y, size] */
let paving = [];
export function setPaving(p) { paving = p; }
let landPath = null;
function buildLand() {
    const g = board.grid;
    const p = new Path2D();
    for (const poly of g.coast) {
        poly.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
        p.closePath();
    }
    // the real coastline only; a station that lands just off the coast gets a little quay to stand on
    const coastOnly = new Path2D(p);
    const c = document.createElement('canvas').getContext('2d');
    const disc = (x, y, r) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, Math.PI * 2); };
    for (const s of [...Object.values(g.stations), ...Object.values(g.ports)])
        if (!c.isPointInPath(coastOnly, s.x, s.y))
            disc(s.x, s.y, 0.5);
    landPath = p;
}
let landMask = null;
const LRES = 8;
/** Is this point on land? (looked up in a small raster of the land shape) */
function inLake(x, y) {
    for (const lk of board.grid.lakes ?? []) {
        const dx = x - lk.x, dy = y - lk.y, c = Math.cos(-lk.rot), sn = Math.sin(-lk.rot);
        const u = dx * c - dy * sn, v = dx * sn + dy * c;
        if ((u / lk.rx) ** 2 + (v / lk.ry) ** 2 < 1.1)
            return true;
    }
    return false;
}
/** Dry land that is not under a lake. */
export function isDryLand(x, y) { return isLand(x, y) && !inLake(x, y); }
export function isLand(x, y) {
    if (!landMask) {
        if (!landPath)
            buildLand();
        const g = board.grid, W = g.w * LRES, H = g.h * LRES;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const m = c.getContext('2d', { willReadFrequently: true });
        m.setTransform(LRES, 0, 0, LRES, LRES / 2, LRES / 2);
        m.fillStyle = '#fff';
        m.fill(landPath);
        const d = m.getImageData(0, 0, W, H).data;
        landMask = new Uint8Array(W * H);
        for (let i = 0; i < landMask.length; i++)
            landMask[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    }
    const g = board.grid;
    const px = Math.floor(x * LRES + LRES / 2), py = Math.floor(y * LRES + LRES / 2);
    if (px < 0 || py < 0 || px >= g.w * LRES || py >= g.h * LRES)
        return false;
    return landMask[py * g.w * LRES + px] === 1;
}
// ---------- painting ----------
const TILE = {
    blue: ['#3d7cf0', '#1f4fc0'], red: ['#f04a3e', '#b8241c'], card: ['#ffd23a', '#d9a400'], quiz: ['#43c26a', '#228a46'],
    event: ['#ff9a2e', '#d2650a'], shop: ['#ffffff', '#cfd6dc'], port: ['#ffffff', '#cfd6dc'], sea: ['#bfe8ff', '#7cc6ee'], station: ['#ffffff', '#cfd2e0'],
};
const TRACK_W = 0.27, TILE_W = 0.34, STATION_W = 0.44;
export class Ground {
    constructor() {
        this.season = 'summer';
        /** screen rows per perspective strip */
        this.band = 4;
        /** True if some ground was left as plain green this frame because its chunk was not painted yet. */
        this.missed = false;
        this.cache = new Map();
        this.frame = 0;
        this.cellsByChunk = new Map();
        this.townsByChunk = new Map();
    }
    setSeason(s) { if (s !== this.season) {
        this.season = s;
        this.cache.clear();
    } }
    index() {
        if (this.cellsByChunk.size)
            return;
        const g = board.grid;
        g.cells.forEach((c, i) => {
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    const k = `${Math.floor((c[0] + dx + 0.5) / CH)},${Math.floor((c[1] + dy + 0.5) / CH)}`;
                    let a = this.cellsByChunk.get(k);
                    if (!a)
                        this.cellsByChunk.set(k, (a = []));
                    if (!a.includes(i))
                        a.push(i);
                }
        });
        paving.forEach(([x, y], i) => {
            for (const [dx, dy] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) {
                const k = `${Math.floor((x + dx + 0.5) / CH)},${Math.floor((y + dy + 0.5) / CH)}`;
                let a = this.townsByChunk.get(k);
                if (!a)
                    this.townsByChunk.set(k, (a = []));
                if (!a.includes(i))
                    a.push(i);
            }
        });
    }
    /** Paints the area x0..x0+w, y0..y0+h (cells) into g, at ppc pixels per cell. Used for chunks and the overview map. */
    paint(g, x0, y0, w, h, ppc, cells, towns, detail = true) {
        if (!landPath)
            buildLand();
        this.index();
        const grid = board.grid;
        const [grass, grassD, grassL] = GRASS[this.season];
        g.setTransform(ppc, 0, 0, ppc, -x0 * ppc, -y0 * ppc);
        // sea
        g.fillStyle = this.season === 'winter' ? '#4f9fd8' : '#3fa3e8';
        g.fillRect(x0, y0, w, h);
        if (detail) {
            g.strokeStyle = 'rgba(255,255,255,0.35)';
            g.lineWidth = 0.035;
            g.lineCap = 'round';
            for (let y = Math.floor(y0); y < y0 + h; y++)
                for (let x = Math.floor(x0); x < x0 + w; x++) {
                    for (let k = 0; k < 2; k++) {
                        const px = x + hash(x, y, k), py = y + hash(x, y, k + 7);
                        g.beginPath();
                        g.moveTo(px - 0.09, py);
                        g.quadraticCurveTo(px, py - 0.05, px + 0.09, py);
                        g.stroke();
                    }
                }
        }
        // shallow water and surf round the coast
        g.save();
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(150,225,255,0.55)';
        g.lineWidth = 0.55;
        g.stroke(landPath);
        g.strokeStyle = 'rgba(255,255,255,0.8)';
        g.lineWidth = 0.16;
        g.stroke(landPath);
        // cliff / beach face: the land shape shifted towards the viewer
        g.translate(0, 0.13);
        g.fillStyle = this.season === 'winter' ? '#b9b2a2' : '#c9a35f';
        g.fill(landPath);
        g.translate(0, -0.05);
        g.fillStyle = this.season === 'winter' ? '#cfc8b8' : '#ddb977';
        g.fill(landPath);
        g.restore();
        g.fillStyle = grass;
        g.fill(landPath);
        // neighbours (the Republic of Ireland, the Isle of Man, France) are paler: they are not part of the UK
        const tags = grid.coastTags ?? [];
        g.fillStyle = FOREIGN[this.season];
        grid.coast.forEach((pts, i) => {
            if (!tags[i] || tags[i] === 'uk')
                return;
            g.beginPath();
            pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
            g.closePath();
            g.fill();
        });
        // lakes (kept clear of the railway and the stations)
        for (const lk of grid.lakes ?? []) {
            g.save();
            g.translate(lk.x, lk.y);
            g.rotate(lk.rot);
            g.fillStyle = '#d9c38a';
            g.beginPath();
            g.ellipse(0, 0.06, lk.rx + 0.08, lk.ry + 0.08, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = this.season === 'winter' ? '#bfe0f0' : '#4fb6ea';
            g.beginPath();
            g.ellipse(0, 0, lk.rx, lk.ry, 0, 0, Math.PI * 2);
            g.fill();
            g.restore();
            g.fillStyle = grass;
            const r = Math.max(lk.rx, lk.ry) + 1.5;
            for (const [x, y, , sea] of grid.cells)
                if (!sea && Math.abs(x - lk.x) < r && Math.abs(y - lk.y) < r) {
                    g.beginPath();
                    g.arc(x, y, 0.55, 0, Math.PI * 2);
                    g.fill();
                }
            for (const s of Object.values(grid.stations))
                if (Math.abs(s.x - lk.x) < r + 1 && Math.abs(s.y - lk.y) < r + 1) {
                    g.beginPath();
                    g.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
                    g.fill();
                    if (s.lm) {
                        g.beginPath();
                        g.arc(s.lm[0], s.lm[1], 0.7, 0, Math.PI * 2);
                        g.fill();
                    }
                }
        }
        // grass texture
        if (detail) {
            g.save();
            g.clip(landPath);
            for (let y = Math.floor(y0); y < y0 + h; y++)
                for (let x = Math.floor(x0); x < x0 + w; x++) {
                    for (let k = 0; k < 3; k++) {
                        g.fillStyle = k === 2 ? grassL : grassD;
                        g.globalAlpha = 0.35;
                        g.beginPath();
                        g.ellipse(x - 0.5 + hash(x, y, k * 3), y - 0.5 + hash(x, y, k * 3 + 1), 0.16 + hash(x, y, k) * 0.2, 0.08 + hash(x, y, k + 9) * 0.08, 0, 0, Math.PI * 2);
                        g.fill();
                    }
                }
            g.globalAlpha = 1;
            g.restore();
        }
        // patchwork fields with hedges in open countryside
        if (detail) {
            const F = FIELDS[this.season];
            g.save();
            g.clip(landPath);
            for (let y = Math.floor(y0); y < y0 + h + 1; y++)
                for (let x = Math.floor(x0); x < x0 + w + 1; x++) {
                    if (landUse(x, y) !== 'field')
                        continue;
                    const sx = 0.35 + hash(x, y, 21) * 0.3, sy = 0.35 + hash(x, y, 22) * 0.3;
                    const rects = [[0, 0, sx, sy], [sx, 0, 1 - sx, sy], [0, sy, sx, 1 - sy], [sx, sy, 1 - sx, 1 - sy]];
                    rects.forEach(([rx, ry, rw, rh], k) => {
                        g.fillStyle = F[Math.floor(hash(x, y, 30 + k) * F.length)];
                        g.fillRect(x - 0.5 + rx + 0.025, y - 0.5 + ry + 0.025, rw - 0.05, rh - 0.05);
                        if (hash(x, y, 40 + k) < 0.4) { // ploughed stripes
                            g.strokeStyle = 'rgba(0,0,0,0.07)';
                            g.lineWidth = 0.02;
                            for (let t = 0.05; t < rw - 0.05; t += 0.07) {
                                g.beginPath();
                                g.moveTo(x - 0.5 + rx + t, y - 0.5 + ry + 0.05);
                                g.lineTo(x - 0.5 + rx + t, y - 0.5 + ry + rh - 0.05);
                                g.stroke();
                            }
                        }
                    });
                    g.strokeStyle = HEDGE[this.season];
                    g.lineWidth = 0.045;
                    g.lineCap = 'round';
                    g.beginPath();
                    if (hash(x, y, 50) < 0.8) {
                        g.moveTo(x - 0.5 + sx, y - 0.5);
                        g.lineTo(x - 0.5 + sx, y + 0.5);
                    }
                    if (hash(x, y, 51) < 0.8) {
                        g.moveTo(x - 0.5, y - 0.5 + sy);
                        g.lineTo(x + 0.5, y - 0.5 + sy);
                    }
                    if (hash(x, y, 52) < 0.45) {
                        g.moveTo(x - 0.5, y - 0.5);
                        g.lineTo(x + 0.5, y - 0.5);
                    }
                    if (hash(x, y, 53) < 0.45) {
                        g.moveTo(x - 0.5, y - 0.5);
                        g.lineTo(x - 0.5, y + 0.5);
                    }
                    g.stroke();
                }
            g.restore();
        }
        // towns: grey city blocks under the buildings, with white kerbs
        const pv = towns ?? paving.map((_, i) => i);
        g.fillStyle = 'rgba(0,0,0,0.13)';
        for (const i of pv) {
            const [x, y, sz] = paving[i];
            g.beginPath();
            g.roundRect(x - sz / 2 + 0.01, y - sz / 2 + 0.04, sz - 0.02, sz - 0.02, 0.03);
            g.fill();
        }
        g.fillStyle = '#eef0f2';
        for (const i of pv) {
            const [x, y, sz] = paving[i];
            g.beginPath();
            g.roundRect(x - sz / 2 + 0.01, y - sz / 2 + 0.01, sz - 0.02, sz - 0.02, 0.03);
            g.fill();
        }
        g.fillStyle = this.season === 'winter' ? '#d3d8de' : '#bfc4ca';
        for (const i of pv) {
            const [x, y, sz] = paving[i];
            g.beginPath();
            g.roundRect(x - sz / 2 + 0.03, y - sz / 2 + 0.03, sz - 0.06, sz - 0.06, 0.02);
            g.fill();
        }
        // track
        const list = cells ?? grid.cells.map((_, i) => i);
        // bridges where a railway crosses water
        for (const i of list) {
            const [x, y, bits, sea] = grid.cells[i];
            if (sea)
                continue;
            const here = isLand(x, y);
            const segs = [];
            if (!here)
                segs.push([0, 0]);
            if ((bits & R) && (!here || !isLand(x + 1, y) || !isLand(x + 0.5, y)))
                segs.push([1, 0]);
            if ((bits & D) && (!here || !isLand(x, y + 1) || !isLand(x, y + 0.5)))
                segs.push([0, 1]);
            const hw = TRACK_W / 2 + 0.07;
            for (const [dx, dy] of segs) {
                const rx = x - hw, ry = y - hw, rw = dx + hw * 2, rh = dy + hw * 2;
                g.fillStyle = 'rgba(0,40,80,0.25)';
                g.fillRect(rx + 0.03, ry + 0.1, rw, rh);
                g.fillStyle = '#9c927e';
                g.fillRect(rx, ry + 0.05, rw, rh);
                g.fillStyle = '#d8cfb8';
                g.fillRect(rx, ry, rw, rh);
                if (dx)
                    for (let t = 0.25; t < 1; t += 0.5) {
                        g.fillStyle = '#8a8170';
                        g.fillRect(x + t - 0.04, y + hw, 0.08, 0.12);
                    }
            }
        }
        for (const i of list) {
            const [x, y, bits, sea] = grid.cells[i];
            if (sea) {
                g.strokeStyle = 'rgba(255,255,255,0.9)';
                g.lineWidth = 0.06;
                g.setLineDash([0.12, 0.1]);
                g.lineCap = 'butt';
                g.beginPath();
                if (bits & R) {
                    g.moveTo(x, y);
                    g.lineTo(x + 0.5, y);
                }
                if (bits & L) {
                    g.moveTo(x, y);
                    g.lineTo(x - 0.5, y);
                }
                if (bits & D) {
                    g.moveTo(x, y);
                    g.lineTo(x, y + 0.5);
                }
                if (bits & U) {
                    g.moveTo(x, y);
                    g.lineTo(x, y - 0.5);
                }
                g.stroke();
                g.setLineDash([]);
                continue;
            }
            this.trackPiece(g, x, y, bits, detail);
        }
        // squares on top of the track
        for (const i of list) {
            const [x, y] = grid.cells[i];
            const n = board.nodes[board.cellNode[y * grid.w + x]];
            if (!n)
                continue;
            this.tile(g, x, y, n.type, ppc);
        }
        g.setTransform(1, 0, 0, 1, 0, 0);
    }
    trackPiece(g, x, y, bits, detail) {
        const hw = TRACK_W / 2;
        // each cell draws the full piece to its right and below (so pieces never split), plus a centre patch
        const segs = [];
        if (bits & R)
            segs.push([1, 0]);
        if (bits & D)
            segs.push([0, 1]);
        const rect = (dx, dy, grow, off = 0) => g.fillRect(x - hw - grow, y - hw - grow + off, dx + TRACK_W + grow * 2, dy + TRACK_W + grow * 2);
        g.fillStyle = 'rgba(0,0,0,0.2)';
        rect(0, 0, 0.02, 0.035);
        for (const [dx, dy] of segs)
            rect(dx, dy, 0.02, 0.035);
        g.fillStyle = '#4d4d50';
        rect(0, 0, 0);
        for (const [dx, dy] of segs)
            rect(dx, dy, 0);
        // white sleepers on a fixed spacing: the ladder look of Momotetsu's track
        g.fillStyle = '#ffffff';
        const step = 1 / 9, sw = 0.062, inset = 0.03;
        for (const [dx, dy] of segs) {
            for (let k = 1; k < 9; k++) {
                const cx = x + dx * k * step, cy = y + dy * k * step;
                if (dx)
                    g.fillRect(cx - sw / 2, cy - hw + inset, sw, TRACK_W - inset * 2);
                else
                    g.fillRect(cx - hw + inset, cy - sw / 2, TRACK_W - inset * 2, sw);
            }
        }
        if (detail) {
            g.fillStyle = '#a9a9ad';
            for (const [dx, dy] of segs) {
                if (dx) {
                    g.fillRect(x, y - hw + 0.005, 1, 0.022);
                    g.fillRect(x, y + hw - 0.027, 1, 0.022);
                }
                else {
                    g.fillRect(x - hw + 0.005, y, 0.022, 1);
                    g.fillRect(x + hw - 0.027, y, 0.022, 1);
                }
            }
        }
    }
    tile(g, x, y, type, ppc) {
        const w = type === 'station' ? STATION_W : TILE_W;
        const [c1, c2] = TILE[type] ?? TILE.blue;
        const h = w / 2;
        const th = 0.06; // thickness seen from the camera
        // drop shadow and side face
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.beginPath();
        g.roundRect(x - h + 0.02, y - h + 0.05, w, w + th, 0.05);
        g.fill();
        g.fillStyle = type === 'station' || type === 'shop' || type === 'port' ? '#9aa3b5' : c2;
        g.beginPath();
        g.roundRect(x - h, y - h + th, w, w, 0.05);
        g.fill();
        // white rim and the coloured top
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.roundRect(x - h, y - h, w, w, 0.05);
        g.fill();
        const m = 0.03;
        const grd = g.createLinearGradient(0, y - h, 0, y + h);
        grd.addColorStop(0, c1);
        grd.addColorStop(1, c2);
        g.fillStyle = type === 'station' ? '#f4f5fb' : grd;
        g.beginPath();
        g.roundRect(x - h + m, y - h + m, w - m * 2, w - m * 2, 0.03);
        g.fill();
        if (ppc < 30)
            return;
        // icons
        if (type === 'station') {
            // the purple house of Momotetsu
            const s = w * 0.36;
            g.fillStyle = '#ffffff';
            g.fillRect(x - s * 0.75, y - s * 0.1, s * 1.5, s * 0.95);
            g.strokeStyle = '#6a3fb5';
            g.lineWidth = 0.012;
            g.strokeRect(x - s * 0.75, y - s * 0.1, s * 1.5, s * 0.95);
            g.fillStyle = '#8a5ad8';
            g.beginPath();
            g.moveTo(x - s, y - s * 0.05);
            g.lineTo(x, y - s * 0.95);
            g.lineTo(x + s, y - s * 0.05);
            g.closePath();
            g.fill();
            g.fillStyle = '#b48cf0';
            g.beginPath();
            g.moveTo(x - s * 0.62, y - s * 0.32);
            g.lineTo(x, y - s * 0.78);
            g.lineTo(x + s * 0.2, y - s * 0.62);
            g.closePath();
            g.fill();
            g.fillStyle = '#6a3fb5';
            g.beginPath();
            g.roundRect(x - s * 0.22, y + s * 0.3, s * 0.44, s * 0.55, [s * 0.22, s * 0.22, 0, 0]);
            g.fill();
        }
        else if (type === 'shop') {
            star(g, x, y, w * 0.36, '#2fae4f');
        }
        else if (type === 'quiz' || type === 'event') {
            g.fillStyle = '#ffffff';
            g.font = `900 ${w * 0.62}px sans-serif`;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            g.fillText(type === 'quiz' ? '?' : '!', x, y + w * 0.03);
        }
        else if (type === 'port') {
            g.strokeStyle = '#1f4fc0';
            g.lineWidth = 0.03;
            g.lineCap = 'round';
            g.beginPath();
            g.moveTo(x, y - w * 0.28);
            g.lineTo(x, y + w * 0.26);
            g.moveTo(x - w * 0.16, y - w * 0.12);
            g.lineTo(x + w * 0.16, y - w * 0.12);
            g.moveTo(x - w * 0.24, y + w * 0.06);
            g.quadraticCurveTo(x, y + w * 0.42, x + w * 0.24, y + w * 0.06);
            g.stroke();
        }
        else if (type === 'sea') {
            g.strokeStyle = '#ffffff';
            g.lineWidth = 0.025;
            g.beginPath();
            g.moveTo(x - w * 0.25, y);
            g.quadraticCurveTo(x - w * 0.12, y - w * 0.12, x, y);
            g.quadraticCurveTo(x + w * 0.12, y + w * 0.12, x + w * 0.25, y);
            g.stroke();
        }
    }
    chunk(i, j) {
        const key = `${i},${j}`;
        let e = this.cache.get(key);
        if (e) {
            e.used = this.frame;
            return e.c;
        }
        const c = document.createElement('canvas');
        c.width = CPX;
        c.height = CPX;
        const g = c.getContext('2d');
        this.paint(g, i * CH - 0.5, j * CH - 0.5, CH, CH, P, this.cellsByChunk.get(key) ?? [], this.townsByChunk.get(key) ?? []);
        e = { c, used: this.frame };
        this.cache.set(key, e);
        if (this.cache.size > 100) {
            let old = '', oldest = Infinity;
            for (const [k, v] of this.cache)
                if (v.used < oldest) {
                    oldest = v.used;
                    old = k;
                }
            this.cache.delete(old);
        }
        return c;
    }
    /** Draws the ground in perspective, from screen row top to bottom. */
    draw(ctx, cam, top = 0, bottom = 720) {
        this.frame++;
        if (!landPath)
            buildLand();
        this.index();
        this.missed = false;
        const t0 = performance.now();
        let painted = 0;
        const BAND = this.band;
        const sea = this.season === 'winter' ? '#4f9fd8' : '#3fa3e8';
        // Chunk columns/rows that touch the board; anything else is open sea and never painted or cached.
        const maxI = Math.ceil(board.grid.w / CH), maxJ = Math.ceil(board.grid.h / CH);
        const edgeR = board.grid.w - 0.5;
        ctx.imageSmoothingEnabled = true;
        for (let sy = top; sy < bottom; sy += BAND) {
            const a = cam.groundRow(sy), b = cam.groundRow(sy + BAND), mid = cam.groundRow(sy + BAND / 2);
            if (!a || !b || !mid)
                continue;
            const s = mid.s;
            const xl = cam.x + (0 - cam.cx) / s, xr = cam.x + (1280 - cam.cx) / s;
            const zt = a.z, zb = b.z;
            // Open sea first, in one fill: the chunk strips below only cover the board itself.
            // (Skipped when the whole band is over land chunks, to avoid pointless overdraw.)
            if (xl < -0.5 || xr > edgeR || zt < -0.5 || zb > board.grid.h - 0.5) {
                ctx.fillStyle = sea;
                ctx.fillRect(0, sy, 1280, BAND + 0.6);
            }
            const j0 = Math.max(0, Math.floor((zt + 0.5) / CH)), j1 = Math.min(maxJ, Math.floor((zb + 0.5) / CH));
            const i0 = Math.max(0, Math.floor((xl + 0.5) / CH)), i1 = Math.min(maxI, Math.floor((xr + 0.5) / CH));
            for (let j = j0; j <= j1; j++) {
                const cz0 = j * CH - 0.5;
                const za = Math.max(zt, cz0), zz = Math.min(zb, cz0 + CH);
                if (zz <= za)
                    continue;
                const dy0 = sy + (za - zt) / (zb - zt) * BAND, dy1 = sy + (zz - zt) / (zb - zt) * BAND;
                for (let i = i0; i <= i1; i++) {
                    const cx0 = i * CH - 0.5;
                    const xa = Math.max(xl, cx0), xz = Math.min(xr, cx0 + CH);
                    if (xz <= xa)
                        continue;
                    const key = `${i},${j}`;
                    if (!this.cache.has(key)) {
                        // New chunks are capped per frame by count AND time, so a fast camera move costs a
                        // bounded hitch; anything not painted yet falls back to plain green below.
                        if (painted >= 3 || (painted >= 1 && performance.now() - t0 > 6)) {
                            this.missed = true;
                            ctx.fillStyle = '#5fbf45';
                            ctx.fillRect(cam.cx + (xa - cam.x) * s, dy0, (xz - xa) * s, dy1 - dy0 + 0.5);
                            continue;
                        }
                        painted++;
                    }
                    const c = this.chunk(i, j);
                    const dx = cam.cx + (xa - cam.x) * s;
                    ctx.drawImage(c, (xa - cx0) * P, (za - cz0) * P, (xz - xa) * P, Math.max(0.5, (zz - za) * P), dx, dy0, (xz - xa) * s + 0.6, dy1 - dy0 + 0.6);
                }
            }
        } // Nothing was missing this frame: paint one chunk just outside the view, so the camera never has to wait for one.
        if (painted === 0 && !this.missed)
            this.prefetch(cam);
    }
    prefetch(cam) {
        const ci = Math.floor((cam.x + 0.5) / CH), cj = Math.floor((cam.z + 0.5) / CH);
        let best = '', bi = 0, bj = 0, bd = Infinity;
        for (let dj = -3; dj <= 2; dj++)
            for (let di = -3; di <= 3; di++) {
                const i = ci + di, j = cj + dj;
                if (i < 0 || j < 0 || i > Math.ceil(board.grid.w / CH) || j > Math.ceil(board.grid.h / CH) || this.cache.has(`${i},${j}`))
                    continue;
                const d = di * di + dj * dj * 1.5;
                if (d < bd) {
                    bd = d;
                    best = `${i},${j}`;
                    bi = i;
                    bj = j;
                }
            }
        if (best)
            this.chunk(bi, bj);
    }
}
function star(g, x, y, r, color) {
    g.fillStyle = color;
    g.beginPath();
    for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r;
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
}
//# sourceMappingURL=ground.js.map