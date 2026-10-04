import { slug } from './slug.js';
export const HEROES = [];
export const HERO_BY_ID = {};
export const HEROES_AT = {};
/** The hometown guest at Durham (Mark Sensei). Editable in the Teacher panel. */
export const SENSEI = { name: { en: 'Mark Sensei', ja: 'マーク先生' }, emoji: '👨‍🏫', welcome: { en: 'Welcome to my hometown, Durham!', ja: 'ぼくのふるさと、ダラムへようこそ！' } };
export function setHeroes(raw) {
    var _a;
    HEROES.length = 0;
    for (const k of Object.keys(HERO_BY_ID))
        delete HERO_BY_ID[k];
    for (const k of Object.keys(HEROES_AT))
        delete HEROES_AT[k];
    for (const h of raw.heroes) {
        h.image = slug(h.name.en);
        HEROES.push(h);
        HERO_BY_ID[h.id] = h;
        (HEROES_AT[_a = h.station] || (HEROES_AT[_a] = [])).push(h);
    }
    if (raw.guest)
        Object.assign(SENSEI, raw.guest);
}
//# sourceMappingURL=heroes.js.map