// Landmarks for the stations added in v0.4, plus a set of generic "looks" (cathedral, castle, pier...).
// Same chunky Kenney-like style as landmarks.ts. Units: 100 = one board cell. Built at the origin; the sprite
// studio renders each one from the board camera's angle.
import { G } from './landmarks.js';
import * as THREE from 'three';
import { Shape } from './shapes.js';
import { LANDMARKS, cathedral, castleShape, flag, house, tudor, stonesRing, crane, chimney, mountain, STONE_D, SLATE, WHITE, GOLD, RED, GLASS, DARK } from './landmarks.js';
const SAND = '#efd9a0', WATER = '#5fb6e6', BRICK = '#b5563e', YBRICK = '#d9b26a', WOOD = '#8a5a36';
// ---------- small pieces ----------
function hill(sh, r, h, color = G.grass, x = 0, z = 0) {
    sh.add(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), color, x, 0, z);
    const g = sh;
    void g;
    void h;
}
function mound(sh, r, h, color = G.grass, x = 0, z = 0) { sh.add(new THREE.CylinderGeometry(r * 0.55, r, h, 12), color, x, h / 2, z); }
function water(sh, w, d, x = 0, z = 0) { sh.box(w, 0.6, d, WATER, x, 0, z); }
function quay(sh, w, d, x = 0, z = 0) { sh.box(w, 3, d, '#b9b2a2', x, 0, z); }
function lighthouse(sh, x, z, s = 1, a = RED, b = WHITE) {
    for (let i = 0; i < 5; i++)
        sh.cyl((7 - i * 0.7) * s, (7.4 - i * 0.7) * s, 8 * s, i % 2 ? a : b, x, i * 8 * s, z, 12);
    sh.cyl(4 * s, 4 * s, 5 * s, GLASS, x, 40 * s, z, 10);
    sh.cone(5 * s, 5 * s, DARK, x, 45 * s, z, 10);
    sh.box(10 * s, 1 * s, 10 * s, DARK, x, 40 * s, z);
}
function pier(sh, x, z, len = 70) {
    sh.box(9, 2.4, len, '#b0835a', x, 4, z);
    for (let k = -len / 2 + 4; k <= len / 2; k += 9) {
        sh.cyl(0.8, 0.8, 4, '#6e4c30', x - 3.5, 0, z + k, 5);
        sh.cyl(0.8, 0.8, 4, '#6e4c30', x + 3.5, 0, z + k, 5);
    }
    sh.box(16, 8, 12, WHITE, x, 6.4, z - len / 2 + 6);
    sh.roof(17, 5, 13, '#4f86c6', x, 14.4, z - len / 2 + 6);
}
function beachHuts(sh, x, z, n = 5) {
    const cols = ['#ff6b6b', '#ffd23f', '#4fc3f7', '#81c784', '#ba68c8', '#ffb74d'];
    for (let i = 0; i < n; i++) {
        sh.box(6, 7, 6, cols[i % cols.length], x + i * 7.2, 0, z);
        sh.roof(7, 3, 7, WHITE, x + i * 7.2, 7, z);
    }
}
function boat(sh, x, z, color = RED, s = 1) {
    sh.box(12 * s, 3 * s, 5 * s, color, x, 0, z);
    sh.box(5 * s, 3 * s, 4 * s, WHITE, x - 1 * s, 3 * s, z);
}
function townRow(sh, x, z, n, cols, roof = SLATE, s = 1) {
    for (let i = 0; i < n; i++)
        house(sh, x + i * 17 * s, z, cols[i % cols.length], roof, s);
}
function ruinWalls(sh, x, z, s = 1, col = '#b9b0a0') {
    const parts = [[-20, 0, 26, 4], [-6, -8, 34, 4], [10, 0, 18, 4], [24, -6, 12, 4]];
    for (const [dx, dz, h, w] of parts)
        sh.box(w * 3 * s, h * s, 4 * s, col, x + dx * s, 0, z + dz * s);
    for (let i = -2; i <= 2; i++)
        sh.box(2.4 * s, 8 * s, 4.4 * s, '#2a2a2a', x + i * 7 * s - 6 * s, 10 * s, z - 8 * s); // window gaps
}
function gothicArch(sh, x, z, s = 1, col = '#b3ab9a') {
    sh.box(8 * s, 40 * s, 6 * s, col, x - 18 * s, 0, z);
    sh.box(8 * s, 40 * s, 6 * s, col, x + 18 * s, 0, z);
    for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI;
        sh.box(5 * s, 5 * s, 6 * s, col, x + Math.cos(Math.PI - a) * 18 * s, 40 * s + Math.sin(a) * 14 * s, z);
    }
    sh.box(46 * s, 22 * s, 5 * s, col, x + 40 * s, 0, z - 4 * s);
    for (let i = 0; i < 3; i++)
        sh.box(5 * s, 10 * s, 5.4 * s, '#3a3a3a', x + (30 + i * 10) * s, 8 * s, z - 4 * s);
}
function trees(c, pts, kind = 'nature/tree-default') { for (const [x, z, s] of pts)
    c.model(kind, x, z, s ?? 18, x * 0.1); }
function pines(c, pts) { trees(c, pts, 'nature/tree-pinetalla'); }
function sheepAt(sh, x, z) {
    sh.box(5, 4, 7, '#f7f5ef', x, 1.6, z);
    sh.box(2.4, 2.4, 2.4, '#2b2b2b', x, 3.6, z + 4.4);
}
function stadium(sh, x, z, r = 22, col = '#e8e8ee') {
    sh.add(new THREE.CylinderGeometry(r, r - 2, 12, 18, 1, true), col, x, 6, z);
    sh.cyl(r - 4, r - 4, 1, G.grass, x, 0.5, z, 18);
}
function spire(sh, x, z, h, base = 12, col = STONE_D) {
    sh.box(base, h * 0.55, base, col, x, 0, z);
    sh.cone(base * 0.62, h * 0.5, col, x, h * 0.55, z, 4);
}
function bigBen(sh, x = 0, z = 0) {
    sh.box(12, 62, 12, '#d8c27a', x, 0, z);
    sh.box(14, 14, 14, '#cdb56a', x, 62, z);
    sh.clock4(5.6, x, 69, z, 7);
    sh.add(new THREE.ConeGeometry(10, 26, 4), '#3e4f66', x, 89, z, Math.PI / 4);
    sh.sphere(1.6, GOLD, x, 103, z);
}
// ---------- generic looks, by the "look" tag in stations.json ----------
export const LOOKS = {
    cathedral: (c) => { const sh = new Shape(); cathedral(sh, 0.9); c.shape(sh, 0, 0); trees(c, [[-40, 18], [40, 20]]); },
    castle: (c) => { const sh = new Shape(); castleShape(sh, 0.75); c.shape(sh, 0, 0); },
    harbour: (c) => {
        const sh = new Shape();
        water(sh, 80, 30, 0, 22);
        quay(sh, 80, 8, 0, 4);
        townRow(sh, -34, -12, 4, ['#f2e9d8', '#cde7f2', '#fff1b8', '#f2c6d0']);
        boat(sh, -12, 26, RED);
        boat(sh, 16, 30, '#2f6fb0');
        lighthouse(sh, 38, 8, 0.45);
        c.shape(sh, 0, 0);
    },
    pier: (c) => {
        const sh = new Shape();
        sh.box(80, 0.8, 26, SAND, 0, 0, 12);
        water(sh, 90, 30, 0, 40);
        pier(sh, 18, 30, 60);
        beachHuts(sh, -36, 2, 4);
        c.shape(sh, 0, -10);
        c.model('city/detail-parasol-a', -18, 18, 16);
        c.model('city/detail-parasol-b', -2, 22, 16);
    },
    ruins: (c) => { const sh = new Shape(); mound(sh, 46, 3, G.grass); ruinWalls(sh, 0, 0, 1); c.shape(sh, 0, 0, 0); },
    town: (c) => { const sh = new Shape(); townRow(sh, -34, 0, 5, ['#efe3c8', BRICK, '#f6dcc0', '#c2694a', '#e8dcc0'], '#5b6b7a'); c.shape(sh, 0, 0); trees(c, [[-46, 20], [48, 18]]); },
    modern: (c) => { c.model('city/building-skyscraper-a', -14, -8, 20); c.model('city/building-skyscraper-c', 16, 4, 18); c.model('city/building-g', -40, 14, 18); },
    glasshouse: (c) => {
        const sh = new Shape();
        sh.add(new THREE.CylinderGeometry(14, 14, 56, 16, 1, false, 0, Math.PI), '#bfe9ff', 0, 0, 0, 0, 0, Math.PI / 2);
        sh.add(new THREE.SphereGeometry(14, 14, 8, 0, Math.PI), '#bfe9ff', -28, 0, 0, 0, -Math.PI / 2);
        sh.add(new THREE.SphereGeometry(14, 14, 8, 0, Math.PI), '#bfe9ff', 28, 0, 0, 0, -Math.PI / 2);
        sh.add(new THREE.CylinderGeometry(9, 9, 22, 16, 1, false, 0, Math.PI), '#d8f3ff', 0, 12, 0, 0, 0, Math.PI / 2);
        for (let i = -3; i <= 3; i++)
            sh.add(new THREE.TorusGeometry(14.2, 0.5, 4, 16, Math.PI), WHITE, i * 8, 0, 0, Math.PI / 2);
        sh.box(70, 1, 40, G.grass, 0, 0, 0);
        c.shape(sh, 0, -4);
        c.model('pirate/palm-straight', 44, 14, 20);
        c.model('pirate/palm-bend', -44, 16, 20);
    },
    clocktower: (c) => {
        const sh = new Shape();
        bigBen(sh);
        sh.box(64, 20, 14, '#d8c27a', -40, 0, 8);
        sh.roof(64, 7, 14, '#3e4f66', -40, 20, 8);
        for (const dx of [-66, -14]) {
            sh.box(8, 30, 8, '#d8c27a', dx, 0, 8);
            sh.add(new THREE.ConeGeometry(6, 10, 4), '#3e4f66', dx, 35, 8, Math.PI / 4);
        }
        c.shape(sh, 14, 0);
    },
    cliffs: (c) => {
        const sh = new Shape();
        sh.box(84, 30, 22, '#f2efe4', 0, -2, 10);
        sh.box(84, 3, 30, G.grass, 0, 28, 6);
        for (let i = 0; i < 6; i++)
            sh.box(10, 18 - i, 6, '#e4dfd0', -36 + i * 14, 0, 22);
        water(sh, 96, 24, 0, 34);
        lighthouse(sh, 26, 0, 0.45, RED, WHITE);
        c.shape(sh, 0, -8);
    },
    lighthouse: (c) => {
        const sh = new Shape();
        mound(sh, 34, 3, '#9a9488');
        lighthouse(sh, 0, 0, 1.1);
        sh.box(18, 10, 10, WHITE, 22, 8, 6);
        sh.roof(19, 5, 11, SLATE, 22, 18, 6);
        c.shape(sh, 0, 0);
    },
    tor: (c) => {
        const sh = new Shape();
        sh.add(new THREE.CylinderGeometry(10, 46, 36, 14), G.grass, 0, 18, 0);
        sh.box(10, 26, 10, '#b5ab98', 0, 36, 0);
        sh.box(12, 3, 12, '#a39883', 0, 62, 0);
        for (let i = 0; i < 4; i++)
            sh.box(4, 1, 6, '#d8c9a0', -20 + i * 8, 6 + i * 6, 22 - i * 4);
        c.shape(sh, 0, 0);
    },
    gorge: (c) => {
        const sh = new Shape();
        for (const sx of [-1, 1])
            for (let i = 0; i < 4; i++)
                sh.box(18, 46 - i * 6, 18, i % 2 ? '#b8b1a0' : '#a9a191', sx * (22 + i * 3), 0, -24 + i * 16);
        sh.box(14, 0.6, 70, '#8a8a84', 0, 0, 0);
        sh.cyl(9, 9, 6, '#f5d36a', 0, 0, 30, 18);
        sh.box(4, 6.2, 4, '#f7e3a0', 6, 0, 32); // a wheel of cheddar
        c.shape(sh, 0, 0);
    },
    bridge: (c) => {
        const sh = new Shape();
        water(sh, 30, 90, 0, 0);
        for (let i = 0; i <= 12; i++) {
            const a = (i / 12) * Math.PI;
            sh.box(5, 3, 10, STONE_D, Math.cos(Math.PI - a) * 30, Math.sin(a) * 18, 0);
        }
        sh.box(80, 3, 12, '#9a9488', 0, 18, 0);
        for (const dx of [-30, 30])
            sh.box(10, 18, 14, STONE_D, dx, 0, 0);
        c.shape(sh, 0, 0);
        trees(c, [[-44, 20], [44, -16]]);
    },
    mountain: (c) => mountain(c, 80, 56, false),
    colourful: (c) => {
        const sh = new Shape();
        const cols = ['#f6b26b', '#9fc5e8', '#f9e076', '#ea9999', '#b6d7a8', '#d5a6bd'];
        for (let i = 0; i < 6; i++) {
            const x = -40 + (i % 3) * 22, z = Math.floor(i / 3) * 18 - 8;
            sh.box(16, 12 + (i % 2) * 6, 12, cols[i], x, 0, z);
            sh.roof(17, 5, 13, '#c96a3a', x, 12 + (i % 2) * 6, z);
        }
        sh.box(9, 46, 9, '#e6c88a', 34, 0, -6);
        sh.cone(7, 12, '#c96a3a', 34, 46, -6, 4); // campanile
        c.shape(sh, 0, 0);
    },
    mill: (c) => {
        const sh = new Shape();
        sh.box(56, 26, 20, BRICK, 0, 0, 0);
        sh.roof(57, 7, 21, SLATE, 0, 26, 0);
        for (let r = 0; r < 3; r++)
            for (let i = -3; i <= 3; i++)
                sh.box(4, 4, 0.5, GLASS, i * 7.5, 4 + r * 7, 10.3);
        chimney(sh, 34, -6, 52, '#9a4a36');
        water(sh, 80, 12, 0, 22);
        c.shape(sh, 0, 0);
    },
    hills: (c) => {
        const sh = new Shape();
        hill(sh, 40, 0, G.grass, -16, -10);
        hill(sh, 30, 0, G.grass, 28, 0);
        sheepAt(sh, -10, 34);
        sheepAt(sh, 8, 30);
        sheepAt(sh, 24, 36);
        c.shape(sh, 0, 0);
        trees(c, [[46, -24], [-50, 16]]);
    },
    tudor: (c) => { const sh = new Shape(); tudor(sh, -24, 0); tudor(sh, 0, -4); tudor(sh, 24, 0); c.shape(sh, 0, 0); },
    abbey: (c) => { const sh = new Shape(); mound(sh, 50, 3, G.grass); gothicArch(sh, -20, 0, 0.9); c.shape(sh, 0, 0, 0); },
    moor: (c) => {
        const sh = new Shape();
        sh.box(26, 14, 14, '#9b927e', -10, 0, 0);
        sh.roof(27, 7, 15, '#55606b', -10, 14, 0); // the parsonage
        sh.box(12, 30, 12, '#8f866f', 22, 0, -6);
        sh.box(14, 2, 14, '#7f765f', 22, 30, -6); // church tower
        for (let i = 0; i < 6; i++)
            sh.sphere(7, '#9c5fb5', -40 + i * 15, 0, 26 + (i % 2) * 6, 7); // heather
        sh.box(80, 4, 2, '#8f877a', 0, 0, 18);
        c.shape(sh, 0, 0);
    },
    lake: (c) => {
        const sh = new Shape();
        sh.cyl(38, 38, 0.6, WATER, 0, 0, 10, 20);
        boat(sh, 4, 14, '#e8e8e8', 0.6);
        c.shape(sh, 0, 0);
        pines(c, [[-44, -14, 26], [-30, -26, 22], [40, -22, 24], [50, -6, 20]]);
        c.model('nature/rock-largea', 30, 34, 14);
    },
    wall: (c) => {
        const sh = new Shape();
        mound(sh, 60, 6, G.grass, 0, 0);
        for (let i = 0; i < 13; i++) {
            const x = -64 + i * 10.5, y = 6 + Math.sin(((i + 0.5) / 13) * Math.PI) * 10;
            sh.box(11, 9, 5, '#a9a296', x, y - 4, 2);
            sh.box(11, 1.2, 5.6, '#bdb6a8', x, y + 5, 2);
        }
        sh.box(20, 14, 16, '#a9a296', 6, 10, -8);
        sh.box(8, 8, 1, '#5a3a22', 6, 10, 0.2); // a milecastle gate
        c.shape(sh, 0, 0);
        c.model('nature/tree-oak', 34, -12, 26); // Sycamore Gap
    },
    stones: (c) => {
        const sh = new Shape();
        stonesRing(sh, 18, 12, 18, false, '#8d918d');
        for (const [dx, dz] of [[0, -30], [0, -42], [0, 30], [30, 0], [-30, 0]])
            sh.add(new THREE.BoxGeometry(4, 16, 3), '#8d918d', dx, 8, dz);
        sh.add(new THREE.BoxGeometry(5, 26, 4), '#7d817d', 0, 13, 0);
        c.shape(sh, 0, 0);
    },
    ship: (c) => {
        const sh = new Shape();
        water(sh, 90, 34, 0, 6);
        quay(sh, 90, 8, 0, -16);
        sh.box(60, 9, 14, '#2a2a2a', 0, 0, 6);
        sh.box(58, 2, 13, '#c9a26a', 0, 9, 6);
        for (const dx of [-18, 2, 20]) {
            sh.cyl(1, 1, 50, '#6e4c30', dx, 9, 6, 6);
            sh.box(1, 1, 18, '#6e4c30', dx, 44, 6);
            sh.box(1, 1, 14, '#6e4c30', dx, 32, 6);
        }
        sh.cyl(3, 3, 12, '#c9a26a', 10, 9, 6, 8);
        c.shape(sh, 0, 0);
    },
};
// ---------- particular stations ----------
export const STATION_BUILDERS = {
    // King's Cross station itself: yellow-brick front with two great arches and a clock tower, and a trolley going into the wall
    kingscross: (c) => {
        const sh = new Shape();
        sh.box(80, 26, 18, YBRICK, 0, 0, 0);
        for (const dx of [-20, 20]) {
            sh.add(new THREE.CylinderGeometry(15, 15, 18.6, 16, 1, false, Math.PI / 2, Math.PI), '#9fb6cc', dx, 18, 0, 0, Math.PI / 2, 0);
            sh.box(30, 18, 18.6, '#9fb6cc', dx, 0, 0);
            for (let i = 0; i <= 8; i++) {
                const a = (i / 8) * Math.PI;
                sh.box(3, 3, 19, '#c99a52', dx + Math.cos(a) * 15, 18 + Math.sin(a) * 15, 0);
            }
        }
        sh.box(10, 48, 10, YBRICK, 0, 0, 2);
        sh.clock4(4, 0, 40, 2, 5);
        sh.box(12, 4, 12, '#c9a35e', 0, 48, 2);
        sh.cone(6, 8, '#5b6b7a', 0, 52, 2, 4);
        sh.box(14, 6, 6, '#7a1f2a', 34, 0, 18);
        sh.box(8, 8, 0.6, '#b98a3a', 31, 6, 18); // the Platform 9¾ trolley
        c.shape(sh, 0, -6);
    },
    westminster: (c) => LANDMARKS.kingscross(c), // Big Ben and the Houses of Parliament (built for King's Cross in v0.3)
    kew: (c) => LOOKS.glasshouse(c),
    windsor: (c) => {
        const sh = new Shape();
        castleShape(sh, 0.8, '#c8bfae', '#5b6b7a', 'none');
        sh.add(new THREE.CylinderGeometry(16, 18, 34, 16), '#d4ccb9', 0, 17, -40 * 0.8 / 2 + 4); // the Round Tower
        sh.cyl(0.6, 0.6, 14, DARK, 0, 34, -12, 6);
        sh.box(12, 7, 0.4, '#c8102e', 6, 40, -12);
        sh.box(6, 3.5, 0.5, '#f2c230', 3, 41.5, -12);
        c.shape(sh, 0, 0);
    },
    reading: (c) => { const sh = new Shape(); ruinWalls(sh, -20, -10, 0.8, '#a69c8a'); townRow(sh, 6, 10, 3, [BRICK, '#c2694a', '#efe3c8'], SLATE); c.shape(sh, 0, 0); },
    winchester: (c) => {
        const sh = new Shape();
        cathedral(sh, 1, true);
        c.shape(sh, 0, -6);
        const t = new Shape();
        t.cyl(9, 9, 1.5, '#e8d6a0', 46, 0, 26, 24);
        for (let i = 0; i < 24; i += 2)
            t.add(new THREE.BoxGeometry(1, 1.6, 8.6), i % 4 ? '#2e7a4e' : WHITE, 46, 1.6, 26, (i / 24) * Math.PI * 2); // the Round Table
        c.shape(t, 0, 0);
    },
    southampton: (c) => {
        const sh = new Shape();
        water(sh, 110, 36, 0, 8);
        quay(sh, 110, 10, 0, -18);
        sh.box(84, 12, 18, WHITE, 0, 0, 8);
        sh.box(70, 8, 16, '#f4f4f4', -4, 12, 8);
        sh.box(54, 6, 14, '#f0f0f0', -6, 20, 8);
        for (let i = -4; i <= 4; i++)
            sh.box(5, 2, 0.4, '#3a6ea8', i * 8, 15, 16.2);
        sh.cyl(4, 4, 12, RED, 14, 26, 8, 10);
        sh.cyl(4.2, 4.2, 3, DARK, 14, 38, 8, 10); // cruise ship
        crane(sh, -44, -22, '#d94b3a', 0.6);
        c.shape(sh, 0, 0);
    },
    hastings: (c) => {
        const sh = new Shape();
        mound(sh, 40, 3, G.grass, -18, -10);
        ruinWalls(sh, -18, -10, 0.7);
        for (let i = 0; i < 3; i++) {
            sh.box(8, 22, 8, '#232323', 22 + i * 11, 0, 14);
            sh.roof(9, 5, 9, '#232323', 22 + i * 11, 22, 14);
        }
        c.shape(sh, 0, 0);
    },
    margate: (c) => LOOKS.pier(c),
    rye: (c) => { const sh = new Shape(); mound(sh, 50, 3, G.grass); townRow(sh, -30, -4, 4, ['#f2e3c6', BRICK, '#efe3c8', '#d9a07a'], '#8a4a36', 0.9); tudor(sh, 26, 14); spire(sh, -6, -22, 36, 9, '#c9b48e'); c.shape(sh, 0, 0); },
    miltonkeynes: (c) => {
        c.model('city/building-skyscraper-e', -30, -16, 16);
        for (const [x, z, r] of [[0, 14, 0.4], [16, 20, -0.6], [30, 10, 2.4]])
            c.model('cube/animal-cow', x, z, 10, r, 0, new THREE.Color('#9a9a9a')); // the concrete cows
    },
    norwich: (c) => { const sh = new Shape(); cathedral(sh, 0.85, false); spire(sh, -22 * 0.85, 2, 90, 13); c.shape(sh, 0, 0); c.model('nature/tree-default', 44, 20, 18); },
    ipswich: (c) => { LOOKS.harbour(c); c.model('car/tractor', -44, 28, 9, 0.4); },
    colchester: (c) => {
        const sh = new Shape();
        sh.box(46, 30, 36, '#c9a383', 0, 0, 0);
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
            sh.box(10, 36, 10, '#bf9877', dx * 23, 0, dz * 18);
        sh.box(10, 12, 1, '#5a3a22', 0, 0, 18.2);
        c.shape(sh, 0, 0);
        trees(c, [[-42, 26], [44, 24]]);
    },
    ely: (c) => { const sh = new Shape(); cathedral(sh, 1, true, false); sh.cyl(9, 11, 18, STONE_D, 8, 30, 0, 8); sh.cone(9, 8, SLATE, 8, 48, 0, 8); c.shape(sh, 0, -4); },
    greatyarmouth: (c) => { LOOKS.pier(c); const sh = new Shape(); boat(sh, 44, 24, '#2f6fb0'); c.shape(sh, 0, 0); },
    bournemouth: (c) => { const sh = new Shape(); sh.box(90, 0.8, 30, SAND, 0, 0, 6); water(sh, 96, 26, 0, 34); pier(sh, 22, 26, 60); beachHuts(sh, -44, -4, 6); c.shape(sh, 0, -8); },
    lymeregis: (c) => {
        const sh = new Shape();
        water(sh, 90, 34, 0, 18);
        for (let i = 0; i <= 10; i++) {
            const a = (i / 10) * Math.PI * 0.8;
            sh.box(8, 6, 8, '#b9a98a', Math.cos(a) * 34 - 10, 0, Math.sin(a) * 22 + 4);
        } // the Cobb
        sh.box(40, 24, 14, '#a8805a', 30, 0, -18);
        sh.box(40, 2, 16, G.grass, 30, 24, -18);
        const am = new Shape();
        for (let i = 0; i < 26; i++) {
            const a = i * 0.42, r = 2 + i * 0.42;
            am.sphere(1.3 + i * 0.06, '#c9b28a', Math.cos(a) * r, 8 + Math.sin(a) * r, 0, 6);
        } // an ammonite
        c.shape(sh, 0, 0);
        c.shape(am, -30, -10, 0);
    },
    torquay: (c) => { LOOKS.harbour(c); c.model('pirate/palm-straight', -44, 22, 20); c.model('pirate/palm-bend', 46, -18, 20); },
    tintagel: (c) => {
        const sh = new Shape();
        sh.box(40, 34, 30, '#8f8a7c', -24, 0, -6);
        sh.box(40, 2, 30, G.grass, -24, 34, -6);
        ruinWalls(sh, -24, -6, 0.6);
        sh.box(26, 24, 30, '#8f8a7c', 30, 0, 0);
        sh.box(26, 2, 30, G.grass, 30, 24, 0);
        sh.box(30, 1.5, 4, '#9a9488', 4, 26, -2);
        water(sh, 100, 20, 0, 26);
        c.shape(sh, 0, 0);
    },
    stives: (c) => { LOOKS.harbour(c); const sh = new Shape(); sh.cyl(12, 12, 14, WHITE, 40, 0, -20, 16); sh.box(16, 6, 6, '#3a7bd5', 40, 14, -20); c.shape(sh, 0, 0); },
    falmouth: (c) => { const sh = new Shape(); mound(sh, 34, 3, '#9a9488', -20, 0); lighthouse(sh, -20, 0, 0.9); castleShape(sh, 0.4, STONE_D, SLATE, 'none'); c.shape(sh, 24, 0); },
    glastonbury: (c) => LOOKS.tor(c),
    cheddar: (c) => LOOKS.gorge(c),
    gloucester: (c) => { const sh = new Shape(); cathedral(sh, 1, true, false); sh.box(16, 60, 16, STONE_D, -22, 0, 2); for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]])
        sh.cone(1.8, 9, STONE_D, -22 + dx, 60, 2 + dz, 4); c.shape(sh, 0, -6); },
    newport: (c) => {
        const sh = new Shape();
        water(sh, 40, 90, 0, 0);
        for (const dx of [-36, 36]) {
            sh.box(4, 70, 4, '#4a7ab0', dx, 0, -6);
            sh.box(4, 70, 4, '#4a7ab0', dx, 0, 6);
        }
        sh.box(80, 5, 14, '#4a7ab0', 0, 70, 0);
        for (let i = -6; i <= 6; i++)
            sh.box(0.6, 54, 0.6, '#2a2a2a', i * 3, 16, 0);
        sh.box(18, 3, 12, '#c0392b', 0, 12, 0); // the gondola carrying cars over the river
        c.shape(sh, 0, 0);
    },
    tenby: (c) => {
        const sh = new Shape();
        water(sh, 80, 30, 0, 24);
        quay(sh, 80, 6, 0, 6);
        townRow(sh, -38, -10, 5, ['#f9c5d1', '#fde68a', '#a7f3d0', '#bfdbfe', '#fbcfe8'], SLATE);
        boat(sh, 10, 26, '#2f6fb0');
        c.shape(sh, 0, 0);
    },
    stdavids: (c) => { const sh = new Shape(); cathedral(sh, 0.8, true); sh.box(30, 10, 14, '#c9b48e', 40, 0, 14); c.shape(sh, -8, 0); trees(c, [[-46, 22]]); },
    brecon: (c) => {
        const sh = new Shape();
        sh.add(new THREE.CylinderGeometry(18, 52, 50, 7), '#7aa05a', 0, 25, -8);
        sh.add(new THREE.CylinderGeometry(14, 18, 4, 7), '#9a8f74', 0, 51, -8);
        sheepAt(sh, -30, 34);
        sheepAt(sh, 30, 30);
        c.shape(sh, 0, 0);
    },
    caernarfon: (c) => {
        const sh = new Shape();
        const w = 70, d = 34;
        sh.box(w, 18, 5, '#b8ad98', 0, 0, d / 2);
        sh.box(w, 18, 5, '#b8ad98', 0, 0, -d / 2);
        sh.box(5, 18, d, '#b8ad98', -w / 2, 0, 0);
        sh.box(5, 18, d, '#b8ad98', w / 2, 0, 0);
        for (const [tx, tz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, d / 2]]) {
            sh.add(new THREE.CylinderGeometry(7, 7.5, 30, 8), '#a89d88', tx, 15, tz);
            sh.box(15, 2, 3, '#8f846f', tx, 22, tz);
        }
        flag(sh, w / 2, 30, -d / 2, 1, 'wales');
        c.shape(sh, 0, 0);
    },
    portmeirion: (c) => LOOKS.colourful(c),
    holyhead: (c) => { LOOKS.lighthouse(c); const sh = new Shape(); water(sh, 60, 22, 30, 34); sh.box(36, 10, 12, WHITE, 34, 0, 34); sh.box(28, 6, 10, '#1f4f8a', 32, 10, 34); c.shape(sh, 0, 0); },
    lincoln: (c) => { const sh = new Shape(); mound(sh, 54, 3, G.grass); cathedral(sh, 0.9, false); for (const dx of [-26, -10])
        sh.box(11, 44, 11, STONE_D, dx, 0, 2); sh.box(13, 50, 13, STONE_D, 8, 0, 0); c.shape(sh, 0, 0, 0); },
    coventry: (c) => {
        const sh = new Shape();
        ruinWalls(sh, -22, 0, 0.8, '#b46a52');
        spire(sh, -46, -10, 84, 11, '#b46a52');
        sh.box(40, 20, 24, '#e6dcc4', 34, 0, -4);
        sh.roof(40, 9, 24, '#6b7a88', 34, 20, -4);
        for (let i = -3; i <= 3; i++)
            sh.box(2.2, 14, 0.5, '#4f7fb2', 34 + i * 5, 3, 8.3);
        sh.box(9, 7, 12, '#e6dcc4', 8, 0, 10);
        sh.box(7, 5.5, 0.5, '#8fb8d8', 8, 0.5, 16.2); // the porch with its glass screen
        sh.box(6, 34, 6, '#cfc6b0', 6, 0, -22);
        sh.cone(4.4, 8, '#6b7a88', 6, 34, -22, 4); // the bell tower
        c.shape(sh, 0, 0);
        c.model('car/taxi', 10, 30, 7, 1.2);
    },
    worcester: (c) => {
        const sh = new Shape();
        cathedral(sh, 0.85, true, false);
        water(sh, 100, 14, 0, 30);
        sh.box(12, 50, 12, STONE_D, 5, 20, 0);
        for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]])
            sh.cone(1.3, 6, STONE_D, 5 + dx, 70, dz, 4); // the great tower
        sh.cyl(4, 4, 18, '#5b2a14', 52, 0, 14, 10);
        sh.cyl(1.8, 2.6, 6, '#5b2a14', 52, 18, 14, 10);
        sh.box(7, 8, 0.4, '#f2e6c8', 52, 6, 18.2); // a giant sauce bottle
        c.shape(sh, -8, -6);
    },
    shrewsbury: (c) => { LOOKS.tudor(c); c.model('nature/tree-oak', 46, 18, 18); },
    derby: (c) => LOOKS.mill(c),
    ironbridge: (c) => {
        const sh = new Shape();
        water(sh, 26, 90, 0, 0);
        sh.box(30, 2, 90, '#5aa060', -30, 0, 0);
        sh.box(30, 2, 90, '#5aa060', 30, 0, 0);
        for (let k = 0; k < 3; k++)
            for (let i = 0; i <= 14; i++) {
                const a = (i / 14) * Math.PI;
                sh.box(4, 1.6, 1.4, '#3a3a3a', Math.cos(Math.PI - a) * (24 - k * 3), Math.sin(a) * (22 - k * 3), -5 + k * 5);
            }
        sh.box(60, 2, 12, '#4a4a4a', 0, 22, 0);
        c.shape(sh, 0, 0);
        trees(c, [[-40, -26], [40, 26]]);
    },
    buxton: (c) => {
        const sh = new Shape();
        for (let i = 0; i < 9; i++) {
            const a = -0.9 + (i / 8) * 1.8;
            sh.box(12, 18, 10, '#e9dcbc', Math.sin(a) * 40, 0, -Math.cos(a) * 30 + 20, -a);
        }
        sh.cyl(5, 5, 4, '#9fd8f0', 0, 0, 24, 12);
        c.shape(sh, 0, 0);
        trees(c, [[-46, 24], [48, 24]]);
    },
    hereford: (c) => { LOOKS.cathedral(c); c.model('cube/animal-cow', 38, 30, 9, -0.5, 0, new THREE.Color('#b25a32')); c.model('cube/animal-cow', 52, 18, 8, 0.4, 0, new THREE.Color('#b25a32')); },
    chester: (c) => {
        const sh = new Shape();
        for (let i = 0; i < 8; i++)
            sh.box(16, 8, 6, '#c89a7a', -56 + i * 16, 0, 20);
        sh.box(14, 14, 10, '#c89a7a', 0, 8, 20);
        sh.clock(5, 0, 24, 25.6);
        sh.box(8, 10, 2, '#1f3b6f', 0, 20, 25); // the Eastgate clock
        tudor(sh, -22, -10);
        tudor(sh, 22, -10);
        c.shape(sh, 0, 0);
    },
    hull: (c) => {
        const sh = new Shape();
        water(sh, 100, 28, 0, 32);
        sh.box(46, 10, 24, '#7f98a8', 0, 0, 0);
        const side = new THREE.Shape();
        side.moveTo(0, 0);
        side.lineTo(44, 0);
        side.lineTo(44, 30);
        side.lineTo(2, 12);
        side.closePath();
        const wedge = new THREE.ExtrudeGeometry(side, { depth: 22, bevelEnabled: false });
        wedge.translate(-22, 10, -11);
        sh.add(wedge, '#9fd0e8', 0, 0, 0);
        sh.box(1, 20, 22.4, '#2f5f7a', 22, 10, 0);
        for (let i = 0; i < 5; i++)
            sh.box(1, 16 - i * 0.5, 0.5, '#e9f6ff', -16 + i * 8.6, 12 + i * 2, 11.3);
        sh.add(new THREE.ConeGeometry(6, 16, 3), '#cfe9f5', -24, 18, 0, 0, 0, Math.PI / 2);
        sh.box(4, 10, 4, '#efe6c4', 44, 0, 14);
        sh.box(4.6, 1, 4.6, '#efe6c4', 44, 10, 14); // a cream phone box
        c.shape(sh, 0, -6);
    },
    scarborough: (c) => { const sh = new Shape(); mound(sh, 44, 3, G.grass, 6, -10); ruinWalls(sh, 6, -14, 0.7); sh.box(90, 0.8, 20, SAND, 0, 0, 26); beachHuts(sh, -40, 22, 4); c.shape(sh, 0, 0); },
    whitby: (c) => LOOKS.abbey(c),
    harrogate: (c) => {
        const sh = new Shape();
        sh.cyl(14, 14, 16, '#e9dcbc', 0, 0, 0, 8);
        sh.cone(15, 10, SLATE, 0, 16, 0, 8);
        for (let i = 0; i < 3; i++) {
            sh.box(22, 1.6, 9, G.grass, -34 + i * 26, 0, 26);
            for (let k = 0; k < 6; k++)
                sh.sphere(1.8, ['#ff6b8b', '#ffd23f', '#a86bff'][(i + k) % 3], -43 + i * 26 + k * 3.6, 2.2, 26 + (k % 2 ? 2 : -2), 5);
        }
        c.shape(sh, 0, 0);
        trees(c, [[-40, -10], [40, -6]]);
    },
    haworth: (c) => LOOKS.moor(c),
    lancaster: (c) => {
        const sh = new Shape();
        castleShape(sh, 0.55, '#b3a98f', SLATE, 'none');
        sh.box(22, 18, 22, '#e6e1d4', 40, 0, -20);
        sh.cyl(8, 8, 8, '#e6e1d4', 40, 18, -20, 12);
        sh.sphere(8, '#7fa89a', 40, 26, -20, 12); // Ashton Memorial
        c.shape(sh, -10, 0);
    },
    keswick: (c) => { LOOKS.lake(c); const sh = new Shape(); sh.box(4, 40, 4, '#f2c230', -10, 0, -30); sh.cone(2.8, 7, '#e8c9a0', -10, 40, -30, 6); sh.cone(1, 2.4, DARK, -10, 45, -30, 6); c.shape(sh, 0, 0); }, // a giant pencil
    hexham: (c) => LOOKS.wall(c),
    sunderland: (c) => { const sh = new Shape(); water(sh, 100, 26, 0, 24); quay(sh, 100, 8, 0, 6); crane(sh, -24, -6, '#d94b3a', 0.9); crane(sh, 24, -6, '#2a6fb0', 0.8); boat(sh, 0, 26, '#c0392b', 2); c.shape(sh, 0, 0); },
    berwick: (c) => {
        const sh = new Shape();
        water(sh, 110, 24, 0, 0);
        for (let i = 0; i < 7; i++) {
            const x = -54 + i * 18;
            sh.box(5, 24, 10, '#c9a383', x, 0, 0);
        }
        sh.box(118, 4, 10, '#c9a383', 0, 24, 0);
        for (let i = 0; i < 6; i++)
            sh.add(new THREE.CylinderGeometry(7, 7, 10, 10, 1, false, 0, Math.PI), '#c9a383', -45 + i * 18, 24, 0, 0, Math.PI / 2, 0);
        c.shape(sh, 0, 0);
    },
    lindisfarne: (c) => {
        const sh = new Shape();
        sh.add(new THREE.CylinderGeometry(14, 28, 30, 9), '#8f8a7c', 0, 15, -6);
        sh.box(26, 14, 14, '#c9b9a0', 0, 30, -6);
        sh.roof(27, 6, 15, '#7a4a36', 0, 44, -6);
        gothicArch(sh, -34, 20, 0.45);
        water(sh, 100, 16, 0, 30);
        c.shape(sh, 0, 0);
    },
    dundee: (c) => LOOKS.ship(c),
    perth: (c) => {
        const sh = new Shape();
        sh.box(54, 22, 18, '#c78a6a', 0, 0, -6);
        for (const dx of [-27, 27]) {
            sh.box(10, 30, 10, '#c78a6a', dx, 0, -6);
            for (let i = -1; i <= 1; i++)
                sh.box(2.6, 3, 10.4, '#c78a6a', dx + i * 3.6, 30, -6);
        }
        sh.box(12, 6, 8, '#8f8a7c', 0, 0, 20); // the Stone of Scone
        c.shape(sh, 0, 0);
    },
    pitlochry: (c) => { const sh = new Shape(); water(sh, 90, 30, 0, -18); sh.box(80, 18, 8, '#bdb9ad', 0, 0, 0); for (let i = 0; i < 6; i++)
        sh.box(8, 2 + i * 2.6, 8, '#9fd0e8', -30 + i * 8, 0, 14); c.shape(sh, 0, 0); pines(c, [[-44, 30], [44, 30, 24]]); },
    oban: (c) => {
        const sh = new Shape();
        mound(sh, 46, 16, G.grass, 0, -12);
        for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            sh.box(9, 12, 3, '#b9b0a0', Math.cos(a) * 26, 16, Math.sin(a) * 20 - 12, -a + Math.PI / 2);
        } // McCaig's Tower
        water(sh, 100, 16, 0, 34);
        boat(sh, 20, 34, '#c0392b');
        c.shape(sh, 0, 0);
    },
    portree: (c) => {
        const sh = new Shape();
        sh.add(new THREE.CylinderGeometry(24, 52, 40, 7), '#7c8a6a', -20, 20, -14);
        sh.add(new THREE.CylinderGeometry(2, 6, 40, 6), '#6e6a60', 26, 20, -18); // the Old Man of Storr
        sh.cyl(9, 9, 0.6, '#7fd6f0', 20, 0, 22, 14);
        sh.cyl(6, 6, 0.6, '#7fd6f0', 34, 0, 30, 14); // Fairy Pools
        c.shape(sh, 0, 0);
    },
    ullapool: (c) => { const sh = new Shape(); water(sh, 90, 30, 0, 22); quay(sh, 90, 6, 0, 4); townRow(sh, -36, -12, 5, [WHITE], SLATE); boat(sh, 22, 26, '#2f6fb0', 1.4); c.shape(sh, 0, 0); },
    melrose: (c) => { LOOKS.abbey(c); const sh = new Shape(); for (const dx of [36, 52])
        sh.box(1.4, 30, 1.4, WHITE, dx, 0, 26); sh.box(17, 1.2, 1.2, WHITE, 44, 9, 26); c.shape(sh, 0, 0); }, // rugby posts
    stornoway: (c) => LOOKS.stones(c),
    lerwick: (c) => { LOOKS.lighthouse(c); const sh = new Shape(); for (const [x, z] of [[-30, 26], [-16, 32]]) {
        sh.box(4, 4, 8, '#7a4a2a', x, 3, z);
        sh.box(3, 4, 3, '#7a4a2a', x, 6, z + 4.5);
        for (const lz of [-3, 3])
            sh.box(1.2, 3, 1.2, '#5a3a1a', x, 0, z + lz);
    } c.shape(sh, 0, 0); }, // Shetland ponies
    armagh: (c) => {
        const sh = new Shape();
        cathedral(sh, 0.7, true);
        sh.cyl(10, 10, 12, WHITE, 44, 0, -16, 14);
        sh.sphere(10, '#c9d3da', 44, 12, -16, 14); // the observatory
        c.shape(sh, -10, 0);
        for (const [x, z] of [[-40, 30], [-20, 34], [0, 32]])
            c.model('nature/tree-fat', x, z, 15, 0, 0, new THREE.Color('#ffd0e0'));
    },
    enniskillen: (c) => { const sh = new Shape(); water(sh, 100, 26, 0, 26); castleShape(sh, 0.6, '#b9b0a0', SLATE, 'none'); c.shape(sh, 0, -4); },
    downpatrick: (c) => { const sh = new Shape(); mound(sh, 52, 3, G.grass); cathedral(sh, 0.75, true); sh.box(14, 7, 4, '#8d918d', 36, 10, 20); c.shape(sh, 0, 0, 0); },
    ballycastle: (c) => {
        const sh = new Shape();
        water(sh, 110, 60, 0, 10);
        sh.box(38, 40, 40, '#8f8a7c', -36, 0, 0);
        sh.box(38, 2, 40, G.grass, -36, 40, 0);
        sh.box(28, 34, 34, '#8f8a7c', 40, 0, 4);
        sh.box(28, 2, 34, G.grass, 40, 34, 4);
        for (let i = 0; i <= 10; i++) {
            const x = -17 + i * 4.2, y = 38 - Math.sin((i / 10) * Math.PI) * 8 - i * 0.4;
            sh.box(4.4, 0.8, 4, '#c9a26a', x, y, 2);
        }
        c.shape(sh, 0, 0);
    },
    newry: (c) => {
        const sh = new Shape();
        sh.add(new THREE.ConeGeometry(40, 50, 7), '#7c9a6a', -18, 25, -10);
        sh.add(new THREE.ConeGeometry(30, 40, 7), '#86a472', 26, 20, -4);
        for (let i = 0; i < 10; i++)
            sh.box(9, 4, 3, '#a39c8c', -50 + i * 9, Math.min(i, 9 - i) * 4, 18);
        c.shape(sh, 0, 0);
    },
    carrickfergus: (c) => {
        const sh = new Shape();
        water(sh, 110, 26, 0, 28);
        sh.box(30, 40, 30, '#b3a98f', 0, 0, -6);
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
            sh.box(6, 44, 6, '#a59b80', dx * 15, 0, -6 + dz * 15);
        sh.box(80, 12, 5, '#a59b80', 0, 0, 14);
        for (const dx of [-40, 40])
            sh.cyl(7, 7.5, 18, '#a59b80', dx, 0, 14, 10);
        c.shape(sh, 0, 0);
    },
};
export const LOOK_MODELS = [
    'pirate/palm-straight', 'pirate/palm-bend', 'car/tractor', 'car/taxi', 'nature/rock-largea', 'nature/tree-pinetalla', 'nature/tree-oak', 'nature/tree-fat', 'nature/tree-default',
    'city/building-skyscraper-a', 'city/building-skyscraper-c', 'city/building-skyscraper-e', 'city/building-g', 'city/detail-parasol-a', 'city/detail-parasol-b', 'cube/animal-cow',
];
//# sourceMappingURL=looks.js.map