// The "TV show" pieces: the presenter's studio, the picture card for a new month and the spinner (slot reel).
import { PModal, dual, dualHeight } from './dialogs.js';
import { C, FONT, text, emoji, roundRect } from '../engine/draw.js';
import { clock, Ease } from '../engine/tween.js';
import { audio } from '../engine/audio.js';
import { fx } from '../engine/fx.js';
import { app } from './app.js';
import { lines, t2, main, lang } from './i18n.js';
import { drawPic, getPic, preload, PRESENTER_PICS } from './images.js';
import { LAY } from './layout.js';
import { teacher } from './storage.js';
import { realMonth } from '../core/calendar.js';
import { SENSEI } from '../core/content/heroes.js';
import { say } from './dialogs.js';
import { sprites } from './fake3d/sprites.js';
/** The presenter's TV studio: Mark Sensei talks, one short bubble at a time, with a picture on the TV. */
class StudioModal extends PModal {
    constructor(ls) {
        super();
        this.ls = ls;
        this.i = 0;
        this.shown = 0; // characters revealed
        this.flash = 0;
        this.tv = null;
        this.spinT = -1;
        this.spinDur = 3400;
        this.spinIdx = -1;
        this.dim = 0;
        this.onBack = () => this.advance();
        this.enter();
    }
    get cur() { return this.ls[this.i]; }
    enter() {
        const l = this.cur;
        this.shown = 0;
        if (l.spin && l.spin.length) {
            this.spinT = 0;
            this.spinIdx = -1;
            audio.play('dice');
            return;
        }
        this.spinT = -1;
        if (l.tv !== undefined) {
            this.tv = l.tv;
            this.flash = 1;
            clock.tween(this, { flash: 0 }, 350, Ease.outQuad);
        }
        if (l.sfx)
            audio.play(l.sfx);
    }
    get spinning() { return this.spinT >= 0 && this.spinT < this.spinDur; }
    /** The roulette stops: the real destination appears with a flash, a fanfare and confetti. */
    land() {
        const l = this.cur;
        this.spinT = this.spinDur;
        this.tv = l.tv ?? null;
        this.flash = 1;
        clock.tween(this, { flash: 0 }, 500, Ease.outQuad);
        audio.play('fanfare');
        fx.shake(6);
        fx.burst(890, 250, 'confetti', 60, { speed: 9, up: 6 });
        fx.burst(890, 250, 'star', 16, { color: C.gold, speed: 8 });
    }
    full() { return lines(this.cur.t).main.length; }
    advance() {
        if (this.closing)
            return;
        if (this.spinning) {
            this.land();
            return;
        }
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
        if (this.spinning) {
            const l = this.cur, list = l.spin;
            this.spinT += dt;
            // fast at first, then slower and slower (ticks get further apart), like a real roulette
            const u = Math.min(1, this.spinT / this.spinDur);
            const steps = Math.floor(28 * (1 - Math.pow(1 - u, 3)));
            if (steps !== this.spinIdx) {
                this.spinIdx = steps;
                this.tv = list[steps % list.length];
                audio.play('hover');
            }
            if (this.spinT >= this.spinDur)
                this.land();
        }
        if (app.autoplay && this.age > 250) {
            this.shown = this.full();
            this.advance();
        }
    }
    pointerUp(_x, _y, wasDrag) { if (!this.closing && !wasDrag)
        this.advance(); return true; }
    tapOutside() { this.advance(); }
    draw(ctx) {
        this.drawBody(ctx);
    }
    drawBody(ctx) {
        const tt = clock.realTime;
        const bg = getPic('presenter', 'studio');
        // the studio is fully opaque from the first frame, so the board never shows through
        const vw = LAY.vr - LAY.vl;
        ctx.fillStyle = '#f7b7c8';
        ctx.fillRect(LAY.vl, 0, vw, 720);
        if (bg && bg.naturalWidth) {
            // cover the whole (possibly wider than 16:9) screen
            const k = Math.max(vw / bg.naturalWidth, 720 / bg.naturalHeight), sw = vw / k, sh = 720 / k;
            ctx.drawImage(bg, (bg.naturalWidth - sw) / 2, (bg.naturalHeight - sh) / 2, sw, sh, LAY.vl, 0, vw, 720);
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
            if (this.spinning) {
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                for (let i = 0; i < 6; i++)
                    ctx.fillRect(x, y + ((clock.realTime / 3 + i * 70) % h), w, 3);
            }
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
            // the idle screen: the "UK Express News" title card
            const nb = getPic('presenter', 'news');
            ctx.fillStyle = '#5aa8e0';
            ctx.fillRect(x, y, w, h);
            // scaled so the whole map sits above the title strip
            if (nb && nb.naturalWidth) {
                const k = (h - 70) / (nb.naturalHeight * 0.8), dw = nb.naturalWidth * k, dh = nb.naturalHeight * k;
                ctx.drawImage(nb, x + (w - dw) / 2, y - nb.naturalHeight * 0.07 * k, dw, dh);
            }
            const by = y + h - 84;
            const bg2 = ctx.createLinearGradient(0, by, 0, by + 72);
            bg2.addColorStop(0, '#e23a56');
            bg2.addColorStop(1, '#a8142f');
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            roundRect(ctx, x + 60, by + 5, w - 120, 72, 16);
            ctx.fill();
            ctx.fillStyle = bg2;
            roundRect(ctx, x + 60, by, w - 120, 72, 16);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            roundRect(ctx, x + 65, by + 5, w - 130, 62, 12);
            ctx.stroke();
            text(ctx, 'UK Express News', x + w / 2, by + 28, { size: 36, color: '#fff', align: 'center', outline: 6, outlineColor: '#6e0d20' });
            text(ctx, lines(t2('Live from the studio!', 'スタジオから ライブ！')).main, x + w / 2, by + 56, { size: 16, color: '#ffe3ee', align: 'center', weight: 700 });
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
        text(ctx, 'LIVE', x + 51, y + 29, { size: 16, color: '#fff', align: 'center', weight: 800 });
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
        text(ctx, nm, x + 24 + tw / 2, y, { size: 22, color: '#fff', align: 'center' });
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
    await preload('presenter', PRESENTER_PICS);
    for (const k of ['places', 'heroes', 'events', 'months']) {
        const names = ls.flatMap((l) => [l.tv, ...(l.spin ?? [])]).filter((t) => t && t.kind === k).map((t) => t.name);
        if (names.length)
            await preload(k, names, 3000);
    }
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
        const cx = LAY.cx, cy = 352;
        // the picture on top, the words on their own strip underneath, so nothing covers the art
        const iw = 560, ih = 420, band = 92, pad = 12;
        const w = iw + pad * 2, h = ih + band + pad * 2;
        ctx.save();
        ctx.translate(cx, cy + (1 - Math.min(1, this.age / 400)) * 400);
        ctx.rotate((1 - k) * -0.25 + Math.sin(this.age / 700) * 0.01);
        ctx.scale(0.4 + 0.6 * k, 0.4 + 0.6 * k);
        const x = -w / 2, y = -h / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(ctx, x + 8, y + 14, w, h, 30);
        ctx.fill();
        ctx.fillStyle = '#fffdf6';
        roundRect(ctx, x, y, w, h, 30);
        ctx.fill();
        ctx.strokeStyle = '#e0457b';
        ctx.lineWidth = 6;
        roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 28);
        ctx.stroke();
        drawPic(ctx, 'months', MONTH_FILES[this.m], x + pad, y + pad, iw, ih, { emoji: '📅', label: main({ en: MONTH_FILES[this.m], ja: `${this.m + 1}月` }), color: '#e0457b', radius: 20 });
        // month tag in the corner of the picture
        const tag = lines({ en: MONTH_FILES[this.m][0].toUpperCase() + MONTH_FILES[this.m].slice(1), ja: `${this.m + 1}月` }).main;
        ctx.font = `800 30px ${FONT}`;
        const tw = ctx.measureText(tag).width + 40;
        ctx.fillStyle = '#e0457b';
        roundRect(ctx, x + pad + 14, y + pad + 14, tw, 50, 25);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        roundRect(ctx, x + pad + 14, y + pad + 14, tw, 50, 25);
        ctx.stroke();
        text(ctx, tag, x + pad + 14 + tw / 2, y + pad + 40, { size: 30, color: '#fff', align: 'center' });
        const hello = lines(MONTH_HELLO[this.m]);
        const by = y + pad + ih + 8;
        text(ctx, hello.main, 0, by + 30, { size: 30, color: '#b0204f', align: 'center', maxWidth: w - 50 });
        const ys = lines(t2(`Year ${this.year} of ${this.yearsTotal}`, `${this.year}ねんめ`)).main;
        text(ctx, hello.sub ? `${hello.sub}  ·  ${ys}` : ys, 0, by + 64, { size: 17, color: '#8a6a55', align: 'center', weight: 600, maxWidth: w - 50 });
        ctx.restore();
    }
}
/** `gameMonth` is the game's month index (0 = April); the card needs the calendar month. */
export async function monthCard(gameMonth, year, years) {
    await preload('months', [MONTH_FILES[realMonth(year, gameMonth).m]]);
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
// ---------- Station arrival scene ----------
/** A Momotetsu-style arrival: flat platform art behind, the train (a pre-rendered side view) rolling in and braking, a crowd in front. */
class ArrivalModal extends PModal {
    constructor(name, emojiStr, color) {
        super();
        this.name = name;
        this.emojiStr = emojiStr;
        this.color = color;
        this.t = 0;
        this.puff = 0;
        this.whistled = false;
        this.dim = 0;
        this.onBack = () => this.skip();
    }
    skip() { if (this.closing)
        return; if (this.t < ArrivalModal.RUN)
        this.t = ArrivalModal.RUN;
    else
        this.resolveWith(undefined); }
    update(dt) {
        super.update(dt);
        const was = this.t;
        this.t += dt;
        if (!this.whistled && this.t > 200) {
            this.whistled = true;
            audio.play('whistle');
        }
        if (was < ArrivalModal.RUN && this.t >= ArrivalModal.RUN)
            audio.play('fanfare');
        if (this.t > ArrivalModal.END && !this.closing)
            this.resolveWith(undefined);
        if (this.t < ArrivalModal.RUN) {
            this.puff += dt;
            if (this.puff > 180) {
                const p = this.trainPos();
                this.puff = 0;
                fx.puff(p.x - 20, p.y - 150);
            }
        }
    }
    pointerUp(_x, _y, wasDrag) { if (!this.closing && !wasDrag)
        this.skip(); return true; }
    tapOutside() { this.skip(); }
    trainPos() {
        const u = Math.min(1, this.t / ArrivalModal.RUN);
        const e = 1 - Math.pow(1 - u, 2.2);
        const X = -150 + (860 + 150) * e;
        return { x: X, y: 588, speed: 1 - u };
    }
    draw(ctx) { this.drawBody(ctx); }
    drawBody(ctx) {
        const vw = LAY.vr - LAY.vl;
        ctx.fillStyle = '#cfe9ef';
        ctx.fillRect(LAY.vl, 0, vw, 720);
        const bg = getPic('presenter', 'arr_bg');
        if (bg && bg.naturalWidth) {
            const k = Math.max(vw / bg.naturalWidth, 720 / bg.naturalHeight), sw = vw / k, sh = 720 / k;
            ctx.drawImage(bg, (bg.naturalWidth - sw) / 2, (bg.naturalHeight - sh) / 2, sw, sh, LAY.vl, 0, vw, 720);
        }
        // the hanging station sign
        const nm = lines(this.name);
        ctx.font = `800 54px ${FONT}`;
        const sw = Math.max(380, ctx.measureText(nm.main).width + 100);
        const sx = 640 - sw / 2, sy = 122;
        ctx.strokeStyle = '#2d3844';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(sx + 40, sy - 30);
        ctx.lineTo(sx + 40, sy);
        ctx.moveTo(sx + sw - 40, sy - 30);
        ctx.lineTo(sx + sw - 40, sy);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        roundRect(ctx, sx + 4, sy + 6, sw, 100, 14);
        ctx.fill();
        ctx.fillStyle = '#1f4e8c';
        roundRect(ctx, sx, sy, sw, 100, 14);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        roundRect(ctx, sx + 7, sy + 7, sw - 14, 86, 9);
        ctx.stroke();
        text(ctx, nm.main, 640, sy + (nm.sub ? 42 : 52), { size: 54, color: '#fff', align: 'center', maxWidth: sw - 60 });
        if (nm.sub)
            text(ctx, nm.sub, 640, sy + 80, { size: 22, color: '#cfe3ff', align: 'center', weight: 600, maxWidth: sw - 60 });
        // the train, between the back and front layers
        const d = sprites.defs['side/' + (this.color % 4)];
        const tp = this.trainPos();
        if (d && sprites.atlases[d.a]) {
            const sc = 1.15, jig = tp.speed > 0.05 ? Math.sin(this.t / 38) * 1.4 * tp.speed : 0;
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath();
            ctx.ellipse(tp.x - d.ax * sc * 0.5 + d.w * sc * 0.5 - 40, tp.y + 8, d.w * sc * 0.5, 9, 0, 0, 7);
            ctx.fill();
            ctx.drawImage(sprites.atlases[d.a], d.x, d.y, d.w, d.h, tp.x - d.ax * sc, tp.y - d.ay * sc + jig, d.w * sc, d.h * sc);
        }
        // the crowd in front
        const fg = getPic('presenter', 'arr_fg');
        if (fg && fg.naturalWidth) {
            const fw = Math.max(vw, 1280) * 0.55, fh = fg.naturalHeight * fw / fg.naturalWidth;
            const arrive = Math.min(1, Math.max(0, (this.t - ArrivalModal.RUN + 600) / 600));
            const bob = this.t > ArrivalModal.RUN ? Math.abs(Math.sin(this.t / 160)) * 8 * arrive : 0;
            for (let x = 640 - Math.ceil((640 - LAY.vl) / fw) * fw; x < LAY.vr; x += fw)
                ctx.drawImage(fg, x, 720 - fh + 6 - bob * arrive, fw, fh);
        }
        // "arrived!" banner
        if (this.t > ArrivalModal.RUN) {
            const a = Math.min(1, (this.t - ArrivalModal.RUN) / 300);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(640, 330);
            ctx.scale(0.8 + 0.2 * a, 0.8 + 0.2 * a);
            const l = lines(t2('We arrived!', 'とうちゃく！'));
            text(ctx, l.main, 0, 0, { size: 84, color: '#ffe066', align: 'center', outline: 14, outlineColor: '#7a1020' });
            if (l.sub)
                text(ctx, l.sub, 0, 58, { size: 28, color: '#fff', align: 'center', outline: 7, outlineColor: '#7a1020' });
            ctx.restore();
        }
    }
}
ArrivalModal.RUN = 2800;
ArrivalModal.END = 4300;
/** Plays the arrival scene for a train of player colour `color` pulling into the station called `name`. */
export async function arrivalScene(name, color) {
    await preload('presenter', ['arr_bg', 'arr_fg'], 4000);
    await app.show(new ArrivalModal(name, '', color));
}
//# sourceMappingURL=show.js.map