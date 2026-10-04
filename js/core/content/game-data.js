export const REGIONS = {};
export const AVATARS = [];
export const STYLES = {};
export const TRAINS = [];
export const CARDS = [];
export const CARD_BY_ID = {};
export const SHOP_STOCK = {};
export const EVENTS = [];
export const WORDS = [];
export function setGameData(game, cards, events, words) {
    Object.assign(REGIONS, game.regions);
    AVATARS.length = 0;
    AVATARS.push(...game.avatars);
    Object.assign(STYLES, game.cpuStyles);
    TRAINS.length = 0;
    TRAINS.push(...game.trains);
    CARDS.length = 0;
    CARDS.push(...cards.cards);
    for (const c of CARDS)
        CARD_BY_ID[c.id] = c;
    Object.assign(SHOP_STOCK, cards.shopStock);
    EVENTS.length = 0;
    EVENTS.push(...events.map((e) => ({ ...e, month: (e.cal + 9) % 12 })));
    WORDS.length = 0;
    WORDS.push(...(words?.words ?? []));
}
export const MONTHS = [
    { en: 'April', ja: '4月' }, { en: 'May', ja: '5月' }, { en: 'June', ja: '6月' }, { en: 'July', ja: '7月' },
    { en: 'August', ja: '8月' }, { en: 'September', ja: '9月' }, { en: 'October', ja: '10月' }, { en: 'November', ja: '11月' },
    { en: 'December', ja: '12月' }, { en: 'January', ja: '1月' }, { en: 'February', ja: '2月' }, { en: 'March', ja: '3月' },
];
export const SEASON_EMOJI = ['🌸', '🌸', '☀️', '☀️', '☀️', '🍂', '🍂', '🍂', '❄️', '❄️', '❄️', '🌸'];
export const SEASONS = [
    { en: 'Spring', ja: '春' }, { en: 'Spring', ja: '春' }, { en: 'Summer', ja: '夏' }, { en: 'Summer', ja: '夏' }, { en: 'Summer', ja: '夏' },
    { en: 'Autumn', ja: '秋' }, { en: 'Autumn', ja: '秋' }, { en: 'Autumn', ja: '秋' }, { en: 'Winter', ja: '冬' }, { en: 'Winter', ja: '冬' }, { en: 'Winter', ja: '冬' }, { en: 'Spring', ja: '春' },
];
//# sourceMappingURL=game-data.js.map