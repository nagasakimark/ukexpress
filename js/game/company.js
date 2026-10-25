// The company books: what each railway owns, money in and out this year, and a
// Transport Tycoon-style graph of every company's net worth over time, plus expected income.
import { Button } from '../engine/ui.js';
import { C, panel, text, emoji, money, roundRect } from '../engine/draw.js';
import { lines, t2, main } from './i18n.js';
import { PModal, header } from './dialogs.js';
import { ownedProps, priceOf, monopolyOwner, forecastIncome } from '../core/rules.js';
import { STATION_BY_ID, PROP_BY_ID } from '../core/content/stations.js';
import { TRAINS, CARD_BY_ID, AVATARS, MONTHS } from '../core/content/game-data.js';
const lbl = (t) => lines(t).main;
const KIND = {
    rent: { icon: '🏠', label: t2('Rent', '家賃') },
    prize: { icon: '🏆', label: t2('Prizes', '賞金') },
    buy: { icon: '🛍️', label: t2('Shopping', 'お買い物') },
    fee: { icon: '💸', label: t2('Fees', '出費') },
    sale: { icon: '💰', label: t2('Sales', '売却') },
    other: { icon: '📦', label: t2('Other', 'その他') },
};
/** "Birmingham Market Hall" for a ledger note like prop:durham_0 (falls back to '' when unknown). */
function noteName(note) {
    if (!note)
        return '';
    if (note.startsWith('prop:')) {
        const pr = PROP_BY_ID[note.slice(5)];
        return pr ? main(pr.name) : '';
    }
    if (note.startsWith('train:')) {
        const tr = TRAINS[Number(note.slice(6))];
        return tr ? main(tr.name) : '';
    }
    if (note.startsWith('card:')) {
        const c = CARD_BY_ID[note.slice(5)];
        return c ? main(c.name) : '';
    }
    return '';
}
const IN = ['rent', 'prize', 'sale'];
const OUT = ['buy', 'fee'];
export class CompanyModal extends PModal {
    constructor(g, selId) {
        super();
        this.g = g;
        this.tab = 'hold';
        this.sel = 0;
        this.page = 0;
        this.tabBtns = [];
        this.dotBtns = [];
        this.pageBtns = [];
        this.dim = 0.6;
        if (selId) {
            const i = g.players.findIndex((p) => p.id === selId);
            if (i >= 0)
                this.sel = i;
        }
        const tabs = [
            ['hold', '💼', t2('Holdings', 'もちもの')],
            ['money', '💰', t2('Money', 'おかね')],
            ['graph', '📈', t2('Graph', 'グラフ')],
        ];
        tabs.forEach(([id, icon, label], i) => {
            const b = new Button({ x: 60 + i * 210, y: 100, w: 200, h: 52, label: lbl(label), icon, size: 22, color: '#1F5E3B', onClick: () => { this.tab = id; this.page = 0; this.refresh(); } });
            this.tabBtns.push(b);
            this.buttons.push(b);
        });
        g.players.forEach((p, i) => {
            const b = new Button({ x: 1196 - (g.players.length - i) * 66, y: 96, w: 56, h: 56, label: '', icon: AVATARS[p.avatar].emoji, size: 30, color: C.players[p.color], onClick: () => { this.sel = i; this.page = 0; this.refresh(); } });
            this.dotBtns.push(b);
            this.buttons.push(b);
        });
        const close = new Button({ x: 640 - 130, y: 640, w: 260, h: 56, label: lbl(t2('Close', 'とじる')), color: '#7a6a55', onClick: () => this.resolveWith(undefined) });
        this.buttons.push(close);
        this.onBack = () => this.resolveWith(undefined);
        this.refresh();
        this.focus = this.buttons.length - 1;
    }
    refresh() {
        const p = this.g.players[this.sel];
        this.tabBtns.forEach((b, i) => (b.color = ['hold', 'money', 'graph'][i] === this.tab ? '#d7263d' : '#1F5E3B'));
        this.dotBtns.forEach((b, i) => (b.color = i === this.sel ? C.players[this.g.players[i].color] : '#8a8a80'));
        const n = this.pages();
        if (this.page >= n)
            this.page = Math.max(0, n - 1);
        this.pageBtns.forEach((b) => { const k = this.buttons.indexOf(b); if (k >= 0)
            this.buttons.splice(k, 1); });
        this.pageBtns = [];
        if (n > 1) {
            const prev = new Button({ x: 70, y: 640, w: 120, h: 56, label: '◀', size: 24, color: '#3a5a8a', onClick: () => { this.page = (this.page + n - 1) % n; } });
            const next = new Button({ x: 200, y: 640, w: 120, h: 56, label: '▶', size: 24, color: '#3a5a8a', onClick: () => { this.page = (this.page + 1) % n; } });
            this.pageBtns = [prev, next];
            this.buttons.push(prev, next);
        }
        void p;
    }
    autoValue() { return undefined; }
    pages() { return this.tab === 'hold' ? Math.max(1, Math.ceil(this.stationRows().length / 6)) : 1; }
    player() { return this.g.players[this.sel]; }
    stationRows() {
        const g = this.g, p = this.player();
        const fc = forecastIncome(g, p);
        const rentOf = new Map();
        for (const l of fc.lines)
            rentOf.set(l.prop.id, (rentOf.get(l.prop.id) ?? 0) + l.rent);
        const bySt = new Map();
        for (const pr of ownedProps(g, p)) {
            const r = bySt.get(pr.stationId) ?? { n: 0, value: 0, rent: 0 };
            r.n++;
            r.value += priceOf(g, pr);
            r.rent += rentOf.get(pr.id) ?? 0;
            bySt.set(pr.stationId, r);
        }
        return [...bySt.entries()].map(([sid, r]) => {
            const st = STATION_BY_ID[sid];
            return { sid, name: main(st.name), emoji: st.emoji, n: r.n, total: st.props.length, mono: monopolyOwner(g, sid) === p.id, value: r.value, rent: Math.round(r.rent) };
        }).sort((a, b) => b.rent - a.rent);
    }
    drawBody(ctx) {
        const g = this.g, p = this.player();
        panel(ctx, 24, 14, 1232, 692);
        header(ctx, t2(`${main(p.name)} Railway: company books`, `${main(p.name)}鉄道：かいしゃのおさいふ`), 24, 14, 1232, C.players[p.color]);
        emoji(ctx, AVATARS[p.avatar].emoji, 90, 178, 44);
        text(ctx, `${money(p.cash)} · ${this.stationRows().reduce((a, r) => a + r.n, 0)} ${lbl(t2('properties', '物件'))}`, 120, 178, { size: 24, maxWidth: 420 });
        if (this.tab === 'hold')
            this.drawHold(ctx);
        else if (this.tab === 'money')
            this.drawMoney(ctx);
        else
            this.drawGraph(ctx);
        if (this.pages() > 1)
            text(ctx, `${this.page + 1} / ${this.pages()}`, 195, 668, { size: 20, color: '#5a5a50', align: 'center' });
    }
    drawHold(ctx) {
        const rows = this.stationRows();
        const g = this.g, p = this.player();
        if (!rows.length) {
            text(ctx, lbl(t2('No properties yet. Land on a station and buy some!', 'まだ物件がないよ。駅に止まって買おう！')), 640, 380, { size: 26, align: 'center', maxWidth: 900 });
            return;
        }
        const fc = forecastIncome(g, p);
        let y = 226;
        text(ctx, lbl(t2('Station', '駅')), 120, y - 28, { size: 18, color: '#8a7a60', weight: 800 });
        text(ctx, lbl(t2('Rent / year', 'ねんだんの家賃')), 1210, y - 28, { size: 18, color: '#8a7a60', align: 'right', weight: 800 });
        for (const r of rows.slice(this.page * 6, this.page * 6 + 6)) {
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            roundRect(ctx, 70, y - 4, 1140, 56, 12);
            ctx.fill();
            emoji(ctx, r.emoji, 110, y + 24, 34);
            text(ctx, `${r.name}  ${r.n}/${r.total}${r.mono ? ' 👑' : ''}`, 140, y + 24, { size: 24, maxWidth: 560 });
            text(ctx, money(r.value), 880, y + 24, { size: 22, color: '#5a5a50', align: 'right' });
            text(ctx, '+' + money(r.rent), 1210, y + 24, { size: 24, color: '#2e7d32', align: 'right' });
            y += 62;
        }
        text(ctx, `${lbl(t2('Expected March income', '3月の予想しゅうにゅう'))}: +${money(fc.total)}`, 640, 614, { size: 24, color: '#2e7d32', align: 'center' });
    }
    drawMoney(ctx) {
        const g = this.g, p = this.player();
        const entries = g.ledger.filter((e) => e.playerId === p.id && e.y === g.year);
        const sum = (ks) => entries.filter((e) => ks.includes(e.k)).reduce((a, e) => a + e.v, 0);
        const got = sum(IN) + entries.filter((e) => e.k === 'other' && e.v > 0).reduce((a, e) => a + e.v, 0);
        const spent = -(sum(OUT) + entries.filter((e) => e.k === 'other' && e.v < 0).reduce((a, e) => a + e.v, 0));
        const rows = ['rent', 'prize', 'sale', 'buy', 'fee', 'other']
            .map((k) => [k, entries.filter((e) => e.k === k).reduce((a, e) => a + e.v, 0)])
            .filter(([, v]) => v !== 0);
        text(ctx, lbl(t2(`Year ${g.year}: money in and out`, `${g.year}年目のおかね`)), 640, 210, { size: 24, align: 'center' });
        let y = 250;
        ctx.fillStyle = 'rgba(46,125,50,0.12)';
        roundRect(ctx, 70, y - 4, 560, 52, 12);
        ctx.fill();
        text(ctx, `💰 ${lbl(t2('Earned', 'もらった'))}`, 100, y + 22, { size: 24 });
        text(ctx, '+' + money(got), 600, y + 22, { size: 26, color: '#2e7d32', align: 'right' });
        ctx.fillStyle = 'rgba(214,38,61,0.10)';
        roundRect(ctx, 650, y - 4, 560, 52, 12);
        ctx.fill();
        text(ctx, `🛍️ ${lbl(t2('Spent', 'つかった'))}`, 680, y + 22, { size: 24 });
        text(ctx, '−' + money(spent), 1180, y + 22, { size: 26, color: C.red, align: 'right' });
        y += 70;
        for (const [k, v] of rows.slice(0, 4)) {
            const kd = KIND[k];
            emoji(ctx, kd.icon, 120, y + 16, 28);
            text(ctx, main(kd.label), 150, y + 16, { size: 22, maxWidth: 300 });
            text(ctx, (v < 0 ? '−' : '+') + money(Math.abs(v)), 600, y + 16, { size: 24, color: v < 0 ? C.red : '#2e7d32', align: 'right' });
            y += 44;
        }
        y = Math.max(y + 6, 470);
        text(ctx, lbl(t2('Recent', 'さいきん')), 100, y, { size: 20, color: '#8a7a60', weight: 800 });
        const recent = g.ledger.filter((e) => e.playerId === p.id).slice(-3).reverse();
        if (!recent.length)
            text(ctx, lbl(t2('Nothing yet.', 'まだないよ。')), 100, y + 34, { size: 22 });
        for (const e of recent) {
            const kd = KIND[e.k];
            const nm = noteName(e.n);
            text(ctx, `${kd.icon} ${nm || main(kd.label)}`, 100, y + 34, { size: 22, maxWidth: 700 });
            text(ctx, (e.v < 0 ? '−' : '+') + money(Math.abs(e.v)), 600, y + 34, { size: 22, color: e.v < 0 ? C.red : '#2e7d32', align: 'right' });
            text(ctx, `Y${e.y} ${main(MONTHS[e.m])}`, 900, y + 34, { size: 20, color: '#5a5a50', maxWidth: 280 });
            y += 36;
        }
    }
    drawGraph(ctx) {
        const g = this.g;
        const x0 = 90, x1 = 1190, y0 = 200, y1 = 500;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        roundRect(ctx, 60, 160, 1160, 400, 14);
        ctx.fill();
        const pts = g.history;
        if (pts.length < 2) {
            text(ctx, lbl(t2('Play a month and the graph will grow here.', '1か月遊ぶと、ここにグラフが出るよ。')), 640, 360, { size: 24, align: 'center', maxWidth: 800 });
        }
        else {
            let maxV = 1000;
            for (const h of pts)
                for (const [, w] of h.v)
                    maxV = Math.max(maxV, w);
            maxV = Math.ceil(maxV / 1000) * 1000;
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 2;
            ctx.fillStyle = '#8a7a60';
            ctx.font = '500 18px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            for (let i = 0; i <= 4; i++) {
                const yy = y1 - (i / 4) * (y1 - y0);
                ctx.beginPath();
                ctx.moveTo(x0, yy);
                ctx.lineTo(x1, yy);
                ctx.stroke();
                ctx.fillText(money(Math.round(maxV * i / 4)), x0 - 8, yy);
            }
            // year gridlines
            ctx.textAlign = 'center';
            let lastY = -1;
            pts.forEach((h, i) => {
                if (h.y !== lastY) {
                    const xx = x0 + (i / (pts.length - 1)) * (x1 - x0);
                    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
                    ctx.beginPath();
                    ctx.moveTo(xx, y0);
                    ctx.lineTo(xx, y1);
                    ctx.stroke();
                    ctx.fillStyle = '#8a7a60';
                    ctx.fillText(`Y${h.y}`, xx, y1 + 22);
                    lastY = h.y;
                }
            });
            g.players.forEach((p, pi) => {
                const col = C.players[p.color];
                ctx.strokeStyle = col;
                ctx.lineWidth = pi === this.sel ? 5 : 3;
                ctx.beginPath();
                pts.forEach((h, i) => {
                    const xx = x0 + (i / (pts.length - 1)) * (x1 - x0);
                    const yy = y1 - (Math.max(0, h.v[pi]?.[1] ?? 0) / maxV) * (y1 - y0);
                    if (i)
                        ctx.lineTo(xx, yy);
                    else
                        ctx.moveTo(xx, yy);
                });
                ctx.stroke();
                const last = pts[pts.length - 1].v[pi]?.[1] ?? 0;
                const lx = x1, ly = y1 - (Math.max(0, last) / maxV) * (y1 - y0);
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.arc(lx, ly, 7, 0, 7);
                ctx.fill();
                ctx.fillStyle = '#1d1d1b';
                ctx.font = '800 20px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`${main(p.name)} ${money(last)}`, Math.min(lx - 190, x1 - 200), Math.max(y0 + 12, Math.min(y1 - 12, ly - 14)), 190);
            });
        }
        // expected income, Tycoon style: what March would pay at today's rents
        const p = this.player();
        const fc = forecastIncome(g, p);
        const top = fc.lines.slice().sort((a, b) => b.rent - a.rent).slice(0, 3);
        ctx.fillStyle = 'rgba(46,125,50,0.12)';
        roundRect(ctx, 60, 572, 1160, 56, 12);
        ctx.fill();
        text(ctx, `🔮 ${lbl(t2('Expected March income', '3月の予想しゅうにゅう'))}: +${money(fc.total)}`, 90, 600, { size: 24, color: '#1d1d1b', maxWidth: 560 });
        text(ctx, top.map((l) => `${main(l.prop.name)} +${money(Math.round(l.rent))}`).join(' · ') || lbl(t2('Buy property to earn rent!', '物件を買うと家賃が入るよ！')), 660, 600, { size: 20, color: '#2e7d32', maxWidth: 540 });
    }
}
//# sourceMappingURL=company.js.map