import { cpuDecide } from '../core/ai.js';
import { clock } from '../engine/tween.js';
import { app } from './app.js';
import { ShopModal, CardShopModal, QuizModal, choose } from './dialogs.js';
import { t2 } from './i18n.js';
import { HERO_BY_ID } from '../core/content/heroes.js';
import { CARD_BY_ID } from '../core/content/game-data.js';
import { STATION_BY_ID } from '../core/content/stations.js';
export class CpuController {
    async decide(g, prompt) {
        const think = prompt.kind === 'command' ? 500 : prompt.kind === 'junction' ? 250 : 400;
        await clock.wait(think);
        return cpuDecide(g, prompt);
    }
}
export class HumanController {
    constructor(board) {
        this.board = board;
    }
    async decide(g, pr) {
        const p = g.players.find((x) => x.id === pr.playerId);
        switch (pr.kind) {
            case 'command': return this.board.awaitCommand(p);
            case 'junction': return this.board.awaitJunction(pr.options);
            case 'shop': return app.show(new ShopModal(g, p, pr.stationId));
            case 'cardShop': return app.show(new CardShopModal(g, p, pr.stock));
            case 'quiz': return app.show(new QuizModal(pr.quiz, pr.hint, pr.reward, pr.title));
            case 'heroReplace': {
                const opts = p.heroes.map((id, i) => ({ label: HERO_BY_ID[id].name, value: i, icon: HERO_BY_ID[id].emoji }));
                return choose(t2('Hero slot is full!', 'ヒーロー枠がいっぱい！'), t2(`Swap a hero for ${HERO_BY_ID[pr.newHero].name.en}? (All heroes stay in your Hall of Heroes.)`, `${HERO_BY_ID[pr.newHero].name.ja}と入れかえる？（ヒーローの殿堂には全員残るよ）`), opts, -1);
            }
            case 'chooseDest':
                return choose(t2('Choose the next destination!', '次の目的地を選ぼう！'), null, pr.options.map((id) => ({ label: STATION_BY_ID[id].name, value: id, icon: STATION_BY_ID[id].emoji })));
            case 'warpTo':
                return choose(t2('Jump to which station?', 'どの駅へジャンプする？'), null, pr.options.map((id) => ({ label: STATION_BY_ID[id].name, value: id, icon: STATION_BY_ID[id].emoji })));
            case 'discard': {
                const opts = p.cards.map((id, i) => ({ label: CARD_BY_ID[id].name, value: i, icon: CARD_BY_ID[id].emoji }));
                return choose(t2(`Your hand is full! Throw one away to keep ${CARD_BY_ID[pr.newCard].name.en}?`, `カードがいっぱい！「${CARD_BY_ID[pr.newCard].name.ja}」のために1枚すてる？`), null, opts, -1);
            }
        }
    }
}
//# sourceMappingURL=controllers.js.map