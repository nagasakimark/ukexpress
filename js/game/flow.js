import { board, nextOptions, distancesTo, stationDist } from '../core/map.js';
import { STATIONS, STATION_BY_ID, PROP_BY_ID } from '../core/content/stations.js';
import { CARD_BY_ID, REGIONS, SHOP_STOCK, TRAINS, AVATARS } from '../core/content/game-data.js';
import { CUSTOM_QUIZ } from '../core/content/stations.js';
import { eventDate, dateText, realMonth } from '../core/calendar.js';
import { HEROES, HERO_BY_ID, HEROES_AT, SENSEI } from '../core/content/heroes.js';
import { addCash, assets, arrivalPrize, arrivalRanking, blueAmount, redAmount, boggartAct, boggartMonth, boostCat, destinationChoices, diceCount, drawCardId, drawRareCardId, giveCard, lastPlace, monopolyOwner, nearestStationTo, newYearReset, ownedProps, payoutYear, pickDestination, priceOf, removeCard, rint, rpick, rchance, rnd, settle, rweighted, pickMonthEvent, pickBoggartHolder, snapshot, } from '../core/rules.js';
import { C, money } from '../engine/draw.js';
import { clock } from '../engine/tween.js';
import { fx } from '../engine/fx.js';
import { audio } from '../engine/audio.js';
import { app } from './app.js';
import { t2, lines, payoutT } from './i18n.js';
import { HumanController, CpuController } from './controllers.js';
import { say, toast, banner, rollDice, RouletteModal, SettlementModal, CalendarModal, drawCard, drawHeroCard } from './dialogs.js';
import { ProfileModal, PlaceModal } from './profile.js';
import { MINIGAMES, cpuScore } from './minigames.js';
import { teacher, collect, book, saveBook, saveJSON, RESULTS_KEY } from './storage.js';
import { drawBoggart } from './mapart.js';
const filmStations = () => STATIONS.filter((s) => s.film).map((s) => s.id);
const SOUTH = ['london', 'southeast', 'east', 'southwest'];
const UI_RAILWAY = t2(' Railway', 'の鉄道');
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
    /** Shows a message box. CPU players get one too, headed with their name, so the class can follow what happens: it waits for a click. */
    async tell(p, o, _toastIcon = '💬') {
        if (this.stopped)
            return;
        if (!p || this.isHuman(p))
            return say(o);
        return say({ ...o, title: { en: `${p.name.en}: ${o.title.en}`, ja: `${p.name.ja}：${o.title.ja}` }, color: o.color ?? C.players[p.color], badge: o.badge ?? (o.portrait || o.icon || o.iconDraw ? lines(p.name).main : undefined) });
    }
    /** A short note about what a player did: a quick toast for a human, a click-through box for the CPU. */
    async note(p, t, icon) {
        if (this.stopped)
            return;
        if (this.isHuman(p))
            return toast(t, icon, C.players[p.color], 1200);
        return say({ title: p.name, icon, body: [t], color: C.players[p.color] });
    }
    /** Names a CPU watcher by name ("Pip skips…"), keeps "you" for a human's own turn. */
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
    async intro() {
        const g = this.g;
        this.setSpeed(null);
        const hs = g.players.filter((p) => p.controller === 'human');
        const me = hs[0];
        const names = { en: hs.map((p) => p.name.en).join(', '), ja: hs.map((p) => p.name.ja).join('、') };
        await this.tell(null, {
            title: t2('Welcome to UK Express!', 'UKエクスプレスへようこそ！'), icon: '🚂',
            body: [
                hs.length > 1
                    ? t2(`${names.en}: each of you runs a railway. Race to each destination, buy famous places, and learn about the UK!`, `${names.ja}：みんなそれぞれ鉄道会社の社長。目的地を目指し、有名な場所を買って、イギリスを学ぼう！`)
                    : t2(`You run ${me.name.en} Railway. Race your rivals to each destination, buy famous places, and learn about the UK!`, `あなたは${me.name.ja}鉄道の社長。ライバルより先に目的地へ行き、有名な場所を買って、イギリスを学ぼう！`),
                t2('The UK has four countries: England, Scotland, Wales and Northern Ireland.', 'イギリスは4つの国：イングランド、スコットランド、ウェールズ、北アイルランド。'),
            ],
        });
        await this.showDestination(true);
    }
    async showDestination(first = false) {
        const g = this.g;
        this.setSpeed(null);
        await app.show(new RouletteModal(g.destination, first ? t2('Your first destination is…', '最初の目的地は…') : undefined));
        const n = board.nodes[board.stationNode[g.destination]];
        await this.board.flyTo(n.x, n.y, 900, 0.7);
        await clock.wait(600);
    }
    // ======================= months =======================
    async monthStart() {
        const g = this.g;
        this.setSpeed(null);
        if (!(g.year === 1 && g.month === 0)) {
            const first = g.players[(g.firstPlayer ?? 0) % g.players.length];
            await banner(t2(`${first.name.en} goes first this month! (Order rotates.)`, `${first.name.ja}が今月はじめ！（順番は毎月変わるよ）`), C.players[first.color], '🔄', 1600);
        }
        const pick = pickMonthEvent(g);
        if (pick)
            await app.show(new CalendarModal(g, pick.ev));
        const grow = boggartMonth(g);
        if (grow === 'grow') {
            const h = g.players.find((p) => p.id === g.boggart.holder);
            audio.play('boggart');
            fx.shake(14);
            await this.tell(null, { title: t2('The Boggart grew into a GRAND BOGGART!', 'ボガートが大ボガートに！'), body: [t2(`It has stayed with ${h.name.en} too long. It will leave in 3 turns.`, `${h.name.ja}のところに長くいすぎた！3ターンでいなくなるよ。`)], iconDraw: (c, x, y) => drawBoggart(c, x, y, 88, 'grand', clock.realTime), color: '#4a3a5a' });
        }
        else if (grow === 'blocked') {
            const h = g.players.find((p) => p.id === g.boggart.holder);
            audio.play('card');
            await this.tell(null, { title: t2('Horseshoe saves the day!', 'ていてつで助かった！'), icon: '🐴', body: [t2(`${h.name.en}'s horseshoe stopped the Boggart growing — but it crumbled to dust!`, `${h.name.ja}のていてつが、ボガートが大きくなるのをふせいだ！でも、ボロボロにこわれちゃった！`)] });
        }
        if (pick)
            await this.eventDay(pick.ev, pick.extra);
    }
    /** The picture card for a place, hero or event. */
    pic(kind, name, emoji, label, color) { return { kind, name, emoji, label, color }; }
    /** The month's event: a factfile with a picture, a simple quiz for each player in turn, then the effect or mini-game. */
    async eventDay(ev, extra) {
        const g = this.g;
        const Y = payoutYear(g);
        const { m } = realMonth(g.year, g.month);
        const d = eventDate(ev, g.year);
        const inMonth = !!d && d.getMonth() === m;
        const dt = inMonth ? dateText(d) : null;
        collect('events', ev.id);
        audio.play('fanfare');
        // the hometown guest's name can be changed by the teacher
        const guest = (t) => ({ en: t.en.replace(/Mark Sensei/g, SENSEI.name.en), ja: t.ja.replace(/マーク先生/g, SENSEI.name.ja) });
        const rows = [];
        const when = dt ?? ev.label;
        if (when)
            rows.push({ icon: '📅', label: t2('When', 'いつ'), text: when });
        if (ev.where)
            rows.push({ icon: '📍', label: t2('Where', 'どこ'), text: ev.where });
        rows.push({ icon: '📖', label: t2('What is it?', 'どんな日？'), text: guest(ev.why) });
        rows.push({ icon: '💡', label: t2('Did you know?', 'しってた？'), text: guest(ev.fact) });
        await app.show(new ProfileModal({
            title: ev.title, color: '#b5651d', badge: dt ? lines(dt).main : undefined, rows,
            pic: this.pic('events', ev.image, ev.emoji, ev.title.en, '#b5651d'), button: t2('Quiz time!', 'クイズ！'), buttonColor: '#8e5cc4',
        }));
        if (extra) {
            await app.show(new ProfileModal({
                title: extra.title, color: '#b5651d', badge: lines(ev.title).main,
                rows: [{ icon: extra.emoji, label: extra.title, text: extra.text }],
                pic: this.pic('events', extra.image, extra.emoji, extra.title.en, '#b5651d'), button: t2('Quiz time!', 'クイズ！'), buttonColor: '#8e5cc4',
            }));
        }
        // Monthly quiz: the solo student always answers; otherwise whoever moves first this month does.
        const hs = g.players.filter((q) => this.isHuman(q));
        const who = hs.length === 1 ? hs[0] : g.players[((g.firstPlayer ?? 0)) % g.players.length];
        await this.askQuiz(who, ev.quiz, 100 * Y, t2(`Quiz for ${who.name.en}!`, `${who.name.ja}へのクイズ！`));
        if (false && ev.minigame && MINIGAMES[ev.minigame]) { // mini-games are switched off for now
            await say({ title: ev.title, icon: ev.emoji, body: [this.payout(ev.effect)], color: '#b5651d' });
            await this.miniGame(ev.minigame, ev.title);
            return;
        }
        await say({ title: ev.title, icon: ev.emoji, body: [this.payout(ev.effect)], color: '#b5651d' });
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
            case 'boggart':
                if (g.boggart.holder)
                    g.boggart.holder = rpick(g, g.players).id;
                break;
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
    /** Simple questions about a place: the station quiz, plus "which team?" and "what is it famous for?" made from its factfile. */
    placeQuestions(st) {
        const g = this.g;
        const out = [st.quiz];
        const others = STATIONS.filter((x) => x.id !== st.id);
        const make = (q, right, pool) => {
            const wrong = [];
            const cands = pool.filter((x) => x.en !== right.en);
            while (wrong.length < 2 && cands.length) {
                const c = cands.splice(Math.floor(rnd(g) * cands.length), 1)[0];
                if (!wrong.some((w) => w.en === c.en))
                    wrong.push(c);
            }
            const idx = Math.floor(rnd(g) * 3);
            const options = [...wrong];
            options.splice(idx, 0, right);
            return { q, options, answer: idx };
        };
        const extra = [];
        if (st.famous)
            extra.push(make(t2(`What is ${st.name.en} famous for?`, `${st.name.ja}で有名なものは？`), st.famous, others.map((x) => x.famous).filter(Boolean)));
        if (st.team)
            extra.push(make(t2(`Which team is from ${st.name.en}?`, `${st.name.ja}のチームはどれ？`), st.team, others.map((x) => x.team).filter(Boolean)));
        for (let i = extra.length - 1; i > 0; i--) {
            const j = Math.floor(rnd(g) * (i + 1));
            [extra[i], extra[j]] = [extra[j], extra[i]];
        }
        return [...out, ...extra];
    }
    /** Everyone takes part: the human plays, CPU rivals get a score for their level. Prizes by rank. */
    async miniGame(id, title) {
        const g = this.g;
        const Y = payoutYear(g);
        if (!teacher.minigames) {
            const w = rpick(g, g.players);
            addCash(g, w, 300 * Y, 'prize');
            await this.tell(null, { title, icon: '🏆', body: [t2(`${w.name.en} wins the prize: £${(300 * Y).toLocaleString('en-GB')}!`, `${w.name.ja}が優勝！£${(300 * Y).toLocaleString('en-GB')}！`)] });
            return;
        }
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
            return t2(`${['🥇', '🥈', '🥉', '4.'][i]} ${x.p.name.en}: ${x.s} → +£${m.toLocaleString('en-GB')}`, `${['🥇', '🥈', '🥉', '4.'][i]} ${x.p.name.ja}：${x.s} → +£${m.toLocaleString('en-GB')}`);
        });
        audio.play('fanfare');
        await this.tell(null, { title: t2(`${title.en}: results`, `${title.ja}：結果`), icon: '🏆', body, confetti: true });
    }
    timeUp() { return teacher.timerMinutes > 0 && !app.autoplay && performance.now() - this.startedAt >= teacher.timerMinutes * 60000; }
    async monthEnd() {
        const g = this.g;
        snapshot(g);
        const timeUp = this.timeUp();
        if (timeUp && g.month !== 11) {
            this.setSpeed(null);
            await say({ title: t2("Time's up!", '時間です！'), icon: '⏰', body: [t2("That's the end of the lesson. Let's count everyone's money!", '授業はここまで。みんなのお金を数えよう！')] });
        }
        if (g.month === 11 || timeUp) {
            this.setSpeed(null);
            const res = settle(g);
            await app.show(new SettlementModal(g, res));
            for (const l of res)
                if (l.forgiven)
                    await this.tell(null, { title: t2("Don't worry!", 'だいじょうぶ！'), icon: '🎩', body: [t2(`Mr Whistle cleared some of ${l.player.name.en}'s debt. Let's try again!`, `ホイッスルさんが${l.player.name.ja}の借金を少し消してくれた。またがんばろう！`)] });
            // Railway Master's gift to last place
            const last = lastPlace(g);
            if (g.year < g.settings.years && !timeUp) {
                const c = drawRareCardId(g);
                if (giveCard(last, c))
                    await this.tell(null, { title: t2("Mr Whistle's gift", 'ホイッスルさんのプレゼント'), icon: '🎁', body: [t2(`${last.name.en} is in last place, so Mr Whistle gives a ${CARD_BY_ID[c].name.en} card. Keep going!`, `最下位の${last.name.ja}に「${CARD_BY_ID[c].name.ja}」カードをプレゼント。がんばれ！`)] });
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
            await banner(t2(`Year ${g.year} begins!`, `${g.year}年目スタート！`), C.brass, '🎉', 1500);
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
        if (this.multi && this.isHuman(p)) {
            audio.play('whistle');
            await say({ title: t2(`Pass to ${p.name.en}!`, `${p.name.ja}の番です！`), portrait: AVATARS[p.avatar].emoji, portraitRing: C.players[p.color], badge: lines(p.name).main + lines(UI_RAILWAY).main, color: C.players[p.color], body: [t2(`${p.name.en}, it is your turn. Everyone else, look away from the buttons!`, `${p.name.ja}の番だよ。ほかの人はボタンにさわらないでね！`)], buttons: [{ label: t2("I'm ready!", 'じゅんびOK！'), value: true, color: C.players[p.color] }] });
        }
        if (!app.autoplay)
            audio.chooChoo(); // the train is in view: no dialog is covering it now
        await banner(t2(`${p.name.en}'s turn!`, `${p.name.ja}の番！`), C.players[p.color], AVATARS[p.avatar].emoji, this.isHuman(p) ? 1000 : 800);
        if (!app.autoplay && g.boggart.holder === p.id && g.boggart.form !== 'brownie')
            await toast(t2(`Careful, ${p.name.en}: the Boggart is on your train!`, `${p.name.ja}、気をつけて！ボガートが電車に乗っているよ！`), '🐾', '#4a3a5a', 1500);
        if (p.effects.skipTurn) {
            p.effects.skipTurn = false;
            await this.tell(p, { title: t2('Waiting in the queue…', '行列に並んでいる…'), icon: '🧍', body: [this.voice(p, t2('You skip this turn. In the UK, people queue politely!', '1回休み。イギリスの人はきちんと並ぶよ！'), t2(`${p.name.en} skips this turn. In the UK, people queue politely!`, '1回休み。イギリスの人はきちんと並ぶよ！'))] });
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
        await this.endTurn(p);
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
            // The Boggart jumps to anyone the holder passes.
            if (g.boggart.holder === p.id) {
                const other = g.players.find((o) => o.id !== p.id && o.pos === p.pos);
                if (other) {
                    g.boggart.holder = other.id;
                    audio.play('boggart');
                    await say({ title: t2('The Boggart jumped!', 'ボガートがジャンプ！'), iconDraw: (ctx, x, y) => drawBoggart(ctx, x, y, 88, g.boggart.form, clock.realTime), body: [t2(`The Boggart jumped onto ${other.name.en}'s train!`, `ボガートが${other.name.ja}の電車に飛び乗った！`)], color: C.players[other.color] });
                }
            }
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
                await this.tell(p, { title: t2('Blue square!', '青マス！'), icon: '💷', body: [t2(g.month >= 2 && g.month <= 4 ? 'Summer tourists bring extra money!' : 'Your railway earns money!', g.month >= 2 && g.month <= 4 ? '夏は観光客が多くて、もうけ2倍！' : '鉄道がもうかった！')], money: a }, '💷');
                break;
            }
            case 'red': {
                if (p.cards.includes('umbrella')) {
                    removeCard(p, 'umbrella');
                    await this.tell(p, { title: t2('Umbrella saves the day!', 'かさで助かった！'), icon: '☂️', body: [this.voice(p, t2('A surprise shower! But your umbrella kept you dry, so no money was lost!', 'とつぜんのにわか雨！でも、かさのおかげでお金は減らなかった！'), t2(`A surprise shower! But ${p.name.en}'s umbrella kept them dry, so no money was lost!`, 'とつぜんのにわか雨！でも、かさのおかげでお金は減らなかった！'))] });
                    break;
                }
                const a = redAmount(g);
                const r = addCash(g, p, -a, 'fee');
                audio.play('bad');
                fx.shake(8);
                fx.float('-' + money(a), s.x, s.y - 80, C.red);
                const f = this.redFlavour(p);
                await this.tell(p, { title: t2('Red square!', '赤マス！'), icon: f.icon, body: [t2(f.en, f.ja)], money: r.change }, f.icon);
                if (r.forgiven)
                    await this.tell(p, { title: t2("Don't worry!", 'だいじょうぶ！'), icon: '🎩', body: [this.voice(p, t2('Mr Whistle helps: your money will not go below -£500.', 'ホイッスルさんが助けてくれた。お金は-£500より下がらないよ。'), t2(`Mr Whistle helps: ${p.name.en}'s money will not go below -£500.`, 'ホイッスルさんが助けてくれた。お金は-£500より下がらないよ。'))] });
                break;
            }
            case 'card':
                await this.gainCard(p, drawCardId(g));
                break;
            case 'quiz':
                await this.quizSquare(p);
                break;
            case 'event':
                await this.eventSquare(p);
                break;
            case 'shop': {
                const stock = SHOP_STOCK[node.region];
                const buy = await this.ask({ kind: 'cardShop', playerId: p.id, stock });
                for (const id of buy) {
                    if (p.cash >= CARD_BY_ID[id].price && giveCard(p, id)) {
                        addCash(g, p, -CARD_BY_ID[id].price, 'buy', 'card:' + id);
                        if (this.isHuman(p))
                            collect('cards', id);
                    }
                }
                if (buy.length && !this.isHuman(p))
                    await this.note(p, t2(`${p.name.en} bought ${buy.map((b) => CARD_BY_ID[b].name.en).join(', ')}`, `${p.name.ja}が${buy.map((b) => CARD_BY_ID[b].name.ja).join('、')}を買った`), '🏪');
                break;
            }
            case 'port':
            case 'sea':
                await toast(t2('All aboard the ferry!', 'フェリーに乗ろう！'), '⛴️', C.sea, 900);
                break;
            case 'station':
                await this.stationVisit(p, node.stationId);
                break;
        }
        this.checkBadges(p);
    }
    /** Why a red square costs money. Rain is only one reason among many, and it is rare. */
    redFlavour(p) {
        const g = this.g;
        const cpu = !this.isHuman(p);
        const nm = p.name.en;
        const autumn = g.month >= 5 && g.month <= 7, winter = g.month >= 8 && g.month <= 10;
        const list = [
            { icon: '🚧', en: 'Roadworks! The engineers are mending the track. Repairs cost money.', ja: '工事中！技師さんが線路を直している。修理代がかかった。', w: 3 },
            { icon: '🚦', en: 'Signal failure! The train waits and waits. Sorry for the delay!', ja: '信号の故障！電車は待たされた。ごめんなさい！', w: 3 },
            { icon: '🎫', en: cpu ? `The ticket machine is broken! ${nm} loses some ticket money.` : 'The ticket machine is broken! You lose some ticket money.', ja: '切符の機械がこわれた！切符のお金が減った。', w: 2 },
            { icon: '🐑', en: 'Sheep on the track! The driver stopped and waited for them to move.', ja: '線路にひつじ！運転士さんは、どいてくれるのを待った。', w: 2 },
            { icon: '🔧', en: cpu ? `A wheel needs fixing. The workshop sends ${nm} a bill.` : 'A wheel needs fixing. The workshop sends you a bill.', ja: '車輪の修理が必要。工場から請求書がきた。', w: 2 },
            { icon: '🌧️', en: 'A heavy shower! Water on the track slows the train.', ja: 'どしゃぶり！線路に水がたまって電車がおそくなった。', w: 1 },
        ];
        if (autumn)
            list.push({ icon: '🍂', en: 'Leaves on the line! Wet leaves make the rails slippery in autumn.', ja: '線路に落ち葉！秋はぬれた落ち葉でレールがすべるよ。', w: 4 });
        if (winter)
            list.push({ icon: '❄️', en: 'Frost on the track! Winter repairs cost double.', ja: '線路がこおった！冬は修理代が2倍。', w: 4 });
        return rweighted(g, list, (x) => x.w);
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
        await this.tell(p, { title: t2(`New card: ${c.name.en}!`, `カードゲット：${c.name.ja}！`), body: [this.isHuman(p) ? this.payout(c.desc) : this.payout({
                    en: c.desc.en.replace(/\b[Yy]ou\b/g, p.name.en).replace(/\bYour\b/g, `${p.name.en}'s`), ja: c.desc.ja,
                })], iconDraw: (ctx, x, y) => drawCard(ctx, c, x - 65, y - 95, 130, 190, false, false, this.g.year) }, c.emoji);
    }
    pickQuiz(p) {
        const g = this.g;
        if (CUSTOM_QUIZ.length && rchance(g, 0.3))
            return rpick(g, CUSTOM_QUIZ);
        const pool = rchance(g, 0.5) && p.visited.length > 2 ? p.visited.map((id) => STATION_BY_ID[id]) : STATIONS;
        return rpick(g, pool).quiz;
    }
    quizHint(p) { return p.effects.guidebook > 0 || p.effects.heroHints > 0 || p.hometownCompanion; }
    async askQuiz(p, q, reward, title) {
        const hint = this.quizHint(p);
        let mult = 1;
        if (p.effects.guidebook > 0) {
            p.effects.guidebook = 0;
            mult = 2;
        }
        else if (p.effects.heroHints > 0) {
            p.effects.heroHints--;
            mult = 2;
        }
        const ans = await this.ask({ kind: 'quiz', playerId: p.id, quiz: q, hint, reward: reward * mult, title });
        const right = ans === q.answer;
        if (right) {
            p.stars++;
            if (reward)
                addCash(this.g, p, reward * mult, 'prize');
        }
        if (!this.isHuman(p))
            await this.note(p, t2(`${p.name.en} answered the quiz ${right ? 'correctly!' : 'wrong.'}`, `${p.name.ja}はクイズに${right ? '正解！' : '不正解。'}`), right ? '⭕' : '❌');
        return right;
    }
    async quizSquare(p) {
        const g = this.g;
        await this.askQuiz(p, this.pickQuiz(p), 100 * payoutYear(g));
    }
    async eventSquare(p) {
        const g = this.g;
        const Y = payoutYear(g);
        const kinds = ['rainbow', 'tea', 'hero', 'umbrella', 'movie', 'match', 'royal'];
        const k = rweighted(g, kinds, (x) => ({ rainbow: 2, tea: 2, hero: 3, umbrella: 2, movie: 2, match: 2, royal: 1 }[x]));
        switch (k) {
            case 'rainbow':
                addCash(g, p, 300 * Y, 'prize');
                audio.play('coin');
                await this.tell(p, { title: t2('A rainbow!', 'にじが出た！'), icon: '🌈', body: [t2('Sun and showers together make a rainbow. A lucky sight for a traveller!', '太陽とにわか雨がいっしょになると、にじが出るよ。旅人にはラッキー！')], money: 300 * Y });
                break;
            case 'tea':
                for (const q of g.players)
                    addCash(g, q, 100 * Y, 'prize');
                await this.tell(p, { title: t2('Afternoon tea party!', 'アフタヌーンティー・パーティー！'), icon: '🫖', body: [t2('Afternoon tea has sandwiches, scones and cakes. Everyone gets £' + 100 * Y + '!', 'サンドイッチ、スコーン、ケーキでお茶会！みんな+£' + 100 * Y + '！')] });
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
                addCash(g, p, 200 * Y, 'prize');
                await this.tell(p, { title: t2('Movie magic!', '映画のまほう！'), icon: '🎬', body: [t2('Many famous films are made in the UK. A film crew paid to use your station!', 'イギリスでは有名な映画がたくさん作られているよ。撮影隊がお金をはらってくれた！')], money: 200 * Y });
                break;
            case 'match': {
                const sport = ownedProps(g, p).filter((x) => x.cat === 'sport').length;
                const m = (sport * 200 + 100) * Y;
                addCash(g, p, m, 'prize');
                await this.tell(p, { title: t2('Big match day!', 'ビッグマッチの日！'), icon: '⚽', body: [t2('Football was first given its rules in England in 1863. Sport properties earn extra today!', 'サッカーのルールは1863年にイングランドで作られたよ。スポーツの物件がもうかった！')], money: m });
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
                    addCash(g, g.players.find((q) => q.id === best[0]), 1000, 'prize');
                await this.tell(p, { title: t2(`Royal visit to ${st.name.en}!`, `王様が${st.name.ja}を訪問！`), icon: '👑', body: [t2(best ? `The King visits! ${g.players.find((q) => q.id === best[0]).name.en} owns the most there and earns £1,000.` : 'The King visits! Nobody owns property there yet.', best ? `王様が来た！いちばん物件を持つ${g.players.find((q) => q.id === best[0]).name.ja}に£1,000！` : '王様が来た！まだだれも物件を持っていない。')] });
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
            if (this.isHuman(p))
                collect('stations', sid);
            if (this.isHuman(p)) {
                const fact = rpick(g, st.facts);
                await app.show(new PlaceModal(t2(`Welcome to ${st.name.en}!`, `${st.name.ja}へようこそ！`), REGIONS[st.region].color, this.pic('places', st.image, st.emoji, st.name.en, REGIONS[st.region].color), fact, lines(REGIONS[st.region].name).main));
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
            await this.tell(p, { title: t2(`New train: ${TRAINS[p.train].name.en}!`, `新しい列車：${TRAINS[p.train].name.ja}！`), icon: '🚂', body: [TRAINS[p.train].fact, this.voice(p, t2(`Now you roll ${TRAINS[p.train].dice} dice!`, `サイコロが${TRAINS[p.train].dice}個になった！`), t2(`Now ${p.name.en} rolls ${TRAINS[p.train].dice} dice!`, `サイコロが${TRAINS[p.train].dice}個になった！`))], confetti: true });
        }
        if (bought.length && !this.isHuman(p))
            await this.note(p, t2(`${p.name.en} bought ${bought.map((b) => PROP_BY_ID[b].name.en).join(', ')}`, `${p.name.ja}が${bought.map((b) => PROP_BY_ID[b].name.ja).join('、')}を買った`), '🏠');
        if (bought.length && monopolyOwner(g, sid) === p.id) {
            audio.play('fanfare');
            const s = this.board.worldToScreen(this.board.vis[p.id].x, this.board.vis[p.id].y);
            fx.burst(s.x, s.y - 40, 'star', 30, { color: C.gold, speed: 8 });
            if (st.hometown)
                p.hometownCompanion = true;
            await this.tell(p, { title: t2(`Monopoly at ${st.name.en}!`, `${st.name.ja}を独占！`), icon: '👑', body: [this.voice(p, t2('You own every property here. Profits are doubled every March!', 'ここの物件をぜんぶ持っている！毎年3月の利益が2倍！'), t2(`${p.name.en} owns every property here. Profits are doubled every March!`, 'ここの物件をぜんぶ持っている！毎年3月の利益が2倍！')),
                    ...(st.hometown ? [this.voice(p, t2(`${SENSEI.name.en} joins you as a companion: every quiz now has a hint!`, `${SENSEI.name.ja}が仲間になった！クイズにいつもヒントが出るよ！`), t2(`${SENSEI.name.en} joins ${p.name.en} as a companion: every quiz now has a hint!`, `${SENSEI.name.ja}が仲間になった！クイズにいつもヒントが出るよ！`))] : [])], confetti: true }, '👑');
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
            title: SENSEI.welcome, portrait: SENSEI.emoji, badge: lines(SENSEI.name).main, confetti: true,
            body: [t2(`Durham is ${SENSEI.name.en}'s hometown! Its cathedral holds the shrine of St Cuthbert, who loved animals.`, `ダラムは${SENSEI.name.ja}のふるさと！大聖堂には動物が大好きだった聖カスバートがねむっているよ。`),
                t2(`Hometown bonus: +£${m.toLocaleString('en-GB')}${got ? ` and a ${CARD_BY_ID[c].name.en} card!` : '!'}`, `ふるさとボーナス：+£${m.toLocaleString('en-GB')}${got ? `と「${CARD_BY_ID[c].name.ja}」カード！` : '！'}`)],
        }, '👨‍🏫');
    }
    async heroMeet(p, heroId, visit) {
        const g = this.g;
        const h = HERO_BY_ID[heroId];
        await banner(t2('A British hero appears!', 'イギリスのヒーロー登場！'), '#8a6a10', h.emoji, 1500);
        if (this.isHuman(p)) {
            const rows = [{ icon: '📅', label: t2('Lived', '生きた年'), text: t2(h.lived, h.lived) }, { icon: '💬', label: t2('In their words', 'ひとこと'), text: h.line }];
            if (h.japan)
                rows.push({ icon: '🇯🇵', label: t2('Japan link', '日本とのつながり'), text: h.japan });
            await app.show(new ProfileModal({
                title: visit ? t2(`A hero visits: ${h.name.en}!`, `ヒーローがやってきた：${h.name.ja}！`) : t2(`Meet a hero: ${h.name.en}`, `ヒーロー：${h.name.ja}`),
                color: '#8a6a10', rows, pic: this.pic('heroes', h.image, h.emoji, h.name.en, '#8a6a10'), button: t2('Who am I?', 'わたしはだれ？'), buttonColor: '#8e5cc4',
            }));
        }
        // "Who am I?" quiz: the hero's line, choose the right name.
        const others = HEROES.filter((x) => x.id !== heroId);
        const opts = [h, rpick(g, others), rpick(g, others.filter((x) => x.id !== h.id))];
        if (opts[1].id === opts[2].id)
            opts[2] = others.find((x) => x.id !== opts[1].id);
        const order = [0, 1, 2].sort(() => rnd(g) - 0.5);
        const q = { q: t2(`Who am I? "${h.line.en}"`, `わたしはだれ？「${h.line.ja}」`), options: order.map((i) => opts[i].name), answer: order.indexOf(0) };
        const right = await this.askQuiz(p, q, 0, t2('Who am I?', 'わたしはだれ？'));
        if (!right) {
            await this.tell(p, { title: t2('So close!', 'おしい！'), portrait: h.emoji, body: [t2(`It was ${h.name.en}. Visit again to earn the Hero card!`, `正解は${h.name.ja}。また来てヒーローカードをゲットしよう！`)] }, h.emoji);
            return;
        }
        p.heroCollection.push(heroId);
        if (this.isHuman(p))
            collect('heroes', heroId);
        if (p.heroes.length < 3)
            p.heroes.push(heroId);
        else {
            const k = await this.ask({ kind: 'heroReplace', playerId: p.id, newHero: heroId });
            if (k >= 0)
                p.heroes[k] = heroId;
        }
        audio.play('fanfare');
        await this.tell(p, { title: t2(`Hero card: ${h.name.en}!`, `ヒーローカード：${h.name.ja}！`), iconDraw: (ctx, x, y) => drawHeroCard(ctx, heroId, x - 72, y - 100, 144, 200), body: [h.powerDesc ? t2(`Power: ${h.powerName.en}. ${h.powerDesc.en} (once a year)`, `パワー：${h.powerName.ja}。${h.powerDesc.ja}（1年に1回）`) : t2('Added to your Hall of Heroes!', 'ヒーローの殿堂に追加されたよ！'), t2('Find it in your Cards menu. Heroes recharge every April!', 'カードメニューで使えるよ。ヒーローは4月になったら復活するよ！')], confetti: true }, '🦸');
    }
    // ======================= arrival =======================
    async arrival(p) {
        const g = this.g;
        const st = STATION_BY_ID[g.destination];
        const prize = arrivalPrize(g);
        const firstBonus = Math.round(prize * 0.5 / 10) * 10;
        addCash(g, p, prize + firstBonus, 'prize');
        // Everyone else ranks by exact squares away: closest is 2nd, next is 3rd.
        const ranked = arrivalRanking(g, p.id);
        const awards = [];
        if (ranked[0])
            awards.push({ place: '2nd', placeJa: '2位', who: ranked[0].p, dist: ranked[0].dist, bonus: Math.round(prize * 0.25 / 10) * 10 });
        if (ranked[1])
            awards.push({ place: '3rd', placeJa: '3位', who: ranked[1].p, dist: ranked[1].dist, bonus: Math.round(prize * 0.1 / 10) * 10 });
        for (const a of awards)
            addCash(g, a.who, a.bonus, 'prize');
        p.arrivals++;
        audio.play('fanfare');
        const s = this.board.worldToScreen(this.board.vis[p.id].x, this.board.vis[p.id].y);
        fx.burst(s.x, s.y - 40, 'confetti', 80, { speed: 10, up: 7 });
        fx.burst(s.x, s.y - 40, 'coin', 20, { speed: 7 });
        await banner(t2(`${p.name.en} is first to arrive at ${st.name.en}!`, `${p.name.ja}が${st.name.ja}に1番乗り！`), C.players[p.color], '🎉', 1600);
        await this.tell(p, { title: t2('You reached the destination!', '目的地に到着！'), icon: st.emoji, body: [t2(`Arrival prize${st.hometown ? ' (+50% hometown bonus)' : ''}:`, `到着ボーナス${st.hometown ? '（ふるさと+50%）' : ''}：`), t2('1st arrival bonus:', '1番乗りボーナス：')], money: prize + firstBonus, confetti: true }, '🎉');
        if (awards.length) {
            audio.play('coin');
            await say({ title: t2('Photo finish!', '写真判定！'), icon: '🏁', body: awards.map((a) => t2(`${a.place}: ${a.who.name.en} (${a.dist} squares away): +${money(a.bonus)}`, `${a.placeJa}：${a.who.name.ja}（あと${a.dist}マス）：+${money(a.bonus)}`)), color: C.brass });
        }
        // The destination's factfile (a picture, the local team, what it is famous for), then a simple quiz: players take turns
        if (!app.autoplay) {
            const rows = [{ icon: '🗺️', label: t2('Where', 'どこ'), text: REGIONS[st.region].name }];
            const facts = st.facts.slice();
            for (let i = facts.length - 1; i > 0; i--) {
                const j = Math.floor(rnd(g) * (i + 1));
                [facts[i], facts[j]] = [facts[j], facts[i]];
            }
            facts.slice(0, 2).forEach((f, i) => rows.push({ icon: i === 0 ? '💡' : '✨', label: i === 0 ? t2('Did you know?', 'しってた？') : t2('Also', 'ほかにも'), text: f }));
            if (st.team)
                rows.push({ icon: '⚽', label: t2('Local team', 'ちほうのチーム'), text: st.team });
            if (st.famous)
                rows.push({ icon: '🛍️', label: t2('Famous for', '有名なもの'), text: st.famous });
            await app.show(new ProfileModal({
                title: t2(`Welcome to ${st.name.en}!`, `${st.name.ja}へようこそ！`), color: REGIONS[st.region].color, badge: lines(REGIONS[st.region].name).main, rows,
                pic: this.pic('places', st.image, st.emoji, st.name.en, REGIONS[st.region].color), button: t2('Quiz time!', 'クイズ！'), buttonColor: '#8e5cc4',
            }));
        }
        const bonus = Math.max(100 * payoutYear(g), Math.round(prize * 0.1 / 10) * 10);
        // Solo student answers everything (whoever arrived); with several humans only the arriver answers.
        const hs = g.players.filter((q) => this.isHuman(q));
        const aqs = this.placeQuestions(st);
        if (hs.length === 1) {
            const who = hs[0];
            const t = t2(`${st.name.en} quiz — ${who.name.en} answers!`, `${st.name.ja}クイズ — ${who.name.ja}が答えるよ！`);
            for (let i = 0; i < Math.min(2, aqs.length); i++)
                await this.askQuiz(who, aqs[i], bonus, t);
        }
        else if (this.isHuman(p)) {
            const t = t2(`${st.name.en} quiz — ${p.name.en} answers!`, `${st.name.ja}クイズ — ${p.name.ja}が答えるよ！`);
            for (let i = 0; i < Math.min(2, aqs.length); i++)
                await this.askQuiz(p, aqs[i], bonus, t);
        }
        else {
            const t = t2(`${st.name.en} quiz — ${p.name.en} answers!`, `${st.name.ja}クイズ — ${p.name.ja}が答えるよ！`);
            for (const q of aqs)
                await this.askQuiz(p, q, bonus, t);
        }
        // The Boggart goes to someone far behind (but not the same player every time)
        const f = pickBoggartHolder(g, p.id);
        if (f && g.players.length > 1) {
            const d = stationDist(g.prevDestination, g.destination);
            const last = lastPlace(g);
            let form = d < 10 || g.settings.years <= 1 ? 'little' : 'boggart';
            if ((f.id === last.id && !f.brownieGiven && rchance(g, 0.5)) || rchance(g, 0.1)) {
                form = 'brownie';
                f.brownieGiven = true;
            }
            g.boggart = { holder: f.id, form, months: 0, calm: 0, grandTurns: 0, brownieTurns: 3, turns: 0 };
            audio.play('boggart');
            fx.shake(10);
            const bad = form !== 'brownie';
            await this.tell(null, {
                title: !bad
                    ? t2(`A Brownie is helping ${f.name.en}!`, `ブラウニーが${f.name.ja}を助けるよ！`)
                    : form === 'little'
                        ? t2(`A Little Boggart is on ${f.name.en}'s train!`, `小ボガートが${f.name.ja}の電車に乗った！`)
                        : t2(`The Boggart is on ${f.name.en}'s train!`, `ボガートが${f.name.ja}の電車に乗った！`),
                iconDraw: (ctx, x, y) => drawBoggart(ctx, x, y, 88, form, clock.realTime), color: form === 'brownie' ? '#7a5230' : '#4a3a5a',
                body: [!bad
                        ? t2(`${f.name.en} will get lucky surprises for a few turns. Nobody else is affected!`, `${f.name.ja}はしばらくラッキーなことが起きるよ。ほかの人には何も起きないよ！`)
                        : t2(`${f.name.en} will have bad luck at the end of every turn until it leaves. To shake it off: pass another train, use Rowan Twig or a Cup of Tea — or just wait, it naps and wanders off!`, `${f.name.ja}は、いなくなるまで毎ターンの最後に悪いことが起きるよ。にがすには：ほかの電車を追いこす、ナナカマドか紅茶を使う、待つ（お昼ねしてどこかへ行くよ）！`),
                    form === 'brownie'
                        ? t2('In old stories, a kind Brownie helps with the chores. Lucky!', '昔話では、親切なブラウニーがお手伝いをしてくれるよ。ラッキー！')
                        : t2('In old English stories, a Boggart lives in your house and plays tricks. "Oops! Sorry!"', 'イギリスの昔話では、ボガートは家に住んでいたずらをするよ。「おっと、ごめん！」')],
            });
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
        await this.showDestination();
        await this.board.focusPlayer(p);
    }
    // ======================= end of turn =======================
    async endTurn(p) {
        const g = this.g;
        if (g.boggart.holder === p.id) {
            const res = boggartAct(g, p);
            if (!res.good)
                audio.play('boggart');
            else
                audio.play('coin');
            if (res.money && res.money < 0)
                fx.shake(8);
            const bad = g.boggart.form !== 'brownie';
            const you = this.isHuman(p);
            await this.tell(p, { title: !bad
                    ? you ? t2('The Brownie helps you!', 'ブラウニーがお手伝い！') : t2(`The Brownie helps ${p.name.en}!`, `ブラウニーが${p.name.ja}をお手伝い！`)
                    : you ? t2('The Boggart strikes you!', 'ボガートがいたずらしてきた！') : t2(`The Boggart strikes ${p.name.en}!`, `ボガートが${p.name.ja}にいたずら！`), iconDraw: (ctx, x, y) => drawBoggart(ctx, x, y, 88, g.boggart.form, clock.realTime), body: [res.text], color: res.good ? '#7a5230' : '#4a3a5a' }, '🐾');
            if (res.warp !== undefined) {
                p.prev = -1;
                p.pos = res.warp;
                await this.board.warpTrain(p, res.warp);
            }
            if (res.leave) {
                const wasB = g.boggart.form === 'brownie';
                g.boggart.holder = null;
                await toast(wasB ? t2('The Brownie waved goodbye.', 'ブラウニーはバイバイと手をふった。') : t2('The Boggart wandered off.', 'ボガートはどこかへ行った。'), wasB ? '👋' : '🐾', C.brass, 1100);
            }
            if (g.boggart.form === 'grand' && g.boggart.grandTurns <= 0) {
                g.boggart.form = 'boggart';
                g.boggart.months = 0;
            }
        }
        this.checkBadges(p);
    }
    checkBadges(p) {
        if (!p.badges.includes('movie') && filmStations().every((id) => p.visited.includes(id))) {
            p.badges.push('movie');
            addCash(this.g, p, 2000, 'prize');
            this.tell(p, { title: t2('Movie Magic Tour complete!', 'ムービー・マジック・ツアー達成！'), icon: '🎬', body: [t2('You visited every film-location station. +£2,000!', '映画のロケ地の駅をぜんぶ訪れた！+£2,000！')], confetti: true });
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
        await this.note(p, t2(`${p.name.en} used ${c.name.en}!`, `${p.name.ja}は「${c.name.ja}」を使った！`), c.emoji);
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
                await this.tell(p, { title: t2('Happy birthday!', 'お誕生日おめでとう！'), icon: '🎂', body: [this.voice(p, t2('Everyone gave you a present!', 'みんながプレゼントをくれた！'), t2(`Everyone gave ${p.name.en} a present!`, `${p.name.ja}がプレゼントをもらった！`))] });
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
            case 'leaves': {
                const saved = g.players.filter((q) => q.id !== p.id && q.cards.includes('wellies'));
                for (const q of saved)
                    removeCard(q, 'wellies');
                for (const q of g.players)
                    if (q.id !== p.id && !saved.includes(q))
                        q.effects.oneDieTurns = 2;
                if (saved.length)
                    await say({ title: t2('Splashed through!', 'へっちゃら！'), icon: '🥾', body: [t2(`${saved.map((q) => q.name.en).join(' and ')} splashed through in wellies — but the wellies fell apart!`, `${saved.map((q) => q.name.ja).join('と')}は長ぐつでへっちゃら！でも長ぐつはこわれちゃった。`)], color: '#6c7a89' });
                return {};
            }
            case 'queue': {
                const r = g.players.slice().sort((a, b) => assets(g, b) - assets(g, a));
                const target = r[0].id === p.id ? r[1] : r[0];
                if (target && target.cards.includes('wellies')) {
                    removeCard(target, 'wellies');
                    await say({ title: t2('Splashed through!', 'へっちゃら！'), icon: '🥾', body: [this.voice(p, t2('Your wellies kept you out of the queue! But they got caked in mud and fell apart.', '長ぐつのおかげで、行列に並ばなくてすんだ！でも、どろどろでこわれちゃった。'), t2(`${target.name.en}'s wellies kept them out of the queue! But the wellies got caked in mud and fell apart.`, `${target.name.ja}は長ぐつのおかげで、行列に並ばなくてすんだ！でも、長ぐつはどろどろでこわれちゃった。`))], color: C.players[target.color] });
                    return {};
                }
                if (target) {
                    target.effects.skipTurn = true;
                    await say({ title: t2('Queue!', '行列！'), icon: '🧍', body: [t2(`${target.name.en} must wait in a queue next turn!`, `${target.name.ja}は次、行列で1回休み！`)], color: C.players[target.color] });
                }
                return {};
            }
            case 'turpin': {
                const r = g.players.slice().sort((a, b) => assets(g, b) - assets(g, a));
                const target = r[0].id === p.id ? r[1] : r[0];
                if (!target)
                    return {};
                if (target.cards.length) {
                    const stolen = rpick(g, target.cards);
                    removeCard(target, stolen);
                    giveCard(p, stolen); // always fits: using this card just freed a slot
                    audio.play('coin');
                    await say({ title: t2('Stand and deliver!', '金を出せ！'), icon: '🦹', body: [this.voice(p, t2(`You took ${target.name.en}'s ${CARD_BY_ID[stolen].name.en} card!`, `${target.name.ja}から「${CARD_BY_ID[stolen].name.ja}」をうばった！`), t2(`${p.name.en} took ${target.name.en}'s ${CARD_BY_ID[stolen].name.en} card!`, `${p.name.ja}が${target.name.ja}から「${CARD_BY_ID[stolen].name.ja}」をうばった！`))], color: C.players[target.color] });
                }
                else {
                    const fee = addCash(g, target, -100 * Y, 'fee');
                    addCash(g, p, -fee.change, 'prize');
                    audio.play('coin');
                    await say({ title: t2('Stand and deliver!', '金を出せ！'), icon: '🦹', body: [this.voice(p, t2(`${target.name.en} had no cards, so they paid you a toll instead!`, `${target.name.ja}はカードを持っていなかったので、通行料をはらった！`), t2(`${target.name.en} had no cards, so they paid ${p.name.en} a toll instead!`, `${target.name.ja}はカードを持っていなかったので、${p.name.ja}に通行料をはらった！`))], color: C.players[target.color] });
                }
                return {};
            }
            case 'signalbox': {
                p.effects.chooseDest = true;
                await say({ title: t2('Signal set!', '信号オーライ！'), icon: '🚦', body: [this.voice(p, t2('At the next destination, you will pick the new one from 3 stations!', '次の目的地では、新しい目的地を3つの駅から選べるよ！'), t2(`At the next destination, ${p.name.en} will pick the new one from 3 stations!`, `次の目的地では、${p.name.ja}が新しい目的地を3つの駅から選ぶよ！`))], color: C.players[p.color] });
                return {};
            }
            case 'scotsman': {
                const region = await this.ask({ kind: 'warpRegion', playerId: p.id });
                const cands = STATIONS.filter((s) => s.region === region).map((s) => s.id);
                await say({ title: t2('All aboard the Flying Scotsman!', 'フライング・スコッツマンに乗車！'), icon: '🚂', body: [t2(`Off to ${REGIONS[region].name.en}!`, `${REGIONS[region].name.ja}へ出発！`)], color: '#2a6a5a' });
                await this.warpTo(p, rpick(g, cands));
                return { endTurn: true };
            }
            case 'rowan': {
                const others = g.players.filter((q) => q.id !== p.id).sort((a, b) => distancesTo(p.pos)[a.pos] - distancesTo(p.pos)[b.pos]);
                if (others[0]) {
                    g.boggart.holder = others[0].id;
                    audio.play('boggart');
                    await say({ title: t2('The Boggart ran away!', 'ボガートがにげた！'), icon: '🌿', body: [t2(`It ran off to ${others[0].name.en}'s train.`, `${others[0].name.ja}の電車へにげていった。`)], color: C.players[others[0].color] });
                }
                return {};
            }
            case 'tea':
                g.boggart.calm = 2;
                return {};
            case 'guidebook':
                p.effects.guidebook = 1;
                return {};
        }
        return {};
    }
    async useHero(p, id) {
        const g = this.g;
        const h = HERO_BY_ID[id];
        const Y = payoutYear(g);
        p.heroUsedYear[id] = g.year;
        audio.play('fanfare');
        await banner(t2(`${h.name.en}: ${h.powerName?.en ?? ''}!`, `${h.name.ja}：${h.powerName?.ja ?? ''}！`), '#8a6a10', h.emoji, 1300);
        switch (h.power) {
            case 'dice2': return { extraDice: 2 };
            case 'perDie':
                p.effects.perDieBonus = true;
                return {};
            case 'shrinkBoggart': {
                const b = g.boggart;
                if (b.holder === p.id) {
                    if (b.form === 'little' || b.form === 'brownie')
                        b.holder = null;
                    else if (b.form === 'grand')
                        b.form = 'boggart';
                    else
                        b.form = 'little';
                }
                return {};
            }
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
            case 'twinpower':
                p.effects.guidebook = 1;
                return { extraDice: 2 };
            case 'neverGiveUp':
                if (lastPlace(g).id === p.id) {
                    p.effects.bonusDice = 3;
                    p.effects.bonusDiceTurns = 2;
                    return {};
                }
                delete p.heroUsedYear[id];
                await this.tell(p, { title: t2('Not yet!', 'まだだよ！'), icon: '🏅', body: [this.voice(p, t2('This power only works when you are in last place.', 'このパワーは最下位のときだけ使えるよ。'), t2(`This power only works when ${p.name.en} is in last place.`, 'このパワーは最下位のときだけ使えるよ。'))] });
                return {};
            case 'quizHints':
                p.effects.heroHints = 3;
                return {};
            case 'undoBoggart':
                addCash(g, p, p.lastBoggartLoss, 'prize');
                p.lastBoggartLoss = 0;
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