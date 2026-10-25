import { app } from '../app.js';
import { Button, navigate } from '../../engine/ui.js';
import { C, panel, text, emoji, roundRect } from '../../engine/draw.js';
import { clock } from '../../engine/tween.js';
import { audio } from '../../engine/audio.js';
import { fx } from '../../engine/fx.js';
import { lines, UI, t2, main } from '../i18n.js';
import { choose, PModal, header } from '../dialogs.js';
import { howToPlay } from '../tutorial.js';
import { BookModal } from '../book.js';
import { board } from '../../core/map.js';
import { view } from '../fake3d/view.js';
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
// The QR code (assets/images/qrcode.png) shown by the top-right button.
let qrImg = null;
let qrImgOk = false;
function getQrImg() {
    if (!qrImg && typeof Image !== 'undefined') {
        const img = new Image();
        img.onload = () => { qrImgOk = true; };
        img.onerror = () => { qrImg = null; };
        img.src = 'assets/images/qrcode.png';
        qrImg = img;
    }
    return qrImgOk && qrImg ? qrImg : null;
}
/** A modal showing the game's QR code, opened from the title screen's top-right button. */
class QrModal extends PModal {
    constructor() {
        super();
        getQrImg(); // start loading straight away
        const l = lines(UI.ok);
        this.buttons.push(new Button({ x: 640 - 130, y: 616, w: 260, h: 64, label: l.main, sub: l.sub ?? undefined, color: C.green, onClick: () => this.resolveWith(undefined) }));
        this.onBack = () => this.resolveWith(undefined);
        this.focus = 0;
    }
    drawBody(ctx) {
        panel(ctx, 340, 40, 600, 640, { fill: '#f3ead2' });
        header(ctx, t2('Play UK Express!', 'UKエクスプレス！であそぼう'), 340, 40, 600, C.green);
        const img = getQrImg();
        const bx = 440, by = 150, bs = 400;
        ctx.fillStyle = '#fff';
        roundRect(ctx, bx - 10, by - 10, bs + 20, bs + 20, 16);
        ctx.fill();
        if (img && img.naturalWidth)
            ctx.drawImage(img, bx, by, bs, bs);
        else
            text(ctx, main(t2('Loading…', 'よみこみちゅう…')), 640, by + bs / 2, { size: 28, color: '#5a5a50', align: 'center' });
        text(ctx, main(t2('Scan with a phone or tablet!', 'スマホやタブレットでよみとってね！')), 640, 600, { size: 22, color: '#5a5a50', align: 'center' });
    }
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
            new Button({ x: 1280 - 16 - 110, y: 16, w: 110, h: 60, label: 'QR', icon: '📱', size: 24, color: '#3a7be8', onClick: () => { app.show(new QrModal()); } }),
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
        else if (a !== 'other')
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
        // The board sprites are loaded before the title screen shows (see boot()),
        // so the normal 3D view is always used. If loading failed, the ground and
        // signs still draw; only the sprites are missing.
        this.drawBoard(ctx, t);
        const v = ctx.createLinearGradient(0, 0, 0, 720);
        v.addColorStop(0, 'rgba(10,40,25,0.35)');
        v.addColorStop(0.35, 'rgba(10,40,25,0)');
        v.addColorStop(0.75, 'rgba(10,40,25,0)');
        v.addColorStop(1, 'rgba(10,40,25,0.4)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, 1280, 720);
        this.drawFront(ctx, t);
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