import { app } from '../app.js';
import { Button, navigate } from '../../engine/ui.js';
import { C, text, emoji, roundRect } from '../../engine/draw.js';
import { clock } from '../../engine/tween.js';
import { audio } from '../../engine/audio.js';
import { fx } from '../../engine/fx.js';
import { drawTrain } from '../mapart.js';
import { lines, UI, t2 } from '../i18n.js';
import { choose } from '../dialogs.js';
import { howToPlay } from '../tutorial.js';
import { BookModal } from '../book.js';
import { board } from '../../core/map.js';
import { view } from '../fake3d/view.js';
import { sprites } from '../fake3d/sprites.js';
import { isDryLand } from '../fake3d/ground.js';
// The title picture (assets/images/title.png). Loads in the background while the
// title screen is showing; the drawn text logo below is only a fallback.
let titleImg = null;
let titleImgOk = false;
function getTitleImg() {
    if (!titleImg && typeof Image !== 'undefined') {
        const img = new Image();
        img.onload = () => { titleImgOk = true; };
        img.onerror = () => { titleImg = null; };
        img.src = 'assets/images/title.png';
        titleImg = img;
    }
    return titleImgOk && titleImg ? titleImg : null;
}
export class TitleScene {
    constructor(onNew, onContinue) {
        this.onNew = onNew;
        this.onContinue = onContinue;
        this.t = 0;
        this.started = false;
        this.buttons = [];
        this.focus = 0;
        this.route = [];
        this.s = 0;
        this.lastT = 0;
        this.puffT = 0;
        this.train = { id: 'title', x: 0, z: 0, dir: 'e', type: 2, color: 0, cars: 3, trail: [], lift: 0, scale: 1 };
    }
    hasSave() { try {
        return !!localStorage.getItem('britainExpressSave');
    }
    catch {
        return false;
    } }
    enter() {
        audio.startMusic('title');
        const L = (l) => lines(l);
        const mk = (x, y, w, l, icon, color, fn, enabled = true, size = 26) => new Button({ x, y, w, h: 64, label: L(l).main, sub: L(l).sub ?? undefined, icon, color, enabled, size, onClick: fn });
        this.buttons = [
            mk(640 - 220, 330, 440, UI.newGame, '🚂', '#d7263d', () => this.onNew(), true, 30),
            mk(640 - 290, 412, 280, UI.cont, '💾', C.green, () => this.onContinue(), this.hasSave()),
            mk(650, 412, 280, UI.howTo, '❓', '#3a7be8', () => howToPlay()),
            mk(640 - 290, 494, 280, t2('UK Book', 'UKブック'), '📖', '#7a2e1f', () => app.show(new BookModal())),
            mk(650, 494, 280, UI.options, '⚙️', '#7a6a55', () => this.optionsMenu()),
        ];
        this.focus = this.hasSave() ? 1 : 0;
    }
    async optionsMenu() {
        const o = app.options;
        const v = await choose(t2('Options', 'せってい'), null, [
            { label: t2(o.muted ? 'Sound: OFF' : 'Sound: ON', o.muted ? '音：オフ' : '音：オン'), value: 'sound', icon: o.muted ? '🔇' : '🔊' },
            { label: t2(o.fast ? 'CPU speed: Fast' : 'CPU speed: Normal', o.fast ? 'CPUのスピード：はやい' : 'CPUのスピード：ふつう'), value: 'fast', icon: '⏩' },
            { label: t2(o.calm ? 'Calm mode: ON (less shaking)' : 'Calm mode: OFF', o.calm ? 'おだやかモード：オン' : 'おだやかモード：オフ'), value: 'calm', icon: '🌙' },
            { label: t2('Fullscreen', 'フルスクリーン'), value: 'full', icon: '⛶' },
        ], 'back');
        if (v === 'sound') {
            o.muted = !o.muted;
            audio.setMuted(o.muted);
        }
        if (v === 'fast')
            o.fast = !o.fast;
        if (v === 'calm')
            o.calm = !o.calm;
        if (v === 'full') {
            try {
                await document.documentElement.requestFullscreen();
            }
            catch { /* not allowed */ }
        }
        app.saveOptions();
        if (v !== 'back')
            this.optionsMenu();
    }
    update(dt) { this.t += dt; }
    pointerMove(x, y) { if (!this.started)
        return; for (let i = 0; i < this.buttons.length; i++) {
        const b = this.buttons[i];
        const h = b.hit(x, y);
        if (h && !b.hover)
            audio.play('hover');
        b.hover = h;
        if (h)
            this.focus = i;
    } }
    pointerUp(x, y) {
        if (!this.started) {
            this.start();
            return true;
        }
        for (const b of this.buttons)
            if (b.hit(x, y)) {
                b.click();
                return true;
            }
        return true;
    }
    key(a) {
        window.__kbd = true;
        if (!this.started) {
            this.start();
            return true;
        }
        if (a === 'confirm')
            this.buttons[this.focus]?.click();
        else if (a === 'up' || a === 'down')
            this.focus = navigate(this.buttons, this.focus, a);
        return true;
    }
    start() {
        this.started = true;
        audio.unlock();
        audio.play('whistle');
        audio.startMusic('title');
        try {
            if (matchMedia('(pointer: coarse)').matches)
                document.documentElement.requestFullscreen?.().catch(() => { });
        }
        catch { /* ignore */ }
    }
    /** A steam train chugging north from King's Cross to Edinburgh, with the camera riding along. */
    drawBoard(ctx, t) {
        const dt = this.lastT ? Math.min(50, t - this.lastT) : 16;
        this.lastT = t;
        if (!this.route.length) {
            // the longest straight east-west stretch of track, so the train never has to turn a corner
            const g = board.grid;
            const has = new Set(g.cells.filter((c) => c[2] & 1 && isDryLand(c[0], c[1])).map((c) => c[0] + ',' + c[1]));
            let best = [];
            for (const c of g.cells) {
                if (!(c[2] & 1) || has.has((c[0] - 1) + ',' + c[1]))
                    continue;
                const run = [];
                for (let x = c[0]; has.has(x + ',' + c[1]); x++)
                    run.push({ x, y: c[1] });
                if (run.length > best.length)
                    best = run;
            }
            this.route = best.length > 3 ? best : [{ x: 0, y: 0 }, { x: 10, y: 0 }];
            view.build();
        }
        this.s += dt * 0.0016;
        let rem = this.s, i = 0;
        for (; i < this.route.length - 1; i++) {
            if (rem < 1)
                break;
            rem -= 1;
        }
        if (i >= this.route.length - 1) {
            this.s = 0;
            i = 0;
            rem = 0;
            this.train.trail = [];
        }
        const a = this.route[i], b = this.route[Math.min(i + 1, this.route.length - 1)];
        const x = a.x + (b.x - a.x) * rem, z = a.y + (b.y - a.y) * rem;
        const tr = this.train;
        tr.x = x;
        tr.z = z;
        const dir = b.x > a.x ? 'e' : b.x < a.x ? 'w' : b.y > a.y ? 's' : 'n';
        tr.dir = dir;
        const last = tr.trail[tr.trail.length - 1];
        if (!last || Math.hypot(last.x - x, last.z - z) > 0.04)
            tr.trail.push({ x, z });
        if (tr.trail.length > 60)
            tr.trail.shift();
        view.setMonth(1);
        view.cam.x = x - 2.4;
        view.cam.z = z - 1.5;
        view.cam.zoom = 0.9;
        view.draw(ctx, [tr], -1, t);
        if (t - this.puffT > 420) {
            this.puffT = t;
            const p = view.toScreen(x, z, 0.5);
            fx.puff(p.x, p.y);
        }
    }
    draw(ctx) {
        const t = clock.realTime;
        if (sprites.ready) {
            this.drawBoard(ctx, t);
            const v = ctx.createLinearGradient(0, 0, 0, 720);
            v.addColorStop(0, 'rgba(10,40,25,0.35)');
            v.addColorStop(0.35, 'rgba(10,40,25,0)');
            v.addColorStop(0.75, 'rgba(10,40,25,0)');
            v.addColorStop(1, 'rgba(10,40,25,0.4)');
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, 1280, 720);
        }
        else
            this.draw2D(ctx, t);
        this.drawFront(ctx, t);
    }
    draw2D(ctx, t) {
        // sky
        const g = ctx.createLinearGradient(0, 0, 0, 720);
        g.addColorStop(0, '#7cc6f2');
        g.addColorStop(0.6, '#cdeefc');
        g.addColorStop(1, '#fff6d8');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1280, 720);
        // clouds
        for (let i = 0; i < 5; i++) {
            const x = ((t / 40 + i * 300) % 1600) - 200, y = 70 + (i % 3) * 50;
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            for (const [dx, dy, r] of [[0, 0, 30], [30, -12, 36], [64, 0, 28], [32, 10, 30]]) {
                ctx.beginPath();
                ctx.arc(x + dx, y + dy, r, 0, 7);
                ctx.fill();
            }
        }
        // landmarks skyline
        emoji(ctx, '🏰', 160, 470, 120);
        emoji(ctx, '🎡', 1110, 470, 110);
        emoji(ctx, '⛪', 980, 500, 80);
        emoji(ctx, '🪨', 300, 520, 60);
        // hills
        const hill = (y0, amp, col, ph) => {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(0, 720);
            for (let x = 0; x <= 1280; x += 20)
                ctx.lineTo(x, y0 + Math.sin(x / 180 + ph) * amp);
            ctx.lineTo(1280, 720);
            ctx.fill();
        };
        hill(540, 24, '#8fcf6b', 0);
        hill(590, 18, '#6fb24f', 2);
        // rails + train
        ctx.fillStyle = '#5b4636';
        ctx.fillRect(0, 640, 1280, 10);
        for (let x = 0; x < 1280; x += 26) {
            ctx.fillStyle = '#8a6a48';
            ctx.fillRect(x, 648, 14, 8);
        }
        const tx = ((t / 5) % 1700) - 200;
        drawTrain(ctx, tx, 630, '#d7263d', 2, 1, t, 3);
        for (let i = 0; i < 3; i++) {
            const a = ((t / 300 + i * 0.33) % 1);
            ctx.fillStyle = `rgba(255,255,255,${0.8 - a * 0.8})`;
            ctx.beginPath();
            ctx.arc(tx + 18 - a * 60, 596 - a * 70, 8 + a * 14, 0, 7);
            ctx.fill();
        }
    }
    drawFront(ctx, t) {
        // logo: the title picture, gently bobbing
        const bob = Math.sin(t / 500) * 6;
        const logo = getTitleImg();
        if (logo && logo.naturalWidth) {
            const k = Math.min(760 / logo.naturalWidth, 250 / logo.naturalHeight);
            const dw = logo.naturalWidth * k, dh = logo.naturalHeight * k;
            ctx.save();
            ctx.translate(640, 145 + bob);
            ctx.rotate(-0.02);
            ctx.drawImage(logo, -dw / 2, -dh / 2, dw, dh);
            ctx.restore();
        }
        else {
            ctx.save();
            ctx.translate(640, 150 + bob);
            ctx.rotate(-0.03);
            ctx.fillStyle = '#1d1d1b';
            roundRect(ctx, -400, -78, 800, 160, 30);
            ctx.fill();
            ctx.fillStyle = C.green;
            roundRect(ctx, -392, -70, 784, 144, 26);
            ctx.fill();
            ctx.strokeStyle = C.brass;
            ctx.lineWidth = 5;
            ctx.setLineDash([12, 8]);
            roundRect(ctx, -378, -56, 756, 116, 20);
            ctx.stroke();
            ctx.setLineDash([]);
            text(ctx, 'UK Express!', 0, -12, { size: 84, color: C.cream, align: 'center', outline: 12, outlineColor: '#123d27' });
            text(ctx, 'UKエクスプレス！', 0, 50, { size: 30, color: C.gold, align: 'center', outline: 6, outlineColor: '#123d27' });
            ctx.restore();
            emoji(ctx, '🇬🇧', 640, 262 + bob, 46);
        }
        if (!this.started) {
            const a = (Math.sin(t / 300) + 1) / 2;
            const l = lines(UI.start);
            text(ctx, l.main, 640, 420, { size: 44, color: '#fff', align: 'center', outline: 9, alpha: 0.5 + a * 0.5 });
            if (l.sub)
                text(ctx, l.sub, 640, 470, { size: 22, color: '#fff', align: 'center', outline: 5, alpha: 0.5 + a * 0.5 });
        }
        else {
            const kbd = !!window.__kbd;
            this.buttons.forEach((b, i) => b.draw(ctx, kbd && i === this.focus));
        }
    }
}
//# sourceMappingURL=title.js.map