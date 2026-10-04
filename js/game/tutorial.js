// "How to play": a short picture tutorial, one idea per page.
import { C, text, emoji, roundRect } from '../engine/draw.js';
import { clock } from '../engine/tween.js';
import { t2 } from './i18n.js';
import { say, drawCard, drawHeroCard, drawCalendarTile } from './dialogs.js';
import { drawTrain, drawBoggart } from './mapart.js';
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
            t2('Roll the dice 🎲 and race your rivals to the destination 🚩. Whoever arrives first wins prize money!', 'サイコロ🎲をふって、ライバルより先に目的地🚩へ行こう。一番乗りには賞金！'),
            t2('Blue squares give money. Red squares take money. Yellow squares give a card. Purple squares are quizzes. Orange stars are surprises!', '青マスはお金ゲット。赤マスはお金が減る。黄色はカード。むらさきはクイズ。オレンジの星はおたのしみ！'),
            t2('Stop at a station to buy famous places. Every March they pay you money. Buy everything at one station for a Monopoly: double money!', '駅で有名な場所を買おう。毎年3月にお金が入るよ。1つの駅でぜんぶ買うと独占：2倍！'),
            t2('Cards help you: go faster, fly to a station, or trick your rivals. Meet real heroes from history and collect their Hero cards!', 'カードが助けてくれるよ。速く進む、駅へ飛ぶ、ライバルにいたずら。歴史のヒーローに会ってカードを集めよう！'),
            t2('Watch out for the Boggart! It likes to jump on a train that is far from the destination, but it naps and wanders off after a few turns. Pass another train to give it away.', 'ボガートに気をつけて！目的地から遠い電車に飛び乗るよ。でもお昼ねしたり、しばらくするとどこかへ行く。ほかの電車を追いこすとうつせる。'),
            t2('Each turn is one month, and each month has one special day, like Bonfire Night on 5 November. Learn about it and take the quiz!', '1ターンは1か月。毎月ひとつ、11月5日のボンファイア・ナイトのようなとくべつな日があって、イギリスを学べるよ！'),
        ],
        pageArt: [
            (ctx, x, y) => { drawTrain(ctx, x - 30, y + 30, C.players[0], 1, 1, clock.realTime, 1); emoji(ctx, '🚩', x + 60, y - 30, 60); emoji(ctx, '🎲', x - 40, y - 50, 50); },
            (ctx, x, y) => { tile(ctx, x - 50, y - 60, '#2f6fe0', '+'); tile(ctx, x, y - 60, '#e0383b', '−'); tile(ctx, x + 50, y - 60, '#f5c400', '🃏'); tile(ctx, x - 25, y, '#9b59d0', '?'); tile(ctx, x + 25, y, '#ff8c1a', '★'); emoji(ctx, '💷', x, y + 70, 50); },
            (ctx, x, y) => { emoji(ctx, '🏰', x, y - 30, 90); emoji(ctx, '👑', x + 50, y - 80, 40); emoji(ctx, '💷', x - 40, y + 60, 44); emoji(ctx, '💷', x + 30, y + 60, 44); },
            (ctx, x, y) => { if (CARDS[0])
                drawCard(ctx, CARDS[0], x - 100, y - 90, 100, 150); if (HEROES[0])
                drawHeroCard(ctx, HEROES.find((h) => h.id === 'potter')?.id ?? HEROES[0].id, x + 5, y - 70, 100, 150); },
            (ctx, x, y) => { drawBoggart(ctx, x, y, 110, 'boggart', clock.realTime); },
            (ctx, x, y) => { drawCalendarTile(ctx, x, y, 10, 5, '🎆'); },
        ],
    });
}
//# sourceMappingURL=tutorial.js.map