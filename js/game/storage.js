export function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    }
    catch {
        return fallback;
    }
}
export function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch { /* storage unavailable */ }
}
export function removeKey(key) { try {
    localStorage.removeItem(key);
}
catch { /* ignore */ } }
export const TEACHER_KEY = 'britainExpressTeacher';
export const teacher = loadJSON(TEACHER_KEY, {
    pin: '0000', timerMinutes: 0, minigames: true, helper: true, guestName: null, guestWelcome: null, className: '',
});
export function saveTeacher() { saveJSON(TEACHER_KEY, teacher); }
export const BOOK_KEY = 'britainExpressBook';
export const book = loadJSON(BOOK_KEY, { stations: [], heroes: [], cards: [], events: [], games: 0 });
export function saveBook() { saveJSON(BOOK_KEY, book); }
export function collect(kind, id) {
    if (!book[kind].includes(id)) {
        book[kind].push(id);
        saveBook();
        return true;
    }
    return false;
}
// ---------- Last game results (for the teacher's CSV export) ----------
export const RESULTS_KEY = 'britainExpressLastResults';
//# sourceMappingURL=storage.js.map