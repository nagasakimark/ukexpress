import { board, distancesTo } from '../core/map.js';
import { STATION_BY_ID } from '../core/content/stations.js';
import { AVATARS, MONTHS, REGIONS, SEASON_EMOJI, STYLES } from '../core/content/game-data.js';
import { assets, ranking } from '../core/rules.js';
import { blitCache, C, FONT, panel, text, emoji, money, roundRect } from '../engine/draw.js';
import { lang, lines, main, t2 } from './i18n.js';
import { dual, dualHeight } from './dialogs.js';
import { drawPic, PhotoBrowser } from './images.js';
import { ImageViewer } from './dialogs.js';
import { app } from './app.js';
import { LAY } from './layout.js';
import { stationProfile } from './profile.js';
import { showUkMap } from './ukmap.js';
const GREEN = '#174a2f';
/** Redrawn at most about five times a second (or at once when the language, window or player changes). */
const stamp = () => Math.floor(performance.now() / 200);
export function drawTopBar(ctx, g, p, destOffscreen) {
    const ang = destOffscreen ? Math.round(destOffscreen.a * 6) : 'x';
    blitCache(ctx, 'topbar', `${stamp()}|${p.id}|${p.cash}|${g.month}|${g.year}|${g.destination}|${lang.mode}|${ang}|${LAY.mapL}|${LAY.mapR}`, LAY.mapL, 0, LAY.mapR - LAY.mapL, LAY.mapTop, (c) => paintTopBar(c, g, p, destOffscreen));
}
function paintTopBar(ctx, g, p, destOffscreen) {
    const L = LAY.mapL, R = LAY.mapR, H = LAY.mapTop;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(23,74,47,0.98)');
    grad.addColorStop(1, 'rgba(15,52,33,0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(L, 0, R - L, H);
    ctx.fillStyle = C.brass;
    ctx.fillRect(L, H - 4, R - L, 4);
    ctx.save();
    ctx.translate(L, 0);
    ctx.fillStyle = '#20170a';
    ctx.beginPath();
    ctx.arc(38, 31, 25, 0, 7);
    ctx.fill();
    ctx.fillStyle = C.players[p.color];
    ctx.beginPath();
    ctx.arc(38, 31, 22, 0, 7);
    ctx.fill();
    emoji(ctx, AVATARS[p.avatar].emoji, 38, 31, 30);
    text(ctx, main(p.name) + main(t2(' Railway', 'てつどう')), 70, 17, { size: 17, color: '#cfe8d5', maxWidth: 230 });
    text(ctx, money(p.cash), 70, 42, { size: 28, color: p.cash < 0 ? '#ff8a8a' : C.cream });
    // month
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, 318, 8, 250, 46, 12);
    ctx.fill();
    emoji(ctx, SEASON_EMOJI[g.month], 346, 31, 26);
    const ys = lang.mode === 'en' ? `Year ${g.year} of ${g.settings.years}` : `${g.year}ねんめ（ぜんぶで${g.settings.years}ねん）`;
    text(ctx, main(MONTHS[g.month]), 448, 22, { size: 22, color: C.cream, align: 'center' });
    text(ctx, ys, 448, 43, { size: 13, color: '#cfe8d5', align: 'center', weight: 500, maxWidth: 190 });
    ctx.restore();
    // destination (always at the right-hand end of the bar)
    ctx.save();
    ctx.translate(R - 920, 0);
    const st = STATION_BY_ID[g.destination];
    ctx.fillStyle = 'rgba(255,214,60,0.2)';
    roundRect(ctx, 580, 8, 332, 46, 12);
    ctx.fill();
    emoji(ctx, '🚩', 606, 31, 26);
    text(ctx, main(st.name), 632, 23, { size: 22, color: C.gold, maxWidth: 190 });
    const d = distancesTo(board.stationNode[g.destination])[p.pos];
    text(ctx, lang.mode === 'en' ? `${d} to go` : `あと ${d} マス`, 632, 44, { size: 14, color: '#fff3c4', weight: 500 });
    if (destOffscreen) {
        ctx.save();
        ctx.translate(884, 31);
        ctx.rotate(destOffscreen.a);
        ctx.fillStyle = C.gold;
        ctx.strokeStyle = '#20170a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
    else
        emoji(ctx, st.emoji, 884, 31, 26);
    ctx.restore();
}
export function drawPlayerList(ctx, g, cur) {
    const x = LAY.mapL + 8, y = LAY.mapBot + 6, w = LAY.mapR - LAY.mapL - 16;
    blitCache(ctx, 'players', `${stamp()}|${cur?.id}|${g.players.map((q) => q.cash + ':' + q.pos).join(',')}|${lang.mode}|${LAY.mapL}|${LAY.mapR}`, x - 4, y - 4, w + 8, 170, (c) => paintPlayerList(c, g, cur));
}
function paintPlayerList(ctx, g, cur) {
    const x = LAY.mapL + 8, y = LAY.mapBot + 6, w = LAY.mapR - LAY.mapL - 16, rowH = 36;
    panel(ctx, x, y, w, 158, { fill: '#fff8e6', radius: 14, shadow: false });
    const rank = ranking(g);
    const dn = board.stationNode[g.destination];
    const dist = distancesTo(dn);
    g.players.forEach((p, i) => {
        const ry = y + 8 + i * (rowH + 1);
        const on = cur?.id === p.id;
        ctx.fillStyle = on ? 'rgba(255,214,60,0.55)' : 'rgba(0,0,0,0.04)';
        roundRect(ctx, x + 8, ry, w - 16, rowH, 10);
        ctx.fill();
        ctx.fillStyle = C.players[p.color];
        roundRect(ctx, x + 8, ry, 12, rowH, 6);
        ctx.fill();
        ctx.fillStyle = '#20170a';
        ctx.beginPath();
        ctx.arc(x + 44, ry + rowH / 2, 15, 0, 7);
        ctx.fill();
        ctx.fillStyle = C.players[p.color];
        ctx.beginPath();
        ctx.arc(x + 44, ry + rowH / 2, 13, 0, 7);
        ctx.fill();
        emoji(ctx, AVATARS[p.avatar].emoji, x + 44, ry + rowH / 2, 17);
        const r = rank.findIndex((q) => q.id === p.id);
        emoji(ctx, ['🥇', '🥈', '🥉', '🎖️'][r] ?? '', x + 76, ry + rowH / 2, 19);
        text(ctx, main(p.name) + (p.controller === 'cpu' ? `  ${STYLES[p.style].badge}` : ''), x + 98, ry + rowH / 2, { size: 19, color: C.ink, maxWidth: 270 });
        text(ctx, main(t2('Cash', 'おかね')), x + 390, ry + rowH / 2, { size: 13, color: '#7a6a55', weight: 700 });
        text(ctx, money(p.cash), x + 540, ry + rowH / 2, { size: 21, color: p.cash < 0 ? C.red : '#1b5e20', align: 'right' });
        const d = dist[p.pos];
        text(ctx, lang.mode === 'en' ? `${d} to go` : `あと ${d} マス`, x + w - 22, ry + rowH / 2, { size: 18, color: '#7a4a10', align: 'right', maxWidth: 150 });
        text(ctx, `${main(t2('Assets', 'しさん'))} ${money(assets(g, p))}`, x + 562, ry + rowH / 2 + 1, { size: 12, color: '#7a6a55', weight: 600, maxWidth: 140 });
    });
}
// ---------- Station guide ----------
let locator = null;
const LW = 96, LH = 124;
function locatorMap() {
    if (locator)
        return locator;
    const c = document.createElement('canvas');
    c.width = LW * 2;
    c.height = LH * 2;
    const g = c.getContext('2d');
    g.scale(2, 2);
    const gr = board.grid;
    const sc = Math.min((LW - 8) / gr.w, (LH - 8) / gr.h);
    g.fillStyle = '#bfe3f7';
    roundRect(g, 0, 0, LW, LH, 10);
    g.fill();
    g.fillStyle = '#e9efd6';
    g.strokeStyle = '#6b8a5a';
    g.lineWidth = 0.8;
    g.lineJoin = 'round';
    const ox = (LW - gr.w * sc) / 2, oy = (LH - gr.h * sc) / 2;
    gr.coast.forEach((poly, i) => {
        const tag = gr.coastTags?.[i];
        if (tag === 'fr')
            return;
        g.beginPath();
        poly.forEach(([px, py], j) => (j ? g.lineTo(ox + (px + 0.5) * sc, oy + (py + 0.5) * sc) : g.moveTo(ox + (px + 0.5) * sc, oy + (py + 0.5) * sc)));
        g.closePath();
        g.fill();
        g.stroke();
    });
    locator = c;
    c.sc = sc;
    c.ox = ox;
    c.oy = oy;
    return c;
}
const TAGS = {
    here: { t: t2('You are here', 'いまここ'), icon: '📍', color: '#2a7a4a' },
    dest: { t: t2('Next stop', 'つぎの もくてきち'), icon: '🚩', color: '#c8921a' },
    look: { t: t2('Looking at', 'みているばしょ'), icon: '🔍', color: '#3a7be8' },
};
// The guide keeps a little state: which station it shows, how far it is scrolled, and its photo browser.
const gs = {
    sid: '', scroll: 0, target: 0, max: 0, photos: null, lastStep: 0,
    photo: { x: 0, y: 0, w: 0, h: 0 }, prev: { x: 0, y: 0, w: 0, h: 0 }, next: { x: 0, y: 0, w: 0, h: 0 },
    body: { x: 0, y: 0, w: 0, h: 0 }, map: { x: 0, y: 0, w: 0, h: 0 }, more: { x: 0, y: 0, w: 0, h: 0 },
};
const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
/** What a tap at (x, y) hits in the guide panel. */
export function guideHit(x, y) {
    if (x < LAY.panelX || x > LAY.panelX + LAY.panelW || y > 556)
        return null;
    if ((gs.photos?.count() ?? 0) > 1) {
        if (inR(gs.prev, x, y))
            return 'prev';
        if (inR(gs.next, x, y))
            return 'next';
    }
    if (inR(gs.photo, x, y))
        return 'photo';
    if (inR(gs.map, x, y))
        return 'map';
    if (gs.more.w && inR(gs.more, x, y) && inR(gs.body, x, y))
        return 'more';
    if (inR(gs.body, x, y))
        return 'body';
    return 'panel';
}
export function guideScroll(dy) { gs.target = Math.max(0, Math.min(gs.max, gs.target + dy)); }
export function guideStep(d) { gs.photos?.step(d); gs.lastStep = performance.now(); }
export function guideOpenMore() { if (gs.sid)
    stationProfile(gs.sid); }
export function guideOpenMap() { if (gs.sid)
    showUkMap(gs.sid); }
/** Opens the current photo full screen (with the other photos of the place). */
export function guideOpenPhoto() {
    const st = STATION_BY_ID[gs.sid];
    if (!st)
        return;
    const pb = new PhotoBrowser('places', st.image);
    pb.sel = gs.photos?.index() ?? 0;
    pb.locked = true;
    app.show(new ImageViewer({ kind: 'places', name: st.image, emoji: st.emoji, label: st.name.en, color: REGIONS[st.region].color }, st.name, pb));
}
/** Everything the guide says about a station, in order. */
function guideItems(sid) {
    const st = STATION_BY_ID[sid];
    const items = st.guide.length ? st.guide.slice() : [{ icon: '💡', title: t2('Did you know?', 'しってた？'), text: st.fact }];
    if (st.famous)
        items.push({ icon: '🛍️', title: t2('Famous for', 'ここの 名物'), text: st.famous });
    if (st.team)
        items.push({ icon: '⚽', title: t2('Local team', 'ちいきの チーム'), text: st.team });
    return items;
}
const gcache = { key: '', cv: null, total: 0, s: 0, more: 0 };
export function drawGuide(ctx, sid, tag, tt) {
    const st = STATION_BY_ID[sid];
    const x = LAY.panelX, y = 8, w = LAY.panelW, h = 548;
    const reg = REGIONS[st.region];
    if (gs.sid !== sid) {
        gs.sid = sid;
        gs.scroll = gs.target = 0;
        gs.photos = new PhotoBrowser('places', st.image);
        gs.photos.locked = true;
        gs.photos.sel = 0;
        gs.lastStep = performance.now();
    }
    const pb = gs.photos;
    const n = pb.count();
    // several photos: show them in turn, every 6 seconds
    if (n > 1 && performance.now() - gs.lastStep > 6000)
        guideStep(1);
    const phX = x + 12, phY = y + 50, phW = w - 24, phH = 172;
    const bx = x + 10, bw = w - 26, by = phY + phH + 6 + LH * 0.56 + 4, bh = y + h - 8 - by;
    // 1. the still parts of the panel (frame, tag, name, region) are painted once and copied
    blitCache(ctx, 'guide', `${sid}|${tag}|${lang.mode}|${x}`, x - 6, y - 6, w + 12, h + 14, (c) => {
        panel(c, x, y, w, h, { fill: '#fffaf0' });
        const tg = TAGS[tag];
        c.fillStyle = tg.color;
        roundRect(c, x + 6, y + 6, w - 12, 36, 10);
        c.fill();
        emoji(c, tg.icon, x + 28, y + 24, 22);
        text(c, main(tg.t), x + 50, y + 24, { size: 19, color: '#fff' });
        text(c, main(t2('Station guide', 'えきガイド')), x + w - 16, y + 24, { size: 14, color: '#fff3c4', align: 'right', weight: 600 });
        const ls0 = 0.56, lw0 = LW * ls0;
        const nw = w - 36 - lw0 - 6;
        const nm = lines(st.name);
        text(c, nm.main, x + 16, phY + phH + 24, { size: 25, color: C.ink, maxWidth: nw });
        if (nm.sub)
            text(c, nm.sub, x + 16, phY + phH + 47, { size: 14, color: '#6a5a40', weight: 600, maxWidth: nw });
        const rn = main(reg.name) + (st.hometown ? '  🏠' : '');
        c.font = `800 14px ${FONT}`;
        const rw = Math.min(nw, c.measureText(rn).width + 26);
        c.fillStyle = reg.color;
        roundRect(c, x + 16, phY + phH + 56, rw, 22, 11);
        c.fill();
        text(c, rn, x + 16 + rw / 2, phY + phH + 67, { size: 14, color: '#fff', align: 'center', maxWidth: rw - 8 });
        c.strokeStyle = 'rgba(0,0,0,0.12)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(bx + 4, by - 2);
        c.lineTo(bx + bw, by - 2);
        c.stroke();
    });
    // 2. photo (tap to see it big)
    drawPic(ctx, 'places', pb.name(), phX, phY, phW, phH, { emoji: st.emoji, label: main(st.name), color: reg.color, radius: 12 });
    gs.photo = { x: phX, y: phY, w: phW, h: phH };
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(phX + phW - 20, phY + 20, 15, 0, 7);
    ctx.fill();
    emoji(ctx, '🔍', phX + phW - 20, phY + 20, 18);
    if (n > 1) {
        gs.prev = { x: phX + 4, y: phY + phH / 2 - 20, w: 34, h: 40 };
        gs.next = { x: phX + phW - 38, y: phY + phH / 2 - 20, w: 34, h: 40 };
        for (const [r, s] of [[gs.prev, '◀'], [gs.next, '▶']]) {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            roundRect(ctx, r.x, r.y, r.w, r.h, 10);
            ctx.fill();
            text(ctx, s, r.x + r.w / 2, r.y + r.h / 2 + 1, { size: 18, color: '#fff', align: 'center' });
        }
        const idx = pb.index();
        for (let i = 0; i < n; i++) {
            ctx.fillStyle = i === idx ? '#fff' : 'rgba(255,255,255,0.5)';
            ctx.beginPath();
            ctx.arc(phX + phW / 2 + (i - (n - 1) / 2) * 14, phY + phH - 12, i === idx ? 5 : 4, 0, 7);
            ctx.fill();
        }
    }
    // 3. the little UK map beside the name, with a pulsing dot on this place
    const lm = locatorMap();
    const ls = 0.56, lw = LW * ls, lh = LH * ls;
    const lx = x + w - 12 - lw, ly = phY + phH + 6;
    ctx.drawImage(lm, lx, ly, lw, lh);
    gs.map = { x: lx, y: ly, w: lw, h: lh };
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(lx + lw - 11, ly + lh - 11, 10, 0, 7);
    ctx.fill();
    emoji(ctx, '🔍', lx + lw - 11, ly + lh - 11, 12);
    const s = board.grid.stations[sid];
    if (s) {
        const px = lx + (lm.ox + (s.x + 0.5) * lm.sc) * ls, py = ly + (lm.oy + (s.y + 0.5) * lm.sc) * ls;
        const pulse = 3.5 + Math.sin(tt / 200) * 1.2;
        ctx.fillStyle = 'rgba(215,38,61,0.35)';
        ctx.beginPath();
        ctx.arc(px, py, pulse + 3, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#d7263d';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 3.4, 0, 7);
        ctx.fill();
        ctx.stroke();
    }
    // 4. the write-up: one tall picture of all the topic cards, shown through a window that scrolls
    gs.body = { x: bx, y: by, w: bw + 10, h: bh };
    const m = ctx.getTransform(), sc = Math.max(0.5, Math.hypot(m.a, m.b));
    const ck = `${sid}|${lang.mode}|${bw}|${sc}`;
    if (gcache.key !== ck || !gcache.cv) {
        const tw = bw - 40;
        const its = guideItems(sid);
        const hs = its.map((it) => 40 + dualHeight(ctx, it.text, 15, tw) + 10);
        const total = 8 + hs.reduce((a, q) => a + q + 8, 0) + 64;
        const cv = gcache.cv ?? (gcache.cv = document.createElement('canvas'));
        cv.width = Math.ceil((bw + 12) * sc);
        cv.height = Math.ceil(total * sc);
        const c = cv.getContext('2d');
        c.setTransform(sc, 0, 0, sc, 0, 0);
        let cy = 8;
        its.forEach((it, i) => {
            const ch = hs[i];
            c.fillStyle = '#ffffff';
            roundRect(c, 2, cy, bw - 6, ch, 12);
            c.fill();
            c.strokeStyle = 'rgba(0,0,0,0.10)';
            c.lineWidth = 1;
            c.stroke();
            c.fillStyle = reg.color;
            roundRect(c, 2, cy, 7, ch, 4);
            c.fill();
            c.fillStyle = 'rgba(0,0,0,0.045)';
            c.fillRect(9, cy + 1, bw - 16, 30);
            emoji(c, it.icon, 28, cy + 16, 20);
            text(c, lines(it.title).main, 46, cy + 16, { size: 17, color: reg.color, maxWidth: bw - 66 });
            dual(c, it.text, 20, cy + 38, 15, tw);
            cy += ch + 8;
        });
        // a big button at the very end: the full fact file
        c.fillStyle = reg.color;
        roundRect(c, 10, cy + 6, bw - 22, 50, 25);
        c.fill();
        c.strokeStyle = '#fff';
        c.lineWidth = 2.5;
        roundRect(c, 14, cy + 10, bw - 30, 42, 21);
        c.stroke();
        emoji(c, '📖', 44, cy + 31, 22);
        text(c, lines(t2('See more', 'もっと みる')).main, (bw - 2) / 2 + 12, cy + 31, { size: 21, color: '#fff', align: 'center' });
        gcache.more = cy + 6;
        gcache.key = ck;
        gcache.total = total;
    }
    gs.scroll += (gs.target - gs.scroll) * 0.25;
    const total = gcache.total;
    gs.max = Math.max(0, total - bh + 6);
    if (gs.target > gs.max)
        gs.target = gs.max;
    const vh = Math.min(bh, total - gs.scroll);
    const my0 = by + gcache.more - gs.scroll;
    gs.more = my0 > by - 10 && my0 + 50 < by + bh + 4 ? { x: bx + 10, y: my0, w: bw - 22, h: 50 } : { x: 0, y: 0, w: 0, h: 0 };
    if (vh > 0)
        ctx.drawImage(gcache.cv, 0, gs.scroll * sc, (bw + 12) * sc, vh * sc, bx, by, bw + 12, vh);
    if (gs.max > 0) {
        // scroll bar, and a soft fade where more text continues
        const th = Math.max(30, bh * bh / total), ty = by + (bh - th) * (gs.scroll / gs.max);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        roundRect(ctx, x + w - 12, by, 5, bh, 3);
        ctx.fill();
        ctx.fillStyle = reg.color;
        roundRect(ctx, x + w - 12, ty, 5, th, 3);
        ctx.fill();
        if (gs.scroll < gs.max - 2) {
            const gr = ctx.createLinearGradient(0, by + bh - 34, 0, by + bh);
            gr.addColorStop(0, 'rgba(255,250,240,0)');
            gr.addColorStop(1, 'rgba(255,250,240,1)');
            ctx.fillStyle = gr;
            ctx.fillRect(bx, by + bh - 34, bw, 34);
            const bob = Math.sin(tt / 250) * 2;
            text(ctx, '▼', x + w / 2, by + bh - 10 + bob, { size: 14, color: reg.color, align: 'center' });
        }
    }
}
//# sourceMappingURL=hud.js.map