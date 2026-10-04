// Loads every editable content file from content/*.json, then builds the board.
import { setStations, setCustomQuiz } from './stations.js';
import { setHeroes } from './heroes.js';
import { setGameData } from './game-data.js';
import { initBoard } from '../map.js';
async function getJson(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok)
        throw new Error(`Could not load ${path} (${r.status})`);
    return r.json();
}
export async function loadContent(base = 'content/') {
    const [stations, heroes, cards, game, events, words, board, grid, custom, places] = await Promise.all([
        getJson(base + 'stations.json'), getJson(base + 'heroes.json'), getJson(base + 'cards.json'), getJson(base + 'game.json'),
        getJson(base + 'events.json'), getJson(base + 'words.json'), getJson(base + 'board.json'), getJson(base + 'grid.json'),
        getJson(base + 'custom-quiz.json').catch(() => ({ questions: [] })),
        getJson(base + 'places.json').catch(() => ({})),
    ]);
    setStations(stations, places);
    setHeroes(heroes);
    setGameData(game, cards, events, words);
    setCustomQuiz(custom);
    initBoard(board, grid);
}
//# sourceMappingURL=load.js.map