// A big map of the UK that opens from the little map in the Station guide: where is this place?
import { PModal, header } from './dialogs.js';
import { Button } from '../engine/ui.js';
import { C, panel, text, roundRect, emoji } from '../engine/draw.js';
import { clock } from '../engine/tween.js';
import { app } from './app.js';
import { lines, main, t2 } from './i18n.js';
import { board } from '../core/map.js';
import { STATION_BY_ID } from '../core/content/stations.js';
import { REGIONS } from '../core/content/game-data.js';
import { UI } from './i18n.js';
const MW = 420, MH = 560;
let sea = null;
let geo = { sc: 1, ox: 0, oy: 0 };
/** The coastline, painted once. */
function baseMap() {
    if (sea)
        return sea;
    const c = document.createElement('canvas');
    c.width = MW * 2;
    c.height = MH * 2;
    const g = c.getContext('2d');
    g.scale(2, 2);
    const gr = board.grid;
    const sc = Math.min((MW - 16) / gr.w, (MH - 16) / gr.h);
    const ox = (MW - gr.w * sc) / 2, oy = (MH - gr.h * sc) / 2;
    geo = { sc, ox, oy };
    g.fillStyle = '#bfe3f7';
    roundRect(g, 0, 0, MW, MH, 16);
    g.fill();
    g.fillStyle = '#eaf1d4';
    g.strokeStyle = '#6b8a5a';
    g.lineWidth = 1.6;
    g.lineJoin = 'round';
    gr.coast.forEach((poly, i) => {
        if (gr.coastTags?.[i] === 'fr')
            return;
        g.beginPath();
        poly.forEach(([px, py], j) => (j ? g.lineTo(ox + (px + 0.5) * sc, oy + (py + 0.5) * sc) : g.moveTo(ox + (px + 0.5) * sc, oy + (py + 0.5) * sc)));
        g.closePath();
        g.fill();
        g.stroke();
    });
    sea = c;
    return c;
}
class UkMapModal extends PModal {
    constructor(sid) {
        super();
        this.sid = sid;
        const l = lines(UI.ok);
        this.buttons.push(new Button({ x: 802, y: 624, w: 260, h: 58, label: t2('Close', 'とじる').ja, sub: 'Close', color: C.green, onClick: () => this.resolveWith(undefined) }));
        this.onBack = () => this.resolveWith(undefined);
        this.focus = 0;
        void l;
    }
    drawBody(ctx) {
        const st = STATION_BY_ID[this.sid];
        const reg = REGIONS[st.region];
        const x = 190, y = 24, w = 900, h = 680;
        panel(ctx, x, y, w, h, { fill: '#f3ead2' });
        header(ctx, t2('Where is it?', 'どこに あるの？'), x, y, w, reg.color);
        const mx = x + 28, my = y + 92;
        ctx.drawImage(baseMap(), mx, my, MW, MH);
        const tt = clock.realTime;
        // every station as a small dot in its region's colour
        for (const [sid, s] of Object.entries(board.grid.stations)) {
            if (sid === this.sid)
                continue;
            const px = mx + geo.ox + (s.x + 0.5) * geo.sc, py = my + geo.oy + (s.y + 0.5) * geo.sc;
            ctx.fillStyle = REGIONS[STATION_BY_ID[sid].region].color;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, 3.4, 0, 7);
            ctx.fill();
            ctx.stroke();
        }
        const s = board.grid.stations[this.sid];
        if (s) {
            const px = mx + geo.ox + (s.x + 0.5) * geo.sc, py = my + geo.oy + (s.y + 0.5) * geo.sc;
            const pulse = 9 + Math.sin(tt / 220) * 3;
            ctx.fillStyle = 'rgba(215,38,61,0.3)';
            ctx.beginPath();
            ctx.arc(px, py, pulse + 6, 0, 7);
            ctx.fill();
            ctx.fillStyle = '#d7263d';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(px, py, 8, 0, 7);
            ctx.fill();
            ctx.stroke();
            emoji(ctx, '📍', px, py - 24 - Math.abs(Math.sin(tt / 300)) * 4, 30);
        }
        // the right side: the name and the regions
        const rx = mx + MW + 36, rw = x + w - 28 - rx;
        const nm = lines(st.name);
        text(ctx, nm.main, rx, my + 30, { size: 40, color: C.ink, maxWidth: rw });
        if (nm.sub)
            text(ctx, nm.sub, rx, my + 68, { size: 22, color: '#6a5a40', weight: 600, maxWidth: rw });
        const rl = lines(reg.name);
        ctx.fillStyle = reg.color;
        roundRect(ctx, rx, my + 92, Math.min(rw, 330), 38, 19);
        ctx.fill();
        text(ctx, rl.main + (rl.sub ? '  ' + rl.sub : ''), rx + 16, my + 112, { size: 19, color: '#fff', maxWidth: Math.min(rw, 330) - 28 });
        text(ctx, main(t2('Regions', 'ちほう')), rx, my + 172, { size: 22, color: '#8a7a60' });
        Object.entries(REGIONS).forEach(([id, r], i) => {
            const cy = my + 206 + i * 32;
            ctx.fillStyle = r.color;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(rx + 10, cy, 9, 0, 7);
            ctx.fill();
            ctx.stroke();
            const l = lines(r.name);
            text(ctx, l.main + (l.sub ? '  ' + l.sub : ''), rx + 30, cy, { size: 17, color: id === st.region ? C.ink : '#5a5a50', weight: id === st.region ? 800 : 500, maxWidth: rw - 34 });
        });
    }
}
/** Opens the big UK map with this station highlighted. */
export function showUkMap(sid) { return app.show(new UkMapModal(sid)); }
//# sourceMappingURL=ukmap.js.map