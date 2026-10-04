// UK Express! entry point: loads fonts and content, then shows the title screen.
// URL options for testing: ?auto=1 (CPU plays every seat at high speed), &years=1, &seed=123, &rivals=3, &lang=en
import { app } from './game/app.js';
import { TitleScene } from './game/scenes/title.js';
import { SetupScene } from './game/scenes/setup.js';
import { BoardScene } from './game/scenes/board.js';
import { ResultsScene } from './game/scenes/results.js';
import { Director } from './game/flow.js';
import { createGame } from './core/rules.js';
import { board } from './core/map.js';
import { loadContent } from './core/content/load.js';
import { lang, t2, normLang } from './game/i18n.js';
import { choose } from './game/dialogs.js';
import { howToPlay } from './game/tutorial.js';
import { BookModal } from './game/book.js';
import { applyGuest } from './game/teacher.js';
import { teacher } from './game/storage.js';
import { audio } from './engine/audio.js';
import { clock } from './engine/tween.js';
import { MINIGAMES } from './game/minigames.js';
import { TeacherModal } from './game/teacher.js';
import { LoadingScene } from './game/scenes/loading.js';
import { sprites } from './game/fake3d/sprites.js';
import { view } from './game/fake3d/view.js';
let director = null;
let spritesLoading = Promise.resolve();
function toTitle() {
    if (director)
        director.stopped = true;
    director = null;
    clock.timeScale = 1;
    app.overlays = [];
    app.go(new TitleScene(() => app.go(new SetupScene(startNew, toTitle)), continueGame));
}
function startNew(s) {
    play(createGame({ ...s, helper: teacher.helper }));
}
function continueGame() {
    try {
        const raw = localStorage.getItem('britainExpressSave');
        if (!raw)
            return;
        const g = JSON.parse(raw);
        if ((g.version ?? 1) < 2) {
            g.ledger ?? (g.ledger = []);
            g.history ?? (g.history = []);
            g.version = 2;
        }
        lang.mode = normLang(g.settings.lang);
        play(g);
    }
    catch { /* a broken save is ignored */ }
}
/** Waits for the board pictures (usually already loaded while on the title screen). */
async function play(g) {
    if (!sprites.ready) {
        app.go(new LoadingScene());
        await spritesLoading;
    }
    view.build();
    const board = new BoardScene(g);
    app.go(board);
    audio.startMusic('board');
    const d = new Director(g, board);
    director = d;
    window.__game = g;
    board.onMenu = async () => {
        const o = app.options;
        const v = await choose(t2('Menu', 'メニュー'), null, [
            { label: t2('Resume', 'つづける'), value: 'resume', icon: '▶️' },
            { label: t2('How to play', 'あそびかた'), value: 'help', icon: '❓' },
            { label: t2('UK Book', 'UKブック'), value: 'book', icon: '📖' },
            { label: t2(o.muted ? 'Sound: OFF' : 'Sound: ON', o.muted ? '音：オフ' : '音：オン'), value: 'sound', icon: o.muted ? '🔇' : '🔊' },
            { label: t2(o.fast ? 'CPU speed: Fast' : 'CPU speed: Normal', o.fast ? 'CPU：はやい' : 'CPU：ふつう'), value: 'fast', icon: '⏩' },
            { label: t2('Save and quit', 'セーブしておわる'), value: 'quit', icon: '💾' },
        ], 'resume');
        if (v === 'help')
            await howToPlay();
        if (v === 'book')
            await app.show(new BookModal());
        if (v === 'sound') {
            o.muted = !o.muted;
            audio.setMuted(o.muted);
            app.saveOptions();
        }
        if (v === 'fast') {
            o.fast = !o.fast;
            app.saveOptions();
        }
        if (v === 'quit')
            toTitle();
    };
    d.onGameOver = (gs) => app.go(new ResultsScene(gs, toTitle));
    d.run().catch((e) => { console.error(e); window.__error = String((e && e.stack) || e); });
}
async function boot() {
    const canvas = document.getElementById('game');
    const loading = document.getElementById('loading');
    try {
        await Promise.all([
            loadContent('content/'),
            document.fonts.load('40px Pook').catch(() => undefined),
            document.fonts.load('800 40px "M PLUS Rounded 1c"').catch(() => undefined),
        ]);
    }
    catch (e) {
        loading.classList.add('error');
        loading.innerHTML = `<p>Could not load the game files. Please start the game with <b>start.bat</b> (or <code>npm start</code>) instead of opening index.html directly.</p><p>ゲームのファイルを読みこめませんでした。index.html を直接開かず、<b>start.bat</b> から起動してください。</p><p style="opacity:.6">${String(e)}</p>`;
        return;
    }
    applyGuest();
    app.boot(canvas);
    // Remember how much detail this computer can manage, so slow Chromebooks start at the right level next time.
    const applyTier = (t) => { app.screen.setQuality(t >= 1 ? 1 : 1.5, t >= 2 ? 0.75 : 1); try {
        localStorage.setItem('ukExpressTier', String(t));
    }
    catch { /* ignore */ } };
    view.onTier = applyTier;
    if (view.tier > 0)
        applyTier(view.tier);
    spritesLoading = sprites.load().catch((e) => { console.error('sprites', e); });
    window.__view = view;
    window.__app = app;
    window.__test = { BookModal, TeacherModal, MINIGAMES, howToPlay }; // handy for automated UI tests
    loading.classList.add('hidden');
    const q = new URLSearchParams(location.search);
    if (q.get('lang'))
        lang.mode = normLang(q.get('lang'));
    if (q.get('view')) {
        // visual test: a still board looking at one station (e.g. ?view=durham&zoom=1&month=6)
        await spritesLoading;
        const g = createGame({ years: 1, rivals: 3, level: 'normal', lang: lang.mode, avatar: 0, seed: 42, helper: true, autoplay: false });
        g.month = Number(q.get('month') || 0);
        if (q.get('dest'))
            g.destination = q.get('dest');
        const sn = board.stationNode[q.get('view')] ?? 0;
        if (q.get('trains'))
            q.get('trains').split(',').forEach((t, i) => { if (g.players[i])
                g.players[i].train = Number(t); });
        if (q.get('spread'))
            g.players.forEach((p, i) => { const l = board.nodes[sn].links[i]; if (l) {
                p.pos = l.to;
                p.prev = sn;
            } });
        const b = new BoardScene(g);
        const n = board.nodes[sn];
        b.cam.x = n.x;
        b.cam.y = n.y;
        b.cam.zoom = Number(q.get('zoom') || 1);
        b.current = g.players[0];
        if (q.get('focus')) {
            const fp = g.players[Number(q.get('focus'))];
            const fn = board.nodes[fp.pos];
            b.cam.x = fn.x;
            b.cam.y = fn.y;
            b.current = fp;
        }
        app.go(b);
        window.__board = b;
        return;
    }
    if (q.get('auto')) {
        app.autoplay = true;
        await spritesLoading;
        play(createGame({ years: Number(q.get('years') || 1), rivals: Number(q.get('rivals') || 3), level: 'normal', lang: lang.mode, avatar: 0, seed: Number(q.get('seed') || 42), helper: true, autoplay: true }));
        return;
    }
    if (q.get('play')) {
        // test: start a normal game straight away (?play=1&humans=2&rivals=1&years=1&seed=7)
        await spritesLoading;
        const humans = Number(q.get('humans') || 1);
        play(createGame({ years: Number(q.get('years') || 1), rivals: Number(q.get('rivals') || 3), humans, avatars: [0, 1, 2, 3].slice(0, humans), level: 'normal', lang: lang.mode, avatar: 0, seed: Number(q.get('seed') || 42), helper: true, autoplay: false }));
        return;
    }
    toTitle();
}
window.addEventListener('error', (e) => { window.__error = String(e.error?.stack || e.message); });
boot();
//# sourceMappingURL=main.js.map