// The land and sea of the 3D board.
// A signed distance field of the coastline (and of the railway) drives everything: land height, beaches,
// hills that stay away from the track, the shallow-water colour and the foam line.
import * as THREE from 'three';
import { board, project, WORLD_W, WORLD_H } from '../../core/map.js';
import { GB, NI, IRELAND, ISLANDS, MAN, FRANCE, LAKES, MOUNTAINS } from '../mapart.js';
import { gfx } from './gfx.js';
import { FONT } from '../../engine/draw.js';
// ---------- distance fields ----------
const CELL = 6; // world units per field cell
export const PAD = 600; // the field covers the world plus this margin on every side
const FX0 = -PAD, FZ0 = -PAD;
const FW = Math.ceil((WORLD_W + PAD * 2) / CELL), FH = Math.ceil((WORLD_H + PAD * 2) / CELL);
export let fields;
function rasterize(draw) {
    const c = document.createElement('canvas');
    c.width = FW;
    c.height = FH;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.setTransform(1 / CELL, 0, 0, 1 / CELL, -FX0 / CELL, -FZ0 / CELL);
    g.fillStyle = '#fff';
    g.strokeStyle = '#fff';
    draw(g);
    const d = g.getImageData(0, 0, FW, FH).data;
    const out = new Uint8Array(FW * FH);
    for (let i = 0; i < out.length; i++)
        out[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    return out;
}
function polyPath(g, pts) {
    pts.forEach(([lon, lat], i) => { const p = project(lon, lat); if (i)
        g.lineTo(p.x, p.y);
    else
        g.moveTo(p.x, p.y); });
    g.closePath();
}
/** Two-pass chamfer distance (in cells) from every cell to the nearest cell where mask === target. */
function chamfer(mask, target) {
    const INF = 1e6, D1 = 1, D2 = Math.SQRT2;
    const d = new Float32Array(FW * FH);
    for (let i = 0; i < d.length; i++)
        d[i] = mask[i] === target ? 0 : INF;
    for (let y = 0; y < FH; y++)
        for (let x = 0; x < FW; x++) {
            const i = y * FW + x;
            let v = d[i];
            if (v === 0)
                continue;
            if (x > 0)
                v = Math.min(v, d[i - 1] + D1);
            if (y > 0) {
                v = Math.min(v, d[i - FW] + D1);
                if (x > 0)
                    v = Math.min(v, d[i - FW - 1] + D2);
                if (x < FW - 1)
                    v = Math.min(v, d[i - FW + 1] + D2);
            }
            d[i] = v;
        }
    for (let y = FH - 1; y >= 0; y--)
        for (let x = FW - 1; x >= 0; x--) {
            const i = y * FW + x;
            let v = d[i];
            if (v === 0)
                continue;
            if (x < FW - 1)
                v = Math.min(v, d[i + 1] + D1);
            if (y < FH - 1) {
                v = Math.min(v, d[i + FW] + D1);
                if (x < FW - 1)
                    v = Math.min(v, d[i + FW + 1] + D2);
                if (x > 0)
                    v = Math.min(v, d[i + FW - 1] + D2);
            }
            d[i] = v;
        }
    return d;
}
export function buildFields() {
    const UK = [GB, NI, ...ISLANDS];
    const land = rasterize((g) => {
        g.beginPath();
        for (const p of [...UK, IRELAND, MAN, FRANCE])
            polyPath(g, p);
        g.fill();
        // land under every railway line and station, so nothing floats in the sea after stations were nudged apart
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.lineWidth = 50;
        for (const e of board.edges)
            if (!e.sea) {
                g.beginPath();
                e.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
                g.stroke();
            }
        for (const n of board.nodes)
            if (n.type === 'station' || n.type === 'port') {
                g.beginPath();
                g.arc(n.x, n.y, n.type === 'port' ? 40 : 66, 0, 7);
                g.fill();
            }
    });
    const foreign = rasterize((g) => {
        g.beginPath();
        for (const p of [IRELAND, MAN, FRANCE])
            polyPath(g, p);
        g.fill();
        g.globalCompositeOperation = 'destination-out';
        g.beginPath();
        polyPath(g, NI);
        g.fill();
        g.lineWidth = 50;
        g.lineCap = 'round';
        for (const e of board.edges)
            if (!e.sea) {
                g.beginPath();
                e.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
                g.stroke();
            }
    });
    const rail = rasterize((g) => {
        g.lineCap = 'round';
        g.lineWidth = 12;
        for (const e of board.edges)
            if (!e.sea) {
                g.beginPath();
                e.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
                g.stroke();
            }
        for (const n of board.nodes)
            if (n.type === 'station') {
                g.beginPath();
                g.arc(n.x, n.y, 60, 0, 7);
                g.fill();
            }
    });
    const dIn = chamfer(land, 0), dOut = chamfer(land, 1), dTrack = chamfer(rail, 1);
    const sdf = new Float32Array(FW * FH), track = new Float32Array(FW * FH);
    for (let i = 0; i < sdf.length; i++) {
        sdf[i] = land[i] ? (dIn[i] - 0.5) * CELL : -(dOut[i] - 0.5) * CELL;
        track[i] = dTrack[i] * CELL;
    }
    fields = { sdf, track, foreign };
}
function sample(a, x, z) {
    const fx = (x - FX0) / CELL - 0.5, fz = (z - FZ0) / CELL - 0.5;
    const x0 = Math.max(0, Math.min(FW - 2, Math.floor(fx))), z0 = Math.max(0, Math.min(FH - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - x0)), tz = Math.max(0, Math.min(1, fz - z0));
    const i = z0 * FW + x0;
    return (a[i] * (1 - tx) + a[i + 1] * tx) * (1 - tz) + (a[i + FW] * (1 - tx) + a[i + FW + 1] * tx) * tz;
}
export const sdfAt = (x, z) => sample(fields.sdf, x, z);
export const trackDistAt = (x, z) => sample(fields.track, x, z);
export function isForeign(x, z) {
    const fx = Math.floor((x - FX0) / CELL), fz = Math.floor((z - FZ0) / CELL);
    if (fx < 0 || fz < 0 || fx >= FW || fz >= FH)
        return true;
    return fields.foreign[fz * FW + fx] === 1;
}
// ---------- height ----------
function hash2(x, y) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
export function fbm(x, y) { return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 17, y * 2.1 + 9) * 0.3 + vnoise(x * 4.3 + 3, y * 4.3 + 41) * 0.15; }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const MTN = MOUNTAINS.map(([lon, lat, s]) => ({ ...project(lon, lat), h: 52 * s, r: 70 * s }));
const HIGHLAND = project(-4.6, 57.3), WALES = project(-3.75, 52.6), LAKE_D = project(-3.0, 54.45), PENNINE = project(-2.1, 54.0);
const LAKE_SHAPES = LAKES.map((l) => ({ ...project(l.lon, l.lat), rx: l.rx * 1.6, ry: l.ry * 1.9, rot: l.rot }));
export function lakeAmount(x, z) {
    let m = 0;
    for (const l of LAKE_SHAPES) {
        const dx = x - l.x, dz = z - l.y, c = Math.cos(-l.rot), s = Math.sin(-l.rot);
        const u = (dx * c - dz * s) / l.rx, v = (dx * s + dz * c) / l.ry;
        m = Math.max(m, 1 - smooth(0.8, 1.6, Math.hypot(u, v)));
    }
    return m;
}
/** Height of the ground. Hills and mountains fade out near the railway, so track and squares sit on gentle ground. */
export function heightAt(x, z) {
    const d = sdfAt(x, z);
    if (d < 0)
        return 1.5 + d * 0.6;
    const base = 1.5 + 7 * (1 - Math.exp(-d / 140));
    const hilly = 0.35 + 0.65 * Math.max(1 - smooth(120, 520, Math.hypot(x - HIGHLAND.x, z - HIGHLAND.y)), 1 - smooth(60, 260, Math.hypot(x - WALES.x, z - WALES.y)), 1 - smooth(40, 200, Math.hypot(x - LAKE_D.x, z - LAKE_D.y)), 1 - smooth(40, 220, Math.hypot(x - PENNINE.x, z - PENNINE.y)), 0);
    let hills = fbm(x / 170, z / 170) * 26 * hilly * (1 - Math.exp(-d / 50));
    for (const m of MTN) {
        const r2 = ((x - m.x) ** 2 + (z - m.y) ** 2) / (m.r * m.r);
        if (r2 < 9)
            hills += m.h * Math.exp(-r2) * (0.75 + 0.5 * fbm(x / 40, z / 40));
    }
    const flat = smooth(24, 110, trackDistAt(x, z));
    const lake = lakeAmount(x, z);
    return base + hills * flat * (1 - lake) - lake * 1.2;
}
/** Height of the railway bed (no hills) — squares, stations and trains sit here. */
export function railHeight(x, z) {
    const d = Math.max(0, sdfAt(x, z));
    return 1.5 + 7 * (1 - Math.exp(-d / 140)) + 0.6;
}
// ---------- terrain mesh ----------
const T0X = -220, T0Z = -220, T1X = WORLD_W + 220, T1Z = WORLD_H + 220;
export const groundUniforms = { uSeasonTint: { value: new THREE.Color(1, 1, 1) }, uSeasonAmt: { value: 0 }, uDetail: { value: null } };
export function buildTerrain(paintExtras) {
    const cell = gfx.preset.terrainCell;
    const nx = Math.ceil((T1X - T0X) / cell) + 1, nz = Math.ceil((T1Z - T0Z) / cell) + 1;
    const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2);
    const hs = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++)
        for (let i = 0; i < nx; i++) {
            const x = T0X + i * cell, z = T0Z + j * cell, k = j * nx + i;
            const h = heightAt(x, z);
            hs[k] = h;
            pos[k * 3] = x;
            pos[k * 3 + 1] = h;
            pos[k * 3 + 2] = z;
            uv[k * 2] = (x - T0X) / (T1X - T0X);
            uv[k * 2 + 1] = 1 - (z - T0Z) / (T1Z - T0Z);
        }
    // split into tiles so that the GPU skips land that is off screen
    const posAttr = new THREE.BufferAttribute(pos, 3), uvAttr = new THREE.BufferAttribute(uv, 2);
    const full = new THREE.BufferGeometry();
    full.setAttribute('position', posAttr);
    const allIdx = [];
    for (let j = 0; j < nz - 1; j++)
        for (let i = 0; i < nx - 1; i++) {
            const a = j * nx + i;
            allIdx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
        }
    full.setIndex(new THREE.Uint32BufferAttribute(allIdx, 1));
    full.computeVertexNormals();
    const normAttr = full.attributes.normal;
    const TILE = 48;
    const tiles = [];
    for (let tj = 0; tj < nz - 1; tj += TILE)
        for (let ti = 0; ti < nx - 1; ti += TILE) {
            const idx = [];
            for (let j = tj; j < Math.min(nz - 1, tj + TILE); j++)
                for (let i = ti; i < Math.min(nx - 1, ti + TILE); i++) {
                    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
                    if (Math.max(hs[a], hs[b], hs[c], hs[d]) < -0.5)
                        continue; // completely under the sea
                    idx.push(a, c, b, b, c, d);
                }
            if (!idx.length)
                continue;
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', posAttr);
            geo.setAttribute('normal', normAttr);
            geo.setAttribute('uv', uvAttr);
            geo.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
            geo.computeBoundingSphere();
            tiles.push(geo);
        }
    const tex = new THREE.CanvasTexture(paintGround(paintExtras));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    groundUniforms.uDetail.value = detailTexture();
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, groundUniforms);
        sh.vertexShader = 'varying vec2 vWorldXZ;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
        sh.fragmentShader = 'uniform vec3 uSeasonTint;\nuniform float uSeasonAmt;\nuniform sampler2D uDetail;\nvarying vec2 vWorldXZ;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  float det = texture2D(uDetail, vWorldXZ / 48.0).r;
  diffuseColor.rgb *= 0.86 + det * 0.28;
  float green = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 4.0, 0.0, 1.0);
  float lum = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
  diffuseColor.rgb = mix(diffuseColor.rgb, uSeasonTint * (0.45 + lum * 1.5), uSeasonAmt * green);`);
    };
    const group = new THREE.Group();
    for (const geo of tiles) {
        const m = new THREE.Mesh(geo, mat);
        m.receiveShadow = true;
        m.matrixAutoUpdate = false;
        group.add(m);
    }
    return group;
}
/** A small tiling grain texture that keeps the ground from looking blurry close up. */
function detailTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const img = g.createImageData(128, 128);
    for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++) {
            const v = (vnoise(x / 6, y / 6) * 0.5 + vnoise(x / 2.5 + 50, y / 2.5) * 0.35 + hash2(x, y) * 0.15);
            const i = (y * 128 + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255);
            img.data[i + 3] = 255;
        }
    // make it tile: blend edges by drawing with wrap
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}
export let painter;
function paintGround(extras) {
    const longSide = Math.round(2048 * gfx.preset.texScale * (gfx.quality === 'high' ? 1.5 : 1));
    const TW = Math.round(longSide * (T1X - T0X) / (T1Z - T0Z)), TH = longSide;
    const s = TW / (T1X - T0X);
    // 1) a low-resolution colour field from height and distance to the coast, scaled up smoothly
    const LW = Math.round(TW / 3), LH = Math.round(TH / 3);
    const low = document.createElement('canvas');
    low.width = LW;
    low.height = LH;
    const lg = low.getContext('2d');
    const img = lg.createImageData(LW, LH);
    const col = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
    const GRASS = col(0x8fd05e), GRASS2 = col(0x74bf52), SAND = col(0xf0dfa0), HEATH = col(0xa79a63), ROCK = col(0x9c9a8e), SNOW = col(0xf4f7f6), FOREIGN = col(0xcdd2b4), FOREIGN2 = col(0xbfc6a3), LAKE = col(0x6cc4ea);
    for (let py = 0; py < LH; py++)
        for (let px = 0; px < LW; px++) {
            const wx = T0X + (px + 0.5) / LW * (T1X - T0X), wz = T0Z + (py + 0.5) / LH * (T1Z - T0Z);
            const d = sdfAt(wx, wz);
            let c;
            if (d < 0)
                c = SAND;
            else {
                const h = heightAt(wx, wz);
                const n = fbm(wx / 90, wz / 90);
                const foreign = isForeign(wx, wz);
                c = foreign ? mix(FOREIGN, FOREIGN2, n) : mix(GRASS, GRASS2, smooth(0.35, 0.75, n));
                if (!foreign) {
                    c = mix(c, HEATH, smooth(14, 32, h) * 0.85);
                    c = mix(c, ROCK, smooth(36, 60, h));
                    c = mix(c, SNOW, smooth(66, 80, h));
                }
                c = mix(c, SAND, 1 - smooth(3, 9, d));
                const lk = lakeAmount(wx, wz);
                if (lk > 0.5)
                    c = LAKE;
            }
            const i = (py * LW + px) * 4;
            img.data[i] = c[0];
            img.data[i + 1] = c[1];
            img.data[i + 2] = c[2];
            img.data[i + 3] = 255;
        }
    lg.putImageData(img, 0, 0);
    const canvas = document.createElement('canvas');
    canvas.width = TW;
    canvas.height = TH;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(low, 0, 0, TW, TH);
    // 2) crisp details in world coordinates
    g.save();
    g.setTransform(s, 0, 0, s, -T0X * s, -T0Z * s);
    painter = { g, s, x: (wx) => wx, y: (wz) => wz };
    paintFields(g);
    paintLakes(g);
    extras(g);
    paintBallast(g);
    paintLabels(g);
    g.restore();
    return canvas;
}
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
/** The patchwork of fields and hedges that you see from a train window in England, Wales and Northern Ireland. */
function paintFields(g) {
    const COLS = ['#9bd567', '#86c75a', '#b5d86a', '#cfd77a', '#e3cf7f', '#7dbd55', '#a8d06a', '#c2e08a'];
    const STEP = 58;
    for (let z = 0; z < WORLD_H; z += STEP)
        for (let x = 0; x < WORLD_W; x += STEP) {
            const r = hash2(x * 7 + 3, z * 13 + 1);
            const cx = x + (hash2(x, z) - 0.5) * 30, cz = z + (hash2(z, x) - 0.5) * 30;
            const d = sdfAt(cx, cz);
            if (d < 25 || isForeign(cx, cz))
                continue;
            const h = heightAt(cx, cz);
            if (h > 16 || lakeAmount(cx, cz) > 0)
                continue;
            if (fbm(cx / 400, cz / 400) < 0.36)
                continue; // leave some open country
            const w = STEP * (0.75 + r * 0.5), hh = STEP * (0.6 + hash2(z, x + 5) * 0.5);
            const rot = (fbm(cx / 600, cz / 600) - 0.5) * 1.2;
            g.save();
            g.translate(cx, cz);
            g.rotate(rot);
            g.fillStyle = COLS[Math.floor(r * COLS.length)];
            g.globalAlpha = 0.75;
            g.fillRect(-w / 2, -hh / 2, w, hh);
            g.globalAlpha = 0.5;
            g.strokeStyle = '#4f9a3c';
            g.lineWidth = 2.2;
            g.strokeRect(-w / 2, -hh / 2, w, hh);
            if (r > 0.7) { // ploughed stripes
                g.globalAlpha = 0.18;
                g.strokeStyle = '#6b5a2a';
                g.lineWidth = 1.2;
                for (let k = -w / 2 + 4; k < w / 2; k += 5) {
                    g.beginPath();
                    g.moveTo(k, -hh / 2 + 2);
                    g.lineTo(k, hh / 2 - 2);
                    g.stroke();
                }
            }
            g.restore();
        }
    g.globalAlpha = 1;
}
function paintLakes(g) {
    for (const l of LAKE_SHAPES) {
        g.save();
        g.translate(l.x, l.y);
        g.rotate(l.rot);
        g.fillStyle = '#efe0a8';
        g.beginPath();
        g.ellipse(0, 0, l.rx * 1.05 + 3, l.ry * 1.05 + 3, 0, 0, 7);
        g.fill();
        g.fillStyle = '#5ab9e6';
        g.beginPath();
        g.ellipse(0, 0, l.rx * 1.05, l.ry * 1.05, 0, 0, 7);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.beginPath();
        g.ellipse(-l.rx * 0.2, -l.ry * 0.2, l.rx * 0.5, l.ry * 0.35, 0, 0, 7);
        g.fill();
        g.restore();
    }
}
/** A gravel bed under the rails, so lines read clearly from far away. */
function paintBallast(g) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const pass = (w, c) => {
        g.strokeStyle = c;
        g.lineWidth = w;
        for (const e of board.edges)
            if (!e.sea) {
                g.beginPath();
                e.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
                g.stroke();
            }
    };
    pass(30, 'rgba(70,90,50,0.25)');
    pass(24, '#b9ab8f');
    pass(18, '#a39478');
}
function paintLabels(g) {
    const label = (s, lon, lat, size, color, rot = 0) => {
        const p = project(lon, lat);
        g.save();
        g.translate(p.x, p.y);
        g.rotate(rot);
        g.font = `800 ${size}px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = color;
        g.fillText(s, 0, 0);
        g.restore();
    };
    label('SCOTLAND', -4.4, 56.75, 64, 'rgba(40,90,30,0.22)');
    label('ENGLAND', -0.9, 52.75, 70, 'rgba(40,90,30,0.2)');
    label('WALES', -3.75, 52.15, 46, 'rgba(40,90,30,0.22)');
    label('NORTHERN IRELAND', -6.85, 54.42, 26, 'rgba(40,90,30,0.28)');
    label('Ireland (not UK)', -8.6, 53.2, 34, 'rgba(70,70,50,0.35)');
    label('France', 2.3, 50.0, 34, 'rgba(70,70,50,0.35)');
}
// ---------- sea ----------
export const seaUniforms = { uTime: { value: 0 }, uSdf: { value: null } };
export function buildSea() {
    // the coast distance field as a texture: the shader turns it into shallow water, deep water and moving foam
    const data = new Uint8Array(FW * FH);
    for (let i = 0; i < data.length; i++)
        data[i] = Math.max(0, Math.min(255, Math.round(160 + fields.sdf[i] / 2)));
    const tex = new THREE.DataTexture(data, FW, FH, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.flipY = false;
    tex.unpackAlignment = 1;
    tex.needsUpdate = true;
    seaUniforms.uSdf.value = tex;
    const SIZE = 12000;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(WORLD_W / 2, 0, WORLD_H / 2);
    const mat = new THREE.ShaderMaterial({
        uniforms: { ...seaUniforms, uOrigin: { value: new THREE.Vector2(FX0, FZ0) }, uSpan: { value: new THREE.Vector2(FW * CELL, FH * CELL) } },
        vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `
      uniform sampler2D uSdf; uniform vec2 uOrigin; uniform vec2 uSpan; uniform float uTime; varying vec2 vW;
      void main(){
        vec2 uv = (vW - uOrigin) / uSpan;
        float d = (texture2D(uSdf, uv).r * 255.0 - 160.0) * 2.0;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) d = -320.0;
        float depth = clamp(-d / 260.0, 0.0, 1.0);
        vec3 shallow = vec3(0.36, 0.80, 0.86), mid = vec3(0.20, 0.62, 0.86), deep = vec3(0.13, 0.45, 0.76);
        vec3 col = mix(shallow, mid, smoothstep(0.0, 0.25, depth));
        col = mix(col, deep, smoothstep(0.25, 1.0, depth));
        float wob = sin(uTime * 1.4 + vW.x * 0.045 + vW.y * 0.03) * 1.6;
        float foam = 1.0 - smoothstep(3.0, 6.0, -d + wob);
        float foam2 = (1.0 - smoothstep(0.0, 2.0, abs(-d - 13.0 - wob * 2.0))) * 0.35 * (1.0 - depth * 4.0);
        float w1 = sin(vW.x * 0.11 + vW.y * 0.05 + uTime * 1.1) * sin(vW.x * 0.043 - vW.y * 0.13 - uTime * 0.8);
        float spark = smoothstep(0.9, 0.99, w1) * 0.12 * (0.3 + depth);
        col += spark;
        col = mix(col, vec3(1.0), clamp(foam * 0.9 + max(foam2, 0.0), 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = -1;
    return mesh;
}
//# sourceMappingURL=terrain.js.map