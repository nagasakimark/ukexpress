import { board, distancesTo } from '../core/map.js';
import { STATION_BY_ID } from '../core/content/stations.js';
import { AVATARS, MONTHS, REGIONS, SEASON_EMOJI, STYLES } from '../core/content/game-data.js';
import { assets, ranking } from '../core/rules.js';
import { C, FONT, panel, text, emoji, money, roundRect } from '../engine/draw.js';
import { lang, lines, main, t2 } from './i18n.js';
import { dual, dualHeight } from './dialogs.js';
import { drawPic } from './images.js';
import { LAY } from './layout.js';
const GREEN = '#174a2f';
export function drawTopBar(ctx, g, p, destOffscreen) {
    const W = LAY.mapW, H = LAY.mapTop;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(23,74,47,0.98)');
    grad.addColorStop(1, 'rgba(15,52,33,0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.brass;
    ctx.fillRect(0, H - 4, W, 4);
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
    // destination
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
}
export function drawPlayerList(ctx, g, cur) {
    const x = 8, y = LAY.mapBot + 6, w = LAY.mapW - 16, rowH = 36;
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
export function drawGuide(ctx, sid, tag, tt) {
    const st = STATION_BY_ID[sid];
    const x = LAY.panelX, y = 8, w = LAY.panelW, h = 548;
    const reg = REGIONS[st.region];
    panel(ctx, x, y, w, h, { fill: '#fffaf0' });
    // header
    const tg = TAGS[tag];
    ctx.fillStyle = tg.color;
    roundRect(ctx, x + 6, y + 6, w - 12, 36, 10);
    ctx.fill();
    emoji(ctx, tg.icon, x + 28, y + 24, 22);
    text(ctx, main(tg.t), x + 50, y + 24, { size: 19, color: '#fff' });
    text(ctx, main(t2('Station guide', 'えきガイド')), x + w - 16, y + 24, { size: 14, color: '#fff3c4', align: 'right', weight: 600 });
    // photo + locator
    drawPic(ctx, 'places', st.image, x + 14, y + 52, w - 28, 180, { emoji: st.emoji, label: main(st.name), color: reg.color, radius: 12 });
    const lm = locatorMap();
    const lx = x + w - 14 - LW - 8, ly = y + 52 + 180 - LH * 0.62 - 6;
    ctx.save();
    ctx.globalAlpha = 0.93;
    ctx.drawImage(lm, lx, ly, LW * 0.62, LH * 0.62);
    ctx.restore();
    const s = board.grid.stations[sid];
    if (s) {
        const px = lx + (lm.ox + (s.x + 0.5) * lm.sc) * 0.62, py = ly + (lm.oy + (s.y + 0.5) * lm.sc) * 0.62;
        const pulse = 3.5 + Math.sin(tt / 200) * 1.2;
        ctx.fillStyle = 'rgba(215,38,61,0.35)';
        ctx.beginPath();
        ctx.arc(px, py, pulse + 3, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#d7263d';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 3.6, 0, 7);
        ctx.fill();
        ctx.stroke();
    }
    // name + region
    const nm = lines(st.name);
    text(ctx, nm.main, x + 18, y + 256, { size: 28, color: C.ink, maxWidth: w - 36 });
    if (nm.sub)
        text(ctx, nm.sub, x + 18, y + 282, { size: 15, color: '#6a5a40', weight: 600, maxWidth: w - 36 });
    const rn = main(reg.name);
    ctx.font = `800 15px ${FONT}`;
    const rw = ctx.measureText(rn).width + 30;
    ctx.fillStyle = reg.color;
    roundRect(ctx, x + 18, y + 294, rw, 24, 12);
    ctx.fill();
    text(ctx, rn, x + 18 + rw / 2, y + 306, { size: 15, color: '#fff', align: 'center' });
    // facts
    let fy = y + 330;
    const bottom = y + h - 10;
    const facts = st.facts.slice(0, 3);
    let size = 17;
    for (let i = 0; i < facts.length; i++) {
        const fh = dualHeight(ctx, facts[i], size, w - 52) + 8;
        if (fy + fh > bottom) {
            if (i === 0)
                size = 14;
            else
                break;
        }
        ctx.fillStyle = reg.color;
        ctx.beginPath();
        ctx.arc(x + 22, fy + 10, 5, 0, 7);
        ctx.fill();
        fy = dual(ctx, facts[i], x + 36, fy, size, w - 56) + 8;
    }
}
//# sourceMappingURL=hud.js.map