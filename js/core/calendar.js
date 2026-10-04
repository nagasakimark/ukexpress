/** Year 1 is the current school year (it starts in April; January to March still belong to the previous one). */
const NOW = new Date();
export const START_YEAR = NOW.getMonth() < 3 ? NOW.getFullYear() - 1 : NOW.getFullYear();
/** Real calendar month (0 = January) and year for a game month (0 = April) in a given game year. */
export function realMonth(gameYear, gameMonth) {
    const m = (gameMonth + 3) % 12;
    const y = START_YEAR + (gameYear - 1) + (gameMonth >= 9 ? 1 : 0);
    return { y, m };
}
export function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
export function firstWeekday(y, m) { return new Date(y, m, 1).getDay(); } // 0 = Sunday
/** Easter Sunday (anonymous Gregorian algorithm). */
export function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
}
function nthWeekday(y, m, weekday, n) {
    const first = new Date(y, m, 1).getDay();
    return new Date(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}
function lastWeekday(y, m, weekday) {
    const last = new Date(y, m + 1, 0);
    return new Date(y, m, last.getDate() - ((last.getDay() - weekday + 7) % 7));
}
/** The real date of an event in this game year, or null if it has no single date.
 *  Rules: 'd25' = the 25th; 'easter' / 'easter-47' = Easter Sunday or days before it;
 *  'nth-6-2' = the 2nd Saturday (weekday 0 = Sunday); 'last-0' = the last Sunday. */
export function eventDate(ev, gameYear) {
    const { y, m } = realMonth(gameYear, ev.month);
    const r = ev.date;
    if (!r)
        return null;
    let mm = /^d(\d+)$/.exec(r);
    if (mm)
        return new Date(y, m, +mm[1]);
    mm = /^easter(?:([+-])(\d+))?$/.exec(r);
    if (mm) {
        const e = easter(y);
        const off = mm[1] ? (mm[1] === '-' ? -1 : 1) * +mm[2] : 0;
        return new Date(e.getFullYear(), e.getMonth(), e.getDate() + off);
    }
    mm = /^nth-(\d)-(\d)$/.exec(r);
    if (mm)
        return nthWeekday(y, m, +mm[1], +mm[2]);
    mm = /^last-(\d)$/.exec(r);
    if (mm)
        return lastWeekday(y, m, +mm[1]);
    return null;
}
/** The day of the month if the event is on a fixed date, else null. */
export function fixedDay(ev) { const m = /^d(\d+)$/.exec(ev.date); return m ? +m[1] : null; }
export const WEEKDAYS = [
    { en: 'Sunday', ja: '日曜日' }, { en: 'Monday', ja: '月曜日' }, { en: 'Tuesday', ja: '火曜日' }, { en: 'Wednesday', ja: '水曜日' },
    { en: 'Thursday', ja: '木曜日' }, { en: 'Friday', ja: '金曜日' }, { en: 'Saturday', ja: '土曜日' },
];
export const MONTH_NAMES = [
    { en: 'January', ja: '1月' }, { en: 'February', ja: '2月' }, { en: 'March', ja: '3月' }, { en: 'April', ja: '4月' }, { en: 'May', ja: '5月' }, { en: 'June', ja: '6月' },
    { en: 'July', ja: '7月' }, { en: 'August', ja: '8月' }, { en: 'September', ja: '9月' }, { en: 'October', ja: '10月' }, { en: 'November', ja: '11月' }, { en: 'December', ja: '12月' },
];
/** "Sunday 21 June" / "6月21日（日曜日）" */
export function ordinal(n) { const t = n % 100; return n + (t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'); }
export function dateText(d) {
    return {
        en: `${WEEKDAYS[d.getDay()].en} ${ordinal(d.getDate())} ${MONTH_NAMES[d.getMonth()].en}`,
        ja: `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()].ja}）`,
    };
}
export function gameDateLabel(g) { return realMonth(g.year, g.month); }
//# sourceMappingURL=calendar.js.map