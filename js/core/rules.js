import { STATIONS, STATION_BY_ID, PROP_BY_ID } from './content/stations.js';
import { CARDS, CARD_BY_ID, TRAINS, AVATARS, EVENTS } from './content/game-data.js';
import { board, dist, stationDist, distancesTo } from './map.js';
import { Rng } from './rng.js';
export const SAVE_VERSION = 2;
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
        yearBoosts: {}, lastBoggartLoss: 0, hometownCompanion: false, badges: [], arrivals: 0, brownieGiven: false,
    });
    const players = chosen.map((a, i) => mk(i, a, 'human', 'scholar'));
    for (let i = 0; i < rivals; i++)
        players.push(mk(humans + i, others[i], 'cpu', styles[i]));
    const g = {
        version: SAVE_VERSION, settings: s, rng: rng.state, year: 1, month: 0, turn: 0, players, owners: {},
        destination: '', prevDestination: 'kingscross',
        boggart: { holder: null, form: 'boggart', months: 0, calm: 0, grandTurns: 0, brownieTurns: 3, turns: 0 },
        globalBoosts: {}, over: false, log: [], monthEvent: null, seenEvents: [], boggartLog: {},
        ledger: [], history: [],
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
/** Non-arrivers ranked by exact squares from the destination (closest first, poorer player wins ties). */
export function arrivalRanking(g, arriverId) {
    const d = distancesTo(board.stationNode[g.destination]);
    return g.players.filter((p) => p.id !== arriverId)
        .map((p) => ({ p, dist: d[p.pos] }))
        .sort((a, b) => a.dist - b.dist || assets(g, a.p) - assets(g, b.p));
}
export function handLimit(p) { return TRAINS[p.train].slots; }
export function diceCount(p) { return TRAINS[p.train].dice; }
/** Adds money, applying the kid-friendly debt floor. Every pound is written into the company books. */
export function addCash(g, p, amount, kind = 'other', note = '') {
    const before = p.cash;
    p.cash += Math.round(amount);
    let forgiven = false;
    if (p.cash < CASH_FLOOR) {
        p.cash = CASH_FLOOR;
        forgiven = true;
    }
    g.ledger.push({ y: g.year, m: g.month, playerId: p.id, v: Math.round(amount), k: kind, n: note || undefined });
    if (g.ledger.length > 500)
        g.ledger.splice(0, g.ledger.length - 500);
    return { change: p.cash - before, forgiven };
}
/** Cash + property value: the number drawn on the company graph. */
export function worth(g, p) { return assets(g, p); }
/** Remembers this month for the company graph (called once per month). */
export function snapshot(g) {
    g.history.push({ y: g.year, m: g.month, v: g.players.map((p) => [p.cash, worth(g, p)]) });
    if (g.history.length > 144)
        g.history.splice(0, g.history.length - 144);
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
    let a = rint(g, 2, 10) * 10 * g.year;
    if (g.month >= 8 && g.month <= 10)
        a *= 2; // Dec-Feb winter: leaves and snow on the line
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
/** The player furthest (in squares) from the destination gets the Boggart. */
export function furthestPlayer(g, excludeId) {
    const d = distancesTo(board.stationNode[g.destination]);
    const others = g.players.filter((p) => p.id !== excludeId);
    if (!others.length)
        return null;
    return others.sort((a, b) => d[b.pos] - d[a.pos] || assets(g, a) - assets(g, b))[0];
}
/** Who gets the Boggart after an arrival: usually someone far behind, but not the player who had it last time, and with some chance. */
export function pickBoggartHolder(g, arriverId) {
    const others = g.players.filter((p) => p.id !== arriverId);
    if (!others.length)
        return null;
    const d = distancesTo(board.stationNode[g.destination]);
    const log = (g.boggartLog || (g.boggartLog = {}));
    const maxD = Math.max(1, ...others.map((p) => d[p.pos]));
    const pick = rweighted(g, others, (p) => {
        let w = 0.6 + (d[p.pos] / maxD) * 1.4; // the further back, the more likely
        const since = log[p.id] ?? 99; // arrivals since this player last held it
        if (since <= 1)
            w *= 0.15;
        else if (since === 2)
            w *= 0.5;
        return w;
    });
    for (const p of g.players)
        log[p.id] = (log[p.id] ?? 99) + 1;
    log[pick.id] = 0;
    return pick;
}
/** The Boggart naps some turns, and wanders off after a few visits, so it is never on one train for long. */
export function boggartAct(g, p) {
    const b = g.boggart;
    if (b.form !== 'brownie' && b.calm <= 0) {
        b.turns = (b.turns ?? 0) + 1;
        if (rchance(g, 0.35)) {
            const leave = b.turns >= 4;
            return { text: { en: leave ? 'The Boggart yawned and wandered off to find another train.' : 'The Boggart is having a nap. It does nothing this turn.', ja: leave ? 'ボガートはあくびをして、べつの電車をさがしにいった。' : 'ボガートはお昼ね中。今回は何もしない。' }, leave };
        }
    }
    const res = boggartActInner(g, p);
    if (b.form !== 'brownie' && (b.turns ?? 0) >= 4 && !res.leave && b.form !== 'grand')
        res.leave = true;
    return res;
}
function boggartActInner(g, p) {
    const b = g.boggart;
    const Y = g.year;
    if (b.calm > 0) {
        b.calm--;
        return { text: { en: 'The Boggart is sipping tea. It does nothing.', ja: 'ボガートは紅茶を飲んでいる。何もしない。' } };
    }
    if (b.form === 'brownie') {
        b.brownieTurns--;
        const leave = b.brownieTurns <= 0;
        if (rchance(g, 0.5)) {
            const m = 500 * Y;
            addCash(g, p, m, 'prize');
            return { text: { en: `The Brownie did your chores! +£${m.toLocaleString('en-GB')}`, ja: `ブラウニーがお手伝い！+£${m.toLocaleString('en-GB')}` }, money: m, good: true, leave };
        }
        const c = drawRareCardId(g);
        giveCard(p, c);
        return { text: { en: `The Brownie tidied your cards and found a ${CARD_BY_ID[c].name.en} card!`, ja: `ブラウニーがカードを整理して「${CARD_BY_ID[c].name.ja}」をくれた！` }, good: true, leave };
    }
    if (b.form === 'little') {
        const r = rint(g, 0, 2);
        if (r === 0 && p.cards.length) {
            const c = rpick(g, p.cards);
            removeCard(p, c);
            return { text: { en: `Little Boggart dropped your ${CARD_BY_ID[c].name.en} card. Oops!`, ja: `小ボガートが「${CARD_BY_ID[c].name.ja}」カードを落とした。おっと！` } };
        }
        if (r <= 1) {
            const m = rint(g, 5, 20) * 10;
            const res = addCash(g, p, -m, 'fee');
            p.lastBoggartLoss = -res.change;
            return { text: { en: `Little Boggart spent £${m} on sweets!`, ja: `小ボガートがおかしに£${m}使った！` }, money: -m };
        }
        return { text: { en: 'Little Boggart put a silly hat on your train. Nothing happens!', ja: '小ボガートが電車にへんな帽子をのせた。何も起きない！' } };
    }
    if (b.form === 'grand') {
        b.grandTurns--;
        const r = rint(g, 0, 2);
        if (r === 0) {
            const props = ownedProps(g, p).sort((a, c) => a.price - c.price);
            if (props.length) {
                const pr = props[0];
                delete g.owners[pr.id];
                const m = Math.round(priceOf(g, pr) / 2);
                addCash(g, p, m, 'sale', 'prop:' + pr.id);
                return { text: { en: `The Grand Boggart sold your ${pr.name.en}!`, ja: `大ボガートが「${pr.name.ja}」を売っちゃった！` } };
            }
        }
        if (r === 1 && p.cards.length) {
            p.cards = [];
            return { text: { en: 'The Grand Boggart threw away all your cards!', ja: '大ボガートがカードを全部すてた！' } };
        }
        const far = STATIONS.slice().sort((a, c) => stationDist(c.id, g.destination) - stationDist(a.id, g.destination))[rint(g, 0, 5)];
        return { text: { en: `Whoosh! The Grand Boggart blew your train to ${far.name.en}!`, ja: `ビューン！大ボガートが電車を${far.name.ja}まで吹き飛ばした！` }, warp: board.stationNode[far.id] };
    }
    // standard Boggart
    const r = rnd(g);
    if (r < 0.2) {
        const c = drawCardId(g, false);
        giveCard(p, c);
        return { text: { en: `The Boggart felt kind today and gave you a ${CARD_BY_ID[c].name.en} card!`, ja: `ボガートが今日はやさしい！「${CARD_BY_ID[c].name.ja}」カードをくれた！` }, good: true };
    }
    if (r < 0.55) {
        const m = rint(g, 10, 50) * 10 * Y;
        const res = addCash(g, p, -m, 'fee');
        p.lastBoggartLoss = -res.change;
        return { text: { en: `The Boggart spent £${m.toLocaleString('en-GB')} of your money!`, ja: `ボガートがお金を£${m.toLocaleString('en-GB')}使った！` }, money: -m };
    }
    if (r < 0.75 && p.cards.length) {
        const c = rpick(g, p.cards);
        removeCard(p, c);
        return { text: { en: `The Boggart threw away your ${CARD_BY_ID[c].name.en} card!`, ja: `ボガートが「${CARD_BY_ID[c].name.ja}」カードをすてた！` } };
    }
    if (r < 0.9) {
        const m = 200 * Y;
        const res = addCash(g, p, -m, 'fee');
        p.lastBoggartLoss = -res.change;
        return { text: { en: `The Boggart bought a giant teapot with your money! -£${m.toLocaleString('en-GB')}`, ja: `ボガートが大きなティーポットを買った！-£${m.toLocaleString('en-GB')}` }, money: -m };
    }
    p.effects.oneDieTurns = Math.max(p.effects.oneDieTurns, 1);
    return { text: { en: 'The Boggart hid your dice! Next turn you roll only 1 die.', ja: 'ボガートがサイコロをかくした！次はサイコロ1個だけ。' } };
}
/** Called once per month for the holder: the Boggart grows if kept too long (Full games only). */
export function boggartMonth(g) {
    const b = g.boggart;
    if (!b.holder)
        return null;
    b.months++;
    const holder = player(g, b.holder);
    if (b.form === 'boggart' && b.months >= 12 && g.settings.years >= 10) {
        if (holder.cards.includes('horseshoe')) {
            removeCard(holder, 'horseshoe');
            return 'blocked';
        }
        b.form = 'grand';
        b.grandTurns = 3;
        return 'grow';
    }
    if (b.form === 'grand' && b.grandTurns <= 0) {
        b.form = 'boggart';
        b.months = 0;
        return 'shrink';
    }
    return null;
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
        const f = forecastIncome(g, p);
        addCash(g, p, f.total, 'rent');
        if (p.effects.seacoleGift > 0)
            p.effects.seacoleGift = 0;
        // Kid-friendly debt rule: sell the cheapest properties at half price until cash is not negative.
        const sold = [];
        while (p.cash < 0) {
            const props = ownedProps(g, p).sort((a, b) => a.price - b.price);
            if (!props.length)
                break;
            delete g.owners[props[0].id];
            addCash(g, p, Math.round(priceOf(g, props[0]) / 2), 'sale', 'prop:' + props[0].id);
            sold.push(props[0].name.en);
        }
        const forgiven = p.cash < CASH_FLOOR;
        if (forgiven)
            p.cash = CASH_FLOOR;
        lines.push({ player: p, income: f.total, monopolies: f.mono, sold, forgiven });
    }
    return lines;
}
/** What the March settlement would pay this player right now (same maths as settle, without paying out). */
export function forecastIncome(g, p) {
    const lines = ownedProps(g, p).map((pr) => {
        let v = priceOf(g, pr) * pr.ret * catMultiplier(g, p, pr);
        const mono = monopolyOwner(g, pr.stationId) === p.id;
        if (mono)
            v *= 2;
        return { prop: pr, rent: v, mono };
    });
    const gift = p.effects.seacoleGift > 0 ? p.effects.seacoleGift * 2 : 0;
    const mono = new Set(lines.filter((l) => l.mono).map((l) => l.prop.stationId)).size;
    return { total: roundTo10(lines.reduce((a, l) => a + l.rent, 0) + gift), mono, gift, lines };
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