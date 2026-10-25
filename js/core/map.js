import { STATIONS, STATION_BY_ID } from './content/stations.js';
import { Rng } from './rng.js';
// The old lon/lat projection, still used by the flat overview art and the sprite studio.
export const MAP_SCALE = 330;
export const MAP_PAD = 120;
export const LON0 = -10.6, LAT0 = 59.5, COSLAT = 0.574;
export const WORLD_W = Math.round((2.2 - LON0) * COSLAT * MAP_SCALE + MAP_PAD * 2);
export const WORLD_H = Math.round((LAT0 - 49.7) * MAP_SCALE + MAP_PAD * 2);
export function project(lon, lat) {
    return { x: (lon - LON0) * COSLAT * MAP_SCALE + MAP_PAD, y: (LAT0 - lat) * MAP_SCALE + MAP_PAD };
}
/** Track connection bits of a cell. */
export const R = 1, L = 2, D = 4, U = 8;
const distCache = new Map();
export function buildBoard(raw, grid) {
    const PORTS = raw.ports;
    const W = grid.w;
    const nodes = [];
    const stationNode = {};
    const portNames = {};
    const cellNode = new Int32Array(grid.w * grid.h).fill(-1);
    const stationAt = new Map();
    for (const [id, s] of Object.entries(grid.stations))
        stationAt.set(s.y * W + s.x, id);
    const portAt = new Map();
    for (const [id, s] of Object.entries(grid.ports))
        portAt.set(s.y * W + s.x, id);
    const rng = new Rng(20261003);
    for (const [x, y, , sea] of grid.cells) {
        const k = y * W + x;
        const sid = stationAt.get(k), pid = portAt.get(k);
        let type;
        if (sid)
            type = 'station';
        else if (pid)
            type = 'port';
        else if (sea)
            type = 'sea';
        else
            type = rng.weighted(['blue', 'red', 'card', 'quiz', 'event'], (t) => ({ blue: 42, red: 22, card: 18, quiz: 10, event: 8 }[t]));
        const n = { id: nodes.length, type, x, y, region: 'london', stationId: sid, links: [] };
        if (sid) {
            n.region = STATION_BY_ID[sid].region;
            stationNode[sid] = n.id;
            const sg = grid.stations[sid].sign;
            n.label = { b: { dx: 0, dy: 1 }, t: { dx: 0, dy: -1 }, l: { dx: -1, dy: 0 }, r: { dx: 1, dy: 0 } }[sg];
        }
        if (pid) {
            n.region = PORTS[pid].region;
            portNames[n.id] = PORTS[pid].name;
        }
        cellNode[k] = n.id;
        nodes.push(n);
    }
    // links from the connection bits
    const edges = [];
    for (const [x, y, bits, sea] of grid.cells) {
        const a = cellNode[y * W + x];
        const pairs = [[R, 1, 0], [D, 0, 1]];
        for (const [bit, dx, dy] of pairs) {
            if (!(bits & bit))
                continue;
            const b = cellNode[(y + dy) * W + x + dx];
            if (b < 0)
                continue;
            const isSea = !!sea || nodes[b].type === 'sea';
            nodes[a].links.push({ to: b, sea: isSea });
            nodes[b].links.push({ to: a, sea: isSea });
            edges.push({ a, b, sea: isSea, pts: [{ x, y }, { x: x + dx, y: y + dy }] });
        }
    }
    // each square belongs to the region of its nearest station
    const reg = new Array(nodes.length).fill(null);
    const q = [];
    for (const n of nodes)
        if (n.stationId || n.type === 'port') {
            reg[n.id] = n.region;
            q.push(n.id);
        }
    for (let i = 0; i < q.length; i++)
        for (const l of nodes[q[i]].links)
            if (!reg[l.to]) {
                reg[l.to] = reg[q[i]];
                q.push(l.to);
            }
    for (const n of nodes)
        n.region = reg[n.id] ?? n.region;
    // one Card Shop per region, next to its main city
    const shopAnchors = raw.cardShopNear;
    for (const sid of Object.values(shopAnchors)) {
        const sn = nodes[stationNode[sid]];
        if (!sn)
            continue;
        const cand = sn.links.map((l) => nodes[l.to]).filter((n) => n.type !== 'station' && n.type !== 'sea' && n.type !== 'port');
        if (cand.length)
            cand[0].type = 'shop';
    }
    // keep the squares right next to the start friendly
    const ks = stationNode['kingscross'];
    if (ks !== undefined)
        for (const l of nodes[ks].links) {
            const n = nodes[l.to];
            if (n.type === 'red')
                n.type = 'blue';
        }
    return { nodes, stationNode, edges, portNames, grid, cellNode };
}
/** The board, filled in place by initBoard() once content has loaded. */
export const board = { nodes: [], stationNode: {}, edges: [], portNames: {}, grid: { w: 0, h: 0, cells: [], coast: [], stations: {}, ports: {} }, cellNode: new Int32Array(0) };
export function initBoard(raw, grid) {
    Object.assign(board, buildBoard(raw, grid));
    distCache.clear();
    // every station in the content must be on the board
    for (const s of STATIONS)
        if (board.stationNode[s.id] === undefined)
            console.warn('station not on the board:', s.id);
}
export function distancesTo(target) {
    let d = distCache.get(target);
    if (d)
        return d;
    d = new Int16Array(board.nodes.length).fill(9999);
    d[target] = 0;
    const q = [target];
    for (let i = 0; i < q.length; i++) {
        const n = q[i];
        for (const l of board.nodes[n].links)
            if (d[l.to] > d[n] + 1) {
                d[l.to] = d[n] + 1;
                q.push(l.to);
            }
    }
    distCache.set(target, d);
    return d;
}
export function dist(a, b) { return distancesTo(b)[a]; }
export function stationDist(a, b) { return dist(board.stationNode[a], board.stationNode[b]); }
// Legal next squares: no reversing onto the square you just came from, unless it is a dead end.
export function nextOptions(pos, prev) {
    const all = board.nodes[pos].links.map((l) => l.to);
    const fwd = all.filter((n) => n !== prev);
    return fwd.length ? fwd : all;
}
export function stationOf(node) { const s = board.nodes[node].stationId; return s ? STATION_BY_ID[s] : null; }
//# sourceMappingURL=map.js.map