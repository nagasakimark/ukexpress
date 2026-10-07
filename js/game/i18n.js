export const lang = { mode: 'bi' };
/** Old saves may hold the removed Japanese-first mode: treat it as English with Japanese support. */
export const normLang = (l) => (l === 'en' ? 'en' : 'bi');
export const t2 = (en, ja) => ({ en, ja });
/** Main line and (optional) sub line for the current language mode. */
export function lines(t) {
    if (lang.mode === 'en')
        return { main: t.en, sub: null };
    return { main: t.en, sub: t.ja };
}
export const main = (t) => lines(t).main;
/** Turns a "£100 × year" formula into this year's actual amount ("£300" in year 3).
 * Content files describe payouts per year; players should see the real money. */
export function payoutText(s, year) {
    const amt = (n) => '£' + (parseInt(n.replace(/,/g, ''), 10) * year).toLocaleString('en-GB');
    return s.replace(/£([\d,]+) × year/g, (_, n) => amt(n)).replace(/£([\d,]+)×年/g, (_, n) => amt(n));
}
/** Same as payoutText, for both languages at once. */
export function payoutT(t, year) { return { en: payoutText(t.en, year), ja: payoutText(t.ja, year) }; }
export const UI = {
    start: t2('Tap to start', 'タップしてスタート'),
    newGame: t2('New Game', 'はじめから'),
    cont: t2('Continue', 'つづきから'),
    howTo: t2('How to Play', 'あそびかた'),
    options: t2('Options', 'せってい'),
    roll: t2('Roll', 'サイコロ'),
    cards: t2('Cards', 'カード'),
    map: t2('Map', 'マップ'),
    info: t2('Info', 'じょうほう'),
    menu: t2('Menu', 'メニュー'),
    ok: t2('OK!', 'OK！'),
    back: t2('Back', 'もどる'),
    buy: t2('Buy', '買う'),
    done: t2('Done', 'おわり'),
    use: t2('Use', '使う'),
    yourTurn: t2("'s turn!", 'の番！'),
    destination: t2('Destination', '目的地'),
    squaresAway: t2('squares away', 'マス'),
    moves: t2('moves', 'マス'),
    cash: t2('Cash', '所持金'),
    assets: t2('Assets', '総資産'),
    year: t2('Year', '年目'),
    next: t2('Next', 'つぎへ'),
    skip: t2('Skip', 'スキップ'),
    railway: t2(' Railway', '鉄道'),
};
//# sourceMappingURL=i18n.js.map