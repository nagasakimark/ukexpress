// In-game dialogs, drawn on the canvas: messages (paged so text never overflows), choices, quizzes,
// shops, the card hand, settlement, the roulette, the calendar page, dice, banners and toasts.
import { Modal, Button } from '../engine/ui.js';
import { C, FONT, panel, text, wrap, fitWrap, emoji, money, roundRect, shade, zoomBadge } from '../engine/draw.js';
import { clock, Ease } from '../engine/tween.js';
import { audio } from '../engine/audio.js';
import { fx } from '../engine/fx.js';
import { lines, lang, UI, t2, payoutT } from './i18n.js';
import { app } from './app.js';
import { CARD_BY_ID, TRAINS, REGIONS, AVATARS, STYLES, SEASONS } from '../core/content/game-data.js';
import { STATION_BY_ID, STATIONS } from '../core/content/stations.js';
import { HERO_BY_ID } from '../core/content/heroes.js';
import { priceOf, assets, monopolyOwner, payoutYear } from '../core/rules.js';
import { realMonth, daysInMonth, firstWeekday, eventDate, dateText, MONTH_NAMES, WEEKDAYS } from '../core/calendar.js';
import { drawPortrait } from './mapart.js';
import { drawPic, drawPicWhole, drawPhotoCircle, PhotoBrowser } from './images.js';
import { LAY } from './layout.js';
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
/** A "2 / 5" pill over a photo, so players can see there is more to browse. */
export function photoCounter(ctx, cx, cy, pos, total) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, cx - 52, cy - 17, 104, 34, 17);
    ctx.fill();
    text(ctx, `${pos} / ${total}`, cx, cy + 1, { size: 20, color: '#fff', align: 'center' });
}
/** The picture, full screen, so students can look closely (tap any photo's 🔍 to get here). */
export class ImageViewer extends PModal {
    constructor(pic, caption, photos) {
        super();
        this.pic = pic;
        this.caption = caption;
        this.photos = photos;
        this.dim = 0.8;
        this.buttons.push(new Button({ x: 640 - 130, y: 640, w: 260, h: 62, label: lbl(UI.back), sub: sub(UI.back), color: '#7a6a55', onClick: () => this.resolveWith(undefined) }));
        this.prevBtn = new Button({ x: 52, y: 324, w: 60, h: 52, label: '◀', size: 24, color: '#3a5a8a', onClick: () => this.photos?.step(-1) });
        this.nextBtn = new Button({ x: 1168, y: 324, w: 60, h: 52, label: '▶', size: 24, color: '#3a5a8a', onClick: () => this.photos?.step(1) });
        this.buttons.push(this.prevBtn, this.nextBtn);
        this.onBack = () => this.resolveWith(undefined);
        this.focus = 0;
    }
    drawBody(ctx) {
        ctx.fillStyle = '#11151a';
        ctx.fillRect(LAY.vl, 0, LAY.vr - LAY.vl, 720);
        const multi = (this.photos?.count() ?? 0) > 1;
        this.prevBtn.hidden = this.nextBtn.hidden = !multi;
        if (!multi && this.focus > 0)
            this.focus = 0;
        drawPicWhole(ctx, this.pic.kind, this.photos ? this.photos.name() : this.pic.name, 40, 76, 1200, 548, { emoji: this.pic.emoji, label: this.pic.label, color: this.pic.color });
        if (multi)
            photoCounter(ctx, 640, 598, this.photos.index() + 1, this.photos.count());
        text(ctx, lbl(this.caption), 640, 40, { size: 30, color: '#fff', align: 'center', maxWidth: 1100 });
    }
}
const BODY_SIZE = 22;
const MAX_BODY_H = 150;
const BIG_BODY_SIZE = 26;
const BIG_MAX_BODY_H = 380;
/**
 * The message box. Normally a see-through bar at the bottom of the map (one tap carries on, like the
 * Momotetsu text window); tutorial pages with pictures (pageArt) use a large centred panel.
 */
export class MessageModal extends PModal {
    constructor(o) {
        super();
        this.o = o;
        this.w = 872;
        this.h = 200;
        this.x = 24;
        this.y = 0;
        this.pages = [];
        this.page = 0;
        this.size = BODY_SIZE;
        /** Where the photo was drawn (for tap-to-enlarge); null when there is no photo. */
        this.photoRect = null;
        this.big = !!o.pageArt;
        const ctx = app.screen.ctx;
        const maxH = this.big ? BIG_MAX_BODY_H : MAX_BODY_H;
        this.size = this.big ? BIG_BODY_SIZE : BODY_SIZE;
        if (this.big)
            this.w = 860;
        const tw = this.textW();
        const body = o.body ?? [];
        const pageH = (pg) => pg.reduce((a, b) => a + dualHeight(ctx, b, this.size, tw) + 8, 0);
        if (o.pageArt)
            this.pages = body.map((b) => [b]);
        else {
            let cur = [];
            for (const b of body) {
                if (cur.length && pageH([...cur, b]) > maxH) {
                    this.pages.push(cur);
                    cur = [];
                }
                cur.push(b);
            }
            this.pages.push(cur);
            while (this.size > 16 && this.pages.some((pg) => pageH(pg) > maxH))
                this.size -= 1;
        }
        if (!this.pages.length)
            this.pages = [[]];
        let mh = 0;
        for (const pg of this.pages)
            mh = Math.max(mh, pageH(pg));
        if (this.big) {
            this.h = Math.min(640, Math.max(250, 96 + Math.max(mh, this.hasArt() ? (this.o.photo ? 260 : 220) : 0) + 116));
            this.x = 640 - this.w / 2;
            this.y = 360 - this.h / 2;
        }
        else {
            this.dim = 0;
            this.h = Math.max(this.hasArt() ? (this.o.photo ? 150 : 132) : 112, 50 + mh + (this.multi() ? 66 : 14));
            this.y = LAY.mapBot - 12 - this.h;
        }
        this.buildButtons();
        if (o.confetti)
            setTimeout(() => fx.burst(this.x + this.w / 2, 200, 'confetti', 60, { speed: 9, up: 6 }), 120);
    }
    multi() { return (this.o.buttons?.length ?? 0) > 1; }
    hasArt() { return !!(this.o.portrait || this.o.icon || this.o.iconDraw || this.o.pageArt || this.o.photo); }
    textW() { return this.w - (this.big ? 80 : 56) - (this.hasArt() ? (this.big ? 210 : 112) : 0) - (!this.big && this.o.money !== undefined ? 150 : 0); }
    lastPage() { return this.page >= this.pages.length - 1; }
    nextPage() { this.page++; audio.play('card'); this.buildButtons(); }
    buildButtons() {
        this.buttons = [];
        if (this.big) {
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
            return;
        }
        if (this.lastPage() && this.multi()) {
            const btns = this.o.buttons;
            const bw = Math.min(250, (this.w - 48) / btns.length - 14);
            const total = btns.length * bw + (btns.length - 1) * 14;
            btns.forEach((b, i) => this.buttons.push(new Button({ x: this.x + this.w - 24 - total + i * (bw + 14), y: this.y + this.h - 62, w: bw, h: 50, size: 20, label: lbl(b.label), sub: sub(b.label), color: b.color ?? C.green, onClick: () => this.resolveWith(b.value) })));
            this.onBack = null;
            this.focus = 0;
        }
        else {
            this.onBack = () => this.advance();
            this.focus = -1;
        }
    }
    advance() {
        if (!this.lastPage())
            this.nextPage();
        else if (!this.multi())
            this.resolveWith((this.o.buttons ?? [{ value: true }])[0].value);
    }
    autoValue() {
        if (!this.lastPage()) {
            this.nextPage();
            return undefined;
        }
        return (this.o.buttons ?? [{ value: true }])[0].value;
    }
    tapOutside() { if (this.big) {
        if (!this.lastPage())
            this.nextPage();
        else if ((this.o.buttons ?? []).length <= 1)
            this.resolveWith((this.o.buttons ?? [{ value: true }])[0].value);
    }
    else
        this.advance(); }
    pointerUp(x, y, wasDrag) {
        if (this.closing || wasDrag)
            return true;
        if (this.o.photo && this.photoRect) {
            const r = this.photoRect;
            if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                const ph = this.o.photo;
                app.show(new ImageViewer(ph, this.o.title, new PhotoBrowser(ph.kind, ph.name)));
                return true;
            }
        }
        for (const b of this.buttons)
            if (b.hit(x, y)) {
                b.click();
                return true;
            }
        if (!this.big)
            this.advance();
        return true;
    }
    draw(ctx) {
        if (this.big) {
            super.draw(ctx);
            return;
        }
        const a = Math.max(0, Math.min(1, this.appear));
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 1.6);
        ctx.translate(0, (1 - a) * 40);
        this.drawBody(ctx);
        for (let i = 0; i < this.buttons.length; i++)
            this.buttons[i].draw(ctx, i === this.focus && !!window.__kbd);
        ctx.restore();
    }
    drawBody(ctx) {
        const { x, y, w, h, o } = this;
        const col = o.color ?? C.green;
        if (this.big) {
            panel(ctx, x, y, w, h);
            header(ctx, o.title, x, y, w, col);
        }
        else {
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            roundRect(ctx, x + 3, y + 6, w, h, 20);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,250,238,0.93)';
            roundRect(ctx, x, y, w, h, 20);
            ctx.fill();
            ctx.strokeStyle = col;
            ctx.lineWidth = 5;
            roundRect(ctx, x + 2.5, y + 2.5, w - 5, h - 5, 18);
            ctx.stroke();
            const tl = lines(o.title);
            ctx.font = `800 20px ${FONT}`;
            const tw = Math.min(w - 120, ctx.measureText(tl.main).width + (tl.sub ? 0 : 0) + 36);
            ctx.fillStyle = col;
            roundRect(ctx, x + 18, y - 17, tw, 36, 18);
            ctx.fill();
            text(ctx, tl.main, x + 18 + tw / 2, y + 1, { size: 20, color: '#fff', align: 'center', maxWidth: tw - 20 });
        }
        let tx = x + (this.big ? 40 : 28);
        const areaTop = y + (this.big ? 82 : 26), areaBot = y + h - (this.big ? (this.pages.length > 1 ? 124 : 100) : (this.multi() && this.lastPage() ? 70 : 28));
        if (this.hasArt()) {
            const ax = this.big ? x + 120 : x + 62;
            const py = this.big ? (areaTop + areaBot) / 2 - (o.badge ? 12 : 0) : y + h / 2 + (this.multi() && this.lastPage() ? -22 : 0);
            const art = o.pageArt?.[this.page];
            this.photoRect = null;
            if (art)
                art(ctx, ax, py);
            else if (o.iconDraw) {
                // cards are drawn for the big window; in the small text box they are scaled down to sit inside it
                if (this.big)
                    o.iconDraw(ctx, ax, py);
                else {
                    const k = Math.min(0.8, (h - 34) / 128), cy = py + 6;
                    ctx.save();
                    ctx.translate(ax, cy);
                    ctx.scale(k, k);
                    o.iconDraw(ctx, 0, 0);
                    ctx.restore();
                }
            }
            else if (o.photo) {
                if (this.big)
                    this.drawPhoto(ctx, ax - 120, py);
                else {
                    const k = 0.6, cy = py + 6;
                    ctx.save();
                    ctx.translate(ax, cy);
                    ctx.scale(k, k);
                    this.drawPhoto(ctx, -120, 0);
                    ctx.restore();
                    const r = this.photoRect;
                    if (r)
                        this.photoRect = { x: ax + r.x * k, y: cy + r.y * k, w: r.w * k, h: r.h * k };
                }
            }
            else if (o.portrait)
                drawPortrait(ctx, o.portrait, ax, py, this.big ? 68 : 44, o.portraitRing);
            else
                emoji(ctx, o.icon, ax, py, this.big ? 96 : 62);
            if (o.badge)
                text(ctx, o.badge, ax, py + (this.big ? 92 : 50), { size: 14, align: 'center', color: '#5a5a50', maxWidth: this.big ? 190 : 100 });
            tx = x + (this.big ? 230 : 118);
        }
        const pg = this.pages[this.page] ?? [];
        const tw = this.textW();
        const gap = this.big ? 14 : 8;
        const contentH = pg.reduce((a, b) => a + dualHeight(ctx, b, this.size, tw) + gap, 0) - gap;
        let cy = areaTop + Math.max(6, (areaBot - areaTop - contentH) / 2);
        for (const b of pg)
            cy = dual(ctx, b, tx, cy, this.size, tw) + gap;
        if (o.money !== undefined && this.lastPage()) {
            const m = o.money;
            text(ctx, (m > 0 ? '+' : '') + money(m), this.big ? tx + tw / 2 : x + w - 88, this.big ? cy + 24 : y + h / 2 - 8, { size: this.big ? 48 : 36, color: m >= 0 ? '#c8921a' : C.red, align: 'center', outline: 7, outlineColor: m >= 0 ? '#fff6d0' : '#ffe0e0', maxWidth: 160 });
        }
        if (!this.big && !(this.multi() && this.lastPage())) {
            const bob = Math.sin(clock.realTime / 180) * 4;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(x + w - 40, y + h - 30 + bob);
            ctx.lineTo(x + w - 20, y + h - 30 + bob);
            ctx.lineTo(x + w - 30, y + h - 17 + bob);
            ctx.closePath();
            ctx.fill();
        }
        if (this.pages.length > 1) {
            for (let i = 0; i < this.pages.length; i++) {
                ctx.fillStyle = i === this.page ? col : '#cfc4a3';
                ctx.beginPath();
                ctx.arc(this.big ? 640 + (i - (this.pages.length - 1) / 2) * 22 : x + w - 70 - (this.pages.length - 1 - i) * 14, this.big ? y + h - 112 : y + h - 22, 5, 0, 7);
                ctx.fill();
            }
        }
    }
    /** The photo in the art slot (heroes as a circle, like their portraits). A 🔍 badge shows it can be tapped bigger. */
    drawPhoto(ctx, x, py) {
        const p = this.o.photo;
        if (p.kind === 'heroes') {
            const cx = x + 120;
            if (!drawPhotoCircle(ctx, p.kind, p.name, cx, py, 60, this.o.portraitRing))
                drawPortrait(ctx, p.emoji, cx, py, 68, this.o.portraitRing);
            this.photoRect = { x: cx - 62, y: py - 62, w: 124, h: 124 };
            // the badge sits outside the ring, bottom-right, so it never covers the face
            const bx = cx + 48, by = py + 48;
            zoomBadge(ctx, bx, by, 16);
        }
        else {
            drawPic(ctx, p.kind, p.name, x + 25, py - 70, 190, 140, { emoji: p.emoji, label: p.label, color: p.color });
            this.photoRect = { x: x + 25, y: py - 70, w: 190, h: 140 };
            const r = this.photoRect;
            zoomBadge(ctx, r.x + r.w - 22, r.y + 22, 16);
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
const KIND_COL = { move: '#3a7be8', warp: '#2aa198', money: '#e6a817', defence: '#6c7a89', attack: '#d7263d', boggart: '#7a5c99', learn: '#2e9b46', control: '#ef6c00' };
/** A card tile. All text is fitted to the card: names shrink, descriptions wrap and shrink.
 * Pass the game year and "£100 × year" descriptions show the actual amount. */
export function drawCard(ctx, c, x, y, w, h, selected = false, dim = false, year = 0) {
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
    const desc = year > 0 ? payoutT(c.desc, Math.min(year, 5)) : c.desc;
    const dm = fitWrap(ctx, lines(desc).main, iw, Math.max(1, Math.floor(room / 14)), 14, 10, 500);
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
    if (!drawPhotoCircle(ctx, 'heroes', hd.image, x + w / 2, y + 26 + pr, pr))
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
const PASSIVE = ['umbrella', 'horseshoe', 'wellies'];
export class HandModal extends PModal {
    constructor(g, p) {
        super();
        this.g = g;
        this.p = p;
        this.sel = 0;
        this.items = [];
        for (const id of p.cards)
            this.items.push({ kind: 'card', id, usable: !PASSIVE.includes(id) && !(id === 'return' && !p.lastBuyStation) });
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
                drawCard(ctx, CARD_BY_ID[it.id], r.x, r.y + lift, r.w, r.h, i === this.sel, !it.usable, this.g.year);
            else
                drawHeroCard(ctx, it.id, r.x, r.y + lift, r.w, r.h, i === this.sel, !it.usable, this.p.heroUsedYear[it.id] === this.g.year);
        });
        const it = this.items[this.sel];
        if (it) {
            const desc = it.kind === 'card' ? payoutT(CARD_BY_ID[it.id].desc, payoutYear(this.g)) : (HERO_BY_ID[it.id].powerDesc ?? t2('This hero has no power yet, but is in your Hall of Heroes.', 'このヒーローのパワーはまだないよ。ヒーローのでんどうに記録されたよ。'));
            const note = it.kind === 'card' && PASSIVE.includes(it.id) ? t2('Keep this card: it works by itself.', '持っているだけでこうかがあるよ。')
                : it.kind === 'hero' && this.p.heroUsedYear[it.id] === this.g.year ? t2('Used this year. It recharges in April.', '今年は使用ずみ。4月にふっかつするよ。')
                    : null;
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
        this.x = 16;
        this.y = 16;
        this.w = 888;
        this.h = 688;
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
        this.buttons.push(new Button({ x: this.x + this.w / 2 - 130, y: this.y + this.h - 84, w: 260, h: 64, label: lbl(UI.done), sub: sub(UI.done), color: C.green, onClick: () => this.resolveWith({ props: [...this.cart], train: this.train }) }));
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
        text(ctx, (nl.sub ? nl.sub + '  ·  ' : '') + lbl(t2('Station shop', '駅のぶっけん')), x + 100, y + 68, { size: 17, color: '#fff', weight: 500, maxWidth: 520 });
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
            text(ctx, `${lbl(t2('earns', 'りえき'))} ${Math.round(pr.ret * 100)}%`, x + 690, ry + rh / 2 + 16, { size: 15, align: 'right', weight: 500, color: '#2e7d32' });
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
            ? `👑 ${lbl(t2('Monopoly', 'どくせん'))}: ${lines(this.g.players.find((q) => q.id === mono).name).main}`
            : '👑 ' + lbl(t2('Buy everything here for a Monopoly: profits double!', 'ぜんぶ買うとどくせん！りえきが2倍！'));
        text(ctx, tip, x + w / 2, y + h - 104, { size: 18, color: '#7a5a10', align: 'center', maxWidth: 900 });
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
        this.stock.forEach((id, i) => drawCard(ctx, CARD_BY_ID[id], this.cardX(i), 140, 180, 320, this.cart.includes(id), false, this.g.year));
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
        header(ctx, t2(`End of Year ${this.g.year}: payday!`, `${this.g.year}年目の決算：りえきの日！`), 110, 24, 1060, C.green);
        text(ctx, lbl(t2('Every March, each property you own pays you money.', '毎年3月、持っているぶっけんがお金をくれるよ。')), 640, 124, { size: 20, align: 'center', color: '#5a5a50', weight: 500 });
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
                text(ctx, lbl(t2('Sold property to pay debts', '借金のためぶっけんをばいきゃく')), 580, y + 84, { size: 14, color: C.red, weight: 500 });
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
const mmul = (a, b) => { const r = []; for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
        r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]); return r; };
const mvec = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const rotX = (t) => { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotY = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
function rotAxis(ax, t) {
    const [x, y, z] = ax, c = Math.cos(t), s = Math.sin(t), k = 1 - c;
    return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
}
/** Rotation that turns face v towards the viewer (+z). Opposite faces add up to 7, like a real die. */
const FACE_UP = { 1: rotX(0), 6: rotY(Math.PI), 2: rotY(-Math.PI / 2), 5: rotY(Math.PI / 2), 3: rotX(-Math.PI / 2), 4: rotX(Math.PI / 2) };
const FACES = [
    { v: 1, n: [0, 0, 1], u: [1, 0, 0], w: [0, 1, 0] }, { v: 6, n: [0, 0, -1], u: [-1, 0, 0], w: [0, 1, 0] },
    { v: 2, n: [1, 0, 0], u: [0, 0, -1], w: [0, 1, 0] }, { v: 5, n: [-1, 0, 0], u: [0, 0, 1], w: [0, 1, 0] },
    { v: 3, n: [0, -1, 0], u: [1, 0, 0], w: [0, 0, 1] }, { v: 4, n: [0, 1, 0], u: [1, 0, 0], w: [0, 0, -1] },
];
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
const VIEW = rotX(-0.16); // looking down at the board: the face lying on top (towards the screen) is the number rolled; a sliver of the near side shows
export class DiceOverlay {
    constructor(final, extra = 0) {
        this.final = final;
        this.extra = extra;
        this.done = false;
        this.t = 0;
        this.settled = false;
        this.promise = new Promise((r) => (this.resolve = r));
        this.fin = final.map((v, i) => mmul(rotZ((i % 2 ? 1 : -1) * (0.09 + 0.06 * i)), FACE_UP[v]));
        this.ax = final.map((_, i) => { const a = [0.8 + 0.3 * i, 0.55 - 0.2 * i, 0.25 + 0.3 * i]; const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; });
        this.spins = final.map((_, i) => (7 + i * 1.5) * Math.PI);
        this.fromY = final.map((_, i) => 200 + i * 60);
        audio.play('dice');
    }
    update(dt) {
        this.t += dt * clock.timeScale;
        if (!this.settled && this.t >= DiceOverlay.ROLL) {
            this.settled = true;
            fx.shake(6);
        }
        if (this.t > 2100 && !this.done) {
            this.done = true;
            this.resolve();
        }
    }
    draw(ctx) {
        const n = this.final.length, size = 98, gap = 52;
        const total = n * size + (n - 1) * gap;
        const mid = (LAY.mapL + LAY.mapR) / 2, groundY = LAY.cy + 70;
        const fade = this.t > 1850 ? 1 - (this.t - 1850) / 250 : 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        for (let i = 0; i < n; i++) {
            const p = Math.min(1, this.t / DiceOverlay.ROLL);
            const ease = 1 - Math.pow(1 - p, 2.2);
            const tx = mid - total / 2 + size / 2 + i * (size + gap);
            const x = LAY.mapL - 120 + (tx - (LAY.mapL - 120)) * ease;
            // two or three bounces that die away
            const hop = p >= 1 ? 0 : Math.abs(Math.sin(p * Math.PI * 3.2 + 0.4)) * (1 - p) * 190;
            const y = groundY - size / 2 - hop;
            // shadow on the ground
            ctx.fillStyle = `rgba(0,0,0,${0.28 - hop / 900})`;
            ctx.beginPath();
            ctx.ellipse(x + 10 + hop * 0.15, groundY - size * 0.02 + 6, size * 0.56 * (1 - hop / 500), size * 0.42 * (1 - hop / 500), 0, 0, 7);
            ctx.fill();
            const R = mmul(VIEW, mmul(rotAxis(this.ax[i], this.spins[i] * Math.pow(1 - p, 1.4) * (p >= 1 ? 0 : 1)), this.fin[i]));
            this.cube(ctx, R, x, y, size / 2, this.final[i]);
        }
        if (this.settled) {
            const k = Ease.outBack(Math.min(1, (this.t - DiceOverlay.ROLL) / 260));
            const sum = this.final.reduce((a, b) => a + b, 0) + this.extra;
            ctx.save();
            ctx.translate(mid, groundY + 80);
            ctx.scale(k, k);
            text(ctx, this.extra ? `${sum} (+${this.extra})` : `${sum}`, 0, 0, { size: 76, color: C.gold, align: 'center', outline: 11 });
            ctx.restore();
        }
        ctx.restore();
    }
    cube(ctx, R, cx, cy, h, _v) {
        const F = 700;
        const pr = (v) => { const q = mvec(R, v); const k = F / (F - q[2] * h); return [cx + q[0] * h * k, cy + q[1] * h * k]; };
        const faces = FACES.map((f) => ({ f, n: mvec(R, f.n), z: mvec(R, f.n)[2] })).filter((q) => q.z > 0.02).sort((a, b) => a.z - b.z);
        for (const { f, n } of faces) {
            const c = f.n, u = f.u, w = f.w;
            const corner = (a, b) => [c[0] + u[0] * a + w[0] * b, c[1] + u[1] * a + w[1] * b, c[2] + u[2] * a + w[2] * b];
            const pts = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)].map(pr);
            const light = Math.max(0, Math.min(1, 0.62 + (-n[0] * 0.25 - n[1] * 0.45 + n[2] * 0.3)));
            const g = Math.round(150 + 105 * light);
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < 4; i++)
                ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.closePath();
            ctx.fillStyle = `rgb(${g},${g},${Math.min(255, g + 4)})`;
            ctx.fill();
            ctx.lineJoin = 'round';
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#2a2420';
            ctx.stroke();
            // pips, squashed onto the face
            const o = pr(c), pu = pr([c[0] + u[0], c[1] + u[1], c[2] + u[2]]), pw = pr([c[0] + w[0], c[1] + w[1], c[2] + w[2]]);
            ctx.save();
            ctx.transform(pu[0] - o[0], pu[1] - o[1], pw[0] - o[0], pw[1] - o[1], o[0], o[1]);
            ctx.fillStyle = f.v === 1 ? C.red : '#1d1d1b';
            for (const [a, b] of PIPS[f.v]) {
                ctx.beginPath();
                ctx.arc(a * 0.5, b * 0.5, f.v === 1 ? 0.3 : 0.17, 0, 7);
                ctx.fill();
            }
            ctx.restore();
        }
    }
}
DiceOverlay.ROLL = 1250;
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
        // the banner only crosses the map window, never the HUD or the Station guide
        const L = LAY.mapL, R = LAY.mapR, W = R - L, cy = LAY.cy, cx = (L + R) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(L, LAY.mapTop, W, LAY.mapBot - LAY.mapTop);
        ctx.clip();
        ctx.translate(-W + W * k, 0);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(L, cy - 46, W, 112);
        ctx.fillStyle = this.color;
        ctx.fillRect(L, cy - 54, W, 104);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(L, cy - 54, W, 7);
        emoji(ctx, this.icon, cx - Math.min(380, W / 2 - 70), cy - 2, 68);
        const l = lines(this.t2_);
        text(ctx, l.main, cx + 30, l.sub ? cy - 14 : cy, { size: 44, color: '#fff', align: 'center', outline: 8, outlineColor: shade(this.color, -0.45), maxWidth: Math.min(700, W - 220) });
        if (l.sub)
            text(ctx, l.sub, cx + 30, cy + 28, { size: 20, color: '#fff', align: 'center', weight: 500, maxWidth: Math.min(700, W - 220) });
        ctx.restore();
    }
}
export function banner(t, color, icon, dur = 1300) {
    app.overlays.push(new Banner(t, color, icon, dur));
    return clock.wait(dur);
}
export { STYLES, FONT };
//# sourceMappingURL=dialogs.js.map