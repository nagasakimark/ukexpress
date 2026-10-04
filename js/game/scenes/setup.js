import { Button, navigate } from '../../engine/ui.js';
import { C, panel, text, emoji, roundRect } from '../../engine/draw.js';
import { audio } from '../../engine/audio.js';
import { AVATARS } from '../../core/content/game-data.js';
import { lang, lines, t2, main } from '../i18n.js';
import { renderWorld } from '../mapart.js';
export class SetupScene {
    constructor(onStart, onBack) {
        this.onStart = onStart;
        this.onBack = onBack;
        /** the avatar each human player picked; tab = which player is being edited */
        this.avs = [0, 1, 2, 3];
        this.tab = 0;
        this.humans = 1;
        this.rivals = 3;
        this.level = 'normal';
        this.years = 1;
        this.lng = lang.mode === 'en' ? 'en' : 'bi';
        this.buttons = [];
        this.focus = 0;
        this.groups = {};
    }
    enter() { this.build(); }
    /** Keeps the human and CPU counts valid: 2 to 4 players in all, and nobody shares an avatar. */
    fix() {
        this.humans = Math.max(1, Math.min(4, this.humans));
        this.rivals = Math.max(this.humans === 1 ? 1 : 0, Math.min(this.rivals, 4 - this.humans));
        this.tab = Math.min(this.tab, this.humans - 1);
        const used = [];
        for (let i = 0; i < this.humans; i++) {
            if (used.includes(this.avs[i]))
                this.avs[i] = [0, 1, 2, 3, 4, 5, 6, 7].find((a) => !used.includes(a) && !this.avs.slice(0, this.humans).includes(a)) ?? this.avs[i];
            used.push(this.avs[i]);
        }
    }
    build() {
        this.fix();
        this.buttons = [];
        this.groups = {};
        const add = (group, b) => { var _a; ((_a = this.groups)[group] || (_a[group] = [])).push(b); this.buttons.push(b); };
        const takenByOther = (a) => this.avs.slice(0, this.humans).some((v, i) => i !== this.tab && v === a);
        if (this.humans > 1) {
            for (let i = 0; i < this.humans; i++)
                add('tabs', new Button({ x: 640 - (this.humans * 160) / 2 + i * 160, y: 58, w: 150, h: 40, label: lines(t2(`Player ${i + 1}`, `プレイヤー${i + 1}`)).main, size: 19, color: this.tab === i ? C.players[i] : '#5f7d6a', onClick: () => { this.tab = i; this.build(); } }));
        }
        AVATARS.forEach((a, i) => add('avatar', new Button({ x: 70 + i * 145, y: 106, w: 130, h: 112, label: '', enabled: !takenByOther(i), color: this.avs[this.tab] === i ? '#e6a817' : '#5f7d6a', onClick: () => { this.avs[this.tab] = i; this.build(); } })));
        const row = (group, y, opts, x0 = 360, w = 230) => opts.forEach((o, i) => add(group, new Button({ x: x0 + i * (w + 20), y, w, h: 56, label: lines(o.label).main, sub: lines(o.label).sub ?? undefined, size: 21, enabled: o.enabled ?? true, color: o.on ? '#d7263d' : '#5f7d6a', onClick: () => { o.fn(); this.build(); } })));
        row('humans', 276, [1, 2, 3, 4].map((n) => ({ label: t2(`${n} player${n > 1 ? 's' : ''}`, `${n}人`), on: this.humans === n, fn: () => (this.humans = n) })), 360, 170);
        row('rivals', 342, [0, 1, 2, 3].map((n) => ({ label: t2(`${n} CPU`, `CPU ${n}人`), on: this.rivals === n, enabled: this.humans + n <= 4 && this.humans + n >= 2, fn: () => (this.rivals = n) })), 360, 170);
        row('level', 408, ['gentle', 'normal', 'clever'].map((l) => ({ label: { gentle: t2('Gentle', 'やさしい'), normal: t2('Normal', 'ふつう'), clever: t2('Clever', 'つよい') }[l], on: this.level === l, fn: () => (this.level = l) })));
        row('years', 474, [[1, t2('Short: 1 year', 'みじかい：1年')], [3, t2('Medium: 3 years', 'ふつう：3年')], [10, t2('Long: 10 years', 'ながい：10年')]].map(([n, l]) => ({ label: l, on: this.years === n, fn: () => (this.years = n) })));
        row('lang', 540, [['bi', t2('English + 日本語', 'English + 日本語')], ['en', t2('English only', 'English only')]].map(([l, label]) => ({ label: { en: label.en, ja: label.ja }, on: this.lng === l, fn: () => { this.lng = l; lang.mode = l; } })));
        this.buttons.push(new Button({ x: 820, y: 622, w: 300, h: 72, label: main(t2("Let's go!", 'しゅっぱつ！')), sub: lines(t2("Let's go!", 'しゅっぱつ！')).sub ?? undefined, color: '#d7263d', pulse: true, onClick: () => this.start() }));
        this.buttons.push(new Button({ x: 160, y: 622, w: 220, h: 72, label: main(t2('Back', 'もどる')), sub: lines(t2('Back', 'もどる')).sub ?? undefined, color: '#7a6a55', onClick: () => this.onBack() }));
        if (this.focus >= this.buttons.length)
            this.focus = 0;
    }
    start() {
        lang.mode = this.lng;
        renderWorld();
        this.fix();
        this.onStart({ years: this.years, rivals: this.rivals, humans: this.humans, avatars: this.avs.slice(0, this.humans), level: this.level, lang: this.lng, avatar: this.avs[0], seed: (Math.random() * 2 ** 31) | 0, helper: true, autoplay: false });
    }
    update() { }
    pointerMove(x, y) { for (let i = 0; i < this.buttons.length; i++) {
        const b = this.buttons[i];
        const h = b.hit(x, y);
        if (h && !b.hover)
            audio.play('hover');
        b.hover = h;
        if (h)
            this.focus = i;
    } }
    pointerUp(x, y) { for (const b of this.buttons)
        if (b.hit(x, y)) {
            b.click();
            return true;
        } return true; }
    key(a) {
        window.__kbd = true;
        if (a === 'confirm')
            this.buttons[this.focus]?.click();
        else if (a === 'back')
            this.onBack();
        else if (a !== 'other')
            this.focus = navigate(this.buttons, this.focus, a);
        return true;
    }
    draw(ctx) {
        const g = ctx.createLinearGradient(0, 0, 0, 720);
        g.addColorStop(0, '#1F5E3B');
        g.addColorStop(1, '#123d27');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1280, 720);
        text(ctx, main(t2('Choose your railway', '鉄道会社をつくろう')), this.humans > 1 ? 180 : 640, 34, { size: 34, color: C.cream, align: 'center', outline: 7, outlineColor: '#0b2818', maxWidth: 340 });
        const kbd = !!window.__kbd;
        this.buttons.forEach((b, i) => b.draw(ctx, kbd && i === this.focus));
        AVATARS.forEach((a, i) => {
            const x = 70 + i * 145 + 65;
            emoji(ctx, a.emoji, x, 150, 54);
            text(ctx, main(a.name), x, 200, { size: 18, color: '#fff', align: 'center', outline: 4, outlineColor: '#123d27' });
        });
        for (let i = 0; i < this.humans; i++) {
            const ai = this.avs[i];
            if (i === this.tab && this.humans > 1)
                continue;
            const x = 70 + ai * 145 + 120, y = 112;
            ctx.fillStyle = '#1b1b1b';
            ctx.beginPath();
            ctx.arc(x, y, 14, 0, 7);
            ctx.fill();
            ctx.fillStyle = C.players[i];
            ctx.beginPath();
            ctx.arc(x, y, 11, 0, 7);
            ctx.fill();
            text(ctx, String(i + 1), x, y + 1, { size: 15, color: '#fff', align: 'center' });
        }
        const a = AVATARS[this.avs[this.tab]];
        text(ctx, `${main(a.name)} (${main(a.from)}): "${main(a.line)}"`, 640, 242, { size: 20, color: C.gold, align: 'center', maxWidth: 1100 });
        const label = (s, y) => { const l = lines(s); text(ctx, l.main, 60, y + 20, { size: 24, color: C.cream, maxWidth: 280 }); if (l.sub)
            text(ctx, l.sub, 60, y + 44, { size: 15, color: '#cfe8d5', weight: 500 }); };
        label(t2('Players', 'プレイヤー'), 276);
        label(t2('CPU rivals', 'CPUのライバル'), 342);
        label(t2('CPU level', 'CPUのつよさ'), 408);
        label(t2('Game length', 'ゲームの長さ'), 474);
        label(t2('Language', 'ことば'), 540);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        roundRect(ctx, 40, 604, 1200, 2, 1);
        ctx.fill();
        void panel;
    }
}
//# sourceMappingURL=setup.js.map