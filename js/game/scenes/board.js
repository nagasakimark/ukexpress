import { app } from '../app.js';
import { board, nextOptions } from '../../core/map.js';
import { STATIONS, STATION_BY_ID } from '../../core/content/stations.js';
import { AVATARS, STYLES, TRAINS } from '../../core/content/game-data.js';
import { assets, monopolyOwner, ownedProps, ranking } from '../../core/rules.js';
import { C, FONT, text, emoji, money, roundRect } from '../../engine/draw.js';
import { Button, navigate } from '../../engine/ui.js';
import { clock, Ease } from '../../engine/tween.js';
import { fx } from '../../engine/fx.js';
import { audio } from '../../engine/audio.js';
import { lines, UI, t2, main, lang } from '../i18n.js';
import { HandModal, say } from '../dialogs.js';
import { view } from '../fake3d/view.js';
import { Overview } from '../fake3d/overview.js';
import { CompanyModal } from '../company.js';
import { LAY, useView } from '../layout.js';
import { stationProfile } from '../profile.js';
import { drawTopBar, drawPlayerList, drawGuide, guideHit, guideScroll, guideStep, guideOpenPhoto } from '../hud.js';
const ZOOM = 1;
const TOP = LAY.mapTop; // height of the top bar
const DIR_OF = (dx, dy) => (Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'e' : 'w') : dy >= 0 ? 's' : 'n');
export class BoardScene {
    constructor(g) {
        this.g = g;
        this.cam = { x: 0, y: 0, zoom: ZOOM };
        this.follow = null;
        this.vis = {};
        this.current = null;
        this.movesLeft = 0;
        this.commandButtons = [];
        this.focus = 0;
        this.mode = 'idle';
        this.cmdResolve = null;
        this.juncResolve = null;
        this.juncOptions = [];
        this.juncSel = 0;
        /** The option on the shortest route to the destination (highlighted pink). */
        this.juncBest = null;
        this.onMenu = null;
        this.overview = new Overview();
        this.puffT = 0;
        this.builtExt = -1;
        this.downX = 0;
        this.downY = 0;
        view.build();
        for (const p of g.players) {
            const n = board.nodes[p.pos];
            const prev = p.prev >= 0 ? board.nodes[p.prev] : board.nodes[n.links[0]?.to ?? p.pos];
            const dir = prev && prev !== n ? DIR_OF(n.x - prev.x, n.y - prev.y) : 'e';
            this.vis[p.id] = { x: n.x, y: n.y, dir, h: 0, trail: prev && prev !== n ? [{ x: prev.x, z: prev.y }, { x: n.x, z: n.y }] : [{ x: n.x, z: n.y }] };
        }
        const n0 = board.nodes[g.players[0].pos];
        this.cam.x = n0.x;
        this.cam.y = n0.y;
        const mk = (x, y, w, h, label, icon, color, onClick, pulse = false, size = 24, subOn = true) => new Button({ x, y, w, h, label: lines(label).main, sub: subOn ? lines(label).sub ?? undefined : undefined, icon, color, size, pulse, onClick });
        this.buildButtons();
    }
    /** The buttons sit under the Station guide, which moves when the window is wider than 16:9. */
    buildButtons() {
        this.builtExt = LAY.ext;
        const mk = (x, y, w, h, label, icon, color, onClick, pulse = false, size = 24, subOn = true) => new Button({ x, y, w, h, label: lines(label).main, sub: subOn ? lines(label).sub ?? undefined : undefined, icon, color, size, pulse, onClick });
        const px = LAY.panelX + 8, pw = LAY.panelW - 16;
        this.commandButtons = [
            mk(px, 562, pw, 64, UI.roll, "🎲", "#d7263d", () => this.resolveCommand({ type: "roll" }), true, 30),
            mk(px, 634, pw / 3 - 5, 36, UI.cards, "🃏", "#d99a0b", () => this.openCards(), false, 16, false),
            mk(px + pw / 3 + 2, 634, pw / 3 - 5, 36, UI.map, "🗺️", "#17a2a2", () => this.enterMap(), false, 16, false),
            mk(px + 2 * pw / 3 + 4, 634, pw / 3 - 4, 36, t2("Company", "会社"), "💼", "#6a3fb5", () => this.openCompany(), false, 16, false),
            mk(px, 676, pw / 2 - 4, 36, UI.info, "📊", "#3a7be8", () => this.openInfo(), false, 17, false),
            mk(px + pw / 2 + 4, 676, pw / 2 - 4, 36, UI.menu, "⚙️", "#7a6a55", () => this.onMenu && this.onMenu(), false, 17, false),
        ];
        this.moreBtn = new Button({ x: LAY.panelX + 8, y: 634, w: LAY.panelW - 16, h: 52, label: lines(t2('More about this place', 'もっと しりたい！')).main, sub: lines(t2('More about this place', 'もっと しりたい！')).sub ?? undefined, icon: '🔍', color: '#3a7be8', size: 20, onClick: () => { stationProfile(this.guideStation().sid); } });
        this.mapBack = new Button({ x: LAY.panelX + 8, y: 562, w: LAY.panelW - 16, h: 64, label: lines(UI.back).main, sub: lines(UI.back).sub ?? undefined, icon: '↩️', color: '#7a6a55', size: 24, onClick: () => this.exitMap() });
    }
    // ---------- camera ----------
    syncCamera() { useView(false); view.cam.cx = LAY.cx; view.cam.cy = LAY.cy; view.cam.x = this.cam.x; view.cam.z = this.cam.y; view.cam.zoom = this.cam.zoom; view.cam.update(); }
    worldToScreen(x, y) {
        if (this.mode === 'map')
            return this.overview.toScreen(x, y);
        this.syncCamera();
        const p = view.toScreen(x, y, 0.25);
        return { x: p.x, y: p.y };
    }
    screenToWorld(x, y) { this.syncCamera(); const w = view.toWorld(x, y); return { x: w.x, y: w.z }; }
    clampCam() {
        const gr = board.grid;
        this.cam.x = Math.max(1, Math.min(gr.w - 2, this.cam.x));
        this.cam.y = Math.max(1, Math.min(gr.h - 2, this.cam.y));
    }
    flyTo(x, y, ms = 700, zoom) {
        this.follow = null;
        const to = { x, y };
        if (zoom)
            to.zoom = zoom;
        return clock.tween(this.cam, to, ms, Ease.inOutCubic);
    }
    async focusPlayer(p) {
        this.current = p;
        const v = this.vis[p.id];
        await this.flyTo(v.x, v.y, 500, ZOOM);
        this.follow = p.id;
    }
    // ---------- train animation ----------
    async animateStep(p, to) {
        const v = this.vis[p.id];
        const n = board.nodes[to];
        v.dir = DIR_OF(n.x - v.x, n.y - v.y);
        audio.play('step');
        await clock.tween(v, { x: n.x, y: n.y }, 260, Ease.inOutQuad);
        this.pushTrail(v);
        if (p.train <= 3)
            this.puff(v);
    }
    pushTrail(v) {
        const last = v.trail[v.trail.length - 1];
        if (!last || Math.hypot(last.x - v.x, last.z - v.y) > 0.04)
            v.trail.push({ x: v.x, z: v.y });
        if (v.trail.length > 140)
            v.trail.splice(0, v.trail.length - 140);
    }
    puff(v) {
        if (this.mode === 'map')
            return;
        const s = this.worldToScreen(v.x, v.y);
        fx.puff(s.x + (v.dir === 'e' ? 18 : v.dir === 'w' ? -18 : 0), s.y - 52);
    }
    async warpTrain(p, to) {
        const v = this.vis[p.id];
        const n = board.nodes[to];
        const s = this.worldToScreen(v.x, v.y);
        fx.burst(s.x, s.y, 'puff', 12, { speed: 3, up: 1 });
        this.follow = null;
        await clock.tween(v, { h: 1.6 }, 300, Ease.outQuad);
        await this.flyTo(n.x, n.y, 700);
        v.x = n.x;
        v.y = n.y;
        v.trail = [{ x: n.x, z: n.y }];
        await clock.tween(v, { h: 0 }, 420, Ease.outBounce);
        this.follow = p.id;
    }
    snapTrain(p) {
        const n = board.nodes[p.pos];
        const v = this.vis[p.id];
        v.x = n.x;
        v.y = n.y;
        v.trail = [{ x: n.x, z: n.y }];
    }
    // ---------- human prompts ----------
    awaitCommand(p) {
        this.current = p;
        this.follow = p.id;
        this.mode = 'command';
        this.focus = 0;
        return new Promise((r) => (this.cmdResolve = r));
    }
    resolveCommand(c) {
        if (!this.cmdResolve)
            return;
        const r = this.cmdResolve;
        this.cmdResolve = null;
        this.mode = 'idle';
        r(c);
    }
    awaitJunction(options) {
        this.mode = 'junction';
        this.juncOptions = options;
        this.juncSel = 0;
        this.juncBest = null;
        if (options.length) {
            // point the player at the destination: fewest squares from here with legal
            // moves (no U-turns, exactly like the train itself moves)
            const best = this.junctionBest(options);
            this.juncBest = best;
            this.juncSel = Math.max(0, options.indexOf(best));
        }
        this.follow = this.current?.id ?? null;
        return new Promise((r) => (this.juncResolve = r));
    }
    /** Shortest legal route to the destination, as a first step: BFS over
     * (square, previous square) states from the current player, so the answer
     * never starts with an illegal U-turn back onto the square we came from. */
    junctionBest(options) {
        const cur = this.current;
        const dest = board.stationNode[this.g.destination];
        if (!cur || dest === undefined)
            return options[0];
        const C = cur.pos, P = cur.prev;
        if (C === dest)
            return options[0];
        if (options.includes(dest))
            return dest;
        const N = board.nodes.length;
        const seen = new Set();
        const q = [];
        for (const o of options) {
            const k = o * (N + 1) + (C + 1);
            if (seen.has(k))
                continue;
            seen.add(k);
            q.push({ v: o, u: C, first: o });
        }
        for (let i = 0; i < q.length; i++) {
            const s = q[i];
            for (const w of nextOptions(s.v, s.u)) {
                if (w === dest)
                    return s.first;
                const k = w * (N + 1) + (s.v + 1);
                if (seen.has(k))
                    continue;
                seen.add(k);
                q.push({ v: w, u: s.v, first: s.first });
            }
        }
        return options[0];
    }
    pickJunction(n) {
        if (!this.juncResolve)
            return;
        const r = this.juncResolve;
        this.juncResolve = null;
        this.mode = 'idle';
        audio.play('click');
        r(n);
    }
    async openCards() {
        const p = this.current;
        const pick = await app.show(new HandModal(this.g, p));
        if (pick)
            this.resolveCommand(pick);
    }
    async openCompany() {
        await app.show(new CompanyModal(this.g, this.current?.id));
    }
    enterMap() {
        this.mode = 'map';
        this.follow = null;
        this.overview.fit();
        const v = this.current ? this.vis[this.current.id] : null;
        if (v) {
            this.overview.ppc = 22;
            this.overview.x = v.x;
            this.overview.y = v.y;
            this.overview.clamp();
        }
    }
    exitMap() { this.mode = 'command'; this.follow = this.current?.id ?? null; }
    async openInfo() {
        const r = ranking(this.g);
        const body = r.map((p, i) => t2(`${i + 1}. ${p.name.en} Railway: ${money(assets(this.g, p))}`, `${i + 1}位 ${p.name.ja}鉄道：${money(assets(this.g, p))}`));
        const me = this.current;
        const total = STATIONS.length;
        body.push(t2(`Your train: ${TRAINS[me.train].name.en} (${TRAINS[me.train].dice} dice). Stations visited: ${me.visited.length} of ${total}. Heroes: ${me.heroCollection.length}.`, `あなたの列車：${TRAINS[me.train].name.ja}（サイコロ${TRAINS[me.train].dice}こ）。おとずれた駅：${me.visited.length}/${total}。ヒーロー：${me.heroCollection.length}人。`));
        await say({ title: t2('Rankings', 'ランキング'), body, icon: '📊' });
    }
    // ---------- input ----------
    activeButtons() {
        if (this.mode === 'command')
            return this.commandButtons;
        if (this.mode === 'map')
            return [this.mapBack, this.moreBtn];
        return [];
    }
    /** One arrow for each way out of the junction: up, down, left or right. */
    junctionArrows() {
        const cur = this.current ? this.vis[this.current.id] : null;
        if (!cur)
            return [];
        this.syncCamera();
        return this.juncOptions.map((o) => {
            const n = board.nodes[o];
            const dir = DIR_OF(n.x - cur.x, n.y - cur.y);
            const v = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[dir];
            const c = view.toScreen(cur.x, cur.y, 0);
            const t = view.toScreen(cur.x + v[0] * 0.7, cur.y + v[1] * 0.7, 0);
            const sa = Math.atan2(t.y - c.y, t.x - c.x);
            return { node: o, dir, sa, x: t.x, y: t.y - 10, k: Math.max(0.7, Math.min(1.3, t.s / 190)) };
        });
    }
    pointerMove(x, y) {
        for (const b of this.activeButtons()) {
            const h = b.hit(x, y);
            if (h && !b.hover)
                audio.play('hover');
            b.hover = h;
        }
        if (this.mode === 'junction')
            this.junctionArrows().forEach((ar, i) => { if (Math.hypot(ar.x - x, ar.y - y) < 56 * ar.k)
                this.juncSel = i; });
    }
    pointerDown(x, y) { this.downX = x; this.downY = y; return true; }
    pointerUp(x, y, wasDrag) {
        if (wasDrag)
            return true;
        for (const b of this.activeButtons())
            if (b.hit(x, y)) {
                b.click();
                return true;
            }
        const gh = guideHit(x, y);
        if (gh === 'prev' || gh === 'next') {
            audio.play('click');
            guideStep(gh === 'prev' ? -1 : 1);
            return true;
        }
        if (gh === 'photo') {
            audio.play('open');
            guideOpenPhoto();
            return true;
        }
        if (gh)
            return true;
        if (this.mode === 'junction') {
            let best = -1, bd = 90;
            for (const ar of this.junctionArrows()) {
                const d = Math.hypot(ar.x - x, ar.y - y);
                if (d < bd) {
                    bd = d;
                    best = ar.node;
                }
            }
            if (best >= 0)
                this.pickJunction(best);
        }
        return true;
    }
    drag(dx, dy) {
        if (guideHit(this.downX, this.downY)) {
            guideScroll(-dy);
            return true;
        }
        if (this.mode === 'idle')
            return true;
        this.follow = null;
        if (this.mode === 'map') {
            this.overview.x -= dx / this.overview.ppc;
            this.overview.y -= dy / this.overview.ppc;
            this.overview.clamp();
            return true;
        }
        this.syncCamera();
        const a = view.toWorld(LAY.cx, LAY.cy), b = view.toWorld(LAY.cx - dx, LAY.cy - dy);
        this.cam.x += b.x - a.x;
        this.cam.y += b.z - a.z;
        this.clampCam();
        return true;
    }
    zoom(f, x, y) {
        if (guideHit(x, y)) {
            guideScroll(f > 1 ? -70 : 70);
            return true;
        }
        if (this.mode === 'idle')
            return true;
        if (this.mode === 'map') {
            const before = this.overview.toWorld(x, y);
            this.overview.ppc *= f;
            this.overview.clamp();
            const after = this.overview.toWorld(x, y);
            this.overview.x += before.x - after.x;
            this.overview.y += before.y - after.y;
            this.overview.clamp();
            return true;
        }
        const before = this.screenToWorld(x, y);
        this.cam.zoom = Math.max(0.6, Math.min(1.5, this.cam.zoom * f));
        const after = this.screenToWorld(x, y);
        this.cam.x += before.x - after.x;
        this.cam.y += before.y - after.y;
        this.clampCam();
        return true;
    }
    key(a) {
        window.__kbd = true;
        if (this.mode === 'command') {
            if (a === 'confirm')
                this.commandButtons[this.focus]?.click();
            else if (a === 'left' || a === 'right')
                this.focus = navigate(this.commandButtons, this.focus, a);
            else if (a === 'back')
                this.enterMap();
        }
        else if (this.mode === 'junction') {
            const arrows = this.junctionArrows();
            if (a === 'confirm')
                this.pickJunction(this.juncOptions[this.juncSel]);
            else if (a !== 'other' && a !== 'back') {
                // the arrow keys are the four ways out: pressing one goes that way
                const want = { up: 'n', down: 's', left: 'w', right: 'e' }[a];
                const i = arrows.findIndex((ar) => ar.dir === want);
                if (i >= 0)
                    this.pickJunction(arrows[i].node);
                else
                    audio.play('quizWrong');
            }
        }
        else if (this.mode === 'map') {
            const step = 120 / this.overview.ppc;
            if (a === 'back' || a === 'confirm')
                this.exitMap();
            if (a === 'up')
                this.overview.y -= step;
            if (a === 'down')
                this.overview.y += step;
            if (a === 'left')
                this.overview.x -= step;
            if (a === 'right')
                this.overview.x += step;
            this.overview.clamp();
        }
        return true;
    }
    // ---------- update / draw ----------
    update(dt) {
        if (this.follow) {
            const v = this.vis[this.follow];
            if (v) {
                const k = 1 - Math.pow(0.86, dt / 16.7);
                this.cam.x += (v.x - this.cam.x) * k;
                this.cam.y += (v.y - this.cam.y) * k;
            }
        }
        for (const v of Object.values(this.vis))
            this.pushTrail(v);
        this.clampCam();
        const cur = this.current;
        if (cur && cur.train <= 3 && this.mode !== 'map' && clock.realTime - this.puffT > 900) {
            this.puffT = clock.realTime;
            this.puff(this.vis[cur.id]);
        }
    }
    ownerColors(sid, mono) {
        const g = this.g;
        if (mono)
            return [];
        return [...new Set(STATION_BY_ID[sid].props.map((pr) => g.owners[pr.id]).filter(Boolean))].map((o) => C.players[g.players.find((p) => p.id === o).color]);
    }
    draw(ctx) {
        const g = this.g;
        const tt = clock.realTime;
        useView(false);
        if (this.builtExt !== LAY.ext)
            this.buildButtons();
        window.__mode = this.mode;
        const dest = board.stationNode[g.destination];
        if (this.mode === 'map') {
            view.setMonth(g.month);
            ctx.save();
            ctx.beginPath();
            ctx.rect(LAY.mapL, TOP, LAY.mapR - LAY.mapL, LAY.mapBot - TOP);
            ctx.clip();
            this.overview.draw(ctx, view.ground, dest, g.players.map((p) => ({ x: this.vis[p.id].x, y: this.vis[p.id].y, color: C.players[p.color], avatar: AVATARS[p.avatar].emoji, current: p.id === this.current?.id })), tt);
            ctx.restore();
            this.drawHud(ctx);
            return;
        }
        this.syncCamera();
        view.setMonth(g.month);
        ctx.save();
        ctx.beginPath();
        ctx.rect(LAY.mapL, TOP, LAY.mapR - LAY.mapL, LAY.mapBot - TOP);
        ctx.clip();
        // trains on the same square sit exactly on top of each other: only the active player's is shown
        const keyOf = (p) => { const vv = this.vis[p.id]; return `${Math.round(vv.x * 4)},${Math.round(vv.y * 4)}`; };
        const cur = this.current;
        const curKey = cur ? keyOf(cur) : '';
        const shown = new Set();
        const trains = [];
        for (const p of g.players) {
            const vv = this.vis[p.id];
            const isCur = p.id === cur?.id;
            const k = keyOf(p);
            if (!isCur && (k === curKey || shown.has(k)))
                continue;
            shown.add(k);
            const cars = 1 + Math.min(2, Math.floor(ownedProps(g, p).length / 5));
            const cell = board.cellNode[Math.round(vv.y) * board.grid.w + Math.round(vv.x)];
            const boat = cell >= 0 && board.nodes[cell].type === 'sea';
            trains.push({ id: p.id, x: vv.x, z: vv.y, dir: vv.dir, type: p.train, color: p.color, cars, trail: vv.trail, lift: vv.h, scale: 1, boat });
        }
        // Each sign asks for its crown and owner colours: share one monopoly lookup per station per frame.
        const monoOf = new Map();
        const mono = (sid) => {
            let m = monoOf.get(sid);
            if (m === undefined) {
                m = monopolyOwner(g, sid);
                monoOf.set(sid, m);
            }
            return m;
        };
        view.draw(ctx, trains, dest, tt, {
            owners: (sid) => this.ownerColors(sid, mono(sid)),
            crowned: (sid) => mono(sid),
        }, TOP);
        this.drawMarkers(ctx, tt);
        fx.draw(ctx, 'world'); // train steam stays on the map, under the HUD and every dialog
        if (this.mode === 'junction')
            this.drawJunction(ctx, tt);
        ctx.restore();
        this.drawHud(ctx);
    }
    drawJunction(ctx, tt) {
        const arrows = this.junctionArrows();
        arrows.forEach((ar, i) => {
            const sel = i === this.juncSel;
            const bob = Math.sin(tt / 160) * 6;
            ctx.save();
            ctx.translate(ar.x + Math.cos(ar.sa) * bob, ar.y + Math.sin(ar.sa) * bob);
            ctx.rotate(ar.sa);
            ctx.scale(ar.k * 1.25, ar.k * 1.25);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.moveTo(32, 6);
            ctx.lineTo(-10, -24);
            ctx.lineTo(-10, 0);
            ctx.lineTo(-30, 0);
            ctx.lineTo(-30, 18);
            ctx.lineTo(-10, 18);
            ctx.lineTo(-10, 36);
            ctx.closePath();
            ctx.fill();
            // hover/keyboard selection is gold; the shortest way to the destination is always pink
            // (pink with a gold outline when it is also the selected one)
            const best = ar.node === this.juncBest;
            ctx.fillStyle = best ? '#ff3399' : sel ? C.gold : '#ffffff';
            ctx.strokeStyle = sel && best ? C.gold : '#1b1b1b';
            ctx.lineWidth = sel && best ? 7 : 4;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(30, 0);
            ctx.lineTo(-6, -28);
            ctx.lineTo(-6, -11);
            ctx.lineTo(-30, -11);
            ctx.lineTo(-30, 11);
            ctx.lineTo(-6, 11);
            ctx.lineTo(-6, 28);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        });
    }
    drawMarkers(ctx, tt) {
        const g = this.g;
        for (const p of g.players) {
            const vv = this.vis[p.id];
            const isCur = p.id === this.current?.id;
            const head = view.toScreen(vv.x, vv.y, (isCur ? 0.62 : 0.45) + vv.h);
            const k = Math.max(0.6, Math.min(1.2, head.s / 190));
            if (isCur) {
                // while choosing a way, the marker steps aside so it never hides the up arrow
                if (this.mode === 'junction') {
                    head.x += 58 * k;
                    head.y += 18 * k;
                }
                const by = head.y - Math.abs(Math.sin(tt / 220)) * 8;
                const r = 24 * k;
                ctx.fillStyle = '#1b1b1b';
                ctx.beginPath();
                ctx.arc(head.x, by, r, 0, 7);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(head.x - 10 * k, by + r - 5 * k);
                ctx.lineTo(head.x + 10 * k, by + r - 5 * k);
                ctx.lineTo(head.x, by + r + 10 * k);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = C.players[p.color];
                ctx.beginPath();
                ctx.arc(head.x, by, r - 4 * k, 0, 7);
                ctx.fill();
                emoji(ctx, AVATARS[p.avatar].emoji, head.x, by, 27 * k);
            }
            else {
                ctx.fillStyle = '#1b1b1b';
                ctx.beginPath();
                ctx.arc(head.x, head.y, 15 * k, 0, 7);
                ctx.fill();
                ctx.fillStyle = C.players[p.color];
                ctx.beginPath();
                ctx.arc(head.x, head.y, 12.5 * k, 0, 7);
                ctx.fill();
                emoji(ctx, AVATARS[p.avatar].emoji, head.x, head.y, 16 * k);
            }
        }
    }
    // ---------- HUD ----------
    /** Which station the side guide shows: the one under the map magnifier, the one the train stands on, or the destination. */
    guideStation() {
        const g = this.g;
        if (this.mode === 'map') {
            let best = '', bd = 3.5 / Math.max(0.5, this.overview.ppc / 22);
            for (const [sid, st] of Object.entries(board.grid.stations)) {
                const d = Math.hypot(st.x - this.overview.x, st.y - this.overview.y);
                if (d < bd) {
                    bd = d;
                    best = sid;
                }
            }
            if (best)
                return { sid: best, tag: 'look' };
        }
        const p = this.current;
        const sid = p ? board.nodes[p.pos].stationId : undefined;
        if (sid && this.mode !== 'map')
            return { sid, tag: 'here' };
        return { sid: g.destination, tag: 'dest' };
    }
    drawHud(ctx) {
        const g = this.g;
        const p = this.current ?? g.players[0];
        const tt = clock.realTime;
        // the map is clipped to its window; everything else is drawn on top
        let off = null;
        const dn = board.nodes[board.stationNode[g.destination]];
        const ds = this.worldToScreen(dn.x, dn.y);
        if (ds.x < LAY.mapL || ds.x > LAY.mapR || ds.y < TOP || ds.y > LAY.mapBot)
            off = { a: Math.atan2(dn.y - this.cam.y, dn.x - this.cam.x) };
        drawTopBar(ctx, g, p, off);
        drawPlayerList(ctx, g, this.current);
        const gs = this.guideStation();
        drawGuide(ctx, gs.sid, gs.tag, tt);
        const kbd = !!window.__kbd;
        if (this.mode === 'command')
            this.commandButtons.forEach((b, i) => b.draw(ctx, kbd && i === this.focus));
        else if (this.mode === 'map') {
            // the magnifier: whatever sits in the ring is shown in the Station guide
            ctx.save();
            ctx.strokeStyle = '#20170a';
            ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.arc(LAY.cx, LAY.cy, 30, 0, 7);
            ctx.stroke();
            ctx.strokeStyle = '#ffd23c';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(LAY.cx, LAY.cy, 30, 0, 7);
            ctx.stroke();
            ctx.restore();
            this.mapBack.draw(ctx, kbd);
            this.moreBtn.draw(ctx, false);
            this.pill(ctx, main(t2('Drag to look around · pinch or scroll to zoom', 'ドラッグでうごかす・ピンチでおおきく')), '🗺️', LAY.cx, LAY.mapBot - 34, 'rgba(255,250,240,0.95)', '#1d1d1b', 17);
        }
        else if (this.mode === 'junction') {
            this.pill(ctx, main(t2("Which way? Pink is the shortcut!", "どっちにいく？ピンクが近道！")), "👉", LAY.cx, LAY.mapBot - 34, "#fffaf0", "#1d1d1b", 21);
        }
        if (this.movesLeft > 0) {
            const bx = LAY.mapR - 128, by = TOP + 10;
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            roundRect(ctx, bx + 5, by + 5, 112, 82, 20);
            ctx.fill();
            ctx.fillStyle = '#20170a';
            roundRect(ctx, bx, by, 112, 82, 20);
            ctx.fill();
            ctx.fillStyle = '#fffaf0';
            roundRect(ctx, bx + 4, by + 4, 104, 74, 17);
            ctx.fill();
            text(ctx, String(this.movesLeft), bx + 56, by + 36, { size: 46, color: C.red, align: 'center' });
            text(ctx, lang.mode === 'en' ? 'to go' : 'あと マス', bx + 56, by + 65, { size: 15, color: '#1d1d1b', align: 'center' });
        }
        if (this.current && this.current.controller === 'cpu' && this.mode === 'idle') {
            const s = STYLES[this.current.style];
            this.pill(ctx, `${main(this.current.name)} · ${main(s.name)}`, s.badge, LAY.cx, TOP + 28, 'rgba(15,52,33,0.88)', C.cream, 17);
        }
    }
    pill(ctx, s, icon, cx, cy, bg, fg, size) {
        ctx.save();
        ctx.font = `800 ${size}px ${FONT}`;
        const w = ctx.measureText(s).width + size * 3.2;
        const h = size * 2.1;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(ctx, cx - w / 2 + 3, cy - h / 2 + 5, w, h, h / 2);
        ctx.fill();
        ctx.fillStyle = bg;
        roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
        ctx.fill();
        ctx.restore();
        emoji(ctx, icon, cx - w / 2 + size * 1.2, cy, size * 1.2);
        text(ctx, s, cx + size * 0.6, cy + 1, { size, color: fg, align: 'center' });
    }
}
//# sourceMappingURL=board.js.map