// The whole-map view (Momotetsu's 全体マップ): a flat picture of the board painted once, with every
// station, the destination and the players drawn on top. Cheap enough for any Chromebook.
import { board } from '../../core/map.js';
import { STATION_BY_ID } from '../../core/content/stations.js';
import { REGIONS } from '../../core/content/game-data.js';
import { FONT, roundRect, emoji } from '../../engine/draw.js';
import { BIG_CITIES } from './ground.js';
import { main } from '../i18n.js';
const PPC = 14; // pixels per cell in the painted map
export class Overview {
    constructor() {
        this.canvas = null;
        this.season = '';
        /** view: centre (cells) and zoom (screen pixels per cell) */
        this.x = 0;
        this.y = 0;
        this.ppc = 11;
    }
    paint(ground) {
        const g = board.grid;
        const c = this.canvas ?? document.createElement('canvas');
        c.width = g.w * PPC;
        c.height = g.h * PPC;
        const ctx = c.getContext('2d');
        ground.paint(ctx, -0.5, -0.5, g.w, g.h, PPC, null, null, false);
        this.canvas = c;
        this.season = ground.season;
    }
    fit() { const g = board.grid; this.ppc = Math.min(1180 / g.w, 600 / g.h); this.x = g.w / 2 - 0.5; this.y = g.h / 2 - 0.5; }
    clamp() { const g = board.grid; this.x = Math.max(0, Math.min(g.w - 1, this.x)); this.y = Math.max(0, Math.min(g.h - 1, this.y)); this.ppc = Math.max(8, Math.min(60, this.ppc)); }
    toScreen(x, y) { return { x: 640 + (x - this.x) * this.ppc, y: 392 + (y - this.y) * this.ppc }; }
    toWorld(sx, sy) { return { x: this.x + (sx - 640) / this.ppc, y: this.y + (sy - 392) / this.ppc }; }
    draw(ctx, ground, destNode, players, tt) {
        if (!this.canvas || this.season !== ground.season)
            this.paint(ground);
        ctx.fillStyle = '#3fa3e8';
        ctx.fillRect(0, 0, 1280, 720);
        const o = this.toScreen(-0.5, -0.5);
        const k = this.ppc / PPC;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.canvas, o.x, o.y, this.canvas.width * k, this.canvas.height * k);
        // stations (important names first; a name that would overlap another is skipped)
        const big = this.ppc >= 22;
        const boxes = [];
        const entries = Object.entries(board.grid.stations).sort(([a], [b]) => {
            const rank = (id) => (board.stationNode[id] === destNode ? 0 : BIG_CITIES.has(id) || STATION_BY_ID[id].capital ? 1 : 2);
            return rank(a) - rank(b);
        });
        for (const [sid, s] of entries) {
            const p = this.toScreen(s.x, s.y);
            if (p.x < -60 || p.x > 1340 || p.y < -30 || p.y > 750)
                continue;
            const st = STATION_BY_ID[sid];
            const r = Math.max(3.5, this.ppc * 0.28);
            ctx.fillStyle = '#1b1b1b';
            ctx.beginPath();
            ctx.arc(p.x, p.y, r + 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = REGIONS[st.region].color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            const isDest = board.stationNode[sid] === destNode;
            if (big || isDest || BIG_CITIES.has(sid) || st.capital) {
                const size = Math.round(Math.max(12, Math.min(20, this.ppc * 0.55)));
                ctx.font = `800 ${size}px ${FONT}`;
                const name = main(st.name);
                const w = ctx.measureText(name).width + 10;
                const ly = p.y + r + size * 0.75;
                const bx = [p.x - w / 2 - 2, ly - size * 0.6 - 2, p.x + w / 2 + 2, ly + size * 0.6 + 2];
                if (!isDest && boxes.some((o) => o[0] < bx[2] && o[2] > bx[0] && o[1] < bx[3] && o[3] > bx[1]))
                    continue;
                boxes.push(bx);
                ctx.fillStyle = isDest ? '#ffe45c' : 'rgba(255,255,255,0.92)';
                roundRect(ctx, p.x - w / 2, ly - size * 0.6, w, size * 1.2, 4);
                ctx.fill();
                ctx.fillStyle = '#111';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(name, p.x, ly + 1);
            }
        }
        const dn = board.nodes[destNode];
        if (dn) {
            const p = this.toScreen(dn.x, dn.y);
            emoji(ctx, '🚩', p.x + 8, p.y - 18 - Math.abs(Math.sin(tt / 260)) * 8, 34);
        }
        for (const pl of players) {
            const p = this.toScreen(pl.x, pl.y);
            const r = pl.current ? 17 : 12;
            const by = p.y - r - 6 - (pl.current ? Math.abs(Math.sin(tt / 220)) * 6 : 0);
            ctx.fillStyle = '#1b1b1b';
            ctx.beginPath();
            ctx.arc(p.x, by, r + 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(p.x - 7, by + r - 2);
            ctx.lineTo(p.x + 7, by + r - 2);
            ctx.lineTo(p.x, by + r + 9);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = pl.color;
            ctx.beginPath();
            ctx.arc(p.x, by, r, 0, Math.PI * 2);
            ctx.fill();
            emoji(ctx, pl.avatar, p.x, by, r * 1.25);
        }
    }
}
//# sourceMappingURL=overview.js.map