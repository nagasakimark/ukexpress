// Test page for the fake-3D board view: tools/viewtest.html?at=<station>&zoom=1&month=3
import { loadContent } from '../core/content/load.js';
import { board } from '../core/map.js';
import { sprites } from '../game/fake3d/sprites.js';
import { BoardView } from '../game/fake3d/view.js';
async function main() {
    await loadContent('/content/');
    await sprites.load('/assets/sprites/');
    const q = new URLSearchParams(location.search);
    const at = q.get('at') || 'york';
    const n = board.nodes[board.stationNode[at]];
    const v = new BoardView();
    v.cam.x = n.x + +(q.get('dx') || 0);
    v.cam.z = n.y + +(q.get('dz') || 0);
    v.cam.zoom = +(q.get('zoom') || 1);
    v.setMonth(+(q.get('month') || 3));
    const ctx = document.getElementById('c').getContext('2d');
    const dest = board.stationNode[q.get('dest') || at];
    const dir = (q.get('dir') || 'e');
    const d = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] }[dir];
    const color = +(q.get('color') || 0);
    const pt = (k) => ({ x: n.x + d[0] * k, z: n.y + d[1] * k });
    const tr = { id: 'a', ...pt(0), dir, type: +(q.get('train') || 2), color, cars: +(q.get('cars') || 2), trail: [pt(-3), pt(-2), pt(-1)].map((p) => ({ x: p.x, z: p.z })), lift: 0, scale: 1 };
    const t0 = performance.now();
    for (let i = 0; i < 8; i++)
        v.draw(ctx, [tr], dest, 1000);
    window.stats = { ms: (performance.now() - t0) / 8, items: v.scenery.items.length };
    window.done = true;
}
main();
//# sourceMappingURL=viewtest.js.map