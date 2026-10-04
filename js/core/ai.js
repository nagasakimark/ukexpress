import { STATION_BY_ID } from './content/stations.js';
import { CARD_BY_ID, TRAINS } from './content/game-data.js';
import { HERO_BY_ID } from './content/heroes.js';
import { board, distancesTo, stationDist } from './map.js';
import { rnd, rchance, rpick, priceOf, assets, lastPlace, leader, distToDest, diceCount, ownedProps, monopolyOwner } from './rules.js';
const ACC = { gentle: 0.5, normal: 0.7, clever: 0.85 };
const CARD_USE = { gentle: 0.45, normal: 0.8, clever: 1 };
function me(g, id) { return g.players.find((p) => p.id === id); }
export function cpuDecide(g, pr) {
    const p = me(g, pr.playerId);
    switch (pr.kind) {
        case 'command': return cpuCommand(g, p);
        case 'junction': return cpuJunction(g, p, pr.options);
        case 'shop': return cpuShop(g, p, pr.stationId);
        case 'cardShop': return cpuCardShop(g, p, pr.stock);
        case 'quiz': return rnd(g) < (pr.hint ? Math.min(0.97, ACC[p.level] + 0.15) : ACC[p.level]) ? pr.quiz.answer : (pr.quiz.answer + 1 + Math.floor(rnd(g) * 2)) % 3;
        case 'heroReplace': return 0;
        case 'chooseDest': return pr.options.slice().sort((a, b) => distancesTo(board.stationNode[a])[p.pos] - distancesTo(board.stationNode[b])[p.pos])[0];
        case 'warpTo': return pr.options.slice().sort((a, b) => stationDist(a, g.destination) - stationDist(b, g.destination))[0];
        case 'discard': {
            // throw away the cheapest card
            const all = p.cards.map((c, i) => ({ i, v: CARD_BY_ID[c].rarity * 100 + CARD_BY_ID[c].price })).sort((a, b) => a.v - b.v);
            const newV = CARD_BY_ID[pr.newCard].rarity * 100 + CARD_BY_ID[pr.newCard].price;
            return all.length && all[0].v < newV ? all[0].i : -1;
        }
    }
}
function heroReady(g, p, id) { return p.heroes.includes(id) && p.heroUsedYear[id] !== g.year; }
function cpuCommand(g, p) {
    const d = distToDest(g, p);
    const use = CARD_USE[p.level];
    const has = (id) => p.cards.includes(id);
    const holder = g.boggart.holder === p.id && g.boggart.form !== 'brownie';
    // Heroes first (free, once a year)
    for (const id of p.heroes) {
        if (!heroReady(g, p, id))
            continue;
        const pw = HERO_BY_ID[id].power;
        const owns = (cat) => ownedProps(g, p).filter((x) => x.cat === cat).length;
        if (pw === 'shrinkBoggart' && holder)
            return { type: 'hero', id };
        if (pw === 'undoBoggart' && p.lastBoggartLoss > 0)
            return { type: 'hero', id };
        if ((pw === 'dice2' || pw === 'perDie') && d > 8)
            return { type: 'hero', id };
        if (pw === 'foodBoost' && owns('food') >= 2 && g.month >= 6)
            return { type: 'hero', id };
        if (pw === 'cultureBoost' && owns('culture') >= 2 && g.month >= 6)
            return { type: 'hero', id };
        if (pw === 'industryBoost' && owns('industry') >= 2 && g.month >= 6)
            return { type: 'hero', id };
        if (pw === 'natureBoost' && owns('tourism') >= 2 && g.month >= 6)
            return { type: 'hero', id };
        if (pw === 'neverGiveUp' && lastPlace(g).id === p.id)
            return { type: 'hero', id };
        if ((pw === 'quizHints' || pw === 'seeDest' || pw === 'callAhead') && !p.effects.chooseDest)
            return { type: 'hero', id };
        if (pw === 'allGain' && g.month === 9)
            return { type: 'hero', id };
        if (pw === 'kindness' && lastPlace(g).id !== p.id && p.cash > 1500 * g.year)
            return { type: 'hero', id };
        if (pw === 'warpOwned') {
            const owned = [...new Set(ownedProps(g, p).map((x) => x.stationId))];
            const best = owned.sort((a, b) => stationDist(a, g.destination) - stationDist(b, g.destination))[0];
            if (best && stationDist(best, g.destination) + 6 < d)
                return { type: 'hero', id };
        }
    }
    if (holder) {
        if (has('rowan'))
            return { type: 'card', id: 'rowan' };
        if (has('tea') && g.boggart.calm === 0)
            return { type: 'card', id: 'tea' };
    }
    if (has('birthday'))
        return { type: 'card', id: 'birthday' };
    if (has('jubilee') && lastPlace(g).id === p.id)
        return { type: 'card', id: 'jubilee' };
    if (has('guidebook') && !p.effects.guidebook)
        return { type: 'card', id: 'guidebook' };
    if (has('royal') && d > 10)
        return { type: 'card', id: 'royal' };
    const lead = leader(g);
    const attackP = p.style === 'trickster' ? 0.7 : p.level === 'clever' ? 0.5 : 0.25;
    const helperHolds = g.settings.helper && g.players.some((x) => x.controller === 'human' && lastPlace(g).id === x.id);
    if (lead.id !== p.id && !helperHolds) {
        if (has('leaves') && rchance(g, attackP))
            return { type: 'card', id: 'leaves' };
        if (has('queue') && rchance(g, attackP))
            return { type: 'card', id: 'queue' };
    }
    for (const c of ['tourism', 'harvest']) {
        if (has(c) && g.month >= 7) {
            const cat = c === 'tourism' ? 'tourism' : 'food';
            if (ownedProps(g, p).filter((x) => x.cat === cat).length >= 2)
                return { type: 'card', id: c };
        }
    }
    const dice = diceCount(p);
    if (d > dice * 3.5 && rnd(g) < use) {
        for (const c of ['azuma', 'intercity', 'express'])
            if (has(c))
                return { type: 'card', id: c };
    }
    if (has('balloon') && d > 18 && rchance(g, 0.35))
        return { type: 'card', id: 'balloon' };
    if (has('return') && p.lastBuyStation && stationDist(p.lastBuyStation, g.destination) + 8 < d && rchance(g, 0.5))
        return { type: 'card', id: 'return' };
    return { type: 'roll' };
}
function cpuJunction(g, p, options) {
    if (p.level === 'gentle' && rchance(g, 0.2))
        return rpick(g, options);
    const d = distancesTo(board.stationNode[g.destination]);
    const best = Math.min(...options.map((o) => d[o]));
    const bests = options.filter((o) => d[o] === best);
    return rpick(g, bests);
}
function cpuShop(g, p, stationId) {
    const st = STATION_BY_ID[stationId];
    const reserveBase = p.style === 'collector' ? 60 : p.style === 'speedy' ? 250 : 150;
    const reserve = reserveBase * g.year;
    let cash = p.cash;
    let train = null;
    // Train upgrade at train shops
    if (st.trainShop && p.train < TRAINS.length - 1) {
        const next = TRAINS[p.train + 1];
        const want = p.style === 'speedy' ? 1.2 : 2;
        if (cash > next.price * want + reserve) {
            train = p.train + 1;
            cash -= next.price;
        }
    }
    let props = st.props.filter((x) => !g.owners[x.id]);
    if (p.style === 'scholar')
        props.sort((a, b) => (b.cat === 'culture' ? 1 : 0) - (a.cat === 'culture' ? 1 : 0) || b.ret - a.ret);
    else if (p.style === 'collector')
        props.sort((a, b) => a.price - b.price);
    else
        props.sort((a, b) => b.ret - a.ret);
    // A collector who can finish a monopoly will stretch for it.
    const othersOwn = st.props.some((x) => g.owners[x.id] && g.owners[x.id] !== p.id);
    const buy = [];
    for (const x of props) {
        const price = priceOf(g, x);
        const stretch = p.style === 'collector' && !othersOwn ? 0.4 : 1;
        if (cash - price >= reserve * stretch) {
            buy.push(x.id);
            cash -= price;
        }
    }
    return { props: buy, train };
}
function cpuCardShop(g, p, stock) {
    const out = [];
    let cash = p.cash;
    const room = 8 - p.cards.length;
    const prefs = stock.slice().sort((a, b) => CARD_BY_ID[b].price - CARD_BY_ID[a].price);
    for (const c of prefs) {
        if (out.length >= Math.min(2, room))
            break;
        const price = CARD_BY_ID[c].price;
        if (cash - price > 800 * g.year) {
            out.push(c);
            cash -= price;
        }
    }
    return out;
}
export { assets, monopolyOwner };
//# sourceMappingURL=ai.js.map