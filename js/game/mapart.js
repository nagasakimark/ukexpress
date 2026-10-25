// Placeholder map art in a toy-railway style.
// The terrain (sea, land, lakes, trees, mountains) is painted once into an offscreen canvas.
// Track, squares and stations are drawn as vectors every frame, so they stay sharp at any zoom.
import { project, board, WORLD_W, WORLD_H } from '../core/map.js';
import { STATION_BY_ID } from '../core/content/stations.js';
import { REGIONS } from '../core/content/game-data.js';
import { C, FONT, emoji, text, shade, roundRect } from '../engine/draw.js';
import { main } from './i18n.js';
export const GB = [
    [-3.37, 58.67], [-3.03, 58.64], [-3.09, 58.44], [-3.65, 58.12], [-3.77, 57.86], [-4.2, 57.5], [-3.87, 57.59], [-3.28, 57.72], [-2.0, 57.69], [-1.78, 57.5],
    [-2.08, 57.15], [-2.2, 56.96], [-2.46, 56.7], [-2.58, 56.56], [-2.97, 56.46], [-2.79, 56.34], [-2.58, 56.28], [-3.15, 56.11], [-3.6, 56.03], [-3.17, 55.98],
    [-2.72, 56.06], [-2.52, 56.0], [-2.13, 55.9], [-2.0, 55.77], [-1.71, 55.61], [-1.57, 55.33], [-1.42, 55.02], [-1.37, 54.9], [-1.18, 54.69], [-1.06, 54.62],
    [-0.61, 54.49], [-0.39, 54.28], [-0.08, 54.12], [-0.2, 53.75], [0.11, 53.58], [0.34, 53.14], [0.2, 52.9], [0.49, 52.95], [1.3, 52.93], [1.73, 52.6],
    [1.76, 52.47], [1.6, 52.1], [1.35, 51.96], [1.16, 51.79], [0.71, 51.54], [0.45, 51.48], [1.0, 51.37], [1.39, 51.39], [1.42, 51.33], [1.32, 51.12],
    [0.98, 50.91], [0.57, 50.85], [0.25, 50.73], [-0.14, 50.82], [-0.79, 50.73], [-1.09, 50.79], [-1.4, 50.85], [-1.88, 50.72], [-1.95, 50.6], [-2.45, 50.6],
    [-2.94, 50.72], [-3.4, 50.62], [-3.64, 50.22], [-4.14, 50.36], [-4.7, 50.3], [-5.2, 49.96], [-5.53, 50.12], [-5.71, 50.07], [-5.48, 50.21], [-5.07, 50.42],
    [-4.94, 50.54], [-4.53, 51.02], [-4.2, 51.06], [-4.12, 51.21], [-3.47, 51.21], [-3.0, 51.22], [-2.98, 51.35], [-2.7, 51.5], [-2.64, 51.61], [-2.98, 51.55],
    [-3.17, 51.46], [-3.27, 51.39], [-3.7, 51.48], [-3.94, 51.61], [-4.3, 51.55], [-4.16, 51.68], [-4.4, 51.72], [-4.7, 51.67], [-5.17, 51.68], [-5.3, 51.88],
    [-4.98, 52.0], [-4.66, 52.1], [-4.08, 52.41], [-4.05, 52.54], [-4.06, 52.72], [-4.42, 52.89], [-4.72, 52.8], [-4.52, 52.94], [-4.3, 53.08], [-4.45, 53.15],
    [-4.63, 53.31], [-4.34, 53.41], [-4.09, 53.27], [-3.83, 53.33], [-3.49, 53.32], [-3.32, 53.35], [-3.1, 53.25], [-3.15, 53.4], [-3.0, 53.42], [-3.07, 53.56],
    [-3.0, 53.65], [-3.05, 53.82], [-3.01, 53.92], [-2.87, 54.07], [-3.23, 54.11], [-3.59, 54.55], [-3.55, 54.64], [-3.39, 54.87], [-3.1, 54.95], [-3.6, 54.87],
    [-4.05, 54.83], [-4.4, 54.68], [-4.86, 54.64], [-5.12, 54.84], [-5.16, 55.01], [-5.03, 54.97], [-4.86, 55.24], [-4.63, 55.46], [-4.87, 55.8], [-4.76, 55.95],
    [-4.5, 55.93], [-4.92, 55.95], [-5.4, 55.4], [-5.8, 55.3], [-5.65, 55.75], [-5.6, 56.1], [-5.47, 56.41], [-6.22, 56.73], [-5.83, 57.0], [-5.71, 57.28],
    [-5.81, 57.43], [-5.7, 57.73], [-5.16, 57.9], [-5.24, 58.15], [-5.0, 58.62], [-4.75, 58.57], [-4.42, 58.53], [-3.52, 58.6],
];
export const NI = [[-6.15, 55.22], [-6.51, 55.24], [-6.66, 55.2], [-6.95, 55.18], [-7.31, 55.05], [-7.55, 54.75], [-8.15, 54.45], [-7.9, 54.3], [-7.4, 54.15], [-7.0, 54.4], [-6.6, 54.05], [-6.27, 54.1], [-5.89, 54.21], [-5.55, 54.33], [-5.43, 54.5], [-5.6, 54.68], [-5.9, 54.65], [-5.8, 54.85], [-5.98, 55.05]];
export const IRELAND = [[-6.15, 55.22], [-7.3, 55.37], [-8.3, 55.15], [-8.7, 54.7], [-8.4, 54.3], [-9.9, 54.2], [-10.1, 53.5], [-9.0, 53.2], [-9.9, 52.6], [-10.3, 52.15], [-9.6, 51.6], [-8.5, 51.6], [-7.5, 52.0], [-6.4, 52.18], [-6.0, 53.0], [-6.1, 53.6], [-6.27, 54.1], [-5.55, 54.33], [-5.43, 54.5], [-5.9, 54.68], [-5.8, 54.85], [-5.98, 55.05]];
export const ISLANDS = [
    [[-5.67, 57.27], [-6.05, 57.1], [-6.5, 57.3], [-6.78, 57.45], [-6.35, 57.7], [-6.1, 57.6], [-5.9, 57.4]], // Skye
    [[-7.5, 56.95], [-7.2, 57.2], [-7.2, 57.6], [-6.8, 57.8], [-6.2, 58.3], [-6.3, 58.5], [-6.9, 58.25], [-7.1, 57.9], [-7.5, 57.6], [-7.5, 57.1]], // Outer Hebrides
    [[-3.35, 58.95], [-3.1, 59.15], [-2.7, 59.1], [-2.75, 58.9], [-3.0, 58.82]], // Orkney
    [[-1.58, 50.67], [-1.3, 50.77], [-1.07, 50.68], [-1.3, 50.58]], // Isle of Wight
    [[-6.0, 56.6], [-5.7, 56.45], [-6.3, 56.3], [-6.35, 56.55]], // Mull
    [[-6.1, 55.9], [-6.45, 55.85], [-6.3, 55.6], [-6.05, 55.65]], // Islay
];
export const MAN = [[-4.8, 54.06], [-4.4, 54.42], [-4.3, 54.25], [-4.6, 54.05]];
export const FRANCE = [[1.6, 51.0], [2.6, 51.1], [3.5, 51.3], [3.5, 49.5], [1.2, 49.5], [1.4, 50.2]];
function poly(ctx, pts) {
    ctx.beginPath();
    pts.forEach(([lon, lat], i) => { const p = project(lon, lat); if (i)
        ctx.lineTo(p.x, p.y);
    else
        ctx.moveTo(p.x, p.y); });
    ctx.closePath();
}
export let worldCanvas = null;
function rngF(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export const LAKES = [
    { lon: -4.45, lat: 57.24, rx: 32, ry: 6, rot: -0.75 }, // Loch Ness
    { lon: -2.93, lat: 54.33, rx: 14, ry: 4, rot: -1.4 }, // Windermere
    { lon: -6.45, lat: 54.6, rx: 26, ry: 20, rot: 0 }, // Lough Neagh
    { lon: -4.6, lat: 56.1, rx: 20, ry: 5, rot: -1.2 }, // Loch Lomond
];
export const MOUNTAINS = [
    [-5.0, 57.05, 1.3], [-4.75, 56.85, 1.1], [-4.1, 57.15, 1], [-5.3, 57.6, 1.1], [-4.8, 57.95, 1], [-3.6, 57.0, 1.2], [-3.95, 56.62, 0.9],
    [-4.4, 58.2, 0.9], [-3.95, 52.95, 1.1], [-3.75, 52.7, 0.8], [-3.1, 54.5, 1], [-2.2, 54.25, 0.8], [-2.0, 53.6, 0.7], [-3.5, 51.9, 0.8], [-3.3, 55.45, 0.8],
];
/** Distance from a point to the nearest track or square, used to keep decorations off the railway. */
function clearance(x, y) {
    let d = Infinity;
    for (const n of board.nodes)
        d = Math.min(d, Math.hypot(n.x - x, n.y - y));
    for (const e of board.edges)
        for (const p of e.pts)
            d = Math.min(d, Math.hypot(p.x - x, p.y - y));
    return d;
}
function tree(ctx, x, y, s, autumn = false) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 4, 11 * s, 5 * s, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(x - 2 * s, y - 6 * s, 4 * s, 8 * s);
    const leaf = autumn ? '#e08a2e' : '#3f8f3a', hi = autumn ? '#f2b34d' : '#5fb24d';
    ctx.fillStyle = leaf;
    ctx.beginPath();
    ctx.arc(x, y - 12 * s, 9 * s, 0, 7);
    ctx.fill();
    ctx.fillStyle = hi;
    ctx.beginPath();
    ctx.arc(x - 3 * s, y - 15 * s, 4.5 * s, 0, 7);
    ctx.fill();
}
function mountain(ctx, x, y, s) {
    const w = 46 * s, h = 40 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 2, w * 0.6, 7 * s, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#8c8a7a';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a9a795';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x - w * 0.05, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.16, y - h * 0.66);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + w * 0.16, y - h * 0.66);
    ctx.lineTo(x + w * 0.05, y - h * 0.72);
    ctx.lineTo(x - w * 0.04, y - h * 0.62);
    ctx.closePath();
    ctx.fill();
}
export function renderWorld() {
    const c = document.createElement('canvas');
    c.width = WORLD_W;
    c.height = WORLD_H;
    const ctx = c.getContext('2d');
    // Sea with soft wave marks
    const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    g.addColorStop(0, '#5aa7dc');
    g.addColorStop(1, '#78c0ea');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    const r = rngF(7);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 220; i++) {
        const x = r() * WORLD_W, y = r() * WORLD_H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 9, y - 6, x + 18, y);
        ctx.quadraticCurveTo(x + 27, y + 6, x + 36, y);
        ctx.stroke();
    }
    // Neighbours (not part of the UK) in a muted colour
    for (const pts of [IRELAND, FRANCE, MAN]) {
        poly(ctx, pts);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 10;
        ctx.lineJoin = 'round';
        ctx.stroke();
        poly(ctx, pts);
        ctx.fillStyle = '#cfd3bd';
        ctx.fill();
    }
    // UK: foam, sand, grass
    const uk = [GB, NI, ...ISLANDS];
    for (const pts of uk) {
        poly(ctx, pts);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 22;
        ctx.lineJoin = 'round';
        ctx.stroke();
    }
    for (const pts of uk) {
        poly(ctx, pts);
        ctx.strokeStyle = '#efdc9c';
        ctx.lineWidth = 12;
        ctx.stroke();
    }
    for (const pts of uk) {
        poly(ctx, pts);
        ctx.fillStyle = '#a3d46f';
        ctx.fill();
    }
    ctx.save();
    ctx.beginPath();
    for (const pts of uk)
        pts.forEach(([lon, lat], i) => { const p = project(lon, lat); if (i)
            ctx.lineTo(p.x, p.y);
        else
            ctx.moveTo(p.x, p.y); });
    ctx.clip();
    // gentle patches of darker and lighter grass
    const pr = rngF(3);
    for (let i = 0; i < 160; i++) {
        const x = pr() * WORLD_W, y = pr() * WORLD_H, rr = 40 + pr() * 90;
        ctx.fillStyle = pr() < 0.5 ? 'rgba(80,150,60,0.10)' : 'rgba(255,255,200,0.10)';
        ctx.beginPath();
        ctx.ellipse(x, y, rr, rr * 0.7, pr() * 3, 0, 7);
        ctx.fill();
    }
    // Highlands are a little browner
    const hl = project(-4.6, 57.3);
    const hg = ctx.createRadialGradient(hl.x, hl.y, 50, hl.x, hl.y, 420);
    hg.addColorStop(0, 'rgba(150,140,90,0.35)');
    hg.addColorStop(1, 'rgba(150,140,90,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(hl.x - 420, hl.y - 420, 840, 840);
    ctx.restore();
    // Lakes
    for (const l of LAKES) {
        const p = project(l.lon, l.lat);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(l.rot);
        ctx.fillStyle = '#efdc9c';
        ctx.beginPath();
        ctx.ellipse(0, 0, l.rx + 4, l.ry + 4, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#6fbfe8';
        ctx.beginPath();
        ctx.ellipse(0, 0, l.rx, l.ry, 0, 0, 7);
        ctx.fill();
        ctx.restore();
    }
    // Mountains and trees, kept clear of the railway
    for (const [lon, lat, s] of MOUNTAINS) {
        const p = project(lon, lat);
        if (clearance(p.x, p.y - 15) > 40)
            mountain(ctx, p.x, p.y, s * 1.2);
    }
    const tr = rngF(11);
    ctx.save();
    ctx.beginPath();
    for (const pts of uk)
        pts.forEach(([lon, lat], i) => { const p = project(lon, lat); if (i)
            ctx.lineTo(p.x, p.y);
        else
            ctx.moveTo(p.x, p.y); });
    let placed = 0;
    for (let i = 0; i < 1400 && placed < 170; i++) {
        const x = tr() * WORLD_W, y = tr() * WORLD_H;
        if (!ctx.isPointInPath(x, y) || clearance(x, y) < 48)
            continue;
        const n = 1 + Math.floor(tr() * 3);
        for (let k = 0; k < n; k++)
            tree(ctx, x + (tr() - 0.5) * 30, y + (tr() - 0.5) * 18, 0.8 + tr() * 0.4, tr() < 0.15);
        placed++;
    }
    ctx.restore();
    // Very faint country and sea names
    const label = (s, lon, lat, size, color = 'rgba(40,80,30,0.22)') => { const p = project(lon, lat); text(ctx, s, p.x, p.y, { size, color, align: 'center', weight: 400 }); };
    label('SCOTLAND', -3.9, 56.95, 60);
    label('ENGLAND', -1.1, 52.75, 60);
    label('WALES', -3.55, 52.25, 44);
    label('NORTHERN IRELAND', -6.8, 54.35, 26);
    label('Ireland (not UK)', -8.6, 53.2, 30, 'rgba(60,60,40,0.35)');
    label('France', 2.4, 50.2, 30, 'rgba(60,60,40,0.35)');
    label('North Sea', 1.2, 56.6, 44, 'rgba(255,255,255,0.4)');
    label('Irish Sea', -5.1, 53.9, 34, 'rgba(255,255,255,0.45)');
    label('English Channel', -2.6, 50.15, 32, 'rgba(255,255,255,0.45)');
    label('Atlantic Ocean', -9.4, 57.4, 44, 'rgba(255,255,255,0.4)');
    worldCanvas = c;
}
// ---------- railway layer (drawn every frame) ----------
const SQ = 17; // half-size of a square
const TILE = {
    blue: { fill: '#2f6fe0', glyph: '+' },
    red: { fill: '#e0383b', glyph: '−' },
    card: { fill: '#f5c400', glyph: 'card' },
    quiz: { fill: '#9b59d0', glyph: '?' },
    event: { fill: '#ff8c1a', glyph: '★' },
    shop: { fill: '#17a2a2', emoji: '🏪' },
};
function trackPath(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}
function visible(v, x, y, pad = 80) { return x > v.x0 - pad && x < v.x1 + pad && y > v.y0 - pad && y < v.y1 + pad; }
/** Track in a toy style: white rails with black-and-white sleepers. Ferry routes are dashed lines. */
export function drawTracks(ctx, v) {
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    for (const e of board.edges) {
        const a = board.nodes[e.a], b = board.nodes[e.b];
        const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x), minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
        if (maxX < v.x0 - 60 || minX > v.x1 + 60 || maxY < v.y0 - 60 || minY > v.y1 + 60)
            continue;
        if (e.sea) {
            trackPath(ctx, e.pts);
            ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            ctx.lineWidth = 5;
            ctx.setLineDash([12, 10]);
            ctx.stroke();
            ctx.setLineDash([]);
            continue;
        }
        trackPath(ctx, e.pts);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 24;
        ctx.stroke();
        trackPath(ctx, e.pts);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 19;
        ctx.stroke();
        trackPath(ctx, e.pts);
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 13;
        ctx.stroke();
        trackPath(ctx, e.pts);
        ctx.strokeStyle = '#f2f2f2';
        ctx.lineWidth = 13;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    ctx.restore();
}
/** Coloured squares, flat and bold, so they read at a glance. */
export function drawSquares(ctx, v) {
    for (const n of board.nodes) {
        if (n.type === 'station' || !visible(v, n.x, n.y))
            continue;
        if (n.type === 'sea') {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#2b6aa0';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(n.x, n.y, 9, 0, 7);
            ctx.fill();
            ctx.stroke();
            continue;
        }
        if (n.type === 'port') {
            ctx.fillStyle = '#20170a';
            roundRect(ctx, n.x - 22, n.y - 22, 44, 44, 9);
            ctx.fill();
            ctx.fillStyle = '#7d8b99';
            roundRect(ctx, n.x - 19, n.y - 19, 38, 38, 7);
            ctx.fill();
            emoji(ctx, '⚓', n.x, n.y, 24);
            continue;
        }
        const t = TILE[n.type];
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        roundRect(ctx, n.x - SQ + 2, n.y - SQ + 4, SQ * 2, SQ * 2, 7);
        ctx.fill();
        ctx.fillStyle = '#20170a';
        roundRect(ctx, n.x - SQ - 3, n.y - SQ - 3, SQ * 2 + 6, SQ * 2 + 6, 9);
        ctx.fill();
        ctx.fillStyle = t.fill;
        roundRect(ctx, n.x - SQ, n.y - SQ, SQ * 2, SQ * 2, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        roundRect(ctx, n.x - SQ + 3, n.y - SQ + 3, SQ * 2 - 6, SQ - 4, 5);
        ctx.fill();
        if (t.glyph === 'card') {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#9a7a00';
            ctx.lineWidth = 2;
            roundRect(ctx, n.x - 7, n.y - 10, 14, 20, 3);
            ctx.fill();
            ctx.stroke();
        }
        else if (t.glyph)
            text(ctx, t.glyph, n.x, n.y + 1, { size: 26, color: '#fff', align: 'center', outline: 4, outlineColor: shade(t.fill, -0.4), font: '"Arial Rounded MT Bold", Arial, sans-serif' });
        if (t.emoji)
            emoji(ctx, t.emoji, n.x, n.y, 22);
    }
}
/** Stations: a paved plaza tile in the region's colour, a big landmark, and a white name sign placed where it is clearest. */
export function drawStations(ctx, v, owners) {
    const S = 31;
    const vis = board.nodes.filter((n) => n.stationId && visible(v, n.x, n.y, 160));
    for (const n of vis) {
        const st = STATION_BY_ID[n.stationId];
        const col = REGIONS[n.region].color;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        roundRect(ctx, n.x - S + 3, n.y - S + 6, S * 2, S * 2, 14);
        ctx.fill();
        ctx.fillStyle = '#20170a';
        roundRect(ctx, n.x - S - 3, n.y - S - 3, S * 2 + 6, S * 2 + 6, 16);
        ctx.fill();
        ctx.fillStyle = col;
        roundRect(ctx, n.x - S, n.y - S, S * 2, S * 2, 14);
        ctx.fill();
        ctx.fillStyle = '#e9e3d2';
        roundRect(ctx, n.x - S + 6, n.y - S + 6, S * 2 - 12, S * 2 - 12, 9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 2;
        for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.moveTo(n.x + k * 13, n.y - S + 7);
            ctx.lineTo(n.x + k * 13, n.y + S - 7);
            ctx.moveTo(n.x - S + 7, n.y + k * 13);
            ctx.lineTo(n.x + S - 7, n.y + k * 13);
            ctx.stroke();
        }
        emoji(ctx, st.emoji, n.x, n.y - 2, 36);
        if (st.hometown)
            emoji(ctx, '🏠', n.x - S + 3, n.y - S + 3, 20);
        if (st.film)
            emoji(ctx, '🎬', n.x + S - 3, n.y - S + 3, 18);
        if (st.trainShop)
            emoji(ctx, '🚂', n.x + S - 2, n.y + S - 8, 18);
    }
    // signs go on top of everything else on the board
    for (const n of vis) {
        const st = STATION_BY_ID[n.stationId];
        const name = main(st.name);
        const size = 19;
        ctx.font = `700 ${size}px ${FONT}`;
        const w = Math.max(64, ctx.measureText(name).width + 20);
        const lb = n.label ?? { dx: 0, dy: 52 };
        const cx = n.x + lb.dx, cy = n.y + lb.dy;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        roundRect(ctx, cx - w / 2 + 2, cy - 12, w, 30, 7);
        ctx.fill();
        ctx.fillStyle = '#20170a';
        roundRect(ctx, cx - w / 2 - 2, cy - 17, w + 4, 34, 8);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, cx - w / 2, cy - 15, w, 30, 6);
        ctx.fill();
        text(ctx, name, cx, cy + 1, { size, color: '#1d1d1b', align: 'center', weight: 700 });
        const os = owners(st.id);
        os.forEach((c, i) => {
            const px = cx - (os.length - 1) * 7 + i * 14;
            ctx.fillStyle = '#20170a';
            ctx.beginPath();
            ctx.arc(px, cy + 17, 6.5, 0, 7);
            ctx.fill();
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(px, cy + 17, 5, 0, 7);
            ctx.fill();
        });
    }
}
// ---------- sprites ----------
export function drawTrain(ctx, x, y, color, trainIdx, facing, t, carriages = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing < 0 ? -1 : 1, 1);
    const bob = Math.sin(t / 120) * 1.2;
    ctx.translate(0, bob);
    const body = ['#5b4636', '#e6b422', '#2e7d32', '#1e5aa8', '#f2c230', '#f2f2f2'][trainIdx] || '#555';
    // carriages behind
    for (let i = 0; i < carriages; i++) {
        const cx = -46 - i * 30;
        ctx.fillStyle = '#1d1d1b';
        roundRect(ctx, cx - 1, -15, 28, 20, 4);
        ctx.fill();
        ctx.fillStyle = color;
        roundRect(ctx, cx + 1, -13, 24, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#e8f4ff';
        ctx.fillRect(cx + 5, -10, 6, 5);
        ctx.fillRect(cx + 14, -10, 6, 5);
        ctx.fillStyle = '#1d1d1b';
        ctx.beginPath();
        ctx.arc(cx + 6, 6, 3.5, 0, 7);
        ctx.arc(cx + 20, 6, 3.5, 0, 7);
        ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 26, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1d1d1b';
    if (trainIdx >= 4) {
        // modern: streamlined nose
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(-24, -16);
        ctx.lineTo(10, -16);
        ctx.quadraticCurveTo(28, -14, 28, 6);
        ctx.lineTo(-24, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillRect(-24, -2, 50, 5);
        ctx.fillStyle = '#9fd3ff';
        ctx.beginPath();
        ctx.moveTo(12, -13);
        ctx.quadraticCurveTo(24, -11, 25, -3);
        ctx.lineTo(12, -3);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(-18, -12, 8, 6);
        ctx.fillRect(-6, -12, 8, 6);
    }
    else {
        // steam: boiler, cab, chimney
        ctx.fillStyle = body;
        roundRect(ctx, -10, -12, 34, 18, 6);
        ctx.fill();
        ctx.stroke();
        roundRect(ctx, -26, -22, 18, 28, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#9fd3ff';
        ctx.fillRect(-22, -18, 10, 8);
        ctx.fillStyle = '#1d1d1b';
        ctx.fillRect(14, -22, 7, 11);
        ctx.fillStyle = color;
        ctx.fillRect(-10, -2, 34, 5);
        ctx.fillRect(-28, -25, 22, 5);
        ctx.fillStyle = C.brass;
        ctx.beginPath();
        ctx.arc(4, -12, 3, 0, 7);
        ctx.fill();
    }
    // player pennant on the roof
    ctx.strokeStyle = '#1d1d1b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-17, trainIdx >= 4 ? -16 : -22);
    ctx.lineTo(-17, -40);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-17, -40);
    ctx.lineTo(-1, -35);
    ctx.lineTo(-17, -29);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1d1d1b';
    for (const wx of [-18, -2, 14]) {
        ctx.beginPath();
        ctx.arc(wx, 8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c9c9c9';
        ctx.beginPath();
        ctx.arc(wx, 8, 2.5, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#1d1d1b';
    }
    ctx.restore();
}
export function drawBoggart(ctx, x, y, size, form, t) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t / 200) * 2);
    const s = size / 40;
    ctx.scale(s, s);
    const fur = form === 'brownie' ? '#a07850' : form === 'grand' ? '#6d6d7a' : '#8f8f9c';
    // ears
    ctx.fillStyle = fur;
    ctx.strokeStyle = '#1d1d1b';
    ctx.lineWidth = 2.5;
    for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * 22, -10, 14, 7, sx * -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e8a0a0';
        ctx.beginPath();
        ctx.ellipse(sx * 22, -10, 8, 3.5, sx * -0.5, 0, 7);
        ctx.fill();
        ctx.fillStyle = fur;
    }
    // fuzzy body
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2, r = 20 + (i % 2 ? 3 : 0);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.95);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // face
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-7, -2, 6, 0, 7);
    ctx.arc(7, -2, 6, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#1d1d1b';
    ctx.beginPath();
    ctx.arc(-6, -1, 3, 0, 7);
    ctx.arc(8, -1, 3, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#d68f8f';
    ctx.beginPath();
    ctx.arc(0, 5, 3.5, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#1d1d1b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (form === 'brownie')
        ctx.arc(0, 9, 6, 0.1 * Math.PI, 0.9 * Math.PI);
    else {
        ctx.moveTo(-6, 12);
        ctx.quadraticCurveTo(0, 8, 6, 12);
    }
    ctx.stroke();
    // hat: flat cap / crown / apron
    if (form === 'grand') {
        ctx.fillStyle = C.gold;
        ctx.beginPath();
        ctx.moveTo(-14, -16);
        ctx.lineTo(-14, -30);
        ctx.lineTo(-7, -22);
        ctx.lineTo(0, -32);
        ctx.lineTo(7, -22);
        ctx.lineTo(14, -30);
        ctx.lineTo(14, -16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    else if (form === 'brownie') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.rect(-10, 10, 20, 10);
        ctx.fill();
        ctx.stroke();
    }
    else {
        ctx.fillStyle = '#6b4a2e';
        ctx.beginPath();
        ctx.ellipse(-2, -17, 18, 7, -0.1, Math.PI, 0);
        ctx.lineTo(20, -15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
}
export function drawFlag(ctx, x, y, color, t, big = false) {
    const s = big ? 1.6 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = '#1d1d1b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -26);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    const w = Math.sin(t / 150) * 2;
    ctx.quadraticCurveTo(8, -28 + w, 16, -24);
    ctx.lineTo(16, -15);
    ctx.quadraticCurveTo(8, -18 - w, 0, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}
export function drawPortrait(ctx, e, x, y, r, ring = C.brass) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(x + 3, y + 6, r + 4, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#1d1d1b';
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, 7);
    ctx.fill();
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, 7);
    ctx.fill();
    const g = ctx.createRadialGradient(x, y - r * 0.4, 2, x, y, r);
    g.addColorStop(0, '#fffaf0');
    g.addColorStop(1, '#e9dcb8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r - 2, 0, 7);
    ctx.fill();
    emoji(ctx, e, x, y, r * 1.15);
    ctx.restore();
}
//# sourceMappingURL=mapart.js.map