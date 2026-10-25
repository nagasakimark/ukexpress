import { LAY } from '../layout.js';
// The Momotetsu-style board view: perspective ground, pre-rendered scenery, trains, name signs and markers.
// Pure drawing - the board scene owns the game logic and the HUD.
import { board } from '../../core/map.js';
import { STATION_BY_ID } from '../../core/content/stations.js';
import { C, FONT, emoji, roundRect } from '../../engine/draw.js';
import { Camera } from './proj.js';
import { Ground, seasonOf } from './ground.js';
import { sprites, Scenery, drawSprite, treeSprite } from './sprites.js';
import { main } from '../i18n.js';
const P = { x: 0, y: 0, s: 0, depth: 0 };
export class BoardView {
    constructor() {
        this.cam = new Camera();
        this.ground = new Ground();
        this.scenery = new Scenery();
        this.month = -1;
        this.built = false;
        /** Lighter drawing for slow machines: switched on automatically if frames take too long (or with ?lite=1). */
        this.namesFor = -1;
        this.names = [];
        /** 0 = full detail, 1 = fewer trees, 2 = fewer trees and a coarser ground. Rises on its own if frames run slow. */
        this.tier = /[?&]lite=1/.test(location.search) ? 1 : (() => { try {
            return Math.min(2, +(localStorage.getItem('ukExpressTier') || 0)) || 0;
        }
        catch {
            return 0;
        } })();
        this.onTier = null;
        this.still = 0;
        this.lastKey = '';
        this.baseCache = null;
        this.baseKey = '';
        this.frames = [];
        this.signList = null;
        this.sw = new Map();
    }
    build() { if (!this.built) {
        this.scenery.build();
        this.built = true;
    } }
    setMonth(m) { if (m !== this.month) {
        this.month = m;
        this.ground.setSeason(seasonOf(m));
    } }
    /** Screen position of a point on (or above) the board. s = pixels per cell there. */
    toScreen(x, z, y = 0) { return this.cam.project(x, y, z, { x: 0, y: 0, s: 0, depth: 0 }); }
    toWorld(sx, sy) { return this.cam.unproject(sx, sy); }
    draw(ctx, trains, destNode, tt, ov = {}, top = 0) {
        const t0 = performance.now();
        this.build();
        this.cam.cx = LAY.cx;
        this.cam.cy = LAY.cy;
        this.cam.update();
        const dn = board.nodes[destNode];
        // The ground and scenery only change when the camera moves (or the month changes), so once the camera has been
        // still for a couple of frames they are painted into a picture that is simply reused until something changes.
        const m = ctx.getTransform();
        const key = `${this.cam.x.toFixed(4)},${this.cam.z.toFixed(4)},${this.cam.zoom},${this.month},${this.tier},${top},${LAY.mapW},${LAY.mapBot},${m.a.toFixed(3)},${m.e.toFixed(1)},${m.f.toFixed(1)}`;
        this.still = key === this.lastKey ? this.still + 1 : 0;
        this.lastKey = key;
        const cv = ctx.canvas;
        if (this.still >= 2 && m.b === 0 && m.c === 0) {
            if (!this.baseCache || this.baseCache.width !== cv.width || this.baseCache.height !== cv.height || this.baseKey !== key) {
                if (!this.baseCache)
                    this.baseCache = document.createElement('canvas');
                this.baseCache.width = cv.width;
                this.baseCache.height = cv.height;
                const bc = this.baseCache.getContext('2d');
                bc.setTransform(m);
                this.drawBase(bc, top);
                this.baseKey = this.ground.missed ? '' : key;
            }
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(this.baseCache, 0, 0);
            ctx.restore();
        }
        else
            this.drawBase(ctx, top);
        // destination glow
        if (dn)
            this.glow(ctx, dn.x, dn.y, tt);
        // trains (on top of the scenery so they are never hidden)
        const order = trains.length > 1 ? trains.slice().sort((p, q) => p.z - q.z) : trains;
        for (const t of order)
            this.drawTrain(ctx, t);
        // name signs and markers on top of everything
        this.drawSigns(ctx, destNode, ov);
        if (dn)
            this.flag(ctx, dn.x, dn.y, tt);
        // automatic detail level: if the last 40 moving frames averaged more than 20 ms, step down (never back up)
        if (this.still < 2) {
            this.frames.push(performance.now() - t0);
            if (this.frames.length >= 40) {
                const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
                this.frames.length = 0;
                if (avg > 20 && this.tier < 2) {
                    this.tier++;
                    console.info('board: detail level', this.tier);
                    this.onTier?.(this.tier);
                }
            }
        }
    }
    drawBase(ctx, top) {
        this.ground.band = this.tier >= 2 ? 8 : this.tier === 1 ? 6 : 4;
        this.ground.draw(ctx, this.cam, top, LAY.mapBot);
        // scenery back to front
        const season = seasonOf(this.month);
        const a = this.cam.unproject(0, top), b = this.cam.unproject(0, LAY.mapBot);
        const [i0, i1] = this.scenery.range(a.z - 1.2, b.z + 2.2);
        const items = this.scenery.items;
        const lmSorted = this.scenery.landmarks;
        let li = 0;
        if (!lmSorted._sorted) {
            lmSorted.sort((p, q) => p.z - q.z);
            lmSorted._sorted = true;
        }
        while (li < lmSorted.length && lmSorted[li].z < a.z - 2)
            li++;
        const sk = season === 'autumn' ? 'au' : season === 'winter' ? 'wi' : season === 'spring' ? 'sp' : 'su';
        if (this.namesFor !== this.month) {
            this.names = items.map((it) => (it.name === 'deco/mountain' ? `deco/mountain/${sk}` : it.kind === 2 ? it.name : treeSprite(it.name, it.kind === 1, season, this.month, it.x, it.z)));
            this.namesFor = this.month;
        }
        const sk2 = season === 'autumn' ? 'au' : season === 'winter' ? 'wi' : '';
        const t = this.tier;
        for (let i = i0; i < i1; i++) {
            const it = items[i];
            while (li < lmSorted.length && lmSorted[li].z + 0.55 <= it.z) {
                const l = lmSorted[li++];
                this.lm(ctx, l, sk2);
            }
            if (t && it.kind !== 2 && (t === 1 ? i % 3 === 2 : i % 2 === 1))
                continue;
            drawSprite(ctx, this.cam, this.names[i], it.x, it.z, it.s);
        }
        while (li < lmSorted.length && lmSorted[li].z < b.z + 2.5) {
            const l = lmSorted[li++];
            this.lm(ctx, l, sk2);
        }
    }
    lm(ctx, l, sk) {
        if (!(sk && drawSprite(ctx, this.cam, `lm/${l.sid}/${sk}`, l.x, l.z, 1)))
            drawSprite(ctx, this.cam, 'lm/' + l.sid, l.x, l.z, 1);
    }
    glow(ctx, x, z, tt) {
        const p = this.cam.project(x, 0, z, P);
        const pulse = (Math.sin(tt / 280) + 1) / 2;
        const r = p.s * (0.42 + pulse * 0.08);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, Math.sin(42 * Math.PI / 180) * 1.05);
        const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
        g.addColorStop(0, 'rgba(255,230,90,0.9)');
        g.addColorStop(1, 'rgba(255,200,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    flag(ctx, x, z, tt) {
        const p = this.cam.project(x, 0.62, z, P);
        const k = Math.max(0.6, Math.min(1.3, p.s / 190));
        emoji(ctx, '🚩', p.x + 8 * k, p.y - Math.abs(Math.sin(tt / 260)) * 10 * k, 50 * k);
    }
    drawTrain(ctx, t) {
        // carriages behind, along the trail
        const pts = t.trail;
        const SP = 0.74 * t.scale;
        const cars = [];
        if (t.cars > 0 && pts.length > 1) {
            let need = SP, acc = 0;
            let px = t.x, pz = t.z;
            for (let i = pts.length - 1; i >= 0 && cars.length < t.cars; i--) {
                const q = pts[i];
                const seg = Math.hypot(px - q.x, pz - q.z);
                while (seg > 0 && acc + seg >= need && cars.length < t.cars) {
                    const f = (need - acc) / seg;
                    const cx = px + (q.x - px) * f, cz = pz + (q.z - pz) * f;
                    const dx = px - q.x, dz = pz - q.z;
                    cars.push({ x: cx, z: cz, dir: Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'e' : 'w') : (dz > 0 ? 's' : 'n') });
                    need += SP;
                }
                acc += seg;
                px = q.x;
                pz = q.z;
            }
        }
        const all = t.boat ? [{ x: t.x, z: t.z, dir: t.dir, name: `ferry/${t.dir}` }]
            : [...cars.map((c) => ({ ...c, name: `car/${t.color}/${c.dir}` })), { x: t.x, z: t.z, dir: t.dir, name: `train/${t.type}/${t.color}/${t.dir}` }];
        all.sort((p, q) => p.z - q.z);
        for (const c of all) {
            // a soft shadow under each vehicle
            const p = this.cam.project(c.x, 0, c.z, P);
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + p.s * 0.02, p.s * 0.2 * t.scale, p.s * 0.1 * t.scale, 0, 0, Math.PI * 2);
            ctx.fill();
            drawSprite(ctx, this.cam, c.name, c.x, c.z, 1.3 * t.scale, t.lift);
        }
    }
    drawSigns(ctx, destNode, ov) {
        const g = board.grid;
        const boxes = [];
        if (!this.signList)
            this.signList = Object.entries(g.stations).map(([sid, s]) => ({ sid, s, node: board.stationNode[sid], name: main(STATION_BY_ID[sid].name) }));
        const list = this.signList.slice().sort((p, q) => (q.node === destNode ? 1 : 0) - (p.node === destNode ? 1 : 0));
        for (const { sid, s, node, name } of list) {
            const off = { b: [0, 0.52], t: [0, -0.36], l: [-0.42, 0.05], r: [0.42, 0.05] }[s.sign];
            const p = this.cam.project(s.x + off[0], 0, s.y + off[1], P);
            if (p.x < -300 || p.x > 1580 || p.y < -60 || p.y > 800)
                continue;
            const k = Math.max(0.62, Math.min(1.25, p.s / 190));
            const st = STATION_BY_ID[sid];
            const size = Math.round(24 * k);
            const wk = name + size;
            let tw = this.sw.get(wk);
            ctx.font = `800 ${size}px ${FONT}`;
            if (tw === undefined) {
                tw = ctx.measureText(name).width;
                this.sw.set(wk, tw);
            }
            const w = tw + 22 * k, h = 36 * k;
            let cx = p.x, cy = p.y - h / 2 - 4 * k;
            if (s.sign === 'l')
                cx -= w / 2;
            else if (s.sign === 'r')
                cx += w / 2;
            else if (s.sign === 't')
                cy -= 18 * k;
            const box = { x0: cx - w / 2 - 3, y0: cy - h / 2 - 3, x1: cx + w / 2 + 3, y1: cy + h / 2 + 3 };
            const isDest = node === destNode;
            if (!isDest && boxes.some((d) => d.x0 < box.x1 && d.x1 > box.x0 && d.y0 < box.y1 && d.y1 > box.y0))
                continue;
            boxes.push(box);
            // the board stands on two little legs, like Momotetsu's signs
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(cx - w * 0.3 - 2 * k, cy + h / 2 - 2, 4 * k, 8 * k);
            ctx.fillRect(cx + w * 0.3 - 2 * k, cy + h / 2 - 2, 4 * k, 8 * k);
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            roundRect(ctx, cx - w / 2 + 3 * k, cy - h / 2 + 5 * k, w, h, 4 * k);
            ctx.fill();
            ctx.fillStyle = '#1b1b1b';
            roundRect(ctx, cx - w / 2 - 2.5 * k, cy - h / 2 - 2.5 * k, w + 5 * k, h + 5 * k, 5 * k);
            ctx.fill();
            ctx.fillStyle = isDest ? '#ffe45c' : '#ffffff';
            roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 3 * k);
            ctx.fill();
            ctx.fillStyle = '#111111';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(name, cx, cy + 1.5 * k);
            // owners' colours and crowns
            const crown = ov.crowned?.(sid);
            if (crown)
                emoji(ctx, '👑', cx - w / 2 - 8 * k, cy - h / 2, 24 * k);
            const os = ov.owners?.(sid) ?? [];
            os.forEach((col, i) => {
                const px = cx - (os.length - 1) * 8 * k + i * 16 * k, py = cy + h / 2 + 9 * k;
                ctx.fillStyle = '#1b1b1b';
                ctx.beginPath();
                ctx.arc(px, py, 7 * k, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(px, py, 5.2 * k, 0, Math.PI * 2);
                ctx.fill();
            });
            if (st.hometown || st.film || st.trainShop) {
                const badges = [st.hometown ? '🏠' : '', st.film ? '🎬' : '', st.trainShop ? '🚂' : ''].filter(Boolean);
                badges.forEach((b, i) => emoji(ctx, b, cx + w / 2 + 12 * k + i * 24 * k, cy, 22 * k));
            }
        }
    }
}
export const view = new BoardView();
export { sprites, C };
//# sourceMappingURL=view.js.map