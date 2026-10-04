// In-game dialogs, drawn on the canvas: messages (paged so text never overflows), choices, quizzes,
// shops, the card hand, settlement, the roulette, the calendar page, dice, banners and toasts.
import { Modal, Button } from '../engine/ui.js';
import { C, FONT, panel, text, wrap, fitWrap, emoji, money, roundRect, shade } from '../engine/draw.js';
import { clock, Ease } from '../engine/tween.js';
import { audio } from '../engine/audio.js';
import { fx } from '../engine/fx.js';
import { lines, lang, UI, t2 } from './i18n.js';
import { app } from './app.js';
import { CARD_BY_ID, TRAINS, REGIONS, AVATARS, STYLES, SEASONS } from '../core/content/game-data.js';
import { STATION_BY_ID, STATIONS } from '../core/content/stations.js';
import { HERO_BY_ID } from '../core/content/heroes.js';
import { priceOf, assets, monopolyOwner } from '../core/rules.js';
import { realMonth, daysInMonth, firstWeekday, eventDate, dateText, MONTH_NAMES, WEEKDAYS } from '../core/calendar.js';
import { drawPortrait } from './mapart.js';
export const CAT_EMOJI = { food: '🍽️', tourism: '📷', industry: '⚙️', culture: '🎭', sport: '⚽' };
export const CAT_NAME = { food: t2('Food', '食べ物'), tourism: t2('Tourism', '観光'), industry: t2('Industry', '工業'), culture: t2('Culture', '文化'), sport: t2('Sport', 'スポーツ') };
const SUB_RATIO = 0.64;
/** Draws a T2 as a main line plus a smaller sub line, wrapped; returns the y after the block. */
export function dual(ctx, t, x, y, size, maxW, align = 'left', color = C.ink, subColor = '#5a5a50') {
    const l = lines(t);
    for (const s of wrap(ctx, l.main, maxW, size)) {
        text(ctx, s, x, y + size / 2, { size, color, align });
        y += size * 1.22;
    }
    if (l.sub) {
        const ss = Math.max(15, Math.round(size * SUB_RATIO));
        y += 3;
        for (const s of wrap(ctx, l.sub, maxW, ss, 500)) {
            text(ctx, s, x, y + ss / 2, { size: ss, color: subColor, align, weight: 500 });
            y += ss * 1.32;
        }
    }
    return y;
}
export function dualHeight(ctx, t, size, maxW) {
    const l = lines(t);
    let h = wrap(ctx, l.main, maxW, size).length * size * 1.22;
    if (l.sub) {
        const ss = Math.max(15, Math.round(size * SUB_RATIO));
        h += 3 + wrap(ctx, l.sub, maxW, ss, 500).length * ss * 1.32;
    }
    return h;
}
const lbl = (t) => lines(t).main;
const sub = (t) => lines(t).sub ?? undefined;
/** A modal that resolves a promise when it closes. */
export class PModal extends Modal {
    constructor() {
        super();
        this.age = 0;
        this.promise = new Promise((r) => (this.res = r));
    }
    resolveWith(v) {
        if (this.closing)
            return;
        this.closeAnim().then(() => this.res(v));
    }
    autoValue() { return undefined; }
    update(dt) {
        this.age += dt;
        if (app.autoplay && this.age > 250 && !this.closing) {
            const v = this.autoValue();
            if (v !== undefined)
                this.resolveWith(v);
        }
    }
}
export function header(ctx, title, x, y, w, color) {
    ctx.fillStyle = color;
    roundRect(ctx, x + 5, y + 5, w - 10, 72, 13);
    ctx.fill();
    const tl = lines(title);
    text(ctx, tl.main, x + w / 2, y + (tl.sub ? 32 : 41), { size: 32, color: C.cream, align: 'center', outline: 6, outlineColor: shade(color, -0.4), maxWidth: w - 60 });
    if (tl.sub)
        text(ctx, tl.sub, x + w / 2, y + 62, { size: 17, color: '#fff3c4', align: 'center', weight: 500, maxWidth: w - 60 });
}
const BODY_SIZE = 26;
const MAX_BODY_H = 380;
export class MessageModal extends PModal {
    constructor(o) {
        super();
        this.o = o;
        this.w = 860;
        this.h = 300;
        this.x = 0;
        this.y = 0;
        this.pages = [];
        this.page = 0;
        this.size = BODY_SIZE;
        const ctx = app.screen.ctx;
        const tw = this.textW();
        const body = o.body ?? [];
        const extra = o.money !== undefined ? 70 : 0;
        const pageH = (pg) => pg.reduce((a, b) => a + dualHeight(ctx, b, this.size, tw) + 14, 0);
        // Split the body into pages that fit; one very long paragraph shrinks a little instead.
        if (o.pageArt)
            this.pages = body.map((b) => [b]);
        else {
            let cur = [];
            for (const b of body) {
                if (cur.length && pageH([...cur, b]) + extra > MAX_BODY_H) {
                    this.pages.push(cur);
                    cur = [];
                }
                cur.push(b);
            }
            this.pages.push(cur);
            while (this.size > 18 && this.pages.some((pg) => pageH(pg) + extra > MAX_BODY_H))
                this.size -= 1;
        }
        if (!this.pages.length)
            this.pages = [[]];
        let maxH = 0;
        for (const pg of this.pages)
            maxH = Math.max(maxH, pageH(pg));
        maxH += extra;
        const artH = this.hasArt() ? 220 : 0;
        this.h = Math.min(640, Math.max(250, 96 + Math.max(maxH, artH) + 116));
        this.x = 640 - this.w / 2;
        this.y = 360 - this.h / 2;
        this.buildButtons();
        if (o.confetti)
            setTimeout(() => fx.burst(640, 200, 'confetti', 60, { speed: 9, up: 6 }), 120);
    }
    hasArt() { return !!(this.o.portrait || this.o.icon || this.o.iconDraw || this.o.pageArt); }
    textW() { return this.w - 80 - (this.hasArt() ? 210 : 0); }
    lastPage() { return this.page >= this.pages.length - 1; }
    nextPage() { this.page++; audio.play('card'); this.buildButtons(); }
    buildButtons() {
        this.buttons = [];
        const by = this.y + this.h - 88;
        if (!this.lastPage()) {
            this.buttons.push(new Button({ x: 640 - 140, y: by, w: 280, h: 66, label: lbl(UI.next) + ' ▶', sub: sub(UI.next), color: C.green, onClick: () => this.nextPage() }));
            this.onBack = () => this.nextPage();
        }
        else {
            const btns = this.o.buttons ?? [{ label: UI.ok, value: true }];
            const bw = Math.min(290, (this.w - 80) / btns.length - 20);
            const total = btns.length * bw + (btns.length - 1) * 24;
            btns.forEach((b, i) => this.buttons.push(new Button({ x: 640 - total / 2 + i * (bw + 24), y: by, w: bw, h: 66, label: lbl(b.label), sub: sub(b.label), color: b.color ?? C.green, onClick: () => this.resolveWith(b.value) })));
            this.onBack = btns.length === 1 ? () => this.resolveWith(btns[0].value) : null;
        }
        this.focus = 0;
    }
    autoValue() {
        if (!this.lastPage()) {
            this.nextPage();
            return undefined;
        }
        return (this.o.buttons ?? [{ value: true }])[0].value;
    }
    tapOutside() {
        if (!this.lastPage())
            this.nextPage();
        else if ((this.o.buttons ?? []).length <= 1)
            this.resolveWith((this.o.buttons ?? [{ value: true }])[0].value);
    }
    drawBody(ctx) {
        const { x, y, w, h, o } = this;
        panel(ctx, x, y, w, h);
        header(ctx, o.title, x, y, w, o.color ?? C.green);
        let tx = x + 40;
        const areaTop = y + 82, areaBot = y + h - (this.pages.length > 1 ? 124 : 100);
        if (this.hasArt()) {
            const py = (areaTop + areaBot) / 2 - (o.badge ? 12 : 0);
            const art = o.pageArt?.[this.page];
            if (art)
                art(ctx, x + 120, py);
            else if (o.iconDraw)
                o.iconDraw(ctx, x + 120, py);
            else if (o.portrait)
                drawPortrait(ctx, o.portrait, x + 120, py, 68, o.portraitRing);
            else
                emoji(ctx, o.icon, x + 120, py, 96);
            if (o.badge)
                text(ctx, o.badge, x + 120, py + 92, { size: 17, align: 'center', color: '#5a5a50', maxWidth: 190 });
            tx = x + 230;
        }
        const pg = this.pages[this.page] ?? [];
        const contentH = pg.reduce((a, b) => a + dualHeight(ctx, b, this.size, this.textW()) + 14, 0) - 14 + (this.lastPage() && o.money !== undefined ? 70 : 0);
        let cy = areaTop + Math.max(8, (areaBot - areaTop - contentH) / 2);
        for (const b of pg)
            cy = dual(ctx, b, tx, cy, this.size, this.textW()) + 14;
        if (o.money !== undefined && this.lastPage()) {
            const m = o.money;
            text(ctx, (m > 0 ? '+' : '') + money(m), tx + this.textW() / 2, cy + 24, { size: 48, color: m >= 0 ? C.gold : C.red, align: 'center', outline: 8 });
        }
        if (this.pages.length > 1) {
            for (let i = 0; i < this.pages.length; i++) {
                ctx.fillStyle = i === this.page ? C.green : '#cfc4a3';
                ctx.beginPath();
                ctx.arc(640 + (i - (this.pages.length - 1) / 2) * 22, y + h - 112, 6, 0, 7);
                ctx.fill();
            }
        }
    }
}
export function say(o) { return app.show(new MessageModal(o)); }
// ---------- Toast (non-blocking, used for CPU actions) ----------
export class Toast {
    constructor(t, icon, color, dur) {
        this.t = t;
        this.icon = icon;
        this.color = color;
        this.dur = dur;
        this.life = 0;
        this.done = false;
        this.y = -120;
        clock.tween(this, { y: 92 }, 260, Ease.outBack);
    }
    update(dt) { this.life += dt * clock.timeScale; if (this.life > this.dur + 300)
        this.done = true;
    else if (this.life > this.dur && this.y > -110)
        this.y -= dt * 0.9 * clock.timeScale; }
    draw(ctx) {
        const w = 780, h = 96, x = 640 - w / 2, y = this.y;
        panel(ctx, x, y, w, h, { fill: '#fffaf0', border: this.color, radius: 18, rivets: false });
        emoji(ctx, this.icon, x + 54, y + h / 2, 46);
        const l = lines(this.t);
        const m = fitWrap(ctx, l.main, w - 120, 2, 24, 16);
        const subH = l.sub ? 22 : 0;
        const total = m.lines.length * m.size * 1.15 + subH;
        let cy = y + h / 2 - total / 2 + m.size * 0.55;
        for (const s of m.lines) {
            text(ctx, s, x + 96, cy, { size: m.size });
            cy += m.size * 1.15;
        }
        if (l.sub) {
            const sm = fitWrap(ctx, l.sub, w - 120, 1, 16, 12, 500);
            text(ctx, sm.lines[0], x + 96, cy + 2, { size: sm.size, color: '#5a5a50', weight: 500 });
        }
    }
}
export function toast(t, icon = '💬', color = C.brass, dur = 1500) {
    app.overlays = app.overlays.filter((o) => !(o instanceof Toast));
    app.overlays.push(new Toast(t, icon, color, dur));
    return clock.wait(dur + 200);
}
export class ChoiceModal extends PModal {
    constructor(title, body, opts, backValue) {
        super();
        this.title = title;
        this.body = body;
        this.opts = opts;
        this.backValue = backValue;
        this.x = 0;
        this.y = 0;
        this.w = 760;
        this.h = 0;
        this.bodyH = 0;
        const cols = opts.length > 5 ? 2 : 1;
        if (cols === 2)
            this.w = 980;
        this.bodyH = body ? dualHeight(app.screen.ctx, body, 24, this.w - 80) + 14 : 0;
        const rowH = 76, rows = Math.ceil(opts.length / cols);
        this.h = Math.min(700, 100 + this.bodyH + rows * rowH + (backValue !== undefined ? 74 : 0) + 24);
        this.x = 640 - this.w / 2;
        this.y = 360 - this.h / 2;
        const bw = cols === 2 ? (this.w - 120) / 2 : this.w - 100;
        opts.forEach((o, i) => {
            const r = Math.floor(i / cols), c = i % cols;
            this.buttons.push(new Button({ x: this.x + 50 + c * (bw + 20), y: this.y + 96 + this.bodyH + r * rowH, w: bw, h: 64, label: lbl(o.label), sub: sub(o.label), icon: o.icon, enabled: o.enabled ?? true, color: o.color ?? C.green, size: 24, onClick: () => this.resolveWith(o.value) }));
        });
        if (backValue !== undefined) {
            this.buttons.push(new Button({ x: 640 - 130, y: this.y + this.h - 80, w: 260, h: 60, label: lbl(UI.back), sub: sub(UI.back), color: '#7a6a55', size: 22, onClick: () => this.resolveWith(backValue) }));
            this.onBack = () => this.resolveWith(backValue);
        }
        this.focus = 0;
    }
    autoValue() { const o = this.opts.find((x) => x.enabled !== false); return o ? o.value : this.backValue; }
    drawBody(ctx) {
        panel(ctx, this.x, this.y, this.w, this.h);
        header(ctx, this.title, this.x, this.y, this.w, C.green);
        if (this.body)
            dual(ctx, this.body, 640, this.y + 90, 24, this.w - 80, 'center');
    }
}
export function choose(title, body, opts, backValue) {
    return app.show(new ChoiceModal(title, body, opts, backValue));
}
// ---------- Quiz ----------
export class QuizModal extends PModal {
    constructor(q, hint, reward, title = t2('Quiz!', 'クイズ！')) {
        super();
        this.q = q;
        this.hint = hint;
        this.reward = reward;
        this.title = title;
        this.x = 170;
        this.y = 60;
        this.w = 940;
        this.h = 600;
        this.timeLeft = 20000;
        this.picked = -2;
        this.hidden = -1;
        this.qBottom = 0;
        if (hint)
            this.hidden = [0, 1, 2].filter((i) => i !== q.answer)[Math.floor(Math.random() * 2)];
        this.qBottom = this.y + 96 + dualHeight(app.screen.ctx, q.q, 30, this.w - 100);
        const top = Math.max(this.y + 250, this.qBottom + 50);
        q.options.forEach((o, i) => {
            this.buttons.push(new Button({ x: this.x + 80, y: top + i * 84, w: this.w - 160, h: 70, label: lbl(o), sub: sub(o), color: ['#3a7be8', '#d7263d', '#2e9b46'][i], size: 28, enabled: i !== this.hidden, onClick: () => this.pick(i) }));
        });
        this.focus = 0;
    }
    autoValue() { return this.q.answer; }
    pick(i) {
        if (this.picked !== -2)
            return;
        this.picked = i;
        const right = i === this.q.answer;
        audio.play(right ? 'quizRight' : 'quizWrong');
        const b = this.buttons[Math.max(0, i)];
        if (right)
            fx.burst(640, b.y + 35, 'star', 20, { color: C.gold, speed: 7 });
        this.buttons.forEach((bb, k) => { bb.enabled = k === this.q.answer || k === i; if (k === this.q.answer)
            bb.color = '#2e9b46';
        else if (k === i)
            bb.color = '#8a8a80'; });
        clock.wait(1600).then(() => this.resolveWith(i));
    }
    update(dt) {
        super.update(dt);
        if (this.picked === -2 && this.appear > 0.9) {
            this.timeLeft -= dt;
            if (this.timeLeft <= 0)
                this.pick(-1);
        }
    }
    drawBody(ctx) {
        const { x, y, w, h } = this;
        panel(ctx, x, y, w, h);
        header(ctx, t2('❓ ' + this.title.en, '❓ ' + this.title.ja), x, y, w, '#8e5cc4');
        dual(ctx, this.q.q, 640, y + 96, 30, w - 100, 'center');
        if (this.reward > 0)
            text(ctx, `Prize ${money(this.reward)}`, x + w - 26, y + 40, { size: 18, color: C.gold, align: 'right', outline: 4 });
        if (this.hint)
            text(ctx, '📘 Hint', x + 26, y + 40, { size: 18, color: '#fff', outline: 3, outlineColor: '#4b2a73' });
        const tw = w - 160, frac = Math.max(0, this.timeLeft / 20000);
        ctx.fillStyle = '#d9cbb0';
        roundRect(ctx, x + 80, y + h - 38, tw, 10, 5);
        ctx.fill();
        ctx.fillStyle = '#8e5cc4';
        roundRect(ctx, x + 80, y + h - 38, Math.max(10, tw * frac), 10, 5);
        ctx.fill();
        emoji(ctx, '🚂', x + 80 + tw * frac, y + h - 44, 30);
        if (this.picked !== -2) {
            const right = this.picked === this.q.answer;
            const msg = right ? 'Correct!' : this.picked === -1 ? "Time's up!" : 'Not quite!';
            text(ctx, msg, 640, (this.qBottom + this.buttons[0].y) / 2, { size: 38, color: right ? '#2e9b46' : C.red, align: 'center', outline: 7, outlineColor: '#fff' });
        }
    }
}
export function quiz(q, hint, reward, title) { return app.show(new QuizModal(q, hint, reward, title)); }
// ---------- Card tiles ----------
const KIND_COL = { move: '#3a7be8', warp: '#2aa198', money: '#e6a817', defence: '#6c7a89', attack: '#d7263d', boggart: '#7a5c99', learn: '#2e9b46' };
/** A card tile. All text is fitted to the card: names shrink, descriptions wrap and shrink. */
export function drawCard(ctx, c, x, y, w, h, selected = false, dim = false) {
    ctx.save();
    if (dim)
        ctx.globalAlpha *= 0.5;
    const frame = c.rarity === 3 ? C.gold : c.rarity === 2 ? '#c0c7cf' : '#ffffff';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, x + 3, y + 6, w, h, 12);
    ctx.fill();
    ctx.fillStyle = '#1d1d1b';
    roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 14);
    ctx.fill();
    ctx.fillStyle = frame;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.fillStyle = '#fffdf6';
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 9);
    ctx.fill();
    const artH = h * 0.42;
    ctx.fillStyle = KIND_COL[c.kind];
    roundRect(ctx, x + 8, y + 8, w - 16, artH, 8);
    ctx.fill();
    emoji(ctx, c.emoji, x + w / 2, y + 8 + artH / 2, artH * 0.62);
    if (c.rarity === 3) {
        const sh = (clock.realTime / 6) % (w * 3);
        ctx.save();
        roundRect(ctx, x, y, w, h, 12);
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(x + sh - w, y);
        ctx.lineTo(x + sh - w + 30, y);
        ctx.lineTo(x + sh - w - 20, y + h);
        ctx.lineTo(x + sh - w - 50, y + h);
        ctx.fill();
        ctx.restore();
    }
    const l = lines(c.name);
    const iw = w - 20;
    let cy = y + 8 + artH + 6;
    const nm = fitWrap(ctx, l.main, iw, 2, Math.min(22, w / 6.5), 11);
    for (const s of nm.lines) {
        text(ctx, s, x + w / 2, cy + nm.size / 2, { size: nm.size, align: 'center' });
        cy += nm.size * 1.1;
    }
    if (l.sub) {
        const sm = fitWrap(ctx, l.sub, iw, 1, 13, 9, 500);
        text(ctx, sm.lines[0], x + w / 2, cy + sm.size / 2, { size: sm.size, align: 'center', weight: 500, color: '#666' });
        cy += sm.size * 1.25;
    }
    const room = y + h - 10 - cy;
    const dm = fitWrap(ctx, lines(c.desc).main, iw, Math.max(1, Math.floor(room / 14)), 14, 10, 500);
    cy += Math.max(0, (room - dm.lines.length * dm.size * 1.2) / 2);
    for (const s of dm.lines) {
        text(ctx, s, x + w / 2, cy + dm.size / 2, { size: dm.size, align: 'center', weight: 500, color: '#333' });
        cy += dm.size * 1.2;
    }
    if (selected) {
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 5;
        roundRect(ctx, x - 8, y - 8, w + 16, h + 16, 16);
        ctx.stroke();
    }
    ctx.restore();
}
export function drawHeroCard(ctx, id, x, y, w, h, selected = false, dim = false, used = false) {
    const hd = HERO_BY_ID[id];
    ctx.save();
    if (dim)
        ctx.globalAlpha *= 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, x + 3, y + 6, w, h, 12);
    ctx.fill();
    ctx.fillStyle = '#1d1d1b';
    roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 14);
    ctx.fill();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#fff4c7');
    g.addColorStop(1, '#e8c45f');
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    text(ctx, 'HERO', x + w / 2, y + 15, { size: 12, align: 'center', color: '#8a6a10' });
    const pr = Math.min(38, w * 0.26);
    drawPortrait(ctx, hd.emoji, x + w / 2, y + 26 + pr, pr);
    let cy = y + 34 + pr * 2 + 6;
    const iw = w - 16;
    const l = lines(hd.name);
    const nm = fitWrap(ctx, l.main, iw, 2, 16, 10);
    for (const s of nm.lines) {
        text(ctx, s, x + w / 2, cy + nm.size / 2, { size: nm.size, align: 'center' });
        cy += nm.size * 1.1;
    }
    if (l.sub) {
        const sm = fitWrap(ctx, l.sub, iw, 1, 12, 9, 500);
        text(ctx, sm.lines[0], x + w / 2, cy + sm.size / 2, { size: sm.size, align: 'center', weight: 500 });
        cy += sm.size * 1.3;
    }
    if (hd.powerName) {
        const pm = fitWrap(ctx, '★ ' + lines(hd.powerName).main, iw, 1, 14, 9);
        text(ctx, pm.lines[0], x + w / 2, cy + pm.size / 2 + 2, { size: pm.size, align: 'center', color: '#7a3b00' });
    }
    text(ctx, hd.lived, x + w / 2, y + h - 13, { size: 12, align: 'center', weight: 500, color: '#555' });
    if (used)
        emoji(ctx, '💤', x + w - 16, y + 16, 18);
    if (selected) {
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 5;
        roundRect(ctx, x - 8, y - 8, w + 16, h + 16, 16);
        ctx.stroke();
    }
    ctx.restore();
}
const PASSIVE = ['umbrella', 'horseshoe'];
export class HandModal extends PModal {
    constructor(g, p) {
        super();
        this.g = g;
        this.p = p;
        this.sel = 0;
        this.items = [];
        for (const id of p.cards)
            this.items.push({ kind: 'card', id, usable: !PASSIVE.includes(id) && !(id === 'return' && !p.lastBuyStation) && !((id === 'rowan' || id === 'tea') && g.boggart.holder !== p.id) });
        for (const id of p.heroes) {
            const hd = HERO_BY_ID[id];
            this.items.push({ kind: 'hero', id, usable: hd.power !== 'none' && p.heroUsedYear[id] !== g.year });
        }
        this.buttons.push(new Button({ x: 400, y: 614, w: 220, h: 64, label: lbl(UI.use), sub: sub(UI.use), color: C.red, onClick: () => this.use() }));
        this.buttons.push(new Button({ x: 660, y: 614, w: 220, h: 64, label: lbl(UI.back), sub: sub(UI.back), color: '#7a6a55', onClick: () => this.resolveWith(null) }));
        this.onBack = () => this.resolveWith(null);
        this.focus = 0;
        this.refresh();
    }
    refresh() { const it = this.items[this.sel]; this.buttons[0].enabled = !!it && it.usable; }
    use() { const it = this.items[this.sel]; if (it && it.usable)
        this.resolveWith({ type: it.kind, id: it.id }); }
    layout() {
        const n = this.items.length;
        const perRow = n <= 6 ? Math.max(1, n) : Math.ceil(n / 2);
        const rows = Math.ceil(n / perRow);
        const ch = rows > 1 ? 178 : 230, cw = Math.round(ch * 0.7), gap = 16;
        const top = rows > 1 ? 96 : 120;
        return this.items.map((_, i) => {
            const r = Math.floor(i / perRow), c = i % perRow, inRow = Math.min(perRow, n - r * perRow);
            const total = inRow * cw + (inRow - 1) * gap;
            return { x: 640 - total / 2 + c * (cw + gap), y: top + r * (ch + 22), w: cw, h: ch };
        });
    }
    pointerUp(x, y, wasDrag) {
        const L = this.layout();
        for (let i = 0; i < L.length; i++) {
            const r = L[i];
            if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                if (this.sel === i)
                    this.use();
                else {
                    this.sel = i;
                    audio.play('card');
                    this.refresh();
                }
                return true;
            }
        }
        return super.pointerUp(x, y, wasDrag);
    }
    key(a) {
        if (a === 'left' || a === 'right') {
            this.sel = Math.max(0, Math.min(this.items.length - 1, this.sel + (a === 'left' ? -1 : 1)));
            audio.play('hover');
            this.refresh();
            return true;
        }
        if (a === 'confirm') {
            this.use();
            return true;
        }
        return super.key(a);
    }
    autoValue() { return null; }
    drawBody(ctx) {
        panel(ctx, 60, 24, 1160, 676, { fill: '#f3ead2' });
        text(ctx, lbl(t2('Your cards', 'カード')), 640, 62, { size: 32, align: 'center', color: C.green });
        if (!this.items.length) {
            dual(ctx, t2('No cards yet. Land on yellow squares or visit a Card Shop!', 'カードがないよ。黄色いマスやカード屋さんで手に入れよう！'), 640, 280, 26, 800, 'center');
            return;
        }
        const L = this.layout();
        this.items.forEach((it, i) => {
            const r = L[i];
            const lift = i === this.sel ? -10 : 0;
            if (it.kind === 'card')
                drawCard(ctx, CARD_BY_ID[it.id], r.x, r.y + lift, r.w, r.h, i === this.sel, !it.usable);
            else
                drawHeroCard(ctx, it.id, r.x, r.y + lift, r.w, r.h, i === this.sel, !it.usable, this.p.heroUsedYear[it.id] === this.g.year);
        });
        const it = this.items[this.sel];
        if (it) {
            const desc = it.kind === 'card' ? CARD_BY_ID[it.id].desc : (HERO_BY_ID[it.id].powerDesc ?? t2('This hero has no power yet, but is in your Hall of Heroes.', 'このヒーローのパワーはまだないよ。ヒーローの殿堂に記録されたよ。'));
            const note = it.kind === 'card' && PASSIVE.includes(it.id) ? t2('Keep this card: it works by itself.', '持っているだけで効果があるよ。')
                : it.kind === 'hero' && this.p.heroUsedYear[it.id] === this.g.year ? t2('Used this year. It recharges in April.', '今年は使用ずみ。4月に復活するよ。')
                    : (it.id === 'rowan' || it.id === 'tea') && !it.usable ? t2('Use this when the Boggart is on your train.', 'ボガートがついているときに使おう。') : null;
            const top = L[L.length - 1].y + L[L.length - 1].h + 18;
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            roundRect(ctx, 200, top, 880, 602 - top, 14);
            ctx.fill();
            const yEnd = dual(ctx, desc, 640, top + 10, 22, 840, 'center');
            if (note)
                text(ctx, lbl(note), 640, Math.min(yEnd + 14, 590), { size: 18, align: 'center', color: C.red });
        }
    }
}
export class ShopModal extends PModal {
    constructor(g, p, stationId) {
        super();
        this.g = g;
        this.p = p;
        this.stationId = stationId;
        this.cart = new Set();
        this.train = null;
        this.x = 120;
        this.y = 24;
        this.w = 1040;
        this.h = 672;
        this.rows = [];
        this.trainBtn = null;
        this.rowH = 82;
        this.rowTop = 0;
        const st = STATION_BY_ID[stationId];
        const hasTrain = st.trainShop && p.train < TRAINS.length - 1;
        const n = st.props.length + (hasTrain ? 1 : 0);
        this.rowTop = this.y + 100;
        this.rowH = Math.min(84, Math.floor((this.h - 100 - 150) / n));
        st.props.forEach((pr, i) => {
            const owner = g.owners[pr.id];
            const b = new Button({ x: this.x + this.w - 196, y: this.rowTop + i * this.rowH + (this.rowH - 58) / 2, w: 160, h: 58, label: owner ? (owner === p.id ? '✓' : '—') : lbl(UI.buy), sub: owner ? undefined : sub(UI.buy), color: '#d7263d', size: 24, enabled: !owner, onClick: () => this.toggle(pr.id) });
            this.rows.push({ id: pr.id, btn: b });
            this.buttons.push(b);
        });
        if (hasTrain) {
            const next = TRAINS[p.train + 1];
            this.trainBtn = new Button({ x: this.x + this.w - 196, y: this.rowTop + st.props.length * this.rowH + (this.rowH - 58) / 2, w: 160, h: 58, label: lbl(UI.buy), sub: sub(UI.buy), color: '#1e5aa8', size: 24, onClick: () => this.toggleTrain(p.train + 1, next.price) });
            this.buttons.push(this.trainBtn);
        }
        this.buttons.push(new Button({ x: 640 - 130, y: this.y + this.h - 84, w: 260, h: 64, label: lbl(UI.done), sub: sub(UI.done), color: C.green, onClick: () => this.resolveWith({ props: [...this.cart], train: this.train }) }));
        this.onBack = () => this.resolveWith({ props: [...this.cart], train: this.train });
        // keyboard focus starts on the first thing you can actually buy, or on Done
        this.refresh();
        const first = this.buttons.findIndex((b) => b.enabled && b.color !== '#8d8a82');
        this.focus = first >= 0 ? first : 0;
    }
    remaining() {
        let c = this.p.cash;
        for (const id of this.cart)
            c -= priceOf(this.g, STATION_BY_ID[this.stationId].props.find((x) => x.id === id));
        if (this.train !== null)
            c -= TRAINS[this.train].price;
        return c;
    }
    toggle(id) {
        if (this.cart.has(id))
            this.cart.delete(id);
        else {
            const pr = STATION_BY_ID[this.stationId].props.find((x) => x.id === id);
            if (this.remaining() < priceOf(this.g, pr)) {
                fx.shake(6);
                audio.play('quizWrong');
                return;
            }
            this.cart.add(id);
            audio.play('buy');
        }
        this.refresh();
    }
    toggleTrain(idx, price) {
        if (this.train !== null)
            this.train = null;
        else {
            if (this.remaining() < price) {
                fx.shake(6);
                return;
            }
            this.train = idx;
            audio.play('buy');
        }
        this.refresh();
    }
    refresh() {
        for (const r of this.rows) {
            if (this.g.owners[r.id])
                continue;
            const on = this.cart.has(r.id);
            r.btn.label = on ? '✓ ' + lbl(t2('Bought', '買った')) : lbl(UI.buy);
            r.btn.sub = on ? undefined : sub(UI.buy);
            const cant = !on && this.remaining() < priceOf(this.g, STATION_BY_ID[this.stationId].props.find((x) => x.id === r.id));
            r.btn.color = on ? '#2e9b46' : cant ? '#8d8a82' : '#d7263d';
        }
        if (this.trainBtn) {
            const on = this.train !== null;
            this.trainBtn.label = on ? '✓' : lbl(UI.buy);
            this.trainBtn.sub = on ? undefined : sub(UI.buy);
            this.trainBtn.color = on ? '#2e9b46' : this.remaining() < TRAINS[this.p.train + 1].price ? '#8d8a82' : '#1e5aa8';
        }
    }
    autoValue() { return { props: [], train: null }; }
    drawBody(ctx) {
        const st = STATION_BY_ID[this.stationId];
        const { x, y, w, h } = this;
        const col = REGIONS[st.region].color;
        panel(ctx, x, y, w, h);
        ctx.fillStyle = col;
        roundRect(ctx, x + 5, y + 5, w - 10, 80, 13);
        ctx.fill();
        emoji(ctx, st.emoji, x + 58, y + 45, 50);
        const nl = lines(st.name);
        text(ctx, nl.main, x + 100, y + 36, { size: 32, color: '#fff', outline: 6, outlineColor: shade(col, -0.45), maxWidth: 520 });
        text(ctx, (nl.sub ? nl.sub + '  ·  ' : '') + lbl(t2('Station shop', '駅の物件')), x + 100, y + 68, { size: 17, color: '#fff', weight: 500, maxWidth: 520 });
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        roundRect(ctx, x + w - 300, y + 18, 276, 54, 12);
        ctx.fill();
        text(ctx, lbl(UI.cash), x + w - 286, y + 45, { size: 18, color: '#fff' });
        text(ctx, money(this.remaining()), x + w - 36, y + 45, { size: 30, color: this.remaining() < 0 ? '#ffb0b0' : C.gold, align: 'right' });
        const mono = monopolyOwner(this.g, st.id);
        const rh = this.rowH;
        st.props.forEach((pr, i) => {
            const ry = this.rowTop + i * rh;
            ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.6)';
            roundRect(ctx, x + 24, ry + 3, w - 48, rh - 6, 10);
            ctx.fill();
            emoji(ctx, CAT_EMOJI[pr.cat], x + 62, ry + rh / 2, 34);
            const pl = lines(pr.name);
            text(ctx, pl.main, x + 100, ry + rh / 2 - (pl.sub ? 11 : 0), { size: 24, maxWidth: 440 });
            if (pl.sub)
                text(ctx, pl.sub, x + 100, ry + rh / 2 + 16, { size: 15, weight: 500, color: '#5a5a50', maxWidth: 440 });
            text(ctx, money(priceOf(this.g, pr)), x + 690, ry + rh / 2 - 10, { size: 26, align: 'right' });
            text(ctx, `${lbl(t2('earns', '利益'))} ${Math.round(pr.ret * 100)}%`, x + 690, ry + rh / 2 + 16, { size: 15, align: 'right', weight: 500, color: '#2e7d32' });
            const owner = this.g.owners[pr.id];
            if (owner) {
                const op = this.g.players.find((q) => q.id === owner);
                ctx.fillStyle = C.players[op.color];
                ctx.beginPath();
                ctx.arc(x + 750, ry + rh / 2, 20, 0, 7);
                ctx.fill();
                emoji(ctx, AVATARS[op.avatar].emoji, x + 750, ry + rh / 2, 26);
            }
        });
        if (this.trainBtn) {
            const next = TRAINS[this.p.train + 1];
            const ry = this.rowTop + st.props.length * rh;
            ctx.fillStyle = 'rgba(30,90,168,0.12)';
            roundRect(ctx, x + 24, ry + 3, w - 48, rh - 6, 10);
            ctx.fill();
            emoji(ctx, '🚂', x + 62, ry + rh / 2, 34);
            text(ctx, `${lbl(t2('New train', '新しい列車'))}: ${lines(next.name).main} (🎲×${next.dice})`, x + 100, ry + rh / 2 - 11, { size: 22, maxWidth: 480 });
            text(ctx, lines(next.fact).main, x + 100, ry + rh / 2 + 16, { size: 15, weight: 500, color: '#5a5a50', maxWidth: 480 });
            text(ctx, money(next.price), x + 690, ry + rh / 2, { size: 26, align: 'right' });
        }
        const tip = mono
            ? `👑 ${lbl(t2('Monopoly', '独占'))}: ${lines(this.g.players.find((q) => q.id === mono).name).main}`
            : '👑 ' + lbl(t2('Buy everything here for a Monopoly: profits double!', 'ぜんぶ買うと独占！利益が2倍！'));
        text(ctx, tip, 640, y + h - 104, { size: 18, color: '#7a5a10', align: 'center', maxWidth: 900 });
    }
}
// ---------- Card shop ----------
export class CardShopModal extends PModal {
    constructor(g, p, stock) {
        super();
        this.g = g;
        this.p = p;
        this.stock = stock;
        this.cart = [];
        stock.forEach((id, i) => this.buttons.push(new Button({ x: this.cardX(i) + 5, y: 480, w: 170, h: 58, label: money(CARD_BY_ID[id].price), color: '#d7263d', size: 24, onClick: () => this.toggle(i) })));
        this.buttons.push(new Button({ x: 640 - 130, y: 596, w: 260, h: 64, label: lbl(UI.done), sub: sub(UI.done), onClick: () => this.resolveWith(this.cart) }));
        this.onBack = () => this.resolveWith(this.cart);
        this.focus = 0;
    }
    cardX(i) { return 640 - (this.stock.length * 210) / 2 + i * 210 + 10; }
    cash() { return this.p.cash - this.cart.reduce((a, id) => a + CARD_BY_ID[id].price, 0); }
    toggle(i) {
        const id = this.stock[i];
        const k = this.cart.indexOf(id);
        if (k >= 0) {
            this.cart.splice(k, 1);
            this.buttons[i].label = money(CARD_BY_ID[id].price);
            this.buttons[i].color = '#d7263d';
            return;
        }
        if (this.cash() < CARD_BY_ID[id].price || this.p.cards.length + this.cart.length >= 8) {
            fx.shake(6);
            audio.play('quizWrong');
            return;
        }
        this.cart.push(id);
        audio.play('buy');
        this.buttons[i].label = '✓';
        this.buttons[i].color = '#2e9b46';
    }
    autoValue() { return []; }
    drawBody(ctx) {
        panel(ctx, 140, 40, 1000, 640);
        header(ctx, t2('Card Shop', 'カード売り場'), 140, 40, 1000, '#17a2a2');
        text(ctx, `${lbl(UI.cash)} ${money(this.cash())}`, 1110, 81, { size: 22, align: 'right', color: '#fff', outline: 4, outlineColor: '#0b5a5a' });
        this.stock.forEach((id, i) => drawCard(ctx, CARD_BY_ID[id], this.cardX(i), 140, 180, 320, this.cart.includes(id)));
    }
}
// ---------- Settlement ----------
export class SettlementModal extends PModal {
    constructor(g, lines_) {
        super();
        this.g = g;
        this.lines_ = lines_;
        this.t = 0;
        this.buttons.push(new Button({ x: 640 - 130, y: 616, w: 260, h: 64, label: lbl(UI.next), sub: sub(UI.next), onClick: () => this.resolveWith(true) }));
        this.focus = 0;
        clock.tween(this, { t: 1 }, 1800, Ease.outCubic);
        audio.play('fanfare');
    }
    autoValue() { return true; }
    drawBody(ctx) {
        panel(ctx, 110, 24, 1060, 676, { fill: '#f3ead2' });
        header(ctx, t2(`End of Year ${this.g.year}: payday!`, `${this.g.year}年目の決算：利益の日！`), 110, 24, 1060, C.green);
        text(ctx, lbl(t2('Every March, each property you own pays you money.', '毎年3月、持っている物件がお金をくれるよ。')), 640, 124, { size: 20, align: 'center', color: '#5a5a50', weight: 500 });
        const rank = this.g.players.slice().sort((a, b) => assets(this.g, b) - assets(this.g, a));
        const maxA = Math.max(1, ...rank.map((p) => Math.max(1, assets(this.g, p))));
        rank.forEach((p, i) => {
            const L = this.lines_.find((l) => l.player.id === p.id);
            const y = 152 + i * 108;
            ctx.fillStyle = i === 0 ? 'rgba(255,201,60,0.3)' : 'rgba(255,255,255,0.55)';
            roundRect(ctx, 150, y, 980, 96, 12);
            ctx.fill();
            text(ctx, `${i + 1}`, 184, y + 48, { size: 40, align: 'center', color: i === 0 ? '#c99a1a' : '#777', outline: 4, outlineColor: '#fff' });
            ctx.fillStyle = C.players[p.color];
            ctx.beginPath();
            ctx.arc(250, y + 48, 32, 0, 7);
            ctx.fill();
            emoji(ctx, AVATARS[p.avatar].emoji, 250, y + 48, 40);
            text(ctx, lines(p.name).main + lines(UI.railway).main, 300, y + 30, { size: 24, maxWidth: 250 });
            text(ctx, `+${money(L.income * this.t)}`, 300, y + 66, { size: 24, color: '#2e7d32' });
            if (L.monopolies)
                text(ctx, `👑×${L.monopolies}`, 470, y + 66, { size: 20, color: '#8a6a10' });
            const a = assets(this.g, p);
            const bw = 380 * Math.max(0, a) / maxA * this.t;
            ctx.fillStyle = C.players[p.color];
            roundRect(ctx, 580, y + 30, Math.max(8, bw), 36, 8);
            ctx.fill();
            text(ctx, money(a * this.t), 592 + Math.max(8, bw), y + 48, { size: 22 });
            if (L.sold.length)
                text(ctx, lbl(t2('Sold property to pay debts', '借金のため物件を売却')), 580, y + 84, { size: 14, color: C.red, weight: 500 });
        });
    }
}
// ---------- Destination roulette ----------
export class RouletteModal extends PModal {
    constructor(target, title = t2('Next destination!', '次の目的地は…')) {
        super();
        this.target = target;
        this.title = title;
        this.idx = 0;
        this.spinT = 0;
        this.stopped = false;
        this.names = STATIONS.map((s) => s.id);
        this.buttons.push(new Button({ x: 640 - 140, y: 532, w: 280, h: 66, label: lbl(t2("Let's go!", '出発！')), sub: lines(t2("Let's go!", '出発！')).sub ?? undefined, hidden: true, onClick: () => this.resolveWith(true) }));
        this.focus = 0;
    }
    autoValue() { return this.stopped ? true : undefined; }
    update(dt) {
        super.update(dt);
        if (this.stopped)
            return;
        this.spinT += dt * Math.min(clock.timeScale, 4);
        const total = 2200;
        const period = 60 + 340 * Math.pow(Math.min(1, this.spinT / total), 2);
        const prev = this.idx;
        this.idx = Math.floor(this.spinT / period) % this.names.length;
        if (prev !== this.idx)
            audio.play('roulette');
        if (this.spinT >= total) {
            this.stopped = true;
            this.buttons[0].hidden = false;
            audio.play('whistle');
            fx.burst(640, 330, 'star', 30, { color: C.gold, speed: 8 });
        }
    }
    drawBody(ctx) {
        panel(ctx, 290, 110, 700, 510);
        header(ctx, this.title, 290, 110, 700, C.green);
        const id = this.stopped ? this.target : this.names[(this.idx * 7) % this.names.length];
        const st = STATION_BY_ID[id];
        const col = REGIONS[st.region].color;
        ctx.fillStyle = col;
        roundRect(ctx, 360, 210, 560, 300, 20);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        roundRect(ctx, 370, 220, 540, 120, 16);
        ctx.fill();
        emoji(ctx, st.emoji, 640, 285, 84);
        const nl = lines(st.name);
        text(ctx, nl.main, 640, 384, { size: 48, color: '#fff', align: 'center', outline: 8, outlineColor: shade(col, -0.5), maxWidth: 520 });
        if (nl.sub)
            text(ctx, nl.sub, 640, 428, { size: 22, color: '#fff', align: 'center', weight: 500 });
        text(ctx, lines(REGIONS[st.region].name).main, 640, 476, { size: 20, align: 'center', color: '#fff', weight: 500 });
    }
}
// ---------- Calendar page (start of every month) ----------
/** A little tear-off calendar tile: month on red, the day number big. Used as the picture for special days. */
export function drawCalendarTile(ctx, x, y, monthIdx, day, icon) {
    const w = 150, h = 160;
    ctx.save();
    ctx.translate(x - w / 2, y - h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, 4, 8, w, h, 16);
    ctx.fill();
    ctx.fillStyle = '#20170a';
    roundRect(ctx, -3, -3, w + 6, h + 6, 18);
    ctx.fill();
    ctx.fillStyle = '#fffdf6';
    roundRect(ctx, 0, 0, w, h, 16);
    ctx.fill();
    ctx.fillStyle = C.red;
    roundRect(ctx, 0, 0, w, 44, 16);
    ctx.fill();
    ctx.fillRect(0, 26, w, 18);
    text(ctx, MONTH_NAMES[monthIdx].en.toUpperCase(), w / 2, 24, { size: 22, color: '#fff', align: 'center', maxWidth: w - 16 });
    if (day)
        text(ctx, String(day), w / 2, 100, { size: 72, color: '#1d1d1b', align: 'center' });
    else
        emoji(ctx, icon, w / 2, 100, 64);
    ctx.fillStyle = '#20170a';
    for (const rx of [34, w - 34]) {
        ctx.beginPath();
        ctx.arc(rx, 4, 5, 0, 7);
        ctx.fill();
    }
    if (day)
        emoji(ctx, icon, w - 22, h - 22, 30);
    ctx.restore();
}
export class CalendarModal extends PModal {
    constructor(g, ev) {
        super();
        this.g = g;
        this.t = 0;
        this.marks = [];
        this.others = [];
        const r = realMonth(g.year, g.month);
        this.y0 = r.y;
        this.m0 = r.m;
        this.days = daysInMonth(r.y, r.m);
        this.first = firstWeekday(r.y, r.m);
        const d = eventDate(ev, g.year);
        if (d && d.getMonth() === r.m)
            this.marks.push({ day: d.getDate(), ev });
        else
            this.others.push(ev);
        this.buttons.push(new Button({ x: 640 - 130, y: 612, w: 260, h: 62, label: lbl(UI.next) + ' ▶', sub: sub(UI.next), color: C.green, onClick: () => this.resolveWith(true) }));
        this.onBack = () => this.resolveWith(true);
        this.focus = 0;
        clock.tween(this, { t: 1 }, 700, Ease.outCubic);
        audio.play('card');
    }
    autoValue() { return true; }
    drawBody(ctx) {
        const x = 150, y = 34, w = 980, h = 660;
        ctx.save();
        ctx.translate(0, (1 - this.t) * -60);
        panel(ctx, x, y, w, h, { fill: '#fffdf6' });
        ctx.fillStyle = C.red;
        roundRect(ctx, x + 5, y + 5, w - 10, 92, 13);
        ctx.fill();
        const mn = MONTH_NAMES[this.m0];
        text(ctx, `${mn.en} ${this.y0}`, x + 40, y + 52, { size: 48, color: '#fff', outline: 7, outlineColor: '#8a1020' });
        const season = SEASONS[this.g.month];
        if (lang.mode !== 'en')
            text(ctx, `${this.y0}年${mn.ja}・${season.ja}`, x + w - 40, y + 38, { size: 26, color: '#fff', align: 'right' });
        else
            text(ctx, season.en, x + w - 40, y + 38, { size: 26, color: '#fff', align: 'right' });
        text(ctx, lines(t2(`Year ${this.g.year} of ${this.g.settings.years}`, `${this.g.year}年目（全${this.g.settings.years}年）`)).main, x + w - 40, y + 74, { size: 18, color: '#ffe0e0', align: 'right', weight: 500 });
        // month grid
        const gx = x + 30, gy = y + 116, cw = 68, rowH = 74;
        WEEKDAYS.forEach((d, i) => text(ctx, d.en.slice(0, 3), gx + i * cw + cw / 2, gy + 10, { size: 18, align: 'center', color: i === 0 ? C.red : '#555' }));
        for (let d = 1; d <= this.days; d++) {
            const idx = this.first + d - 1, r = Math.floor(idx / 7), c = idx % 7;
            const cx = gx + c * cw + cw / 2, cy = gy + 52 + r * rowH;
            const mark = this.marks.find((m) => m.day === d);
            if (mark) {
                ctx.fillStyle = C.gold;
                ctx.beginPath();
                ctx.arc(cx, cy, 27, 0, 7);
                ctx.fill();
                ctx.strokeStyle = C.red;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(cx, cy, 27, 0, 7);
                ctx.stroke();
            }
            text(ctx, String(d), cx, cy + 1, { size: 24, align: 'center', color: c === 0 ? C.red : '#1d1d1b' });
            if (mark)
                emoji(ctx, mark.ev.emoji, cx + 22, cy - 22, 22);
        }
        // special days list
        const lx = x + 530, lw = w - 570;
        text(ctx, lbl(t2('This month', '今月のとくべつな日')), lx, gy + 10, { size: 22, color: C.green });
        let ly = gy + 38;
        const row = (ev, dateStr, bg, fg) => {
            ctx.fillStyle = bg;
            roundRect(ctx, lx - 8, ly - 4, lw + 16, 100, 12);
            ctx.fill();
            emoji(ctx, ev.emoji, lx + 26, ly + 46, 42);
            text(ctx, dateStr, lx + 60, ly + 18, { size: 18, color: fg, maxWidth: lw - 64 });
            const tl = lines(ev.title);
            text(ctx, tl.main, lx + 60, ly + 48, { size: 25, maxWidth: lw - 64 });
            if (tl.sub)
                text(ctx, tl.sub, lx + 60, ly + 76, { size: 16, weight: 500, color: '#5a5a50', maxWidth: lw - 64 });
            ly += 110;
        };
        for (const m of this.marks) {
            const d = new Date(this.y0, this.m0, m.day);
            row(m.ev, lines(dateText(d)).main, 'rgba(255,201,60,0.28)', C.red);
        }
        for (const ev of this.others)
            row(ev, ev.label ? lines(ev.label).main : '', 'rgba(255,201,60,0.28)', C.red);
        ctx.restore();
    }
}
// ---------- Dice overlay ----------
export class DiceOverlay {
    constructor(final, extra = 0) {
        this.final = final;
        this.extra = extra;
        this.done = false;
        this.t = 0;
        this.settled = false;
        this.vals = final.map(() => 1);
        this.promise = new Promise((r) => (this.resolve = r));
        audio.play('dice');
    }
    update(dt) {
        const sdt = dt * clock.timeScale;
        this.t += sdt;
        if (this.t < 900) {
            if (Math.floor(this.t / 70) !== Math.floor((this.t - sdt) / 70))
                this.vals = this.vals.map(() => 1 + Math.floor(Math.random() * 6));
        }
        else if (!this.settled) {
            this.settled = true;
            this.vals = this.final.slice();
            fx.shake(6);
        }
        if (this.t > 1700 && !this.done) {
            this.done = true;
            this.resolve();
        }
    }
    draw(ctx) {
        const n = this.vals.length, size = 96, gap = 24;
        const total = n * size + (n - 1) * gap;
        const fade = this.t > 1450 ? 1 - (this.t - 1450) / 250 : 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        this.vals.forEach((v, i) => {
            const x = 640 - total / 2 + i * (size + gap);
            const jump = this.settled ? 0 : Math.abs(Math.sin(this.t / 90 + i)) * 40;
            const rot = this.settled ? 0 : Math.sin(this.t / 60 + i * 2) * 0.5;
            ctx.save();
            ctx.translate(x + size / 2, 330 - jump);
            ctx.rotate(rot);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            roundRect(ctx, -size / 2 + 4, -size / 2 + 8, size, size, 18);
            ctx.fill();
            ctx.fillStyle = '#1d1d1b';
            roundRect(ctx, -size / 2 - 3, -size / 2 - 3, size + 6, size + 6, 20);
            ctx.fill();
            ctx.fillStyle = '#fff';
            roundRect(ctx, -size / 2, -size / 2, size, size, 18);
            ctx.fill();
            ctx.fillStyle = v === 1 ? C.red : '#1d1d1b';
            const pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
            for (const [px, py] of pips[v]) {
                ctx.beginPath();
                ctx.arc(px * 24, py * 24, v === 1 ? 14 : 9, 0, 7);
                ctx.fill();
            }
            ctx.restore();
        });
        if (this.settled) {
            const sum = this.final.reduce((a, b) => a + b, 0) + this.extra;
            text(ctx, this.extra ? `${sum} (+${this.extra})` : `${sum}`, 640, 450, { size: 72, color: C.gold, align: 'center', outline: 10 });
        }
        ctx.restore();
    }
}
export function rollDice(vals, extra = 0) {
    const d = new DiceOverlay(vals, extra);
    app.overlays.push(d);
    return d.promise;
}
// ---------- Banner (turn start) ----------
export class Banner {
    constructor(t2_, color, icon, dur = 1300) {
        this.t2_ = t2_;
        this.color = color;
        this.icon = icon;
        this.dur = dur;
        this.done = false;
        this.t = 0;
    }
    update(dt) { this.t += dt * clock.timeScale; if (this.t > this.dur)
        this.done = true; }
    draw(ctx) {
        const k = this.t < 250 ? Ease.outBack(this.t / 250) : this.t > this.dur - 250 ? 1 - Ease.inOutQuad((this.t - (this.dur - 250)) / 250) : 1;
        ctx.save();
        ctx.translate(-1280 + 1280 * k, 0);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 312, 1280, 120);
        ctx.fillStyle = this.color;
        ctx.fillRect(0, 302, 1280, 112);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(0, 302, 1280, 8);
        emoji(ctx, this.icon, 250, 358, 76);
        const l = lines(this.t2_);
        text(ctx, l.main, 660, l.sub ? 344 : 358, { size: 50, color: '#fff', align: 'center', outline: 9, outlineColor: shade(this.color, -0.45), maxWidth: 760 });
        if (l.sub)
            text(ctx, l.sub, 660, 390, { size: 22, color: '#fff', align: 'center', weight: 500, maxWidth: 760 });
        ctx.restore();
    }
}
export function banner(t, color, icon, dur = 1300) {
    app.overlays.push(new Banner(t, color, icon, dur));
    return clock.wait(dur);
}
export { STYLES, FONT };
//# sourceMappingURL=dialogs.js.map