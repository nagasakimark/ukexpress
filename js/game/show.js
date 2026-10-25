// The "TV show" pieces: the presenter's studio, the picture card for a new month and the spinner (slot reel).
import { PModal, dual, dualHeight } from './dialogs.js';
import { C, FONT, text, emoji, roundRect } from '../engine/draw.js';
import { clock, Ease } from '../engine/tween.js';
import { audio } from '../engine/audio.js';
import { fx } from '../engine/fx.js';
import { app } from './app.js';
import { lines, t2, main, lang } from './i18n.js';
import { drawPic, getPic } from './images.js';
import { LAY } from './layout.js';
import { teacher } from './storage.js';
import { realMonth } from '../core/calendar.js';
import { SENSEI } from '../core/content/heroes.js';
import { say } from './dialogs.js';
/** The presenter's TV studio: Mark Sensei talks, one short bubble at a time, with a picture on the TV. */
class StudioModal extends PModal {
    constructor(ls) {
        super();
        this.ls = ls;
        this.i = 0;
        this.shown = 0; // characters revealed
        this.flash = 0;
        this.tv = null;
        this.dim = 0;
        this.onBack = () => this.advance();
        this.enter();
    }
    get cur() { return this.ls[this.i]; }
    enter() {
        const l = this.cur;
        this.shown = 0;
        if (l.tv !== undefined) {
            this.tv = l.tv;
            this.flash = 1;
            clock.tween(this, { flash: 0 }, 350, Ease.outQuad);
        }
        if (l.sfx)
            audio.play(l.sfx);
    }
    full() { return lines(this.cur.t).main.length; }
    advance() {
        if (this.closing)
            return;
        if (this.shown < this.full()) {
            this.shown = this.full();
            return;
        }
        if (this.i < this.ls.length - 1) {
            this.i++;
            audio.play('card');
            this.enter();
        }
        else
            this.resolveWith(undefined);
    }
    autoValue() { return undefined; }
    update(dt) {
        super.update(dt);
        this.shown = Math.min(this.full(), this.shown + dt * 0.045);
        if (app.autoplay && this.age > 250) {
            this.shown = this.full();
            this.advance();
        }
    }
    pointerUp(_x, _y, wasDrag) { if (!this.closing && !wasDrag)
        this.advance(); return true; }
    tapOutside() { this.advance(); }
    draw(ctx) {
        const a = Math.max(0, Math.min(1, this.appear));
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 1.5);
        this.drawBody(ctx);
        ctx.restore();
    }
    drawBody(ctx) {
        const tt = clock.realTime;
        const bg = getPic('presenter', 'studio');
        if (bg && bg.naturalWidth)
            ctx.drawImage(bg, 0, 0, 1280, 720);
        else {
            ctx.fillStyle = '#f7b7c8';
            ctx.fillRect(0, 0, 1280, 720);
        }
        this.drawTv(ctx, tt);
        // presenter
        const pose = this.cur.pose ?? 'happy';
        const img = getPic('presenter', 'mark_' + pose);
        const bob = Math.sin(tt / 380) * 3;
        if (img && img.naturalWidth) {
            const h = 640, w = img.naturalWidth * h / img.naturalHeight;
            ctx.drawImage(img, 70, 100 + bob, w, h);
        }
        else
            emoji(ctx, SENSEI.emoji, 280, 300, 220);
        // ON AIR lamp
        ctx.fillStyle = Math.sin(tt / 300) > 0 ? '#ff3b3b' : '#a02020';
        ctx.beginPath();
        ctx.arc(1226, 40, 11, 0, 7);
        ctx.fill();
        text(ctx, 'ON AIR', 1204, 40, { size: 15, color: '#fff', align: 'right', outline: 4, outlineColor: '#7a1020' });
        this.drawBubble(ctx, tt);
    }
    drawTv(ctx, tt) {
        const x = 560, y = 70, w = 660, h = 400;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(ctx, x + 8, y + 12, w, h, 26);
        ctx.fill();
        ctx.fillStyle = '#c8921a';
        roundRect(ctx, x - 12, y - 12, w + 24, h + 24, 28);
        ctx.fill();
        ctx.fillStyle = '#20170a';
        roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 22);
        ctx.fill();
        const tv = this.tv;
        ctx.save();
        roundRect(ctx, x, y, w, h, 18);
        ctx.clip();
        if (tv) {
            drawPic(ctx, tv.kind, tv.name, x, y, w, h, { emoji: tv.emoji, label: main(tv.title), color: tv.color, radius: 0, border: 'none' });
            const g = ctx.createLinearGradient(0, y + h - 110, 0, y + h);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, 'rgba(0,0,0,0.7)');
            ctx.fillStyle = g;
            ctx.fillRect(x, y + h - 110, w, 110);
            const tl = lines(tv.title);
            text(ctx, tl.main, x + 24, y + h - 56, { size: 40, color: '#fff', outline: 7, outlineColor: 'rgba(0,0,0,0.7)', maxWidth: w - 48 });
            const sb = tl.sub ?? (tv.sub ? lines(tv.sub).main : '');
            if (sb)
                text(ctx, sb, x + 26, y + h - 20, { size: 20, color: '#ffeaa0', weight: 600, maxWidth: w - 52 });
        }
        else {
            const g = ctx.createLinearGradient(x, y, x + w, y + h);
            g.addColorStop(0, '#ffd1e0');
            g.addColorStop(1, '#ffe9a8');
            ctx.fillStyle = g;
            ctx.fillRect(x, y, w, h);
            emoji(ctx, '🚂', x + w / 2, y + h / 2 - 20, 150);
            text(ctx, 'UK Express News', x + w / 2, y + h - 60, { size: 40, color: '#b01c3c', align: 'center', outline: 7, outlineColor: '#fff' });
        }
        if (this.flash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${this.flash})`;
            ctx.fillRect(x, y, w, h);
        }
        ctx.restore();
        // little LIVE tag
        ctx.fillStyle = '#d7263d';
        roundRect(ctx, x + 14, y + 14, 74, 28, 10);
        ctx.fill();
        text(ctx, '📺 LIVE', x + 51, y + 29, { size: 15, color: '#fff', align: 'center' });
    }
    drawBubble(ctx, tt) {
        const x = 24, w = 1232, h = 150, y = 548;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(ctx, x + 3, y + 6, w, h, 22);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,250,238,0.96)';
        roundRect(ctx, x, y, w, h, 22);
        ctx.fill();
        ctx.strokeStyle = '#e0457b';
        ctx.lineWidth = 6;
        roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 20);
        ctx.stroke();
        const nm = main(SENSEI.name);
        ctx.font = `800 22px ${FONT}`;
        const tw = ctx.measureText(nm).width + 44;
        ctx.fillStyle = '#e0457b';
        roundRect(ctx, x + 24, y - 20, tw, 40, 20);
        ctx.fill();
        text(ctx, '🎤 ' + nm, x + 24 + tw / 2, y, { size: 22, color: '#fff', align: 'center' });
        const t = this.cur.t;
        const l = lines(t);
        const left = Math.floor(this.shown);
        const shownMain = l.main.slice(0, left);
        // layout is measured on the full text so the bubble does not jump while it types
        const ctxm = ctx;
        let size = 34;
        while (size > 22 && dualHeight(ctxm, t, size, w - 80) > h - 38)
            size -= 2;
        const full = this.shown >= l.main.length;
        const mk = lang.mode === 'en' ? 'en' : 'ja', ok = mk === 'en' ? 'ja' : 'en';
        const typed = { en: '', ja: '' };
        typed[mk] = shownMain;
        typed[ok] = full ? t[ok] : '';
        dual(ctx, typed, x + 40, y + 30, size, w - 80);
        if (full) {
            const bob = Math.sin(tt / 180) * 4;
            ctx.fillStyle = '#e0457b';
            ctx.beginPath();
            ctx.moveTo(x + w - 64, y + h - 36 + bob);
            ctx.lineTo(x + w - 38, y + h - 36 + bob);
            ctx.lineTo(x + w - 51, y + h - 20 + bob);
            ctx.closePath();
            ctx.fill();
        }
    }
}
/** The presenter speaks the lines (TV studio). If the teacher turned the presenter off, the same lines appear in the message box. */
export async function studio(ls) {
    if (!ls.length)
        return;
    if (!teacher.presenter) {
        await say({ title: SENSEI.name, icon: '🎤', body: ls.map((l) => l.t), color: '#e0457b' });
        return;
    }
    await app.show(new StudioModal(ls));
}
// ---------- Month picture card ----------
const MONTH_FILES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
export const MONTH_HELLO = [
    t2("Happy New Year! It's January!", 'あけまして おめでとう！1月だよ！'),
    t2("It's February! Brrr, so cold!", '2月だよ！さむいね〜！'),
    t2("It's March! Spring is coming!", '3月だよ！もうすぐ はる！'),
    t2("It's April! Cherry blossoms and showers!", '4月だよ！はなが さく きせつ！'),
    t2("It's May! Flowers everywhere!", '5月だよ！おはなが いっぱい！'),
    t2("It's June! The days are so long!", '6月だよ！ひが ながいね！'),
    t2("It's July! Summer is here!", '7月だよ！なつが きた！'),
    t2("It's August! Time to enjoy the beach!", '8月だよ！うみに いこう！'),
    t2("It's September! A new school term!", '9月だよ！しんがっきの はじまり！'),
    t2("It's October! The leaves turn red!", '10月だよ！はっぱが あかくなる！'),
    t2("It's November! Fireworks and bonfires!", '11月だよ！はなびと たきび！'),
    t2("It's December! Christmas is coming!", '12月だよ！クリスマスが くるよ！'),
];
class MonthCard extends PModal {
    constructor(m, year, yearsTotal) {
        super();
        this.m = m;
        this.year = year;
        this.yearsTotal = yearsTotal;
        this.held = 0;
        this.dim = 0;
        this.onBack = () => this.close();
    }
    close() { if (this.age > 500)
        this.resolveWith(undefined); }
    pointerUp(_x, _y, wasDrag) { if (!wasDrag)
        this.close(); return true; }
    tapOutside() { this.close(); }
    update(dt) { super.update(dt); if (this.age > 3200 || (app.autoplay && this.age > 150))
        this.resolveWith(undefined); }
    drawBody(ctx) {
        const k = Ease.outBack(Math.min(1, this.age / 520));
        const cx = LAY.cx, cy = LAY.cy + 6;
        const w = 600, h = 450;
        ctx.save();
        ctx.translate(cx, cy + (1 - Math.min(1, this.age / 400)) * 400);
        ctx.rotate((1 - k) * -0.25 + Math.sin(this.age / 700) * 0.012);
        ctx.scale(0.4 + 0.6 * k, 0.4 + 0.6 * k);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(ctx, -w / 2 + 8, -h / 2 + 14, w, h, 30);
        ctx.fill();
        ctx.fillStyle = '#fffdf6';
        roundRect(ctx, -w / 2 - 12, -h / 2 - 12, w + 24, h + 24, 34);
        ctx.fill();
        ctx.strokeStyle = '#e0457b';
        ctx.lineWidth = 6;
        roundRect(ctx, -w / 2 - 12, -h / 2 - 12, w + 24, h + 24, 34);
        ctx.stroke();
        drawPic(ctx, 'months', MONTH_FILES[this.m], -w / 2, -h / 2, w, h, { emoji: '📅', label: main({ en: MONTH_FILES[this.m], ja: `${this.m + 1}月` }), color: '#e0457b', radius: 24 });
        // ribbon
        ctx.fillStyle = '#e0457b';
        roundRect(ctx, -w / 2 + 20, h / 2 - 118, w - 40, 98, 22);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        roundRect(ctx, -w / 2 + 25, h / 2 - 113, w - 50, 88, 18);
        ctx.stroke();
        const hello = lines(MONTH_HELLO[this.m]);
        text(ctx, hello.main, 0, h / 2 - 82, { size: 32, color: '#fff', align: 'center', outline: 5, outlineColor: '#9a1f4c', maxWidth: w - 70 });
        const ys = lines(t2(`Year ${this.year} of ${this.yearsTotal}`, `${this.year}ねんめ`)).main;
        text(ctx, hello.sub ? `${hello.sub}  ·  ${ys}` : ys, 0, h / 2 - 42, { size: 18, color: '#ffe3ee', align: 'center', weight: 600, maxWidth: w - 70 });
        ctx.restore();
    }
}
/** `gameMonth` is the game's month index (0 = April); the card needs the calendar month. */
export async function monthCard(gameMonth, year, years) {
    audio.play('fanfare');
    await app.show(new MonthCard(realMonth(year, gameMonth).m, year, years));
}
class SpinnerModal extends PModal {
    constructor(title, items, target) {
        super();
        this.title = title;
        this.items = items;
        this.pos = 0; // reel position in items (continuous)
        this.dur = 2200;
        this.t = 0;
        this.hold = 0;
        this.skipped = false;
        this.lastTick = -1;
        this.dim = 0.25;
        this.target = target;
        const n = items.length;
        this.pos = Math.floor(Math.random() * n);
        this.startPos = this.pos;
        this.endPos = this.pos + n * 3 + ((target - this.pos) % n + n) % n;
        this.onBack = () => this.skip();
    }
    skip() { if (this.t < this.dur) {
        this.t = this.dur;
        this.pos = this.endPos;
        this.skipped = true;
        audio.play('fanfare');
        fx.burst(LAY.cx, LAY.cy, 'star', 24, { color: C.gold, speed: 7 });
    } }
    autoValue() { return this.target; }
    pointerUp(_x, _y, wasDrag) { if (!wasDrag) {
        if (this.t < this.dur)
            this.skip();
        else if (this.hold > 300)
            this.resolveWith(this.target);
    } return true; }
    tapOutside() { if (this.t < this.dur)
        this.skip();
    else if (this.hold > 300)
        this.resolveWith(this.target); }
    update(dt) {
        super.update(dt);
        if (this.t < this.dur) {
            this.t = Math.min(this.dur, this.t + dt);
            const u = 1 - Math.pow(1 - this.t / this.dur, 4);
            this.pos = this.startPos + (this.endPos - this.startPos) * u;
            const tick = Math.floor(this.pos);
            if (tick !== this.lastTick) {
                this.lastTick = tick;
                if (this.t < this.dur)
                    audio.play('hover');
            }
            if (this.t >= this.dur) {
                audio.play('fanfare');
                fx.burst(LAY.cx, LAY.cy, 'star', 24, { color: C.gold, speed: 7 });
            }
        }
        else {
            this.hold += dt;
            if (this.hold > 1800)
                this.resolveWith(this.target);
        }
    }
    drawBody(ctx) {
        const cx = LAY.cx, cy = LAY.cy;
        const w = 520, h = 330;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(ctx, cx - w / 2 + 6, cy - h / 2 + 10, w, h, 26);
        ctx.fill();
        ctx.fillStyle = '#fff8e6';
        roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 26);
        ctx.fill();
        ctx.strokeStyle = '#e0457b';
        ctx.lineWidth = 6;
        roundRect(ctx, cx - w / 2 + 3, cy - h / 2 + 3, w - 6, h - 6, 24);
        ctx.stroke();
        const tl = lines(this.title);
        ctx.fillStyle = '#e0457b';
        roundRect(ctx, cx - w / 2 + 20, cy - h / 2 - 20, w - 40, 44, 22);
        ctx.fill();
        text(ctx, tl.main, cx, cy - h / 2 + 2, { size: 26, color: '#fff', align: 'center', maxWidth: w - 80 });
        // reel window
        const rx = cx - 210, rw = 420, rh = 150, ry = cy - rh / 2 + 6;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, rx, ry, rw, rh, 16);
        ctx.fill();
        ctx.save();
        roundRect(ctx, rx, ry, rw, rh, 16);
        ctx.clip();
        const n = this.items.length;
        const rowH = 100;
        for (let k = -2; k <= 2; k++) {
            const idx = Math.round(this.pos) + k;
            const off = (idx - this.pos) * rowH;
            const it = this.items[((idx % n) + n) % n];
            const y = ry + rh / 2 + off;
            const mid = 1 - Math.min(1, Math.abs(off) / rowH);
            ctx.globalAlpha = 0.25 + 0.75 * mid;
            emoji(ctx, it.icon, rx + 80, y, 60 + 14 * mid);
            text(ctx, lines(it.label).main, rx + 140, y, { size: 30 + 6 * mid, color: it.color ?? C.ink, maxWidth: rw - 160 });
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.strokeStyle = '#e0457b';
        ctx.lineWidth = 4;
        roundRect(ctx, rx - 2, ry - 2, rw + 4, rh + 4, 18);
        ctx.stroke();
        ctx.fillStyle = '#e0457b';
        ctx.beginPath();
        ctx.moveTo(rx - 22, ry + rh / 2 - 14);
        ctx.lineTo(rx - 4, ry + rh / 2);
        ctx.lineTo(rx - 22, ry + rh / 2 + 14);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(rx + rw + 22, ry + rh / 2 - 14);
        ctx.lineTo(rx + rw + 4, ry + rh / 2);
        ctx.lineTo(rx + rw + 22, ry + rh / 2 + 14);
        ctx.closePath();
        ctx.fill();
        if (this.t >= this.dur) {
            const it = this.items[this.target];
            const pop = Ease.outBack(Math.min(1, this.hold / 350));
            ctx.save();
            ctx.translate(cx, cy + h / 2 - 50);
            ctx.scale(pop, pop);
            text(ctx, lines(it.label).main, 0, 0, { size: 40, color: '#d7263d', align: 'center', outline: 7, outlineColor: '#fff6d0', maxWidth: w - 40 });
            ctx.restore();
        }
        else
            text(ctx, lines(t2('Tap to stop!', 'タップで とまるよ！')).main, cx, cy + h / 2 - 40, { size: 20, color: '#8a7a60', align: 'center', weight: 600 });
    }
}
/** Spins the reel and stops on `target` (decided beforehand by the game's own dice, so saves and tests stay fair). */
export function spin(title, items, target) {
    return app.show(new SpinnerModal(title, items, target));
}
//# sourceMappingURL=show.js.map