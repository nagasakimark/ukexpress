// Canvas UI widgets: ticket-style buttons with hover, press and keyboard focus, and a modal base class.
import { C, roundRect, text, emoji, shade } from './draw.js';
import { audio } from './audio.js';
import { clock, Ease } from './tween.js';
export class Button {
    constructor(o) {
        this.hover = false;
        this.press = 0;
        this.lift = 0;
        this.x = o.x;
        this.y = o.y;
        this.w = o.w;
        this.h = o.h;
        this.label = o.label;
        this.sub = o.sub && o.sub !== o.label ? o.sub : undefined;
        this.icon = o.icon;
        this.color = o.color ?? C.green;
        this.textColor = o.textColor ?? C.cream;
        this.size = o.size ?? 26;
        this.enabled = o.enabled ?? true;
        this.onClick = o.onClick;
        this.pulse = o.pulse ?? false;
        this.hidden = o.hidden ?? false;
    }
    hit(px, py) { return !this.hidden && px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h; }
    click() {
        if (!this.enabled || this.hidden) {
            audio.play('quizWrong');
            return;
        }
        audio.play('click');
        this.press = 1;
        clock.tween(this, { press: 0 }, 220, Ease.outQuad);
        this.onClick && this.onClick();
    }
    draw(ctx, focused) {
        if (this.hidden)
            return;
        const target = this.enabled && (this.hover || focused) ? 1 : 0;
        this.lift += (target - this.lift) * 0.25;
        const pulse = this.pulse && this.enabled ? Math.sin(clock.realTime / 220) * 0.03 + 0.03 : 0;
        const sq = 1 - this.press * 0.08;
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2 - this.lift * 4;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale((1 + pulse) * (1 + this.press * 0.04), (1 + pulse) * sq);
        const w = this.w, h = this.h, x = -w / 2, y = -h / 2;
        const base = this.enabled ? this.color : '#8a8a80';
        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        roundRect(ctx, x + 2, y + 6 + this.lift * 3, w, h, 14);
        ctx.fill();
        // outline
        ctx.fillStyle = '#20170a';
        roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 16);
        ctx.fill();
        // body
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, shade(base, 0.12));
        g.addColorStop(1, shade(base, -0.08));
        ctx.fillStyle = g;
        roundRect(ctx, x, y, w, h, 14);
        ctx.fill();
        // ticket notches
        ctx.fillStyle = '#20170a';
        ctx.beginPath();
        ctx.arc(x, 0, 7, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + w, 0, 7, Math.PI / 2, Math.PI * 1.5);
        ctx.fill();
        // brass inner line
        ctx.strokeStyle = this.enabled ? 'rgba(232,196,95,0.75)' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        roundRect(ctx, x + 7, y + 6, w - 14, h - 12, 9);
        ctx.stroke();
        ctx.setLineDash([]);
        // focus ring
        if (focused && this.enabled) {
            ctx.strokeStyle = C.gold;
            ctx.lineWidth = 4;
            roundRect(ctx, x - 8, y - 8, w + 16, h + 16, 20);
            ctx.stroke();
        }
        // content
        const hasSub = !!this.sub;
        let tx = 0;
        if (this.icon) {
            const isz = Math.min(h * 0.55, 40);
            const iconX = this.label ? x + 18 + isz / 2 : 0;
            emoji(ctx, this.icon, iconX, 0, isz, this.enabled ? 1 : 0.5);
            if (this.label)
                tx = (isz + 10) / 2;
        }
        if (this.label) {
            const msz = hasSub ? Math.min(this.size, Math.floor(h * 0.42)) : this.size;
            text(ctx, this.label, tx, hasSub ? -h * 0.1 : 0, { size: msz, color: this.enabled ? this.textColor : '#e8e8e0', align: 'center', outline: 5, outlineColor: shade(base, -0.35), maxWidth: w - 30 - (this.icon ? 50 : 0) });
            if (hasSub)
                text(ctx, this.sub, tx, h * 0.27, { size: Math.min(Math.round(this.size * 0.58), Math.floor(h * 0.24)), color: this.enabled ? '#fff7dd' : '#dddddd', align: 'center', weight: 500, maxWidth: w - 30 - (this.icon ? 50 : 0) });
        }
        ctx.restore();
    }
}
// Picks the nearest button in a direction, for keyboard and gamepad navigation.
export function navigate(buttons, cur, dir) {
    const vis = buttons.map((b, i) => ({ b, i })).filter((o) => !o.b.hidden);
    if (!vis.length)
        return -1;
    if (cur < 0 || cur >= buttons.length || buttons[cur].hidden)
        return vis[0].i;
    const a = buttons[cur];
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    let best = cur, bestScore = Infinity;
    for (const { b, i } of vis) {
        if (i === cur)
            continue;
        const dx = b.x + b.w / 2 - ax, dy = b.y + b.h / 2 - ay;
        let ok = false, main = 0, cross = 0;
        if (dir === 'up') {
            ok = dy < -4;
            main = -dy;
            cross = Math.abs(dx);
        }
        if (dir === 'down') {
            ok = dy > 4;
            main = dy;
            cross = Math.abs(dx);
        }
        if (dir === 'left') {
            ok = dx < -4;
            main = -dx;
            cross = Math.abs(dy);
        }
        if (dir === 'right') {
            ok = dx > 4;
            main = dx;
            cross = Math.abs(dy);
        }
        if (!ok)
            continue;
        const score = main + cross * 2.5;
        if (score < bestScore) {
            bestScore = score;
            best = i;
        }
    }
    return best;
}
// Base class for anything modal: dialogs, shops, quizzes. Handles buttons, focus and the pop-in animation.
export class Modal {
    constructor() {
        this.buttons = [];
        this.focus = -1;
        this.appear = 0;
        this.closing = false;
        this.done = false;
        this.dim = 0.45;
        this.onBack = null;
    }
    open() {
        audio.play('open');
        clock.tween(this, { appear: 1 }, 260, Ease.outBack);
    }
    async closeAnim() {
        this.closing = true;
        await clock.tween(this, { appear: 0 }, 140, Ease.inOutQuad);
        this.done = true;
    }
    update(_dt) { }
    draw(ctx) {
        ctx.save();
        ctx.fillStyle = `rgba(10,20,15,${this.dim * Math.min(1, Math.max(0, this.appear))})`;
        ctx.fillRect(0, 0, 1280, 720);
        const s = 0.85 + 0.15 * this.appear;
        ctx.globalAlpha = Math.max(0, Math.min(1, this.appear * 1.5));
        ctx.translate(640, 360);
        ctx.scale(s, s);
        ctx.translate(-640, -360);
        this.drawBody(ctx);
        for (let i = 0; i < this.buttons.length; i++)
            this.buttons[i].draw(ctx, i === this.focus && !!window.__kbd);
        ctx.restore();
    }
    pointerMove(x, y) {
        for (let i = 0; i < this.buttons.length; i++) {
            const b = this.buttons[i];
            const h = b.hit(x, y);
            if (h && !b.hover && b.enabled)
                audio.play('hover');
            b.hover = h;
            if (h)
                this.focus = i;
        }
        return true;
    }
    pointerDown(_x, _y) { return true; }
    pointerUp(x, y, wasDrag) {
        if (this.closing || wasDrag)
            return true;
        for (const b of this.buttons)
            if (b.hit(x, y)) {
                b.click();
                return true;
            }
        return true; // taps outside the buttons do nothing: players must press a button
    }
    tapOutside(_x, _y) { }
    key(a) {
        if (this.closing)
            return true;
        window.__kbd = true;
        if (a === 'confirm') {
            const b = this.buttons[this.focus];
            if (b)
                b.click();
            else
                this.tapOutside(-1, -1);
        }
        else if (a === 'back') {
            if (this.onBack) {
                audio.play('click');
                this.onBack();
            }
        }
        else if (a !== 'other')
            this.focus = navigate(this.buttons, this.focus, a);
        return true;
    }
    drag() { return true; }
    zoom() { return true; }
}
//# sourceMappingURL=ui.js.map