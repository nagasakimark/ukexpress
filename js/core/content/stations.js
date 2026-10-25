import { slug, PLACE_IMAGE } from './slug.js';
export const STATIONS = [];
export const STATION_BY_ID = {};
export const ALL_PROPS = [];
export const PROP_BY_ID = {};
export const CUSTOM_QUIZ = [];
export function setStations(raw, places = {}) {
    STATIONS.length = 0;
    ALL_PROPS.length = 0;
    for (const k of Object.keys(STATION_BY_ID))
        delete STATION_BY_ID[k];
    for (const s of raw) {
        const props = (s.properties || []).map((p, i) => ({
            id: `${s.id}_${i}`, name: p.name, cat: p.category, price: p.price, ret: p.returnPercent / 100, stationId: s.id,
        }));
        const def = {
            id: s.id, name: s.name, region: s.region, lon: s.lon, lat: s.lat, emoji: s.emoji, props, fact: s.fact, quiz: s.quiz,
            film: s.film, hometown: !!s.hometown, nature: !!s.nature, trainShop: !!s.trainShop, capital: !!s.capital,
            facts: [], image: '',
        };
        const pl = places[s.id] ?? {};
        def.facts = [s.fact, ...(pl.facts ?? [])];
        if (s.film)
            def.facts.push({ en: '🎬 Film location: ' + s.film.en, ja: '🎬 映画のロケ地：' + s.film.ja });
        if (pl.team)
            def.team = pl.team;
        if (pl.famous)
            def.famous = pl.famous;
        def.image = PLACE_IMAGE[s.id] ?? slug(s.name.en);
        STATIONS.push(def);
        STATION_BY_ID[def.id] = def;
        for (const p of props) {
            ALL_PROPS.push(p);
            PROP_BY_ID[p.id] = p;
        }
    }
}
export function setCustomQuiz(raw) {
    CUSTOM_QUIZ.length = 0;
    for (const q of raw?.questions ?? [])
        if (q?.q && q.options?.length === 3)
            CUSTOM_QUIZ.push(q);
}
//# sourceMappingURL=stations.js.map