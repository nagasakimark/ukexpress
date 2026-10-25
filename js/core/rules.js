import { STATIONS, STATION_BY_ID, PROP_BY_ID } from './content/stations.js';
import { CARDS, TRAINS, AVATARS, EVENTS } from './content/game-data.js';
import { board, dist, stationDist, distancesTo } from './map.js';
import { Rng } from './rng.js';
export const SAVE_VERSION = 1;
export const CASH_FLOOR = -500;
// ---------- randomness (seeded, stored in the state) ----------
export function rnd(g) { const r = new Rng(g.rng); const v = r.next(); g.rng = r.state; return v; }
export function rint(g, a, b) { return a + Math.floor(rnd(g) * (b - a + 1)); }
export function rpick(g, arr) { return arr[Math.floor(rnd(g) * arr.length)]; }
export function rchance(g, p) { return rnd(g) < p; }
export function rweighted(g, items, w) {
    const ws = items.map(w);
    const total = ws.reduce((a, b) => a + b, 0);
    let r = rnd(g) * total;
    for (let i = 0; i < items.length; i++) {
        r -= ws[i];
        if (r <= 0)
            return items[i];
    }
    return items[items.length - 1];
}
// ---------- setup ----------
export function createGame(s) {
    const rng = new Rng(s.seed);
    const humans = Math.max(1, Math.min(4, s.humans ?? 1));
    const rivals = Math.max(humans === 1 ? 1 : 0, Math.min(s.rivals, 4 - humans));
    const chosen = [];
    for (let i = 0; i < humans; i++) {
        const want = i === 0 ? s.avatar : s.avatars?.[i];
        chosen.push(want !== undefined && !chosen.includes(want) ? want : [0, 1, 2, 3, 4, 5, 6, 7].find((a) => !chosen.includes(a)));
    }
    const others = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7].filter((a) => !chosen.includes(a)));
    const styles = rng.shuffle(['speedy', 'collector', 'trickster', 'scholar']);
    const start = board.stationNode['kingscross'];
    const mk = (i, avatar, controller, style) => ({
        id: 'p' + i, name: { ...AVATARS[avatar].name }, avatar, color: i, controller, level: s.level, style,
        cash: 1000, pos: start, prev: -1, train: 0, cards: [], heroes: [], heroCollection: [], heroUsedYear: {},
        visited: ['kingscross'], stars: 0, lastBuyStation: null,
        effects: { oneDieTurns: 0, bonusDiceTurns: 0, bonusDice: 0, skipTurn: false, guidebook: 0, heroHints: 0, seacoleGift: 0, chooseDest: false, perDieBonus: false },
        yearBoosts: {}, hometownCompanion: false, badges: [], arrivals: 0,
    });
    const players = chosen.map((a, i) => mk(i, a, 'human', 'scholar'));
    for (let i = 0; i < rivals; i++)
        players.push(mk(humans + i, others[i], 'cpu', styles[i]));
    const g = {
        version: SAVE_VERSION, settings: s, rng: rng.state, year: 1, month: 0, turn: 0, players, owners: {},
        destination: '', prevDestination: 'kingscross',
        globalBoosts: {}, over: false, log: [], monthEvent: null, seenEvents: [],
    };
    // The first destination is a famous city a short ride from London, so the first trip is quick and exciting.
    const ks = board.stationNode['kingscross'];
    const near = ['york', 'bristol', 'oxford', 'cambridge', 'brighton', 'canterbury', 'bath', 'birmingham', 'stratford', 'dover', 'norwich', 'winchester']
        .filter((id) => { const d = distancesTo(board.stationNode[id] ?? ks)[ks]; return d >= 10 && d <= 24; });
    g.destination = rpick(g, near.length ? near : ['york', 'bristol']);
    return g;
}
// ---------- helpers ----------
export const ym = (g) => g.year;
/** The event for this game month: one at random from the month's list (December is always Christmas), avoiding repeats. */
export function pickMonthEvent(g) {
    const pool = EVENTS.filter((e) => e.month === g.month);
    if (!pool.length)
        return null;
    const seen = (g.seenEvents || (g.seenEvents = []));
    let fresh = pool.filter((e) => !seen.includes(e.id));
    if (!fresh.length) {
        for (const e of pool) {
            const i = seen.indexOf(e.id);
            if (i >= 0)
                seen.splice(i, 1);
        }
        fresh = pool;
    }
    const ev = rpick(g, fresh);
    seen.push(ev.id);
    g.monthEvent = ev.id;
    let extra;
    if (ev.extras?.length) {
        let ex = ev.extras.filter((x) => !seen.includes(ev.id + ':' + x.id));
        if (!ex.length) {
            for (const x of ev.extras) {
                const i = seen.indexOf(ev.id + ':' + x.id);
                if (i >= 0)
                    seen.splice(i, 1);
            }
            ex = ev.extras;
        }
        extra = rpick(g, ex);
        seen.push(ev.id + ':' + extra.id);
    }
    return { ev, extra };
}
export function player(g, id) { return g.players.find((p) => p.id === id); }
export function priceOf(g, prop) { return Math.round((prop.price * Math.pow(1.05, g.year - 1)) / 10) * 10; }
export function ownedProps(g, p) {
    return Object.entries(g.owners).filter(([, o]) => o === p.id).map(([id]) => PROP_BY_ID[id]);
}
export function assets(g, p) { return p.cash + ownedProps(g, p).reduce((a, pr) => a + priceOf(g, pr), 0); }
export function monopolyOwner(g, stationId) {
    const st = STATION_BY_ID[stationId];
    const o = g.owners[st.props[0].id];
    if (!o)
        return null;
    return st.props.every((pr) => g.owners[pr.id] === o) ? o : null;
}
export function ranking(g) { return g.players.slice().sort((a, b) => assets(g, b) - assets(g, a)); }
export function lastPlace(g) { const r = ranking(g); return r[r.length - 1]; }
export function leader(g) { return ranking(g)[0]; }
export function distToDest(g, p) { return distancesTo(board.stationNode[g.destination])[p.pos]; }
export function handLimit(p) { return TRAINS[p.train].slots; }
export function diceCount(p) { return TRAINS[p.train].dice; }
/** Adds money, applying the kid-friendly debt floor. Returns {change, forgiven}. */
export function addCash(p, amount) {
    const before = p.cash;
    p.cash += Math.round(amount);
    let forgiven = false;
    if (p.cash < CASH_FLOOR) {
        p.cash = CASH_FLOOR;
        forgiven = true;
    }
    return { change: p.cash - before, forgiven };
}
export function roundTo10(n) { return Math.round(n / 10) * 10; }
// ---------- squares ----------
export function blueAmount(g) {
    let a = rint(g, 2, 10) * 10 * g.year;
    if (g.month >= 2 && g.month <= 4)
        a *= 2; // Jun-Aug summer
    return a;
}
export function redAmount(g) {
    let a = rint(g, 1, 6) * 10 * g.year;
    if (g.month >= 8 && g.month <= 10)
        a = Math.round((a * 1.5) / 10) * 10; // Dec-Feb winter repairs cost a little more
    return a;
}
// ---------- cards ----------
export function drawCardId(g, allowLegendary = true) {
    const pool = CARDS.filter((c) => allowLegendary || c.rarity < 3);
    return rweighted(g, pool, (c) => (c.rarity === 1 ? 70 : c.rarity === 2 ? 25 : 6)).id;
}
export function drawRareCardId(g) {
    return rpick(g, CARDS.filter((c) => c.rarity >= 2)).id;
}
export function giveCard(p, id) {
    if (p.cards.length >= handLimit(p))
        return false;
    p.cards.push(id);
    return true;
}
export function removeCard(p, id) { const i = p.cards.indexOf(id); if (i >= 0)
    p.cards.splice(i, 1); }
// ---------- destination ----------
export function pickDestination(g, exclude = []) {
    const cur = g.destination || 'kingscross';
    const last = g.settings.helper ? lastPlace(g) : null;
    const cands = STATIONS.filter((s) => s.id !== cur && !exclude.includes(s.id));
    return rweighted(g, cands, (s) => {
        // not too close, not across the whole country: Momotetsu-style trips of a few months
        const d = stationDist(cur, s.id);
        let w = d < 8 ? 0.15 : d <= 34 ? 1 + d / 20 : 0.3;
        if (last && distancesTo(board.stationNode[s.id])[last.pos] < 10)
            w *= 1.3;
        return w;
    }).id;
}
export function destinationChoices(g, n = 3) {
    const out = [];
    while (out.length < n) {
        const d = pickDestination(g, out);
        if (!out.includes(d))
            out.push(d);
    }
    return out;
}
export function arrivalPrize(g) {
    const d = stationDist(g.prevDestination, g.destination);
    let prize = Math.max(300, roundTo10(d * 30 * (1 + 0.2 * (g.year - 1))));
    if (STATION_BY_ID[g.destination].hometown)
        prize = roundTo10(prize * 1.5);
    return prize;
}
export function catMultiplier(g, p, pr) {
    let m = 1;
    const st = STATION_BY_ID[pr.stationId];
    const pb = p.yearBoosts;
    if (pb[pr.cat])
        m *= pb[pr.cat];
    if (pr.cat === 'tourism' && st.nature && pb.nature)
        m *= pb.nature;
    if (pr.cat === 'tourism' && st.film && g.globalBoosts.filmTourism)
        m *= g.globalBoosts.filmTourism;
    if (g.globalBoosts[pr.cat])
        m *= g.globalBoosts[pr.cat];
    if (pr.cat === 'culture' && st.region === 'scotland' && g.globalBoosts.scotlandCulture)
        m *= g.globalBoosts.scotlandCulture;
    return m;
}
export function settle(g) {
    const lines = [];
    for (const p of g.players) {
        let income = 0;
        const mono = new Set();
        for (const pr of ownedProps(g, p)) {
            let v = priceOf(g, pr) * pr.ret * catMultiplier(g, p, pr);
            if (monopolyOwner(g, pr.stationId) === p.id) {
                v *= 2;
                mono.add(pr.stationId);
            }
            income += v;
        }
        if (p.effects.seacoleGift > 0) {
            income += p.effects.seacoleGift * 2;
            p.effects.seacoleGift = 0;
        }
        income = roundTo10(income);
        p.cash += income;
        // Kid-friendly debt rule: sell the cheapest properties at half price until cash is not negative.
        const sold = [];
        while (p.cash < 0) {
            const props = ownedProps(g, p).sort((a, b) => a.price - b.price);
            if (!props.length)
                break;
            delete g.owners[props[0].id];
            p.cash += Math.round(priceOf(g, props[0]) / 2);
            sold.push(props[0].name.en);
        }
        const forgiven = p.cash < CASH_FLOOR;
        if (forgiven)
            p.cash = CASH_FLOOR;
        lines.push({ player: p, income, monopolies: mono.size, sold, forgiven });
    }
    return lines;
}
export function newYearReset(g) {
    for (const p of g.players) {
        p.yearBoosts = {};
    }
    g.globalBoosts = {};
}
export function canAfford(p, price) { return p.cash >= price; }
export function isWinter(g) { return g.month >= 8 && g.month <= 10; }
export { STATIONS, STATION_BY_ID, PROP_BY_ID, dist };
export function nearestStationTo(target, exclude = []) {
    let best = '', bd = 1e9;
    for (const s of STATIONS) {
        if (s.id === target || exclude.includes(s.id))
            continue;
        const d = stationDist(s.id, target);
        if (d < bd) {
            bd = d;
            best = s.id;
        }
    }
    return best;
}
export function boostCat(p, cat, mult) { p.yearBoosts[cat] = (p.yearBoosts[cat] ?? 1) * mult; }
//# sourceMappingURL=rules.js.map