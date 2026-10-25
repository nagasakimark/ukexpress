// The Teacher panel: lesson timer, mini-games, helper, the hometown guest, class name, results export, resets.
// It sits behind a 4-digit PIN (default 0000) so students do not change settings by accident.
import { Button } from '../engine/ui.js';
import { C, text, emoji, roundRect, panel, money } from '../engine/draw.js';
import { audio } from '../engine/audio.js';
import { fx } from '../engine/fx.js';
import { askText } from '../engine/textinput.js';
import { SENSEI } from '../core/content/heroes.js';
import { CUSTOM_QUIZ } from '../core/content/stations.js';
import { PModal, say, choose, header } from './dialogs.js';
import { lines, t2, UI } from './i18n.js';
import { app } from './app.js';
import { teacher, saveTeacher, book, saveBook, removeKey, loadJSON, RESULTS_KEY } from './storage.js';
const lbl = (t) => lines(t).main;
/** Puts the teacher's hometown guest into the game content. */
export function applyGuest() {
    if (teacher.guestName)
        SENSEI.name = teacher.guestName;
    if (teacher.guestWelcome)
        SENSEI.welcome = teacher.guestWelcome;
}
// ---------- PIN pad ----------
export class PinModal extends PModal {
    constructor(title) {
        super();
        this.title = title;
        this.value = '';
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];
        keys.forEach((k, i) => {
            const r = Math.floor(i / 3), c = i % 3;
            this.buttons.push(new Button({ x: 470 + c * 116, y: 250 + r * 86, w: 104, h: 74, label: k, size: 32, color: k === 'OK' ? C.green : k === '⌫' ? '#7a6a55' : '#3a7be8', onClick: () => this.press(k) }));
        });
        this.onBack = () => this.resolveWith(null);
        this.focus = 0;
    }
    press(k) {
        if (k === '⌫')
            this.value = this.value.slice(0, -1);
        else if (k === 'OK')
            this.resolveWith(this.value);
        else if (this.value.length < 4) {
            this.value += k;
            if (this.value.length === 4)
                setTimeout(() => this.resolveWith(this.value), 200);
        }
    }
    key(a, e) {
        if (e && /^[0-9]$/.test(e.key)) {
            this.press(e.key);
            return true;
        }
        if (e && e.key === 'Backspace') {
            this.press('⌫');
            return true;
        }
        return super.key(a);
    }
    autoValue() { return null; }
    drawBody(ctx) {
        panel(ctx, 400, 70, 480, 610);
        header(ctx, this.title, 400, 70, 480, '#7a6a55');
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = '#fff';
            roundRect(ctx, 480 + i * 84, 168, 64, 64, 12);
            ctx.fill();
            ctx.strokeStyle = '#7a6a55';
            ctx.lineWidth = 3;
            roundRect(ctx, 480 + i * 84, 168, 64, 64, 12);
            ctx.stroke();
            if (i < this.value.length) {
                ctx.fillStyle = '#1d1d1b';
                ctx.beginPath();
                ctx.arc(512 + i * 84, 200, 12, 0, 7);
                ctx.fill();
            }
        }
    }
}
export class TeacherModal extends PModal {
    constructor() {
        super();
        this.rows = [];
        this.dim = 0.85;
        const onOff = (v) => lbl(v ? t2('On', 'オン') : t2('Off', 'オフ'));
        this.rows = [
            { icon: '⏰', label: t2('Lesson timer', '授業タイマー'), value: () => teacher.timerMinutes ? `${teacher.timerMinutes} min` : lbl(t2('Off', 'オフ')), actionLabel: t2('Change', '変更'),
                action: () => { const opts = [0, 20, 25, 30, 35, 40, 45]; teacher.timerMinutes = opts[(opts.indexOf(teacher.timerMinutes) + 1) % opts.length]; } },
            { icon: '🎮', label: t2('Mini-games on special days', 'とくべつな日のミニゲーム'), value: () => onOff(teacher.minigames), actionLabel: t2('Change', '変更'), action: () => { teacher.minigames = !teacher.minigames; } },
            { icon: '🤝', label: t2('Helper: CPUs go easy on a child who is far behind', 'ヘルパー：大きく負けている子に手加減'), value: () => onOff(teacher.helper), actionLabel: t2('Change', '変更'), action: () => { teacher.helper = !teacher.helper; } },
            { icon: '🏠', label: t2('Durham hometown guest', 'ダラムのふるさとゲスト'), value: () => `${SENSEI.name.en} / ${SENSEI.name.ja}`, actionLabel: t2('Edit', '編集'), action: () => this.editGuest() },
            { icon: '💬', label: t2("Guest's welcome", 'ゲストのあいさつ'), value: () => SENSEI.welcome.en, actionLabel: t2('Edit', '編集'), action: () => this.editWelcome() },
            { icon: '🏫', label: t2('Class name (for results)', 'クラス名（結果用）'), value: () => teacher.className || '—', actionLabel: t2('Edit', '編集'), action: () => this.editClass() },
            { icon: '📄', label: t2('Results of the last game', '前回のゲームの結果'), value: () => { const r = loadJSON(RESULTS_KEY, null); return r ? new Date(r.date).toLocaleDateString('ja-JP') : '—'; }, actionLabel: t2('Download CSV', 'CSVを保存'), action: () => this.download() },
            { icon: '❓', label: t2('Your own quiz questions (content/custom-quiz.json)', '自作クイズ（content/custom-quiz.json）'), value: () => `${CUSTOM_QUIZ.length}`, actionLabel: t2('How?', '使い方'), action: () => this.quizHelp() },
            { icon: '📖', label: t2('UK Book progress on this device', 'この端末のUKブック'), value: () => `🚉${book.stations.length} 🦸${book.heroes.length} 🎮${book.games}`, actionLabel: t2('Reset', 'リセット'), action: () => this.resetBook() },
            { icon: '🔒', label: t2('Teacher PIN', '先生用PIN'), value: () => '••••', actionLabel: t2('Change', '変更'), action: () => this.changePin() },
        ];
        this.build();
    }
    build() {
        this.buttons = this.rows.map((r, i) => new Button({ x: 1000, y: 102 + i * 54, w: 190, h: 46, label: lbl(r.actionLabel), size: 18, color: '#3a7be8', onClick: async () => { await r.action(); saveTeacher(); applyGuest(); this.build(); } }));
        this.buttons.push(new Button({ x: 640 - 120, y: 652, w: 240, h: 56, label: lbl(UI.back), sub: lines(UI.back).sub ?? undefined, color: '#7a6a55', onClick: () => this.resolveWith(undefined) }));
        this.onBack = () => this.resolveWith(undefined);
        this.focus = 0;
    }
    async ask(prompt, value) {
        const v = await app.show(new PromptModal(prompt, value));
        return v;
    }
    async editGuest() {
        const en = await this.ask(t2('Guest name in English', 'ゲストの名前（英語）'), SENSEI.name.en);
        if (en === null)
            return;
        const ja = await this.ask(t2('Guest name in Japanese', 'ゲストの名前（日本語）'), SENSEI.name.ja);
        if (ja === null)
            return;
        teacher.guestName = { en: en || 'Mark Sensei', ja: ja || en || 'マーク先生' };
    }
    async editWelcome() {
        const en = await this.ask(t2('Welcome message in English', 'あいさつ（英語）'), SENSEI.welcome.en);
        if (en === null)
            return;
        const ja = await this.ask(t2('Welcome message in Japanese', 'あいさつ（日本語）'), SENSEI.welcome.ja);
        if (ja === null)
            return;
        teacher.guestWelcome = { en: en || SENSEI.welcome.en, ja: ja || SENSEI.welcome.ja };
    }
    async editClass() { const v = await this.ask(t2('Class name, for example 5-2', 'クラス名（例：5年2組）'), teacher.className); if (v !== null)
        teacher.className = v; }
    download() {
        const r = loadJSON(RESULTS_KEY, null);
        if (!r) {
            say({ title: t2('No results yet', 'まだ結果がありません'), icon: '📄', body: [t2('Finish a game first.', 'ゲームを最後まで遊ぶと保存されます。')] });
            return;
        }
        const head = ['date', 'class', 'years', 'minutes', 'player', 'total assets (£)', 'cash (£)', 'properties', 'stations visited', 'quiz stars', 'heroes', 'arrivals'];
        const rows = r.rows.map((x) => [r.date, r.className, r.years, r.minutes, x.player, x.assets, x.cash, x.properties, x.stations, x.quizStars, x.heroes, x.arrivals]);
        const csv = [head, ...rows].map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `uk-express-results-${r.date.slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        audio.play('coin');
    }
    async quizHelp() {
        await say({ title: t2('Your own quiz questions', '自作クイズの追加'), icon: '❓', body: [
                t2('Open the file content/custom-quiz.json in a text editor and add questions in the same shape as the example. Each needs an English and Japanese question, three answers, and the number of the right answer (0 = first).', 'テキストエディタで content/custom-quiz.json を開き、例と同じ形で問題を追加してください。英語と日本語の問題、3つの答え、正解の番号（0＝1つ目）が必要です。'),
                t2('Save the file and reload the game. About 3 in 10 quiz squares will then use your questions.', '保存してゲームを読みこみ直すと、クイズマスの約3割で自作の問題が出ます。'),
            ] });
    }
    async resetBook() {
        const ok = await choose(t2('Reset the UK Book?', 'UKブックをリセットする？'), t2('This clears every station, hero, card and special day collected on this device.', 'この端末で集めた駅・ヒーロー・カード・とくべつな日がすべて消えます。'), [{ label: t2('Yes, reset', 'リセットする'), value: true, color: C.red }], false);
        if (!ok)
            return;
        book.stations = [];
        book.heroes = [];
        book.cards = [];
        book.events = [];
        book.games = 0;
        saveBook();
        removeKey('britainExpressSave');
        fx.shake(6);
    }
    async changePin() {
        const p1 = await app.show(new PinModal(t2('New PIN', '新しいPIN')));
        if (!p1 || p1.length !== 4)
            return;
        const p2 = await app.show(new PinModal(t2('Type it again', 'もう一度')));
        if (p1 !== p2) {
            await say({ title: t2("PINs didn't match", 'PINが一致しません'), icon: '🔒' });
            return;
        }
        teacher.pin = p1;
    }
    autoValue() { return undefined; }
    drawBody(ctx) {
        panel(ctx, 50, 14, 1180, 700, { fill: '#f6eed8' });
        text(ctx, '🍎 ' + lbl(t2('Teacher panel', '先生用パネル')), 90, 56, { size: 32, color: C.green });
        text(ctx, lbl(t2('Settings are saved on this device.', '設定はこの端末に保存されます。')), 1190, 56, { size: 16, color: '#5a5a50', align: 'right', weight: 500 });
        this.rows.forEach((r, i) => {
            const y = 102 + i * 54;
            ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.7)';
            roundRect(ctx, 80, y - 2, 1120, 50, 10);
            ctx.fill();
            emoji(ctx, r.icon, 112, y + 23, 28);
            text(ctx, lbl(r.label), 144, y + 23, { size: 19, maxWidth: 520 });
            text(ctx, r.value(), 980, y + 23, { size: 19, color: '#2f6fe0', align: 'right', maxWidth: 300 });
        });
        void money;
    }
}
/** A dialog with a real text box. */
export class PromptModal extends PModal {
    constructor(title, value) {
        super();
        this.title = title;
        this.value = value;
        this.started = false;
    }
    update(dt) {
        super.update(dt);
        if (!this.started && this.appear > 0.9) {
            this.started = true;
            askText(app.screen, { x: 290, y: 300, w: 700, h: 72, value: this.value, maxLength: 80 }).then((v) => this.resolveWith(v));
        }
    }
    autoValue() { return null; }
    drawBody(ctx) {
        panel(ctx, 250, 170, 780, 330);
        header(ctx, this.title, 250, 170, 780, C.green);
        text(ctx, lbl(t2('Type, then press Enter. Esc to cancel.', '入力してEnter。Escでキャンセル。')), 640, 440, { size: 18, color: '#5a5a50', align: 'center', weight: 500 });
    }
}
//# sourceMappingURL=teacher.js.map