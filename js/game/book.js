// The UK Book: everything this device has collected over all games.
// Tabs: Stations, Hall of Heroes, Cards, Special days. Tap anything to read about it.
import { Button } from '../engine/ui.js';
import { C, text, emoji, roundRect, fitWrap, panel, shade } from '../engine/draw.js';
import { audio } from '../engine/audio.js';
import { STATIONS, STATION_BY_ID } from '../core/content/stations.js';
import { HEROES, HERO_BY_ID } from '../core/content/heroes.js';
import { CARDS, CARD_BY_ID, EVENTS, REGIONS } from '../core/content/game-data.js';
import { PModal, say, drawCard, drawHeroCard, QuizModal } from './dialogs.js';
import { drawPortrait } from './mapart.js';
import { drawPhotoCircle, picStatus, picVersion } from './images.js';
import { lines, t2, UI } from './i18n.js';
import { app } from './app.js';
import { book, saveBook } from './storage.js';
const lbl = (t) => lines(t).main;
export class BookModal extends PModal {
    constructor() {
        super();
        this.tab = 'stations';
        this.sel = 0;
        this.tabs = [
            { id: 'stations', label: t2('Stations', '駅'), icon: '🚉' },
            { id: 'heroes', label: t2('Heroes', 'ヒーロー'), icon: '🦸' },
            { id: 'cards', label: t2('Cards', 'カード'), icon: '🃏' },
            { id: 'events', label: t2('Special days', 'とくべつな日'), icon: '📅' },
        ];
        this.cache = null;
        this.cacheKey = '';
        this.dim = 0.85;
        this.build();
    }
    ids() {
        if (this.tab === 'stations') {
            const order = Object.keys(REGIONS);
            return STATIONS.map((s, i) => ({ id: s.id, k: order.indexOf(s.region) * 1000 + i })).sort((a, b) => a.k - b.k).map((x) => x.id);
        }
        if (this.tab === 'heroes')
            return HEROES.map((h) => h.id);
        if (this.tab === 'cards')
            return CARDS.map((c) => c.id);
        return EVENTS.map((e) => e.id);
    }
    build() {
        this.buttons = [];
        this.tabs.forEach((tb, i) => this.buttons.push(new Button({ x: 70 + i * 230, y: 92, w: 216, h: 58, label: lbl(tb.label), icon: tb.icon, size: 22, color: this.tab === tb.id ? C.red : '#5f7d6a', onClick: () => { this.tab = tb.id; this.sel = 0; this.build(); } })));
        this.buttons.push(new Button({ x: 1040, y: 92, w: 180, h: 58, label: lbl(UI.back), icon: '↩️', size: 22, color: '#7a6a55', onClick: () => this.resolveWith(undefined) }));
        this.onBack = () => this.resolveWith(undefined);
        this.focus = -1;
    }
    dims() {
        return { stations: { cols: 10, w: 108, h: 64 }, heroes: { cols: 9, w: 118, h: 90 }, cards: { cols: 9, w: 116, h: 170 }, events: { cols: 8, w: 136, h: 120 } }[this.tab];
    }
    /** How many entries fit on one page. */
    pageSize() { const { cols, h } = this.dims(); return cols * Math.max(1, Math.floor((672 - 178) / (h + 10))); }
    pages() { return Math.max(1, Math.ceil(this.ids().length / this.pageSize())); }
    page() { return Math.floor(this.sel / this.pageSize()); }
    /** Rectangles for every entry; entries on other pages are pushed off screen. */
    layout() {
        const n = this.ids().length;
        const { cols, w, h } = this.dims();
        const gap = 10;
        const total = cols * w + (cols - 1) * gap;
        const ps = this.pageSize(), pg = this.page();
        return Array.from({ length: n }, (_, i) => {
            const j = i - pg * ps;
            if (j < 0 || j >= ps)
                return { x: -9999, y: -9999, w, h };
            return { x: 640 - total / 2 + (j % cols) * (w + gap), y: 178 + Math.floor(j / cols) * (h + gap), w, h };
        });
    }
    has(id) { return book[this.tab].includes(id); }
    pointerUp(x, y, wasDrag) {
        const L = this.layout();
        for (let i = 0; i < L.length; i++) {
            const r = L[i];
            if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.sel = i;
                this.open_(i);
                return true;
            }
        }
        if (this.pages() > 1 && y > 668) {
            const ps = this.pageSize();
            if (x < 640 && this.page() > 0) {
                this.sel = (this.page() - 1) * ps;
                audio.play('card');
                return true;
            }
            if (x >= 640 && this.page() < this.pages() - 1) {
                this.sel = (this.page() + 1) * ps;
                audio.play('card');
                return true;
            }
        }
        return super.pointerUp(x, y, wasDrag);
    }
    key(a) {
        const cols = this.dims().cols, n = this.ids().length;
        if (a === 'left')
            this.sel = Math.max(0, this.sel - 1);
        else if (a === 'right')
            this.sel = Math.min(n - 1, this.sel + 1);
        else if (a === 'up')
            this.sel = Math.max(0, this.sel - cols);
        else if (a === 'down')
            this.sel = Math.min(n - 1, this.sel + cols);
        else if (a === 'confirm')
            this.open_(this.sel);
        else if (a === 'back')
            this.resolveWith(undefined);
        window.__kbd = true;
        return true;
    }
    async open_(i) {
        const id = this.ids()[i];
        audio.play('card');
        if (!this.has(id)) {
            const how = {
                stations: t2('Visit this station in a game to add it to your book!', 'ゲームでこの駅に行くと、本に追加されるよ！'),
                heroes: t2('Meet this hero at their station and answer "Who am I?" to collect them.', 'この人の駅で「わたしはだれ？」に正解すると集められるよ。'),
                cards: t2('Get this card in a game to add it to your book.', 'ゲームでこのカードを手に入れると、本に追加されるよ。'),
                events: t2('Play through this month of the year to see this special day.', 'この月まで遊ぶと、このとくべつな日が見られるよ。'),
            };
            await say({ title: t2('Not found yet!', 'まだ見つけていないよ！'), icon: '🔒', body: [how[this.tab]] });
            return;
        }
        if (this.tab === 'stations') {
            const s = STATION_BY_ID[id];
            const body = [s.fact];
            if (s.film)
                body.push(t2('🎬 ' + s.film.en, '🎬 ' + s.film.ja));
            await say({ title: s.name, photo: { kind: 'places', name: s.image, emoji: s.emoji, label: s.name.en, color: REGIONS[s.region].color }, badge: lines(REGIONS[s.region].name).main, body, color: REGIONS[s.region].color });
        }
        else if (this.tab === 'heroes') {
            const hd = HERO_BY_ID[id];
            const body = [hd.line, hd.bio];
            if (hd.japan)
                body.push(t2('🇯🇵 Japan link: ' + hd.japan.en, '🇯🇵 日本とのつながり：' + hd.japan.ja));
            if (hd.powerDesc)
                body.push(t2(`★ ${hd.powerName.en}: ${hd.powerDesc.en}`, `★ ${hd.powerName.ja}：${hd.powerDesc.ja}`));
            const done = book.heroQuiz[id] ?? 0;
            if (done > 0)
                body.push(t2(`🏆 Perfect quizzes: ${done}`, `🏆 パーフェクト：${done}回`));
            const go = await say({
                title: hd.name, photo: { kind: 'heroes', name: hd.image, emoji: hd.emoji, label: hd.name.en, color: '#8a6a10' }, badge: hd.lived, body, color: '#8a6a10',
                buttons: [
                    { label: t2('Quiz! (3 questions)', 'クイズ！（3もん）'), value: 'quiz', color: '#2e9b46' },
                    { label: UI.back, value: undefined, color: '#7a6a55' },
                ],
            });
            if (go === 'quiz')
                await this.heroQuiz(id);
        }
        else if (this.tab === 'cards') {
            const c = CARD_BY_ID[id];
            await say({ title: c.name, iconDraw: (ctx, x, y) => drawCard(ctx, c, x - 70, y - 100, 140, 200), body: [c.desc] });
        }
        else {
            const ev = EVENTS.find((e) => e.id === id);
            await say({ title: ev.title, photo: { kind: 'events', name: ev.image, emoji: ev.emoji, label: ev.title.en, color: '#b5651d' }, badge: ev.label ? lines(ev.label).main : undefined, body: [ev.why, ev.fact], color: '#b5651d' });
        }
    }
    autoValue() { return undefined; }
    /** The book's own quiz: 3 questions about one hero. Only a perfect score earns the star. */
    async heroQuiz(id) {
        const hd = HERO_BY_ID[id];
        let right = 0;
        for (let i = 0; i < hd.quiz.length; i++) {
            const q = hd.quiz[i];
            const ans = await app.show(new QuizModal(q, false, 0, t2(`Hero quiz ${i + 1}/${hd.quiz.length}: ${hd.name.en}`, `ヒーロークイズ ${i + 1}/${hd.quiz.length}：${hd.name.ja}`)));
            if (ans === q.answer)
                right++;
        }
        const perfect = right === hd.quiz.length;
        if (perfect) {
            book.heroQuiz[id] = (book.heroQuiz[id] ?? 0) + 1;
            saveBook();
        }
        audio.play(perfect ? 'fanfare' : 'coin');
        await say({
            title: t2(`Quiz complete: ${right}/${hd.quiz.length}!`, `クイズ終了：${right}/${hd.quiz.length}！`),
            icon: perfect ? '🏆' : '💪',
            body: [perfect
                    ? t2(`Perfect! You really know ${hd.name.en}! Star earned!`, `${hd.name.ja}博士だね！パーフェクト！星ゲット！`)
                    : t2('Good try! Only a perfect score earns a star — read the profile and try again!', 'よくがんばった！星はパーフェクトだけ。プロフィールを読んでもう一度！')],
        });
    }
    /** The page is painted once into a picture and reused, because it only changes when you turn the page or move the cursor. */
    drawBody(ctx) {
        const sc = Math.min(2, app.screen.dpr * app.screen.scale);
        const key = `${this.tab}|${this.page()}|${window.__kbd ? this.sel : -1}|${this.ids().filter((id) => this.has(id)).length}|${HEROES.reduce((a, h) => a + (book.heroQuiz[h.id] ?? 0), 0)}|${sc}|${picVersion()}`;
        if (!this.cache || key !== this.cacheKey) {
            if (!this.cache)
                this.cache = document.createElement('canvas');
            this.cache.width = Math.round(1280 * sc);
            this.cache.height = Math.round(720 * sc);
            const c = this.cache.getContext('2d');
            c.setTransform(sc, 0, 0, sc, 0, 0);
            this.paint(c);
            this.cacheKey = key;
        }
        ctx.drawImage(this.cache, 0, 0, 1280, 720);
    }
    paint(ctx) {
        // book cover look
        ctx.fillStyle = '#7a2e1f';
        roundRect(ctx, 30, 14, 1220, 694, 26);
        ctx.fill();
        ctx.fillStyle = '#f6eed8';
        roundRect(ctx, 46, 26, 1188, 670, 18);
        ctx.fill();
        text(ctx, '📖 ' + lbl(t2('UK Book', 'UKブック')), 70, 56, { size: 34, color: '#7a2e1f' });
        const got = this.ids().filter((id) => this.has(id)).length;
        text(ctx, `${got} / ${this.ids().length}`, 1210, 56, { size: 30, color: '#7a2e1f', align: 'right' });
        if (this.tab === 'heroes')
            text(ctx, lbl(t2('Hall of Heroes: real people from British history', 'ヒーローの殿堂：イギリスの歴史上の人たち')), 640, 56, { size: 18, color: '#7a5a10', align: 'center', weight: 500 });
        const L = this.layout();
        const kbd = !!window.__kbd;
        this.ids().forEach((id, i) => {
            const r = L[i];
            if (r.x < -1000)
                return;
            const ok = this.has(id);
            ctx.save();
            if (this.tab === 'cards') {
                if (ok)
                    drawCard(ctx, CARD_BY_ID[id], r.x, r.y, r.w, r.h);
                else {
                    ctx.fillStyle = '#d9d0b6';
                    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
                    ctx.fill();
                    emoji(ctx, '❓', r.x + r.w / 2, r.y + r.h / 2, 40, 0.5);
                }
            }
            else {
                const col = this.tab === 'stations' ? REGIONS[STATION_BY_ID[id].region].color : this.tab === 'heroes' ? '#c99a1a' : '#b5651d';
                ctx.fillStyle = ok ? '#fffdf6' : '#e2d9be';
                roundRect(ctx, r.x, r.y, r.w, r.h, 12);
                ctx.fill();
                ctx.strokeStyle = ok ? col : '#c8bd9c';
                ctx.lineWidth = 4;
                roundRect(ctx, r.x, r.y, r.w, r.h, 12);
                ctx.stroke();
                if (ok && this.tab === 'heroes') {
                    const qn = book.heroQuiz[id] ?? 0;
                    if (qn > 0) {
                        ctx.strokeStyle = '#e6a817';
                        ctx.lineWidth = 6;
                        roundRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 14);
                        ctx.stroke();
                        text(ctx, qn > 1 ? `★${qn}` : '★', r.x + r.w - 8, r.y + 18, { size: 17, color: '#8a6a10', align: 'right' });
                    }
                }
                let e = '', name = t2('', '');
                if (this.tab === 'stations') {
                    const s = STATION_BY_ID[id];
                    e = s.emoji;
                    name = s.name;
                }
                else if (this.tab === 'heroes') {
                    const h = HERO_BY_ID[id];
                    e = h.emoji;
                    name = h.name;
                }
                else {
                    const ev = EVENTS.find((x) => x.id === id);
                    e = ev.emoji;
                    name = ev.title;
                }
                // Collected heroes show their real photo (it pops in once loaded); everything else keeps its emoji art.
                let photoed = false;
                if (ok && this.tab === 'heroes') {
                    const hd = HERO_BY_ID[id];
                    if (picStatus('heroes', hd.image) === 'ok') {
                        photoed = drawPhotoCircle(ctx, 'heroes', hd.image, r.x + r.w / 2, r.y + 30, 21);
                    }
                }
                if (this.tab === 'heroes') {
                    if (!photoed) {
                        if (ok)
                            drawPortrait(ctx, e, r.x + r.w / 2, r.y + 30, 21);
                        else
                            emoji(ctx, '👤', r.x + r.w / 2, r.y + 30, 36, 0.35);
                    }
                }
                else
                    emoji(ctx, e, r.x + r.w / 2, r.y + (this.tab === 'events' ? 40 : 24), this.tab === 'events' ? 44 : 28, ok ? 1 : 0.3);
                const nm = fitWrap(ctx, ok || this.tab !== 'heroes' ? lines(name).main : '???', r.w - 12, this.tab === 'stations' ? 1 : 2, 15, 9);
                const ty = r.y + r.h - 12 - (nm.lines.length - 1) * nm.size;
                nm.lines.forEach((s, k) => text(ctx, s, r.x + r.w / 2, ty + k * nm.size * 1.05, { size: nm.size, align: 'center', color: ok ? '#1d1d1b' : '#9a9078' }));
            }
            if (kbd && i === this.sel) {
                ctx.strokeStyle = C.gold;
                ctx.lineWidth = 5;
                roundRect(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 14);
                ctx.stroke();
            }
            ctx.restore();
        });
        if (this.pages() > 1) {
            const pg = this.page(), np = this.pages();
            text(ctx, `${pg + 1} / ${np}`, 640, 684, { size: 22, color: '#7a2e1f', align: 'center' });
            if (pg > 0)
                text(ctx, '◀ ' + lbl(t2('Back', 'まえ')), 520, 684, { size: 22, color: '#7a2e1f', align: 'right' });
            if (pg < np - 1)
                text(ctx, lbl(t2('Next', 'つぎ')) + ' ▶', 760, 684, { size: 22, color: '#7a2e1f', align: 'left' });
        }
        void panel;
        void shade;
        void drawHeroCard;
    }
}
//# sourceMappingURL=book.js.map