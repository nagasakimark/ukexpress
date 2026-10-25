// Mini-games for special days. Each one is a full-screen modal: intro → 3-2-1 → play → result.
// They resolve with a score. CPU rivals get a simulated score for their level.
import { Button } from '../engine/ui.js';
import { C, text, emoji, roundRect, shade, panel, fitWrap } from '../engine/draw.js';
import { audio } from '../engine/audio.js';
import { fx } from '../engine/fx.js';
import { WORDS } from '../core/content/game-data.js';
import { PModal, dual } from './dialogs.js';
import { lines, t2, UI } from './i18n.js';
const lbl = (t) => lines(t).main;
export class MiniGame extends PModal {
    constructor() {
        super();
        this.phase = 'intro';
        this.t = 0;
        this.score = 0;
        this.duration = 25000;
        this.cursor = { x: 640, y: 400 };
        this.showCursor = false;
        this.endEarly = false;
        this.dim = 0.92;
    }
    open() { super.open(); this.setButtons(); }
    setButtons() {
        this.buttons = [];
        if (this.phase === 'intro')
            this.buttons.push(new Button({ x: 640 - 150, y: 560, w: 300, h: 76, label: lbl(t2('Start!', 'スタート！')), sub: lines(t2('Start!', 'スタート！')).sub ?? undefined, color: C.red, pulse: true, onClick: () => this.go('count') }));
        if (this.phase === 'result')
            this.buttons.push(new Button({ x: 640 - 130, y: 560, w: 260, h: 70, label: lbl(UI.ok), sub: lines(UI.ok).sub ?? undefined, color: C.green, onClick: () => this.resolveWith(this.score) }));
        this.focus = 0;
    }
    go(p) {
        this.phase = p;
        this.t = 0;
        this.setButtons();
        if (p === 'play')
            this.start();
        if (p === 'result') {
            audio.play('fanfare');
            fx.burst(640, 260, 'confetti', 50, { speed: 8, up: 5 });
        }
    }
    start() { }
    tap(_x, _y) { }
    scoreText() { return String(Math.round(this.score)); }
    update(dt) {
        super.update(dt);
        if (this.closing)
            return;
        this.t += dt;
        if (this.phase === 'count') {
            if (Math.floor((this.t - dt) / 1000) !== Math.floor(this.t / 1000))
                audio.play(this.t >= 3000 ? 'whistle' : 'click');
            if (this.t >= 3000)
                this.go('play');
        }
        else if (this.phase === 'play') {
            this.step(dt);
            if (this.t >= this.duration || this.endEarly)
                this.go('result');
        }
    }
    pointerDown(x, y) {
        if (this.phase === 'play') {
            this.cursor = { x, y };
            this.showCursor = false;
            this.tap(x, y);
            return true;
        }
        return true;
    }
    pointerMove(x, y) {
        super.pointerMove(x, y);
        this.cursor = { x, y };
        this.showCursor = false;
        this.move(x, y);
        return true;
    }
    pointerUp(x, y, wasDrag) {
        if (this.phase === 'play')
            return true;
        return super.pointerUp(x, y, wasDrag);
    }
    move(_x, _y) { }
    key(a, e) {
        if (this.phase !== 'play')
            return super.key(a);
        this.playKey(a, e);
        return true;
    }
    /** Default keyboard play: arrows move a cursor, Enter taps. */
    playKey(a, _e) {
        this.showCursor = true;
        const s = 36;
        if (a === 'left')
            this.cursor.x -= s;
        if (a === 'right')
            this.cursor.x += s;
        if (a === 'up')
            this.cursor.y -= s;
        if (a === 'down')
            this.cursor.y += s;
        this.cursor.x = Math.max(20, Math.min(1260, this.cursor.x));
        this.cursor.y = Math.max(90, Math.min(700, this.cursor.y));
        if (a === 'confirm')
            this.tap(this.cursor.x, this.cursor.y);
    }
    drawBody(ctx) {
        this.drawGame(ctx);
        if (this.phase === 'play' || this.phase === 'count')
            this.drawHud(ctx);
        if (this.phase === 'count') {
            const n = 3 - Math.floor(this.t / 1000);
            const k = (this.t % 1000) / 1000;
            ctx.save();
            ctx.globalAlpha = 1 - k * 0.6;
            ctx.translate(640, 380);
            ctx.scale(1.4 - k * 0.4, 1.4 - k * 0.4);
            text(ctx, n > 0 ? String(n) : 'GO!', 0, 0, { size: 150, color: C.gold, align: 'center', outline: 14 });
            ctx.restore();
        }
        if (this.phase === 'intro') {
            panel(ctx, 240, 90, 800, 520);
            ctx.fillStyle = C.red;
            roundRect(ctx, 245, 95, 790, 80, 13);
            ctx.fill();
            const tl = lines(this.title);
            text(ctx, tl.main, 640, tl.sub ? 125 : 135, { size: 38, color: '#fff', align: 'center', outline: 6, outlineColor: '#7a1020' });
            if (tl.sub)
                text(ctx, tl.sub, 640, 158, { size: 18, color: '#fff', align: 'center', weight: 500 });
            emoji(ctx, this.icon, 640, 260, 100);
            dual(ctx, this.howTo, 640, 340, 26, 700, 'center');
            text(ctx, lbl(t2(`${Math.round(this.duration / 1000)} seconds`, `${Math.round(this.duration / 1000)}秒`)), 640, 535, { size: 18, color: '#5a5a50', align: 'center', weight: 500 });
        }
        if (this.phase === 'result') {
            panel(ctx, 340, 110, 600, 530);
            text(ctx, lbl(t2('Finished!', 'おわり！')), 640, 170, { size: 44, color: C.green, align: 'center' });
            emoji(ctx, this.icon, 640, 270, 90);
            text(ctx, `${this.scoreText()} ${lbl(this.unit)}`, 640, 380, { size: 56, color: C.red, align: 'center', outline: 6, outlineColor: '#fff' });
            const stars = this.stars();
            for (let i = 0; i < 3; i++)
                emoji(ctx, i < stars ? '⭐' : '☆', 580 + i * 60, 460, 46, i < stars ? 1 : 0.4);
        }
        if (this.showCursor && this.phase === 'play') {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.cursor.x, this.cursor.y, 26, 0, 7);
            ctx.stroke();
            ctx.strokeStyle = C.red;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.cursor.x - 34, this.cursor.y);
            ctx.lineTo(this.cursor.x + 34, this.cursor.y);
            ctx.moveTo(this.cursor.x, this.cursor.y - 34);
            ctx.lineTo(this.cursor.x, this.cursor.y + 34);
            ctx.stroke();
        }
    }
    drawHud(ctx) {
        ctx.fillStyle = 'rgba(15,52,33,0.9)';
        ctx.fillRect(0, 0, 1280, 70);
        ctx.fillStyle = C.brass;
        ctx.fillRect(0, 70, 1280, 4);
        emoji(ctx, this.icon, 40, 36, 40);
        text(ctx, lbl(this.title), 76, 36, { size: 26, color: C.cream, maxWidth: 420 });
        text(ctx, `${this.scoreText()} ${lbl(this.unit)}`, 640, 36, { size: 34, color: C.gold, align: 'center' });
        const left = Math.max(0, (this.duration - (this.phase === 'play' ? this.t : 0)) / 1000);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        roundRect(ctx, 960, 24, 280, 24, 12);
        ctx.fill();
        ctx.fillStyle = left < 5 ? C.red : C.gold;
        roundRect(ctx, 960, 24, 280 * (left * 1000 / this.duration), 24, 12);
        ctx.fill();
        text(ctx, `⏱ ${Math.ceil(left)}`, 940, 36, { size: 24, color: '#fff', align: 'right' });
    }
}
export class EggHunt extends MiniGame {
    constructor() {
        super();
        this.title = t2('Easter Egg Hunt', 'イースター・エッグ探し');
        this.howTo = t2('Eggs are hiding in the garden. Tap every egg you can find!', '庭に卵がかくれているよ。見つけたらタップしよう！');
        this.icon = '🥚';
        this.unit = t2('eggs', 'こ');
        this.eggs = [];
        this.props = [];
        this.duration = 25000;
        const cols = ['#ff8fb1', '#8fd3ff', '#ffe066', '#b18cff', '#8fffb0', '#ffb37a'];
        for (let i = 0; i < 12; i++) {
            const x = 120 + (i % 6) * 200 + Math.random() * 60, y = 280 + Math.floor(i / 6) * 220 + Math.random() * 60;
            this.props.push({ x, y, kind: ['bush', 'flowers', 'bush', 'pot'][i % 4], s: 0.9 + Math.random() * 0.4 });
            if (i < 10)
                this.eggs.push({ x: x + (Math.random() - 0.5) * 50, y: y - 22 - Math.random() * 10, c: cols[i % cols.length], found: false, t: 0 });
        }
    }
    stars() { return this.score >= 9 ? 3 : this.score >= 6 ? 2 : this.score >= 3 ? 1 : 0; }
    step(dt) { for (const e of this.eggs)
        if (e.found)
            e.t += dt; if (this.eggs.every((e) => e.found))
        this.endEarly = true; }
    tap(x, y) {
        for (const e of this.eggs)
            if (!e.found && Math.hypot(e.x - x, e.y - y) < 34) {
                e.found = true;
                this.score++;
                audio.play('coin');
                fx.burst(x, y, 'star', 14, { color: e.c, speed: 6 });
                return;
            }
        audio.play('step');
    }
    drawGame(ctx) {
        const g = ctx.createLinearGradient(0, 0, 0, 720);
        g.addColorStop(0, '#9fdcff');
        g.addColorStop(0.35, '#d8f3ff');
        g.addColorStop(0.36, '#8fd46a');
        g.addColorStop(1, '#5fb14a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1280, 720);
        // fence
        ctx.fillStyle = '#f5ead0';
        for (let x = 0; x < 1280; x += 40) {
            ctx.fillRect(x + 8, 200, 22, 70);
            ctx.beginPath();
            ctx.moveTo(x + 8, 200);
            ctx.lineTo(x + 19, 188);
            ctx.lineTo(x + 30, 200);
            ctx.fill();
        }
        ctx.fillRect(0, 218, 1280, 10);
        ctx.fillRect(0, 248, 1280, 10);
        emoji(ctx, '🌳', 1150, 170, 150);
        emoji(ctx, '🏡', 120, 175, 130);
        for (const e of this.eggs) {
            if (e.found && e.t > 500)
                continue;
            ctx.save();
            ctx.translate(e.x, e.y - (e.found ? e.t / 6 : 0));
            ctx.globalAlpha = e.found ? 1 - e.t / 500 : 1;
            ctx.fillStyle = e.c;
            ctx.strokeStyle = '#20170a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 0, 17, 22, 0, 0, 7);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-15, -4);
            ctx.quadraticCurveTo(0, 4, 15, -4);
            ctx.stroke();
            ctx.restore();
        }
        for (const p of this.props) {
            if (p.kind === 'bush') {
                ctx.fillStyle = '#3f8f3a';
                for (const [dx, dy, r] of [[-30, 10, 30], [0, -4, 36], [32, 10, 30]]) {
                    ctx.beginPath();
                    ctx.arc(p.x + dx * p.s, p.y + dy * p.s, r * p.s, 0, 7);
                    ctx.fill();
                }
                ctx.fillStyle = '#5fb24d';
                ctx.beginPath();
                ctx.arc(p.x - 6, p.y - 12, 14 * p.s, 0, 7);
                ctx.fill();
            }
            else if (p.kind === 'flowers') {
                ctx.fillStyle = '#4c9a3f';
                ctx.beginPath();
                ctx.ellipse(p.x, p.y + 10, 56 * p.s, 22 * p.s, 0, 0, 7);
                ctx.fill();
                for (let k = -2; k <= 2; k++)
                    emoji(ctx, ['🌷', '🌼', '🌸'][(k + 5) % 3], p.x + k * 22, p.y - 6 + Math.abs(k) * 4, 30);
            }
            else {
                ctx.fillStyle = '#c0613a';
                ctx.beginPath();
                ctx.moveTo(p.x - 34, p.y - 10);
                ctx.lineTo(p.x + 34, p.y - 10);
                ctx.lineTo(p.x + 24, p.y + 34);
                ctx.lineTo(p.x - 24, p.y + 34);
                ctx.closePath();
                ctx.fill();
                emoji(ctx, '🌱', p.x, p.y - 26, 40);
            }
        }
        emoji(ctx, '🧺', 1200, 650, 70);
    }
}
// ======================= Wimbledon tennis =======================
export class Tennis extends MiniGame {
    constructor() {
        super();
        this.title = t2('Wimbledon Rally', 'ウィンブルドン・ラリー');
        this.howTo = t2('Move your racket left and right. Hit the ball back as many times as you can! Miss 3 and it is over.', 'ラケットを左右に動かして、ボールを打ち返そう！3回ミスしたらおわり。');
        this.icon = '🎾';
        this.unit = t2('hits', '回');
        this.racket = 640;
        this.ball = { x: 640, y: 170, vx: 0, vy: 0 };
        this.misses = 0;
        this.pause = 0;
        this.speed = 0.42;
        this.duration = 30000;
    }
    stars() { return this.score >= 15 ? 3 : this.score >= 8 ? 2 : this.score >= 3 ? 1 : 0; }
    start() { this.serve(); }
    serve() { this.ball = { x: 640, y: 170, vx: (Math.random() - 0.5) * 0.3, vy: this.speed }; }
    move(x) { if (this.phase === 'play')
        this.racket = Math.max(260, Math.min(1020, x)); }
    playKey(a) { if (a === 'left')
        this.racket -= 60; if (a === 'right')
        this.racket += 60; this.racket = Math.max(260, Math.min(1020, this.racket)); }
    step(dt) {
        if (this.pause > 0) {
            this.pause -= dt;
            if (this.pause <= 0)
                this.serve();
            return;
        }
        const b = this.ball;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 270 || b.x > 1010) {
            b.vx = -b.vx;
            b.x = Math.max(270, Math.min(1010, b.x));
        }
        if (b.vy > 0 && b.y >= 600 && b.y < 640) {
            if (Math.abs(b.x - this.racket) < 80) {
                this.score++;
                audio.play('click');
                fx.burst(b.x, 600, 'star', 8, { color: '#e8ff5a', speed: 5 });
                this.speed = Math.min(1.1, this.speed + 0.035);
                b.vy = -this.speed;
                b.vx = (b.x - this.racket) / 80 * 0.35 + (Math.random() - 0.5) * 0.2;
            }
        }
        if (b.y > 700) {
            this.misses++;
            audio.play('bad');
            fx.shake(8);
            this.pause = 900;
            if (this.misses >= 3)
                this.endEarly = true;
        }
        if (b.vy < 0 && b.y <= 170) {
            b.vy = this.speed;
            b.vx = ((300 + Math.random() * 680) - b.x) / ((600 - 170) / this.speed);
            audio.play('step');
        }
    }
    drawGame(ctx) {
        ctx.fillStyle = '#3f8f3a';
        ctx.fillRect(0, 0, 1280, 720);
        ctx.fillStyle = '#5fae4a';
        ctx.beginPath();
        ctx.moveTo(380, 120);
        ctx.lineTo(900, 120);
        ctx.lineTo(1060, 700);
        ctx.lineTo(220, 700);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(640, 120);
        ctx.lineTo(640, 700);
        ctx.moveTo(300, 410);
        ctx.lineTo(980, 410);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(300, 400, 680, 6);
        for (let x = 300; x < 980; x += 20) {
            ctx.fillStyle = 'rgba(30,30,30,0.35)';
            ctx.fillRect(x, 380, 2, 24);
        }
        emoji(ctx, '🍓', 120, 640, 60);
        emoji(ctx, '🏆', 1160, 640, 60);
        emoji(ctx, '🧑', 640, 128, 50);
        const b = this.ball;
        if (this.pause <= 0) {
            const s = 0.6 + (b.y - 170) / 430 * 0.6;
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.ellipse(b.x + 6, b.y + 10, 12 * s, 6 * s, 0, 0, 7);
            ctx.fill();
            ctx.fillStyle = '#e8ff5a';
            ctx.strokeStyle = '#20170a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(b.x, b.y, 14 * s, 0, 7);
            ctx.fill();
            ctx.stroke();
        }
        // racket
        ctx.save();
        ctx.translate(this.racket, 620);
        ctx.fillStyle = '#7a5230';
        ctx.fillRect(-6, 20, 12, 60);
        ctx.strokeStyle = '#20170a';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.ellipse(0, 0, 70, 30, 0, 0, 7);
        ctx.stroke();
        ctx.strokeStyle = C.red;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        for (let k = -60; k <= 60; k += 15) {
            ctx.beginPath();
            ctx.moveTo(k, -26);
            ctx.lineTo(k, 26);
            ctx.stroke();
        }
        ctx.restore();
        for (let i = 0; i < 3; i++)
            emoji(ctx, i < this.misses ? '❌' : '🎾', 1180 + 0 * i, 140 + i * 50, 34, i < this.misses ? 1 : 0.6);
    }
}
// ======================= Highland Games caber toss =======================
export class Caber extends MiniGame {
    constructor() {
        super();
        this.title = t2('Caber Toss', 'ケーバー投げ');
        this.howTo = t2('Tap to stop the POWER bar, then tap to stop the ANGLE. Best of 3 throws!', 'タップでパワーを止めて、もう一回タップで角度を止めよう。3回投げていちばんの記録が勝負！');
        this.icon = '🪵';
        this.unit = t2('metres', 'メートル');
        this.sub = 'power';
        this.st = 0;
        this.power = 0;
        this.angle = 45;
        this.tries = 0;
        this.last = 0;
        this.flyT = 0;
        this.duration = 60000;
    }
    scoreText() { return this.score.toFixed(1); }
    stars() { return this.score >= 16 ? 3 : this.score >= 11 ? 2 : this.score >= 6 ? 1 : 0; }
    step(dt) {
        this.st += dt;
        if (this.sub === 'power')
            this.power = (Math.sin(this.st / 380 - Math.PI / 2) + 1) / 2;
        if (this.sub === 'angle')
            this.angle = 45 + Math.sin(this.st / 330) * 40;
        if (this.sub === 'throw') {
            this.flyT += dt;
            if (this.flyT > 1600) {
                this.sub = 'show';
                this.st = 0;
                audio.play(this.last >= 12 ? 'fanfare' : 'coin');
                fx.shake(10);
            }
        }
        if (this.sub === 'show' && this.st > 1400) {
            if (this.tries >= 3)
                this.endEarly = true;
            else {
                this.sub = 'power';
                this.st = 0;
                this.flyT = 0;
            }
        }
    }
    tap() {
        if (this.sub === 'power') {
            this.sub = 'angle';
            this.st = 0;
            audio.play('click');
        }
        else if (this.sub === 'angle') {
            this.sub = 'throw';
            this.st = 0;
            this.flyT = 0;
            this.tries++;
            const a = this.angle * Math.PI / 180;
            this.last = Math.max(1, 20 * this.power * Math.sin(2 * a) + 1.5 * Math.random());
            this.score = Math.max(this.score, this.last);
            audio.play('whistle');
        }
    }
    playKey(a) { if (a === 'confirm')
        this.tap(); }
    drawGame(ctx) {
        const g = ctx.createLinearGradient(0, 0, 0, 720);
        g.addColorStop(0, '#a9c9e8');
        g.addColorStop(0.45, '#dfe9f2');
        g.addColorStop(0.46, '#7aa34e');
        g.addColorStop(1, '#5c8a3c');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1280, 720);
        ctx.fillStyle = '#8e8a78';
        ctx.beginPath();
        ctx.moveTo(0, 330);
        ctx.lineTo(220, 200);
        ctx.lineTo(420, 320);
        ctx.lineTo(650, 180);
        ctx.lineTo(900, 320);
        ctx.lineTo(1100, 220);
        ctx.lineTo(1280, 300);
        ctx.lineTo(1280, 332);
        ctx.lineTo(0, 332);
        ctx.fill();
        // distance markers
        for (let m = 0; m <= 20; m += 5) {
            const x = 220 + m * 48;
            ctx.fillStyle = '#fff';
            ctx.fillRect(x - 2, 560, 4, 30);
            text(ctx, `${m}m`, x, 606, { size: 18, color: '#fff', align: 'center', outline: 4 });
        }
        // athlete
        // a Scottish Saltire flag
        ctx.fillStyle = '#5b4636';
        ctx.fillRect(128, 430, 4, 70);
        ctx.fillStyle = '#005eb8';
        ctx.fillRect(132, 430, 54, 34);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(132, 430);
        ctx.lineTo(186, 464);
        ctx.moveTo(186, 430);
        ctx.lineTo(132, 464);
        ctx.stroke();
        emoji(ctx, '💪', 190, 520, 60);
        // caber
        const fly = this.sub === 'throw' || this.sub === 'show';
        const k = Math.min(1, this.flyT / 1600);
        const dist = fly ? this.last : 0;
        const cx = 220 + dist * 48 * k;
        const cy = 520 - Math.sin(k * Math.PI) * 220 * (fly ? 1 : 0);
        const rot = fly ? -Math.PI / 2 + k * Math.PI : -Math.PI / 2 + (this.sub === 'angle' ? (90 - this.angle) * Math.PI / 180 * 0.4 : 0);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.fillStyle = '#8a5a2b';
        ctx.strokeStyle = '#20170a';
        ctx.lineWidth = 3;
        roundRect(ctx, -90, -11, 180, 22, 10);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 2;
        for (let x = -70; x < 90; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, -8);
            ctx.lineTo(x + 10, 8);
            ctx.stroke();
        }
        ctx.restore();
        // meters
        if (this.sub === 'power' || this.sub === 'angle') {
            panel(ctx, 820, 110, 400, 300, { fill: '#fffaf0' });
            text(ctx, lbl(t2('POWER', 'パワー')), 860, 150, { size: 24 });
            ctx.fillStyle = '#ddd';
            roundRect(ctx, 860, 170, 320, 36, 10);
            ctx.fill();
            const pg = ctx.createLinearGradient(860, 0, 1180, 0);
            pg.addColorStop(0, '#3dbe5a');
            pg.addColorStop(0.7, '#f2c230');
            pg.addColorStop(1, '#e8443a');
            ctx.fillStyle = pg;
            roundRect(ctx, 860, 170, 320 * this.power, 36, 10);
            ctx.fill();
            text(ctx, lbl(t2('ANGLE', '角度')), 860, 250, { size: 24, alpha: this.sub === 'angle' ? 1 : 0.4 });
            ctx.save();
            ctx.translate(900, 390);
            ctx.globalAlpha = this.sub === 'angle' ? 1 : 0.4;
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, 100, -Math.PI / 2, 0);
            ctx.stroke();
            ctx.strokeStyle = '#3dbe5a';
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.arc(0, 0, 100, -Math.PI / 4 - 0.15, -Math.PI / 4 + 0.15);
            ctx.stroke();
            const a = -this.angle * Math.PI / 180;
            ctx.strokeStyle = C.red;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * 110, Math.sin(a) * 110);
            ctx.stroke();
            ctx.restore();
            text(ctx, lbl(t2('Tap!', 'タップ！')), 1100, 360, { size: 40, color: C.red, align: 'center', outline: 6, outlineColor: '#fff' });
        }
        if (this.sub === 'show')
            text(ctx, `${this.last.toFixed(1)} m!`, 640, 300, { size: 80, color: C.gold, align: 'center', outline: 10 });
        text(ctx, `${lbl(t2('Throw', '投げ'))} ${Math.min(3, this.tries + (this.sub === 'power' || this.sub === 'angle' ? 1 : 0))}/3`, 40, 110, { size: 26, color: '#fff', outline: 5 });
    }
}
export class Fireworks extends MiniGame {
    constructor() {
        super();
        this.title = t2('Firework Spelling', '花火でスペリング');
        this.howTo = t2('Spell the word! Tap the rocket with the next letter (or type it on the keyboard).', '単語をつづろう！次の文字のロケットをタップしよう（キーボードで打ってもOK）。');
        this.icon = '🎆';
        this.unit = t2('letters', '文字');
        this.words = WORDS.slice().sort(() => Math.random() - 0.5);
        this.wi = 0;
        this.filled = 0;
        this.rockets = [];
        this.spawn = 0;
        this.wordsDone = 0;
        this.flash = 0;
        this.duration = 35000;
    }
    stars() { return this.wordsDone >= 4 ? 3 : this.wordsDone >= 2 ? 2 : this.wordsDone >= 1 ? 1 : 0; }
    word() { return this.words[this.wi % this.words.length]; }
    need() { return this.word().word[this.filled]; }
    step(dt) {
        this.spawn -= dt;
        this.flash = Math.max(0, this.flash - dt);
        if (this.spawn <= 0) {
            this.spawn = 650;
            const w = this.word().word;
            const r = Math.random();
            const ch = r < 0.5 ? this.need() : r < 0.75 ? w[Math.floor(Math.random() * w.length)] : String.fromCharCode(65 + Math.floor(Math.random() * 26));
            this.rockets.push({ x: 120 + Math.random() * 1040, y: 740, vy: 0.14 + Math.random() * 0.06, ch, dead: false });
        }
        for (const rk of this.rockets) {
            rk.y -= rk.vy * dt;
            if (rk.y < 120)
                rk.dead = true;
        }
        this.rockets = this.rockets.filter((r) => !r.dead);
        if (!this.rockets.some((r) => r.ch === this.need()) && this.spawn > 300)
            this.spawn = 300;
    }
    pop(rk) {
        rk.dead = true;
        if (rk.ch === this.need()) {
            this.filled++;
            this.score++;
            audio.play('coin');
            fx.burst(rk.x, rk.y, 'star', 26, { speed: 9, up: 0, color: ['#ff6b6b', '#ffd93d', '#6bcBff', '#c77dff', '#7dff9b'][Math.floor(Math.random() * 5)] });
            if (this.filled >= this.word().word.length) {
                this.wordsDone++;
                this.flash = 900;
                audio.play('fanfare');
                for (let i = 0; i < 4; i++)
                    fx.burst(200 + i * 300, 250, 'confetti', 30, { speed: 10, up: 4 });
                this.wi++;
                this.filled = 0;
                this.rockets = [];
            }
        }
        else {
            audio.play('quizWrong');
            fx.burst(rk.x, rk.y, 'puff', 6, { speed: 2, up: 0 });
        }
    }
    tap(x, y) {
        let best = null, bd = 60;
        for (const rk of this.rockets) {
            const d = Math.hypot(rk.x - x, rk.y - y);
            if (d < bd) {
                bd = d;
                best = rk;
            }
        }
        if (best)
            this.pop(best);
    }
    playKey(a, e) {
        const k = e?.key?.toUpperCase();
        if (k && /^[A-Z]$/.test(k)) {
            const rk = this.rockets.filter((r) => r.ch === k).sort((p, q) => q.y - p.y)[0];
            if (rk)
                this.pop(rk);
            else
                audio.play('step');
            return;
        }
        super.playKey(a, e);
    }
    drawGame(ctx) {
        const g = ctx.createLinearGradient(0, 0, 0, 720);
        g.addColorStop(0, '#0b1030');
        g.addColorStop(1, '#2a2a5a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1280, 720);
        for (let i = 0; i < 60; i++) {
            ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) / 8})`;
            ctx.fillRect((i * 211) % 1280, (i * 97) % 400 + 80, 2, 2);
        }
        // skyline with Big Ben and a bonfire
        ctx.fillStyle = '#141428';
        ctx.beginPath();
        ctx.moveTo(0, 720);
        for (let x = 0; x <= 1280; x += 80)
            ctx.lineTo(x, 610 - ((x * 37) % 70));
        ctx.lineTo(1280, 720);
        ctx.fill();
        ctx.fillRect(1080, 440, 50, 200);
        ctx.beginPath();
        ctx.moveTo(1075, 440);
        ctx.lineTo(1105, 390);
        ctx.lineTo(1135, 440);
        ctx.fill();
        ctx.fillStyle = '#f2e6b0';
        ctx.beginPath();
        ctx.arc(1105, 475, 16, 0, 7);
        ctx.fill();
        emoji(ctx, '🔥', 160, 640, 90);
        for (const rk of this.rockets) {
            ctx.fillStyle = 'rgba(255,200,120,0.6)';
            ctx.fillRect(rk.x - 2, rk.y + 30, 4, 40);
            ctx.fillStyle = '#e8443a';
            ctx.strokeStyle = '#20170a';
            ctx.lineWidth = 3;
            roundRect(ctx, rk.x - 26, rk.y - 26, 52, 52, 12);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ffd93d';
            ctx.beginPath();
            ctx.moveTo(rk.x - 20, rk.y - 26);
            ctx.lineTo(rk.x, rk.y - 48);
            ctx.lineTo(rk.x + 20, rk.y - 26);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            text(ctx, rk.ch, rk.x, rk.y + 2, { size: 36, color: '#fff', align: 'center', outline: 5 });
        }
        // the word to spell
        const w = this.word();
        panel(ctx, 340, 92, 600, 120, { fill: this.flash > 0 ? '#fff4c7' : '#fffaf0', radius: 18 });
        emoji(ctx, w.emoji, 400, 152, 64);
        const letters = w.word.split('');
        letters.forEach((ch, i) => {
            const x = 480 + i * 66;
            ctx.fillStyle = i < this.filled ? '#3dbe5a' : i === this.filled ? '#ffe066' : '#e6e0cf';
            roundRect(ctx, x, 118, 56, 66, 10);
            ctx.fill();
            if (i < this.filled)
                text(ctx, ch, x + 28, 152, { size: 44, align: 'center' });
            else if (i === this.filled)
                text(ctx, '?', x + 28, 152, { size: 40, align: 'center', color: '#b08a00' });
        });
        if (w.ja)
            text(ctx, w.ja, 400, 200, { size: 16, align: 'center', color: '#5a5a50', weight: 500 });
    }
}
// ======================= Pancake Day race =======================
export class Pancake extends MiniGame {
    constructor() {
        super();
        this.title = t2('Pancake Race', 'パンケーキ競走');
        this.howTo = t2('Tap when the marker is in the green zone to flip your pancake and run faster!', 'マーカーが緑のところに来たらタップ！パンケーキをひっくり返して走ろう！');
        this.icon = '🥞';
        this.unit = t2('flips', '回');
        this.pos = 0;
        this.dir = 1;
        this.zone = 0.24;
        this.flipT = 0;
        this.drop = 0;
        this.run = 0;
        this.duration = 25000;
    }
    stars() { return this.score >= 18 ? 3 : this.score >= 10 ? 2 : this.score >= 4 ? 1 : 0; }
    step(dt) {
        const sp = 0.0011 + this.score * 0.00005;
        this.pos += this.dir * sp * dt;
        if (this.pos > 1) {
            this.pos = 1;
            this.dir = -1;
        }
        if (this.pos < 0) {
            this.pos = 0;
            this.dir = 1;
        }
        this.flipT = Math.max(0, this.flipT - dt);
        this.drop = Math.max(0, this.drop - dt);
        this.run += (0.02 + this.score * 0.004) * dt * 0.05;
        if (this.score >= 25)
            this.endEarly = true;
    }
    tap() {
        if (this.drop > 0 || this.flipT > 0)
            return;
        const c = 0.5;
        if (Math.abs(this.pos - c) < this.zone / 2) {
            this.score++;
            this.flipT = 450;
            this.zone = Math.max(0.1, this.zone - 0.006);
            audio.play('coin');
            fx.burst(640, 360, 'star', 10, { color: C.gold, speed: 6 });
        }
        else {
            this.drop = 700;
            audio.play('bad');
            fx.shake(6);
        }
    }
    playKey(a) { if (a === 'confirm' || a === 'up')
        this.tap(); }
    drawGame(ctx) {
        ctx.fillStyle = '#bfe3ff';
        ctx.fillRect(0, 0, 1280, 720);
        // street with shops scrolling
        const off = (this.run * 300) % 240;
        for (let i = -1; i < 7; i++) {
            const x = i * 240 - off;
            ctx.fillStyle = ['#e8a87c', '#c38d9e', '#85dcb0', '#e27d60', '#41b3a3'][(i + 50) % 5];
            ctx.fillRect(x, 150, 220, 300);
            ctx.fillStyle = '#fff';
            ctx.fillRect(x + 30, 200, 60, 70);
            ctx.fillRect(x + 130, 200, 60, 70);
            ctx.fillStyle = '#5a3b2e';
            ctx.fillRect(x + 85, 360, 50, 90);
        }
        ctx.fillStyle = '#9a9a9a';
        ctx.fillRect(0, 450, 1280, 270);
        ctx.fillStyle = '#fff';
        for (let x = -off; x < 1280; x += 120)
            ctx.fillRect(x, 580, 60, 8);
        // runner + pan + pancake
        const bob = Math.abs(Math.sin(this.t / 120)) * 10;
        ctx.save();
        ctx.translate(520, 470 - bob);
        ctx.scale(-1, 1);
        emoji(ctx, '🏃', 0, 0, 140);
        ctx.restore();
        ctx.save();
        ctx.translate(640, 380 - bob);
        ctx.fillStyle = '#333';
        ctx.fillRect(40, -6, 90, 12);
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.ellipse(0, 0, 60, 16, 0, 0, 7);
        ctx.fill();
        const up = this.flipT > 0 ? Math.sin((1 - this.flipT / 450) * Math.PI) * 140 : 0;
        const rot = this.flipT > 0 ? (1 - this.flipT / 450) * Math.PI * 2 : 0;
        if (this.drop > 0) {
            ctx.translate(0, (1 - this.drop / 700) * 120);
        }
        ctx.translate(0, -12 - up);
        ctx.scale(1, Math.cos(rot) * 0.9 + 0.1);
        ctx.fillStyle = '#f2c46b';
        ctx.strokeStyle = '#a8742a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 48, 12, 0, 0, 7);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#d99a3a';
        ctx.beginPath();
        ctx.arc(-14, -2, 5, 0, 7);
        ctx.arc(12, 3, 4, 0, 7);
        ctx.fill();
        ctx.restore();
        // timing bar
        const bx = 290, bw = 700, by = 630;
        panel(ctx, bx - 20, by - 26, bw + 40, 76, { fill: '#fffaf0', radius: 18, rivets: false });
        ctx.fillStyle = '#e6e0cf';
        roundRect(ctx, bx, by - 6, bw, 28, 12);
        ctx.fill();
        ctx.fillStyle = '#3dbe5a';
        roundRect(ctx, bx + bw * (0.5 - this.zone / 2), by - 6, bw * this.zone, 28, 8);
        ctx.fill();
        const mx = bx + bw * this.pos;
        ctx.fillStyle = C.red;
        ctx.strokeStyle = '#20170a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(mx, by + 26);
        ctx.lineTo(mx - 14, by + 44);
        ctx.lineTo(mx + 14, by + 44);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(mx - 3, by - 10, 6, 36);
        if (this.drop > 0)
            text(ctx, lbl(t2('Oops!', 'おっと！')), 640, 250, { size: 60, color: C.red, align: 'center', outline: 8, outlineColor: '#fff' });
    }
}
export const MINIGAMES = {
    eggs: () => new EggHunt(), tennis: () => new Tennis(), caber: () => new Caber(), fireworks: () => new Fireworks(), pancake: () => new Pancake(),
};
/** A believable score for a CPU rival of the given level. */
export function cpuScore(id, level, r) {
    const range = { eggs: [4, 10], tennis: [3, 16], caber: [7, 18], fireworks: [5, 20], pancake: [6, 20] };
    const [lo, hi] = range[id] ?? [1, 10];
    const k = { gentle: [0.2, 0.6], normal: [0.4, 0.85], clever: [0.6, 1] }[level];
    const f = k[0] + r() * (k[1] - k[0]);
    const v = lo + (hi - lo) * f;
    return id === 'caber' ? Math.round(v * 10) / 10 : Math.round(v);
}
export { fitWrap, shade };
//# sourceMappingURL=minigames.js.map