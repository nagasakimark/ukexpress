// "How to play": a short picture tutorial, one idea per page. Japanese first, English underneath.
import { C, text, emoji, roundRect } from '../engine/draw.js';
import { clock } from '../engine/tween.js';
import { t2 } from './i18n.js';
import { say, drawCard, drawHeroCard } from './dialogs.js';
import { drawTrain } from './mapart.js';
import { CARDS } from '../core/content/game-data.js';
import { HEROES } from '../core/content/heroes.js';
function tile(ctx, x, y, fill, glyph) {
    ctx.fillStyle = '#20170a';
    roundRect(ctx, x - 20, y - 20, 40, 40, 9);
    ctx.fill();
    ctx.fillStyle = fill;
    roundRect(ctx, x - 17, y - 17, 34, 34, 7);
    ctx.fill();
    text(ctx, glyph, x, y + 1, { size: 24, color: '#fff', align: 'center', outline: 3 });
}
export function howToPlay() {
    return say({
        title: t2('How to play', 'あそびかた'),
        body: [
            t2('Roll the dice 🎲 and race your rivals to the destination 🚩. Whoever arrives first wins bonus money!', 'サイコロ🎲を ふって、ライバルより さきに もくてきち🚩へ いこう！いちばんに ついたら ボーナス！'),
            t2('Blue squares give money. Red squares take a little. Yellow squares give a card. Purple squares are lucky spinners. Orange stars are surprises!', 'あおマスは おかねが ふえる。あかマスは すこし へる。きいろは カード。むらさきは ラッキー ルーレット。オレンジの ほしは サプライズ！'),
            t2('Stop at a station to buy famous places. Every March they pay you money. Buy everything at one station for a Monopoly: double money!', 'えきで ゆうめいな ばしょを かおう。まい年3月に おかねが もらえるよ。1つの えきで ぜんぶ かうと どくせんで 2ばい！'),
            t2('Cards help you go faster or fly to a station. Meet real heroes from history and collect their Hero cards!', 'カードを つかうと はやく すすめたり、えきへ とべたりするよ。れきしの ヒーローに あって、ヒーローカードを あつめよう！'),
            t2('Read the Station guide on the right to learn about every place. Each month, Mark Sensei shows a special day on TV!', 'みぎがわの「えきガイド」で、いろんな ばしょを しらべよう。まい月、マーク先生が とくべつな 日を テレビで おしえてくれるよ！'),
        ],
        pageArt: [
            (ctx, x, y) => { drawTrain(ctx, x - 30, y + 30, C.players[0], 1, 1, clock.realTime, 1); emoji(ctx, '🚩', x + 60, y - 30, 60); emoji(ctx, '🎲', x - 40, y - 50, 50); },
            (ctx, x, y) => { tile(ctx, x - 50, y - 60, '#2f6fe0', '+'); tile(ctx, x, y - 60, '#e0383b', '−'); tile(ctx, x + 50, y - 60, '#f5c400', '🃏'); tile(ctx, x - 25, y, '#9b59d0', '?'); tile(ctx, x + 25, y, '#ff8c1a', '★'); emoji(ctx, '💷', x, y + 70, 44); },
            (ctx, x, y) => { emoji(ctx, '🏰', x, y - 30, 90); emoji(ctx, '👑', x + 50, y - 80, 40); emoji(ctx, '💷', x - 40, y + 60, 44); emoji(ctx, '💷', x + 30, y + 60, 44); },
            (ctx, x, y) => { if (CARDS[0])
                drawCard(ctx, CARDS[0], x - 100, y - 90, 100, 150); if (HEROES[0])
                drawHeroCard(ctx, HEROES.find((h) => h.id === 'potter')?.id ?? HEROES[0].id, x + 5, y - 70, 100, 150); },
            (ctx, x, y) => { emoji(ctx, '📺', x, y - 20, 110); emoji(ctx, '🎤', x + 62, y + 40, 52); },
        ],
    });
}
//# sourceMappingURL=tutorial.js.map