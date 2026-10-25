import { Button } from '../../engine/ui.js';
import { C, panel, text, emoji, money, roundRect } from '../../engine/draw.js';
import { fx } from '../../engine/fx.js';
import { audio } from '../../engine/audio.js';
import { AVATARS } from '../../core/content/game-data.js';
import { assets, ranking } from '../../core/rules.js';
import { lines, t2, main } from '../i18n.js';
export class ResultsScene {
    constructor(g, onDone) {
        this.g = g;
        this.t = 0;
        this.awards = [];
        this.btn = new Button({ x: 640 - 150, y: 630, w: 300, h: 66, label: main(t2('Back to title', 'タイトルへ')), sub: lines(t2('Back to title', 'タイトルへ')).sub ?? undefined, color: C.green, onClick: onDone });
        const by = (f) => g.players.slice().sort((a, b) => f(b) - f(a))[0];
        const ex = by((p) => p.visited.length), sc = by((p) => p.stars), he = by((p) => p.heroCollection.length), ar = by((p) => p.arrivals);
        this.awards = [
            { title: t2('Explorer', 'たんけん家'), icon: '🧭', p: ex, value: `${ex.visited.length} stations` },
            { title: t2('Scholar', '物知り博士'), icon: '🎓', p: sc, value: `${sc.stars} ⭐` },
            { title: t2('Hero Collector', 'ヒーロー・コレクター'), icon: '🦸', p: he, value: `${he.heroCollection.length} heroes` },
            { title: t2('Speed Star', 'スピードスター'), icon: '🚩', p: ar, value: `${ar.arrivals} arrivals` },
        ];
    }
    enter() { audio.play('fanfare'); audio.startMusic('title'); }
    update(dt) { this.t += dt; if (Math.random() < 0.05)
        fx.burst(200 + Math.random() * 880, 120, 'confetti', 8, { speed: 4, up: 2 }); }
    pointerMove(x, y) { this.btn.hover = this.btn.hit(x, y); }
    pointerUp(x, y) { if (this.btn.hit(x, y))
        this.btn.click(); return true; }
    key(a) { if (a === 'confirm')
        this.btn.click(); return true; }
    draw(ctx) {
        const g = ctx.createLinearGradient(0, 0, 0, 720);
        g.addColorStop(0, '#2b5f8f');
        g.addColorStop(1, '#123d27');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1280, 720);
        text(ctx, main(t2('Final results!', '最終結果！')), 640, 50, { size: 44, color: C.gold, align: 'center', outline: 8 });
        const r = ranking(this.g);
        const pods = [[1, 300, 230], [0, 380, 470], [2, 230, 710]];
        for (const [i, h, x] of pods) {
            const p = r[i];
            if (!p)
                continue;
            const top = 470 - h + 140;
            ctx.fillStyle = ['#e8c45f', '#c0c7cf', '#d08a4f'][i];
            roundRect(ctx, x, top, 200, 470 - top + 60, 12);
            ctx.fill();
            text(ctx, String(i + 1), x + 100, top + 40, { size: 50, align: 'center', color: '#fff', outline: 7 });
            const bob = Math.sin(this.t / 300 + i) * 6;
            ctx.fillStyle = C.players[p.color];
            ctx.beginPath();
            ctx.arc(x + 100, top - 50 + bob, 46, 0, 7);
            ctx.fill();
            emoji(ctx, AVATARS[p.avatar].emoji, x + 100, top - 50 + bob, 64);
            if (i === 0)
                emoji(ctx, '👑', x + 100, top - 110 + bob, 40);
            text(ctx, main(p.name), x + 100, top + 90, { size: 24, align: 'center', color: '#1d1d1b', maxWidth: 190 });
            text(ctx, money(assets(this.g, p)), x + 100, top + 122, { size: 22, align: 'center', color: '#1d1d1b' });
        }
        panel(ctx, 940, 110, 320, 500, { fill: '#fffaf0' });
        text(ctx, main(t2('Awards', 'とくべつ賞')), 1100, 145, { size: 28, align: 'center', color: C.green });
        this.awards.forEach((a, i) => {
            const y = 190 + i * 102;
            emoji(ctx, a.icon, 990, y + 20, 44);
            text(ctx, main(a.title), 1025, y + 6, { size: 20, maxWidth: 220 });
            text(ctx, `${main(a.p.name)} · ${a.value}`, 1025, y + 36, { size: 16, weight: 500, color: '#555', maxWidth: 220 });
        });
        if (r.length > 3)
            r.slice(3).forEach((p, k) => text(ctx, `${4 + k}. ${main(p.name)} ${money(assets(this.g, p))}`, 120, 600 + k * 26, { size: 18, color: '#fff' }));
        this.btn.draw(ctx, false);
    }
}
//# sourceMappingURL=results.js.map