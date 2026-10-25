import { board, nextOptions } from '../core/map.js';
import { STATIONS, STATION_BY_ID, PROP_BY_ID } from '../core/content/stations.js';
import { CARD_BY_ID, REGIONS, SHOP_STOCK, TRAINS, AVATARS } from '../core/content/game-data.js';
import { eventDate, dateText, realMonth } from '../core/calendar.js';
import { HEROES, HERO_BY_ID, HEROES_AT, SENSEI } from '../core/content/heroes.js';
import { addCash, assets, arrivalPrize, arrivalRanking, blueAmount, redAmount, boostCat, destinationChoices, diceCount, drawCardId, drawRareCardId, giveCard, lastPlace, monopolyOwner, nearestStationTo, newYearReset, ownedProps, payoutYear, pickDestination, priceOf, removeCard, rint, rpick, rnd, settle, rweighted, pickMonthEvent, snapshot, } from '../core/rules.js';
import { C, money } from '../engine/draw.js';
import { clock } from '../engine/tween.js';
import { fx } from '../engine/fx.js';
import { audio } from '../engine/audio.js';
import { app } from './app.js';
import { t2, lines, payoutT } from './i18n.js';
import { HumanController, CpuController } from './controllers.js';
import { say, toast, banner, rollDice, SettlementModal, drawCard, drawHeroCard } from './dialogs.js';
import { studio, monthCard, spin } from './show.js';
import { MINIGAMES, cpuScore } from './minigames.js';
import { teacher, collect, book, saveBook, saveJSON, RESULTS_KEY } from './storage.js';
const filmStations = () => STATIONS.filter((s) => s.film).map((s) => s.id);
/** Japanese first, English second. */
const T = (ja, en) => t2(en, ja);
const yen = (n) => '£' + n.toLocaleString('en-GB');
export class Director {
    constructor(g, board) {
        this.g = g;
        this.board = board;
        this.ctrls = {};
        this.stopped = false;
        this.onGameOver = null;
        this.startedAt = performance.now();
        const human = new HumanController(board);
        const cpu = new CpuController();
        for (const p of g.players)
            this.ctrls[p.id] = p.controller === 'human' && !app.autoplay ? human : cpu;
    }
    isHuman(p) { return p.controller === 'human' && !app.autoplay; }
    ask(prompt) { return this.ctrls[prompt.playerId].decide(this.g, prompt); }
    /** One message in the message box. CPU players get one too, headed with their name, so the class can follow what happens. */
    async tell(p, o, _toastIcon = '💬') {
        if (this.stopped)
            return;
        if (!p || this.isHuman(p))
            return say(o);
        return say({ ...o, title: { en: `${p.name.en}: ${o.title.en}`, ja: `${p.name.ja}：${o.title.ja}` }, color: o.color ?? C.players[p.color], badge: o.badge ?? (o.portrait || o.icon || o.iconDraw ? lines(p.name).main : undefined) });
    }
    /** A short note about what a player did: a quick toast for a human, a message for the CPU. */
    async note(p, t, icon) {
        if (this.stopped)
            return;
        if (this.isHuman(p))
            return toast(t, icon, C.players[p.color], 1200);
        return say({ title: p.name, icon, body: [t], color: C.players[p.color] });
    }
    /** Names a CPU watcher by name ("Pip skips…"), keeps "you" for a human's own turn. */
    /** The humans, in turn order starting after the given player (or with the given player first). */
    humansFrom(first, includeFirst = true) {
        const hs = this.g.players.filter((q) => this.isHuman(q));
        if (!first)
            return hs;
        const all = this.g.players;
        const start = all.findIndex((q) => q.id === first.id);
        const order = [];
        for (let i = 0; i < all.length; i++) {
            const q = all[(start + (includeFirst ? 0 : 1) + i) % all.length];
            if (this.isHuman(q))
                order.push(q);
        }
        return order;
    }
    voice(p, human, cpu) { return this.isHuman(p) ? human : cpu; }
    /** This year's actual payout ("£100 × year" in the content files confuses the class). */
    payout(t) { return payoutT(t, payoutYear(this.g)); }
    get multi() { return this.g.players.filter((q) => q.controller === 'human').length > 1 && !app.autoplay; }
    setSpeed(_p) {
        if (app.autoplay) {
            clock.timeScale = 30;
            return;
        }
        clock.timeScale = 1; // never rush: the class needs to see what is happening
    }
    save() {
        if (app.autoplay)
            return;
        try {
            localStorage.setItem('britainExpressSave', JSON.stringify(this.g));
        }
        catch { /* ignore */ }
    }
    // ======================= main loop =======================
    async run() {
        const g = this.g;
        if (g.year === 1 && g.month === 0 && g.turn === 0 && !g.log.includes('started')) {
            g.log.push('started');
            await this.intro();
        }
        while (!g.over && !this.stopped) {
            if (g.turn === 0) {
                this.save();
                await this.monthStart();
            }
            while (g.turn < g.players.length && !this.stopped) {
                await this.playTurn(g.players[((g.firstPlayer ?? 0) + g.turn) % g.players.length]);
                g.turn++;
            }
            if (this.stopped)
                return;
            g.turn = 0;
            await this.monthEnd();
        }
        if (!this.stopped) {
            try {
                localStorage.removeItem('britainExpressSave');
            }
            catch { /* ignore */ }
            if (!app.autoplay) {
                book.games++;
                saveBook();
                this.saveResults();
                await studio([{ pose: 'excited', tv: null, sfx: 'fanfare', t: T('ゲームしゅうりょう！みんな、よく がんばったね！さあ、けっか はっぴょうだよ！', 'The game is over! Great job everyone! Here come the results!') }]);
            }
            this.onGameOver && this.onGameOver(g);
        }
    }
    /** Stores a summary for the teacher's CSV export. */
    saveResults() {
        const g = this.g;
        const rows = g.players.map((p) => ({
            player: p.name.en + (p.controller === 'human' ? ' (class)' : ' (CPU)'), assets: assets(g, p), cash: p.cash, properties: ownedProps(g, p).length,
            stations: p.visited.length, quizStars: p.stars, heroes: p.heroCollection.length, arrivals: p.arrivals,
        }));
        saveJSON(RESULTS_KEY, { date: new Date().toISOString(), className: teacher.className, years: g.settings.years, minutes: Math.round((performance.now() - this.startedAt) / 60000), rows });
    }
    // ======================= the presenter =======================
    /** The picture on the studio TV for a station. */
    tvPlace(sid) {
        const st = STATION_BY_ID[sid];
        return { kind: 'places', name: st.image, emoji: st.emoji, title: st.name, sub: REGIONS[st.region].name, color: REGIONS[st.region].color };
    }
    /** The presenter's name, as the teacher set it (default Mark Sensei). */
    get host() { return SENSEI.name; }
    async intro() {
        const g = this.g;
        this.setSpeed(null);
        const hs = g.players.filter((p) => p.controller === 'human');
        const names = { en: hs.map((p) => p.name.en).join(', '), ja: hs.map((p) => p.name.ja).join('、') };
        const pre = [
            { pose: 'excited', tv: null, sfx: 'fanfare', t: T('みんな、こんにちは！マーク先生だよ！「UKエクスプレス」へ ようこそ！', 'Hello everyone! I am Mark Sensei. Welcome to UK Express!') },
            { pose: 'happy', t: hs.length > 1
                    ? T(`${names.ja}、みんなは てつどうがいしゃの しゃちょうさん！イギリスを ぐるぐる まわって、ゆうめいな ばしょを かおう！`, `${names.en}: you are all railway bosses! Travel around the UK and buy famous places!`)
                    : T(`${names.ja}は ${hs[0].name.ja}てつどうの しゃちょうさん！イギリスを ぐるぐる まわって、ゆうめいな ばしょを かおう！`, `You are the boss of ${hs[0].name.en} Railway! Travel around the UK and buy famous places!`) },
            { pose: 'point', t: T('えきの ことは、みぎがわの「えきガイド」に でるよ。ぜひ よんでね！', 'Look at the Station guide on the right to learn about each place!') },
        ];
        await this.announceDestination(true, pre);
    }
    /** The presenter announces where everyone is going next. */
    async announceDestination(first = false, pre = []) {
        const g = this.g;
        this.setSpeed(null);
        const st = STATION_BY_ID[g.destination];
        const region = REGIONS[st.region].name;
        // the roulette: the TV flicks through stations, slows down... and stops on the destination!
        const others = STATIONS.filter((x) => x.id !== g.destination);
        const spinList = [];
        for (let i = 0; i < 9; i++)
            spinList.push(this.tvPlace(others[Math.floor(Math.random() * others.length)].id));
        const hook = st.guide[0];
        // park the camera on the destination while the studio screen still covers the map (no flash of the board)
        const n = board.nodes[board.stationNode[g.destination]];
        this.board.parkAt(n.x, n.y, 0.7);
        const ls = [
            ...pre,
            { pose: 'excited', tv: null, sfx: 'whistle', t: first ? T('さいしょの もくてきちは…どこだ！？', 'The first destination is... where?!') : T('つぎの もくてきちは…どこだ！？', 'The next destination is... where?!') },
            { pose: 'surprised', tv: this.tvPlace(g.destination), spin: spinList, t: T('ドキドキ… ルーレット スタート！', 'Drum roll... spin the roulette!') },
            { pose: 'excited', t: T(`${st.name.ja}に きまり！ ${lines(region).main}に あるよ。いちばんに ついたひとが ボーナス！`, `It's ${st.name.en}! It is in ${region.en}. The first one there wins a bonus!`) },
        ];
        if (hook)
            ls.push({ pose: 'point', t: T(`${st.name.ja}と いえば…「${hook.title.ja}」！ えきガイドを 見てね！`, `${st.name.en} is famous for... ${hook.title.en}! Read all about it in the Station guide!`) });
        await studio(ls);
        await clock.wait(250);
    }
    // ======================= months =======================
    async monthStart() {
        const g = this.g;
        this.setSpeed(null);
        await monthCard(g.month, g.year, g.settings.years);
        if (!(g.year === 1 && g.month === 0)) {
            const first = g.players[(g.firstPlayer ?? 0) % g.players.length];
            await banner(t2(`${first.name.en} goes first this month! (Order rotates.)`, `${first.name.ja}が今月はじめ！（順番は毎月変わるよ）`), C.players[first.color], '🔄', 1600);
        }
        const pick = pickMonthEvent(g);
        if (pick)
            await this.eventDay(pick.ev, pick.extra);
    }
    /** The picture card, shown on the studio TV as the day's news. */
    async eventDay(ev, extra) {
        const g = this.g;
        const Y = payoutYear(g);
        const { m } = realMonth(g.year, g.month);
        const d = eventDate(ev, g.year);
        const inMonth = !!d && d.getMonth() === m;
        const dt = inMonth ? dateText(d) : null;
        collect('events', ev.id);
        // the hometown guest's name can be changed by the teacher
        const guest = (t) => ({ en: t.en.replace(/Mark Sensei/g, SENSEI.name.en), ja: t.ja.replace(/マーク先生/g, SENSEI.name.ja) });
        const tv = { kind: 'events', name: ev.image, emoji: ev.emoji, title: ev.title, sub: dt ?? ev.label ?? undefined, color: '#b5651d' };
        const ls = [
            { pose: 'excited', tv, sfx: 'fanfare', t: guest(ev.why) },
            { pose: 'point', t: guest(ev.fact) },
        ];
        if (extra)
            ls.push({ pose: 'happy', tv: { kind: 'events', name: extra.image, emoji: extra.emoji, title: extra.title, color: '#b5651d' }, t: extra.text });
        ls.push({ pose: 'excited', t: this.payout(ev.effect) });
        await studio(ls);
        await this.applyFx(ev.fx);
    }
    async applyFx(f) {
        const g = this.g;
        const Y = payoutYear(g);
        const regionOf = (p) => board.nodes[p.pos].region;
        switch (f.t) {
            case 'all':
                for (const p of g.players)
                    addCash(g, p, f.amount * Y, 'prize');
                audio.play('coin');
                break;
            case 'region':
                for (const p of g.players)
                    if (f.regions.includes(regionOf(p)))
                        addCash(g, p, f.amount * Y, 'prize');
                break;
            case 'card':
                for (const p of g.players)
                    giveCard(p, drawCardId(g, false));
                break;
            case 'cardRegion':
                for (const p of g.players)
                    if (f.regions.includes(regionOf(p)))
                        giveCard(p, drawCardId(g, false));
                break;
            case 'boost':
                g.globalBoosts[f.cat] = (g.globalBoosts[f.cat] ?? 1) * f.mult;
                break;
            case 'scotlandCulture':
                g.globalBoosts.scotlandCulture = 2;
                break;
            case 'owner': {
                const o = g.owners[f.prop];
                if (o)
                    addCash(g, g.players.find((p) => p.id === o), f.amount, 'prize');
                break;
            }
            case 'gala': {
                for (const p of g.players)
                    if (regionOf(p) === 'north')
                        giveCard(p, 'express');
                const owners = new Set(STATION_BY_ID['durham'].props.map((pr) => g.owners[pr.id]).filter(Boolean));
                for (const o of owners)
                    addCash(g, g.players.find((p) => p.id === o), 500 * Y, 'prize');
                break;
            }
            case 'minigame': {
                // Mini-games are switched off: the prize becomes a lucky draw instead.
                const w = rpick(g, g.players);
                addCash(g, w, 300 * Y, 'prize');
                audio.play('fanfare');
                await this.tell(null, { title: t2('Lucky draw!', 'くじ引き！'), icon: '🏆', body: [t2(`${w.name.en} wins the prize: £${(300 * Y).toLocaleString('en-GB')}!`, `${w.name.ja}が当選！£${(300 * Y).toLocaleString('en-GB')}！`)] });
                break;
            }
            case 'charity': {
                const last = lastPlace(g);
                for (const p of g.players)
                    if (p.id !== last.id) {
                        const r = addCash(g, p, -f.amount * Y, 'fee');
                        addCash(g, last, -r.change, 'prize');
                    }
                break;
            }
        }
    }
    /** Everyone takes part: the human plays, CPU rivals get a score for their level. Prizes by rank. (Mini-games are switched off for now.) */
    async miniGame(id, title) {
        const g = this.g;
        const Y = payoutYear(g);
        const scores = [];
        for (const p of g.players) {
            if (this.isHuman(p))
                scores.push({ p, s: await app.show(MINIGAMES[id]()) });
            else
                scores.push({ p, s: cpuScore(id, p.level, () => rnd(g)) });
        }
        scores.sort((a, b) => b.s - a.s);
        const prizes = [500, 300, 150, 50];
        const body = scores.map((x, i) => {
            const m = prizes[i] * Y;
            addCash(g, x.p, m, 'prize');
            return T(`${['🥇', '🥈', '🥉', '4.'][i]} ${x.p.name.ja}：${x.s} → +${yen(m)}`, `${['🥇', '🥈', '🥉', '4.'][i]} ${x.p.name.en}: ${x.s} → +${yen(m)}`);
        });
        audio.play('fanfare');
        await this.tell(null, { title: T(`${title.ja}：けっか`, `${title.en}: results`), icon: '🏆', body, confetti: true });
    }
    timeUp() { return teacher.timerMinutes > 0 && !app.autoplay && performance.now() - this.startedAt >= teacher.timerMinutes * 60000; }
    async monthEnd() {
        const g = this.g;
        snapshot(g);
        const timeUp = this.timeUp();
        if (timeUp && g.month !== 11) {
            this.setSpeed(null);
            await studio([{ pose: 'happy', tv: null, sfx: 'whistle', t: T('ピピーッ！じかんだよ！じゅぎょうは ここまで。みんなの おかねを かぞえよう！', "Time's up! That's the end of the lesson. Let's count everyone's money!") }]);
        }
        if (g.month === 11 || timeUp) {
            this.setSpeed(null);
            const res = settle(g);
            await app.show(new SettlementModal(g, res));
            for (const l of res)
                if (l.forgiven)
                    await this.tell(null, { title: T('だいじょうぶ！', "Don't worry!"), icon: '🎩', body: [T(`ホイッスルさんが ${l.player.name.ja}の しゃっきんを すこし けしてくれたよ。また がんばろう！`, `Mr Whistle cleared some of ${l.player.name.en}'s debt. Let's try again!`)] });
            // Mr Whistle's gift to last place
            const last = lastPlace(g);
            if (g.year < g.settings.years && !timeUp) {
                const c = drawRareCardId(g);
                if (giveCard(last, c))
                    await this.tell(null, { title: T('ホイッスルさんの プレゼント', "Mr Whistle's gift"), icon: '🎁', body: [T(`いま いちばん おくれている ${last.name.ja}に「${CARD_BY_ID[c].name.ja}」カード！`, `${last.name.en} is in last place, so Mr Whistle gives a ${CARD_BY_ID[c].name.en} card. Keep going!`)] });
                else {
                    addCash(g, last, 500 * payoutYear(g), 'prize');
                }
            }
            newYearReset(g);
            if (timeUp) {
                g.over = true;
                return;
            }
            g.year++;
            if (g.year > g.settings.years) {
                g.over = true;
                return;
            }
            await studio([
                { pose: 'excited', tv: null, sfx: 'fanfare', t: T(`${g.year}ねんめの スタート！`, `Year ${g.year} begins!`) },
                ...(g.year === g.settings.years && g.settings.years > 1 ? [{ pose: 'point', t: T('いよいよ さいごの 1ねんだよ！ぜんりょくで いこう！', 'This is the final year! Give it everything!') }] : []),
            ]);
        }
        g.month = (g.month + 1) % 12;
        // Fairness: the first player rotates every month, so nobody keeps the opening-move edge.
        g.firstPlayer = (((g.firstPlayer ?? 0) + 1) % g.players.length);
    }
    // ======================= a turn =======================
    async playTurn(p) {
        const g = this.g;
        this.setSpeed(p);
        this.board.snapTrain(p);
        await this.board.focusPlayer(p);
        if (!app.autoplay)
            audio.chooChoo(); // the train is in view: no dialog is covering it now
        await banner(T(`${p.name.ja}の番！`, `${p.name.en}'s turn!`), C.players[p.color], AVATARS[p.avatar].emoji, this.isHuman(p) ? 1000 : 800);
        if (p.effects.skipTurn) {
            p.effects.skipTurn = false;
            await this.tell(p, { title: T('おやすみ', 'Resting'), icon: '😴', body: [T('1かい やすみ。', 'You skip this turn.')] });
            return;
        }
        let extra = 0;
        let endTurn = false;
        for (let guard = 0; guard < 12; guard++) {
            const cmd = await this.ask({ kind: 'command', playerId: p.id });
            if (this.stopped)
                return;
            if (cmd.type === 'roll')
                break;
            const r = cmd.type === 'card' ? await this.useCard(p, cmd.id) : await this.useHero(p, cmd.id);
            if (r.extraDice) {
                extra += r.extraDice;
                break;
            }
            if (r.endTurn) {
                endTurn = true;
                break;
            }
        }
        if (!endTurn) {
            // roll
            let n = diceCount(p) + extra;
            if (p.effects.bonusDiceTurns > 0) {
                n += p.effects.bonusDice;
                p.effects.bonusDiceTurns--;
            }
            if (p.effects.oneDieTurns > 0) {
                n = 1;
                p.effects.oneDieTurns--;
            }
            const vals = Array.from({ length: n }, () => rint(g, 1, 6));
            let bonus = 0;
            if (p.effects.perDieBonus) {
                bonus = n;
                p.effects.perDieBonus = false;
            }
            await rollDice(vals, bonus);
            const steps = vals.reduce((a, b) => a + b, 0) + bonus;
            const result = await this.move(p, steps);
            if (this.stopped)
                return;
            if (result === 'arrived')
                await this.arrival(p);
            await this.land(p);
        }
        this.checkBadges(p);
    }
    async move(p, steps) {
        const g = this.g;
        this.board.current = p;
        this.board.follow = p.id;
        let left = steps;
        while (left > 0 && !this.stopped) {
            this.board.movesLeft = left;
            const opts = nextOptions(p.pos, p.prev);
            let next = opts[0];
            if (opts.length > 1)
                next = await this.ask({ kind: 'junction', playerId: p.id, options: opts, movesLeft: left });
            this.board.follow = p.id;
            await this.board.animateStep(p, next);
            p.prev = p.pos;
            p.pos = next;
            left--;
            const node = board.nodes[p.pos];
            if (node.stationId === g.destination) {
                this.board.movesLeft = 0;
                return 'arrived';
            }
        }
        this.board.movesLeft = 0;
        return 'stopped';
    }
    // ======================= squares =======================
    async land(p) {
        const g = this.g;
        const node = board.nodes[p.pos];
        const s = this.board.worldToScreen(this.board.vis[p.id].x, this.board.vis[p.id].y);
        switch (node.type) {
            case 'blue': {
                const a = blueAmount(g);
                addCash(g, p, a, 'prize');
                audio.play('coin');
                fx.burst(s.x, s.y - 30, 'coin', 14, { speed: 6 });
                fx.float('+' + money(a), s.x, s.y - 80, C.gold);
                const summer = g.month >= 2 && g.month <= 4;
                await this.tell(p, { title: T('あおマス！', 'Blue square!'), icon: '💷', body: [summer ? T('なつは かんこうきゃくが いっぱい！いつもより もうかったよ！', 'Summer tourists bring extra money!') : T('てつどうが もうかったよ！', 'Your railway earns money!')], money: a }, '💷');
                break;
            }
            case 'red': {
                if (p.cards.includes('umbrella')) {
                    removeCard(p, 'umbrella');
                    await this.tell(p, { title: T('かさで たすかった！', 'Umbrella saves the day!'), icon: '☂️', body: [T('にわか雨！でも かさが あったから、おかねは へらなかったよ！', 'A surprise shower! Your umbrella kept you dry, so no money was lost!')] });
                    break;
                }
                const a = redAmount(g);
                const r = addCash(this.g, p, -a);
                audio.play('bad');
                fx.float('-' + money(a), s.x, s.y - 80, C.red);
                const f = this.redFlavour(p);
                await this.tell(p, { title: T('あかマス！', 'Red square!'), icon: f.icon, body: [t2(f.en, f.ja)], money: r.change }, f.icon);
                if (r.forgiven)
                    await this.tell(p, { title: T('だいじょうぶ！', "Don't worry!"), icon: '🎩', body: [T('ホイッスルさんが たすけてくれたよ。おかねは -£500より 下がらないよ。', 'Mr Whistle helps: your money will not go below -£500.')] });
                break;
            }
            case 'card':
                await this.cardSquare(p);
                break;
            case 'quiz':
                await this.luckySquare(p);
                break;
            case 'event':
                await this.eventSquare(p);
                break;
            case 'shop': {
                const stock = SHOP_STOCK[node.region];
                const buy = await this.ask({ kind: 'cardShop', playerId: p.id, stock });
                for (const id of buy) {
                    if (p.cash >= CARD_BY_ID[id].price && giveCard(p, id)) {
                        addCash(this.g, p, -CARD_BY_ID[id].price);
                        if (this.isHuman(p))
                            collect('cards', id);
                    }
                }
                if (buy.length && !this.isHuman(p))
                    await this.note(p, T(`${buy.map((b) => CARD_BY_ID[b].name.ja).join('、')}を かったよ`, `bought ${buy.map((b) => CARD_BY_ID[b].name.en).join(', ')}`), '🏪');
                break;
            }
            case 'port':
            case 'sea':
                await toast(T('フェリーに のろう！', 'All aboard the ferry!'), '⛴️', C.sea, 900);
                break;
            case 'station':
                await this.stationVisit(p, node.stationId);
                break;
        }
        this.checkBadges(p);
    }
    /** Why a red square costs money: small, silly, never mean. */
    redFlavour(p) {
        const g = this.g;
        const cpu = !this.isHuman(p);
        const nm = p.name.en;
        const autumn = g.month >= 5 && g.month <= 7, winter = g.month >= 8 && g.month <= 10;
        const list = [
            { icon: '🚧', en: 'Roadworks! The engineers are mending the track. Repairs cost money.', ja: '工事中！せんろを なおしているよ。しゅうりだいが かかったね。', w: 3 },
            { icon: '🚦', en: 'Signal failure! The train waits and waits. Sorry for the delay!', ja: 'しんごうが こわれた！でんしゃは まちぼうけ。ごめんなさい！', w: 3 },
            { icon: '🎫', en: 'The ticket machine is broken! You lose some ticket money.', ja: 'きっぷの きかいが こわれた！きっぷの おかねが すこし へったよ。', w: 2 },
            { icon: '🐑', en: 'Sheep on the track! The driver waited for them to move.', ja: 'せんろに ひつじ！うんてんしさんは どいてくれるのを まったよ。', w: 2 },
            { icon: '🔧', en: 'A wheel needs fixing. The workshop sends you a bill.', ja: 'しゃりんを なおさなきゃ！こうじょうから せいきゅうしょが きたよ。', w: 2 },
            { icon: '🌧️', en: 'A heavy shower! Water on the track slows the train.', ja: 'どしゃぶり！せんろに みずが たまって、でんしゃが おそくなったよ。', w: 1 },
        ];
        if (autumn)
            list.push({ icon: '🍂', en: 'Fallen leaves! Wet leaves make the rails slippery in autumn.', ja: 'おちばが いっぱい！あきは ぬれた おちばで レールが すべるよ。', w: 4 });
        if (winter)
            list.push({ icon: '❄️', en: 'Frost on the track! Winter repairs cost a little more.', ja: 'せんろが こおった！ふゆは しゅうりだいが すこし たかいよ。', w: 4 });
        return rweighted(g, list, (x) => x.w);
    }
    /** The spinner shows the card the game has already drawn among a few others. */
    async cardSquare(p) {
        const g = this.g;
        const id = drawCardId(g);
        if (this.isHuman(p)) {
            const ids = Object.keys(CARD_BY_ID).filter((x) => x !== id);
            const items = [];
            while (items.length < 5 && ids.length) {
                const c = CARD_BY_ID[ids.splice(Math.floor(rnd(g) * ids.length), 1)[0]];
                items.push({ icon: c.emoji, label: c.name });
            }
            const k = Math.floor(rnd(g) * (items.length + 1));
            items.splice(k, 0, { icon: CARD_BY_ID[id].emoji, label: CARD_BY_ID[id].name });
            await spin(T('カードルーレット！', 'Card spinner!'), items, k);
        }
        await this.gainCard(p, id);
    }
    async gainCard(p, id) {
        const c = CARD_BY_ID[id];
        audio.play('card');
        if (this.isHuman(p))
            collect('cards', id);
        if (!giveCard(p, id)) {
            const k = await this.ask({ kind: 'discard', playerId: p.id, newCard: id });
            if (k < 0)
                return;
            p.cards.splice(k, 1);
            p.cards.push(id);
        }
        await this.tell(p, { title: T(`カードゲット：${c.name.ja}！`, `New card: ${c.name.en}!`), body: [this.payout(c.desc)], iconDraw: (ctx, x, y) => drawCard(ctx, c, x - 46, y - 62, 92, 124, false, false, this.g.year) }, c.emoji);
    }
    /** The old quiz square is now a lucky spin. */
    async luckySquare(p) {
        const g = this.g;
        const Y = payoutYear(g);
        const amts = [100, 300, 200, 500, 150, 400].map((a) => a * Y);
        const k = rweighted(g, [0, 1, 2, 3, 4, 5], (i) => [3, 2, 3, 1, 3, 2][i]);
        if (this.isHuman(p))
            await spin(T('ラッキー ルーレット！', 'Lucky spinner!'), amts.map((a) => ({ icon: '💷', label: T(`+${yen(a)}`, `+${yen(a)}`), color: '#c8921a' })), k);
        addCash(this.g, p, amts[k]);
        const s = this.board.worldToScreen(this.board.vis[p.id].x, this.board.vis[p.id].y);
        audio.play('coin');
        fx.burst(s.x, s.y - 30, 'coin', 16, { speed: 6 });
        fx.float('+' + money(amts[k]), s.x, s.y - 80, C.gold);
        if (!this.isHuman(p))
            await this.note(p, T(`ラッキー！ +${yen(amts[k])}`, `Lucky! +${yen(amts[k])}`), '🍀');
    }
    async eventSquare(p) {
        const g = this.g;
        const Y = payoutYear(g);
        const kinds = ['rainbow', 'tea', 'hero', 'umbrella', 'movie', 'match', 'royal'];
        const k = rweighted(g, kinds, (x) => ({ rainbow: 2, tea: 2, hero: 3, umbrella: 2, movie: 2, match: 2, royal: 1 }[x]));
        switch (k) {
            case 'rainbow':
                addCash(this.g, p, 300 * Y);
                audio.play('coin');
                await this.tell(p, { title: T('にじが でた！', 'A rainbow!'), icon: '🌈', body: [T('たいようと にわか雨が いっしょだと、にじが でるよ。ラッキー！', 'Sun and showers together make a rainbow. Lucky!')], money: 300 * Y });
                break;
            case 'tea':
                for (const q of g.players)
                    addCash(this.g, q, 100 * Y);
                audio.play('coin');
                await this.tell(p, { title: T('アフタヌーンティー！', 'Afternoon tea party!'), icon: '🫖', body: [T(`サンドイッチ、スコーン、ケーキ！みんなが ${yen(100 * Y)} もらえたよ！`, `Sandwiches, scones and cakes! Everyone gets ${yen(100 * Y)}!`)] });
                break;
            case 'hero': {
                const cand = HEROES.filter((h) => !p.heroCollection.includes(h.id));
                if (cand.length) {
                    await this.heroMeet(p, rpick(g, cand).id, true);
                    break;
                }
                addCash(g, p, 300 * Y, 'prize');
                break;
            }
            case 'umbrella':
                await this.gainCard(p, 'umbrella');
                break;
            case 'movie':
                addCash(this.g, p, 200 * Y);
                await this.tell(p, { title: T('えいがの まほう！', 'Movie magic!'), icon: '🎬', body: [T('イギリスでは ゆうめいな えいがが たくさん つくられているよ。さつえいチームが えきを つかったので、おかねが もらえた！', 'Many famous films are made in the UK. A film crew paid to use your station!')], money: 200 * Y });
                break;
            case 'match': {
                const sport = ownedProps(g, p).filter((x) => x.cat === 'sport').length;
                const m = (sport * 200 + 100) * Y;
                addCash(this.g, p, m);
                await this.tell(p, { title: T('ビッグマッチの日！', 'Big match day!'), icon: '⚽', body: [T('サッカーの ルールは 1863ねんに イングランドで できたよ。きょうは スポーツの ぶっけんが もうかる！', 'Football got its rules in England in 1863. Sport properties earn extra today!')], money: m });
                break;
            }
            case 'royal': {
                const st = rpick(g, STATIONS);
                const counts = {};
                for (const pr of st.props) {
                    const o = g.owners[pr.id];
                    if (o)
                        counts[o] = (counts[o] ?? 0) + 1;
                }
                const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                if (best)
                    addCash(this.g, g.players.find((q) => q.id === best[0]), 1000);
                const w = best ? g.players.find((q) => q.id === best[0]) : null;
                await this.tell(p, { title: T(`王さまが ${st.name.ja}に やってきた！`, `The King visits ${st.name.en}!`), icon: '👑', body: [w ? T(`${st.name.ja}で いちばん ぶっけんを もっている ${w.name.ja}に ${yen(1000)}！`, `${w.name.en} owns the most there and earns ${yen(1000)}.`) : T(`でも ${st.name.ja}には だれの ぶっけんも なかったよ。`, 'Nobody owns property there yet.')] });
                break;
            }
        }
    }
    // ======================= stations =======================
    async stationVisit(p, sid) {
        const g = this.g;
        const st = STATION_BY_ID[sid];
        const first = !p.visited.includes(sid);
        if (first) {
            p.visited.push(sid);
            if (this.isHuman(p)) {
                collect('stations', sid);
                audio.play('card');
            }
            if (st.hometown)
                await this.hometown(p);
            const heroes = (HEROES_AT[sid] ?? []).filter((h) => !p.heroCollection.includes(h.id));
            if (heroes.length)
                await this.heroMeet(p, rpick(g, heroes).id, false);
        }
        // Shop
        const ans = await this.ask({ kind: 'shop', playerId: p.id, stationId: sid });
        const bought = [];
        for (const id of ans.props) {
            const pr = PROP_BY_ID[id];
            const price = priceOf(g, pr);
            if (g.owners[id] || p.cash < price)
                continue;
            addCash(g, p, -price, 'buy', 'prop:' + id);
            g.owners[id] = p.id;
            bought.push(id);
        }
        if (bought.length) {
            p.lastBuyStation = sid;
            audio.play('buy');
        }
        if (ans.train !== null && ans.train === p.train + 1 && p.cash >= TRAINS[ans.train].price) {
            addCash(g, p, -TRAINS[ans.train].price, 'buy', 'train:' + ans.train);
            p.train = ans.train;
            audio.play('whistle');
            await this.tell(p, { title: T(`あたらしい れっしゃ：${TRAINS[p.train].name.ja}！`, `New train: ${TRAINS[p.train].name.en}!`), icon: '🚂', body: [TRAINS[p.train].fact, T(`サイコロが ${TRAINS[p.train].dice}こに なったよ！`, `Now you roll ${TRAINS[p.train].dice} dice!`)], confetti: true });
        }
        if (bought.length && !this.isHuman(p))
            await this.note(p, T(`${bought.map((b) => PROP_BY_ID[b].name.ja).join('、')}を かったよ`, `bought ${bought.map((b) => PROP_BY_ID[b].name.en).join(', ')}`), '🏠');
        if (bought.length && monopolyOwner(g, sid) === p.id) {
            audio.play('fanfare');
            const s = this.board.worldToScreen(this.board.vis[p.id].x, this.board.vis[p.id].y);
            fx.burst(s.x, s.y - 40, 'star', 30, { color: C.gold, speed: 8 });
            if (st.hometown)
                p.hometownCompanion = true;
            await this.tell(p, { title: T(`${st.name.ja}を どくせん！`, `Monopoly at ${st.name.en}!`), icon: '👑', body: [T('ここの ぶっけんを ぜんぶ もっているよ！まい年3月の りえきが 2ばい！', 'You own every property here. Profits are doubled every March!')] });
        }
    }
    async hometown(p) {
        const g = this.g;
        const m = 500 * payoutYear(g);
        addCash(g, p, m, 'prize');
        const c = drawRareCardId(g);
        const got = giveCard(p, c);
        audio.play('fanfare');
        await this.tell(p, {
            title: SENSEI.welcome, photo: { kind: 'heroes', name: 'marksensei', emoji: SENSEI.emoji, label: SENSEI.name.en, color: '#e0457b' }, badge: lines(SENSEI.name).main, confetti: true,
            body: [T(`ダラムは ${SENSEI.name.ja}の ふるさと！だいせいどうには、どうぶつが だいすきだった セント・カスバートが ねむっているよ。`, `Durham is ${SENSEI.name.en}'s hometown! Its cathedral holds the shrine of St Cuthbert, who loved animals.`),
                T(`ふるさとボーナス：+${yen(m)}${got ? `と「${CARD_BY_ID[c].name.ja}」カード！` : '！'}`, `Hometown bonus: +${yen(m)}${got ? ` and a ${CARD_BY_ID[c].name.en} card!` : '!'}`)],
        }, '👨‍🏫');
    }
    /** Meeting a hero: no quiz any more. The hero's card is yours, with a line about who they were. */
    async heroMeet(p, heroId, visit) {
        const h = HERO_BY_ID[heroId];
        p.heroCollection.push(heroId);
        if (this.isHuman(p))
            collect('heroes', heroId);
        audio.play('fanfare');
        const body = [h.line];
        if (h.japan && this.isHuman(p))
            body.push(T(`🇯🇵 ${h.japan.ja}`, `🇯🇵 ${h.japan.en}`));
        if (h.powerDesc)
            body.push(T(`★ ${h.powerName.ja}：${h.powerDesc.ja}（1年に1かい）`, `★ ${h.powerName.en}: ${h.powerDesc.en} (once a year)`));
        await this.tell(p, { title: visit ? T(`ヒーローが きた！${h.name.ja}`, `A hero visits: ${h.name.en}!`) : T(`ヒーローに あえた！${h.name.ja}`, `You met a hero: ${h.name.en}!`), iconDraw: (ctx, x, y) => drawHeroCard(ctx, heroId, x - 46, y - 64, 92, 128), body, confetti: true, color: '#8a6a10' });
        if (p.heroes.length < 3)
            p.heroes.push(heroId);
        else {
            const k = await this.ask({ kind: 'heroReplace', playerId: p.id, newHero: heroId });
            if (k >= 0)
                p.heroes[k] = heroId;
        }
    }
    // ======================= arrival =======================
    async arrival(p) {
        const g = this.g;
        const st = STATION_BY_ID[g.destination];
        const base = arrivalPrize(g);
        // Everyone else ranks by exact squares away: closest is 2nd, next is 3rd.
        const ranked = arrivalRanking(g, p.id);
        const awards = [];
        if (ranked[0])
            awards.push({ place: '2nd', placeJa: '2い', who: ranked[0].p, dist: ranked[0].dist, bonus: Math.round(base * 0.25 / 10) * 10 });
        if (ranked[1])
            awards.push({ place: '3rd', placeJa: '3い', who: ranked[1].p, dist: ranked[1].dist, bonus: Math.round(base * 0.1 / 10) * 10 });
        p.arrivals++;
        audio.play('fanfare');
        const s = this.board.worldToScreen(this.board.vis[p.id].x, this.board.vis[p.id].y);
        fx.burst(s.x, s.y - 40, 'confetti', 80, { speed: 10, up: 7 });
        fx.burst(s.x, s.y - 40, 'coin', 20, { speed: 7 });
        const fact = rpick(g, st.facts);
        await studio([
            { pose: 'excited', tv: this.tvPlace(g.destination), sfx: 'fanfare', t: T(`${p.name.ja}しゃちょうが ${st.name.ja}に とうちゃく！おめでとう！`, `${p.name.en} has arrived at ${st.name.en}! Congratulations!`) },
            { pose: 'point', t: fact },
        ]);
        // the bonus: a spin, a little more or less than the usual prize
        const mults = [1, 1.5, 0.8, 2, 1.2, 1];
        const k = rweighted(g, [0, 1, 2, 3, 4, 5], (i) => [3, 2, 2, 1, 2, 3][i]);
        const prizes = mults.map((m) => Math.max(100, Math.round((base * m) / 10) * 10));
        if (this.isHuman(p))
            await spin(T('とうちゃく ボーナス ルーレット！', 'Arrival bonus spinner!'), prizes.map((a) => ({ icon: '💷', label: T(`+${yen(a)}`, `+${yen(a)}`), color: '#c8921a' })), k);
        addCash(this.g, p, prizes[k]);
        audio.play('coin');
        fx.float('+' + money(prizes[k]), s.x, s.y - 80, C.gold);
        if (!this.isHuman(p))
            await this.tell(p, { title: T('とうちゃく ボーナス！', 'Arrival bonus!'), icon: st.emoji, body: [T(`${st.name.ja}に いちばんに ついたよ！`, `First to ${st.name.en}!`)], money: prizes[k] });
        // photo finish: the next closest trains get a smaller bonus
        for (const a of awards)
            addCash(g, a.who, a.bonus, 'prize');
        if (awards.length) {
            audio.play('coin');
            await say({ title: T('しゃしん はんてい！', 'Photo finish!'), icon: '🏁', body: awards.map((a) => T(`${a.placeJa}：${a.who.name.ja}（あと${a.dist}マス）：+${money(a.bonus)}`, `${a.place}: ${a.who.name.en} (${a.dist} squares away): +${money(a.bonus)}`)), color: C.brass });
        }
        // New destination
        g.prevDestination = g.destination;
        if (p.effects.chooseDest) {
            p.effects.chooseDest = false;
            const opts = destinationChoices(g, 3);
            g.destination = await this.ask({ kind: 'chooseDest', playerId: p.id, options: opts });
        }
        else
            g.destination = pickDestination(g);
        await this.announceDestination();
        await this.board.focusPlayer(p);
    }
    checkBadges(p) {
        if (!p.badges.includes('movie') && filmStations().every((id) => p.visited.includes(id))) {
            p.badges.push('movie');
            addCash(this.g, p, 2000);
            this.tell(p, { title: T('ムービー・マジック・ツアー たっせい！', 'Movie Magic Tour complete!'), icon: '🎬', body: [T('えいがの ロケちの えきを ぜんぶ まわったよ！+£2,000！', 'You visited every film-location station. +£2,000!')], confetti: true });
        }
    }
    // ======================= cards and heroes =======================
    async warpTo(p, sid) {
        const node = board.stationNode[sid];
        p.prev = -1;
        p.pos = node;
        await this.board.warpTrain(p, node);
        if (sid === this.g.destination)
            await this.arrival(p);
        await this.stationVisit(p, sid);
    }
    async useCard(p, id) {
        const g = this.g;
        const c = CARD_BY_ID[id];
        removeCard(p, id);
        audio.play('card');
        const Y = payoutYear(g);
        await this.note(p, T(`「${c.name.ja}」を つかった！`, `used ${c.name.en}!`), c.emoji);
        switch (id) {
            case 'express':
            case 'intercity':
            case 'azuma': return { extraDice: c.dice };
            case 'balloon':
                await this.warpTo(p, rpick(g, STATIONS).id);
                return { endTurn: true };
            case 'royal':
                await this.warpTo(p, nearestStationTo(g.destination));
                return { endTurn: true };
            case 'return':
                if (p.lastBuyStation) {
                    await this.warpTo(p, p.lastBuyStation);
                    return { endTurn: true };
                }
                return {};
            case 'birthday': {
                for (const q of g.players)
                    if (q.id !== p.id) {
                        const r = addCash(g, q, -100 * Y, 'fee');
                        addCash(g, p, -r.change, 'prize');
                    }
                audio.play('coin');
                await this.tell(p, { title: T('おたんじょうび おめでとう！', 'Happy birthday!'), icon: '🎂', body: [T('みんなが プレゼントを くれたよ！', 'Everyone gave you a present!')] });
                return {};
            }
            case 'tourism':
                boostCat(p, 'tourism', 2);
                return {};
            case 'harvest':
                boostCat(p, 'food', 2);
                return {};
            case 'cupfinal':
                boostCat(p, 'sport', 2);
                return {};
            case 'jubilee':
                for (const q of g.players)
                    addCash(g, q, 300 * Y, 'prize');
                audio.play('coin');
                return {};
            case 'signalbox': {
                p.effects.chooseDest = true;
                await say({ title: T('しんごう オーライ！', 'Signal set!'), icon: '🚦', body: [this.voice(p, T('つぎの もくてきちでは、あたらしい もくてきちを 3つの えきから えらべるよ！', 'At the next destination, you will pick the new one from 3 stations!'), T(`つぎの もくてきちでは、${p.name.ja}が 3つの えきから えらぶよ！`, `At the next destination, ${p.name.en} will pick the new one from 3 stations!`))], color: C.players[p.color] });
                return {};
            }
            case 'scotsman': {
                const region = await this.ask({ kind: 'warpRegion', playerId: p.id });
                const cands = STATIONS.filter((s) => s.region === region).map((s) => s.id);
                await say({ title: T('フライング・スコッツマンに のろう！', 'All aboard the Flying Scotsman!'), icon: '🚂', body: [T(`${REGIONS[region].name.ja}へ しゅっぱつ！`, `Off to ${REGIONS[region].name.en}!`)], color: '#2a6a5a' });
                await this.warpTo(p, rpick(g, cands));
                return { endTurn: true };
            }
        }
        return {};
    }
    async useHero(p, id) {
        const g = this.g;
        const h = HERO_BY_ID[id];
        const Y = payoutYear(g);
        p.heroUsedYear[id] = g.year;
        audio.play('fanfare');
        await banner(T(`${h.name.ja}：${h.powerName?.ja ?? ''}！`, `${h.name.en}: ${h.powerName?.en ?? ''}!`), '#8a6a10', h.emoji, 1300);
        switch (h.power) {
            case 'dice2': return { extraDice: 2 };
            case 'perDie':
                p.effects.perDieBonus = true;
                return {};
            case 'foodBoost':
                boostCat(p, 'food', 1.5);
                return {};
            case 'natureBoost':
                boostCat(p, 'nature', 2);
                return {};
            case 'cultureBoost':
                boostCat(p, 'culture', 2);
                return {};
            case 'industryBoost':
                boostCat(p, 'industry', 1.5);
                return {};
            case 'sportBoost':
                boostCat(p, 'sport', 2);
                return {};
            case 'allGain':
                for (const q of g.players)
                    addCash(g, q, 300 * Y, 'prize');
                audio.play('coin');
                return {};
            case 'underdog': {
                if (lastPlace(g).id !== p.id) {
                    delete p.heroUsedYear[id];
                    await this.tell(p, { title: t2('Not yet!', 'まだだよ！'), icon: '🏐', body: [this.voice(p, t2('This power only works when you are in last place.', 'このパワーは最下位のときだけ使えるよ。'), t2(`This power only works when ${p.name.en} is in last place.`, 'このパワーは最下位のときだけ使えるよ。'))] });
                    return {};
                }
                await this.gainCard(p, drawRareCardId(g));
                return {};
            }
            case 'twinpower': return { extraDice: 2 };
            case 'neverGiveUp':
                if (lastPlace(g).id === p.id) {
                    p.effects.bonusDice = 3;
                    p.effects.bonusDiceTurns = 2;
                    return {};
                }
                delete p.heroUsedYear[id];
                await this.tell(p, { title: T('まだだよ！', 'Not yet!'), icon: '🏅', body: [T('このパワーは さいかいの ときだけ つかえるよ。', 'This power only works when you are in last place.')] });
                return {};
            case 'cardDraw':
                await this.gainCard(p, drawCardId(g, false));
                return {};
            case 'kindness': {
                const last = lastPlace(g);
                const m = 200 * Y;
                if (last.id !== p.id) {
                    addCash(g, p, -m, 'fee');
                    addCash(g, last, m, 'prize');
                    p.effects.seacoleGift += m;
                }
                return {};
            }
            case 'seeDest':
            case 'callAhead':
                p.effects.chooseDest = true;
                return {};
            case 'warpOwned': {
                const opts = [...new Set(ownedProps(g, p).map((x) => x.stationId))];
                if (!opts.length) {
                    delete p.heroUsedYear[id];
                    return {};
                }
                const sid = await this.ask({ kind: 'warpTo', playerId: p.id, options: opts.slice(0, 8) });
                await this.warpTo(p, sid);
                return { endTurn: true };
            }
        }
        return {};
    }
}
//# sourceMappingURL=flow.js.map