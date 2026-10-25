// A famous landmark next to every station, so each place on the board looks different and is easy to remember.
// Built from Kenney kit pieces (CC0) and simple procedural shapes in the same chunky style.
import * as THREE from 'three';
import { board, project } from '../../core/map.js';
import { has, materialFor } from './models.js';
import { Shape } from './shapes.js';
import { heightAt, sdfAt, trackDistAt } from './terrain.js';
export const STONE = '#cfc6b0', STONE_D = '#b3a98f', SLATE = '#56657a', WHITE = '#f6f3ea', GOLD = '#f2c440', RED = '#d83a3a', GLASS = '#8fd3ff', DARK = '#3a3a40', GREEN_D = '#2f7a4e';
// ---------- reusable pieces ----------
/** Season-dependent colours for the baked hills and lawns (studio sets this before each render). */
export const G = { grass: '#6fae55', rock: '#8b8a7c', cap: 0.42, snow: '#f6f8f8' };
export const SEASON_LOOK = {
    su: { grass: '#6fae55', rock: '#8b8a7c', cap: 0.2 }, sp: { grass: '#7dbb5c', rock: '#8b8a7c', cap: 0.38 },
    au: { grass: '#b59a52', rock: '#8a7f6e', cap: 0.26 }, wi: { grass: '#eef3f6', rock: '#c3c9cd', cap: 0.7 },
};
/** A rounded green hill with rocky sides for a castle or cathedral to stand on. */
export function hillBase(sh, r, h, dx = 0, dz = 0) {
    sh.add(new THREE.CylinderGeometry(r * 0.62, r, h, 10), G.rock, dx, h / 2, dz);
    sh.add(new THREE.CylinderGeometry(r * 0.6, r * 0.66, 2, 10), G.grass, dx, h + 1, dz);
}
export function cathedral(sh, s = 1, tower = true) {
    sh.box(56 * s, 22 * s, 22 * s, STONE, 0, 0, 0);
    sh.roof(56 * s, 12 * s, 22 * s, SLATE, 0, 22 * s, 0);
    sh.box(20 * s, 18 * s, 34 * s, STONE, 6 * s, 0, 0); // transept
    sh.roof(20 * s, 10 * s, 34 * s, SLATE, 6 * s, 18 * s, 0, Math.PI / 2);
    if (tower) {
        sh.box(15 * s, 50 * s, 15 * s, STONE_D, -22 * s, 0, 2 * s);
        for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]])
            sh.cone(1.6 * s, 7 * s, STONE_D, -22 * s + dx * s, 50 * s, 2 * s + dz * s, 4);
    }
    for (let i = -2; i <= 2; i++)
        sh.box(3 * s, 9 * s, 0.6 * s, GLASS, i * 9 * s + 4 * s, 8 * s, 11.1 * s);
    sh.cyl(4.5 * s, 4.5 * s, 0.8 * s, '#7fb8e8', -22 * s, 34 * s, 9.6 * s, 12); // rose window
}
export function castleShape(sh, s = 1, wall = STONE_D, roof = '#4a6fb0', kind = 'england') {
    const w = 52 * s, d = 36 * s;
    sh.box(w, 16 * s, 5 * s, wall, 0, 0, d / 2);
    sh.box(w, 16 * s, 5 * s, wall, 0, 0, -d / 2);
    sh.box(5 * s, 16 * s, d, wall, -w / 2, 0, 0);
    sh.box(5 * s, 16 * s, d, wall, w / 2, 0, 0);
    for (let i = -2; i <= 2; i++)
        sh.box(4 * s, 4 * s, 5.5 * s, wall, i * 10 * s, 16 * s, d / 2);
    for (const [tx, tz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        sh.cyl(7 * s, 7.5 * s, 26 * s, wall, tx * w / 2, 0, tz * d / 2, 10);
        sh.cone(8.5 * s, 12 * s, roof, tx * w / 2, 26 * s, tz * d / 2, 10);
    }
    sh.box(18 * s, 34 * s, 18 * s, STONE, 0, 0, -4 * s); // keep
    sh.roof(18 * s, 10 * s, 18 * s, roof, 0, 34 * s, -4 * s);
    sh.box(9 * s, 11 * s, 1 * s, '#5a3a22', 0, 0, d / 2 + 2.6 * s); // gate
    flag(sh, 0, 44 * s, -4 * s, s, kind);
}
/** The right flag for the country: St George's Cross, the Saltire, or the Welsh flag. */
export function flag(sh, x, y, z, s = 1, kind = 'england') {
    if (kind === 'none')
        return;
    sh.cyl(0.6 * s, 0.6 * s, 14 * s, DARK, x, y, z, 6);
    const fx = x + 5.6 * s, fy = y + 8 * s;
    if (kind === 'scotland') {
        sh.box(10 * s, 6 * s, 0.4 * s, '#1f5fbf', fx, fy, z);
        const d = Math.atan2(6, 10);
        sh.add(new THREE.BoxGeometry(11.4 * s, 1.1 * s, 0.5 * s), '#ffffff', fx, fy + 3 * s, z, 0, 0, d);
        sh.add(new THREE.BoxGeometry(11.4 * s, 1.1 * s, 0.5 * s), '#ffffff', fx, fy + 3 * s, z, 0, 0, -d);
    }
    else if (kind === 'wales') {
        sh.box(10 * s, 3 * s, 0.4 * s, '#ffffff', fx, fy + 3 * s, z);
        sh.box(10 * s, 3 * s, 0.4 * s, '#2e9b46', fx, fy, z);
        sh.box(4.5 * s, 3 * s, 0.6 * s, RED, fx, fy + 1.5 * s, z);
    }
    else {
        sh.box(10 * s, 6 * s, 0.4 * s, '#ffffff', fx, fy, z);
        sh.box(10 * s, 1.4 * s, 0.5 * s, RED, fx, fy + 2.3 * s, z);
        sh.box(1.4 * s, 6 * s, 0.5 * s, RED, fx, fy, z);
    }
}
export function house(sh, x, z, wall = WHITE, roof = '#b5523b', s = 1) {
    sh.box(16 * s, 12 * s, 12 * s, wall, x, 0, z);
    sh.roof(17 * s, 7 * s, 13 * s, roof, x, 12 * s, z);
    sh.box(4 * s, 4 * s, 0.4 * s, GLASS, x - 4 * s, 5 * s, z + 6.1 * s);
    sh.box(3.5 * s, 6 * s, 0.4 * s, '#6b4528', x + 4 * s, 0, z + 6.1 * s);
}
export function tudor(sh, x, z) {
    sh.box(20, 14, 13, '#f7f0dc', x, 0, z);
    sh.box(21, 12, 14, '#f7f0dc', x, 14, z + 0.5);
    for (const dx of [-9, -3, 3, 9]) {
        sh.box(1.2, 14, 0.5, '#3b2a1e', x + dx, 0, z + 6.6);
        sh.box(1.2, 12, 0.5, '#3b2a1e', x + dx, 14, z + 7.6);
    }
    sh.box(20, 1.2, 0.5, '#3b2a1e', x, 13.5, z + 6.6);
    sh.roof(22, 9, 15, '#7a5236', x, 26, z + 0.5);
}
export function stonesRing(sh, r, n, h, lintel, color = '#9fa3a0') {
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
        sh.add(new THREE.BoxGeometry(5, h, 3.5), color, x, h / 2, z, -a + Math.PI / 2);
        if (lintel && i % 2 === 0) {
            const a2 = ((i + 1) / n) * Math.PI * 2;
            const mx = (x + Math.cos(a2) * r) / 2, mz = (z + Math.sin(a2) * r * 0.8) / 2;
            sh.add(new THREE.BoxGeometry(12, 3, 4), color, mx, h + 1.5, mz, -(a + a2) / 2 + Math.PI / 2);
        }
    }
}
export function crane(sh, x, z, color = '#f2c230', s = 1) {
    sh.box(4 * s, 50 * s, 4 * s, color, x - 10 * s, 0, z);
    sh.box(4 * s, 50 * s, 4 * s, color, x + 10 * s, 0, z);
    sh.box(30 * s, 5 * s, 6 * s, color, x, 50 * s, z);
    sh.box(3 * s, 1 * s, 3 * s, DARK, x + 4 * s, 34 * s, z);
}
export function chimney(sh, x, z, h, color = '#a0523c') {
    sh.cyl(3.2, 4.2, h, color, x, 0, z, 8);
    sh.cyl(3.8, 3.8, 2, DARK, x, h, z, 8);
}
export function smallTrees(c, pts) { for (const [dx, dz] of pts)
    c.model('nature/tree-default', dx, dz, 18, dx * 0.3); }
export const LANDMARKS = {
    kingscross: (c) => {
        const sh = new Shape();
        sh.box(12, 62, 12, '#d8c27a', 0, 0, 0); // Big Ben
        sh.box(14, 14, 14, '#cdb56a', 0, 62, 0);
        sh.clock4(5.6, 0, 69, 0, 7);
        sh.add(new THREE.ConeGeometry(10, 26, 4), '#3e4f66', 0, 89, 0, Math.PI / 4);
        sh.sphere(1.6, GOLD, 0, 103, 0);
        sh.box(64, 20, 14, '#d8c27a', -40, 0, 8); // Parliament
        sh.roof(64, 7, 14, '#3e4f66', -40, 20, 8);
        for (const dx of [-66, -14]) {
            sh.box(8, 30, 8, '#d8c27a', dx, 0, 8);
            sh.add(new THREE.ConeGeometry(6, 10, 4), '#3e4f66', dx, 35, 8, Math.PI / 4);
        }
        c.shape(sh, 0, 0);
        c.model('city/building-skyscraper-a', 34, -24, 22);
        c.model('city/building-skyscraper-c', 52, -2, 20);
    },
    paddington: (c) => {
        const sh = new Shape();
        for (let i = 0; i < 4; i++)
            house(sh, -27 + i * 18, 0, ['#f2e9d8', '#e9dcc0', '#f4ead6', '#e6d7bb'][i], '#5b6b7a');
        c.shape(sh, 0, 0);
        smallTrees(c, [[-40, 20], [40, 18]]);
        c.model('cube/animal-bunny', 12, 22, 7);
    },
    waterloo: (c) => {
        const ring = new Shape();
        ring.add(new THREE.TorusGeometry(34, 1.3, 6, 48), '#f4f6f8', 0, 0, 0);
        ring.add(new THREE.TorusGeometry(30, 0.7, 6, 48), '#cfd6dc', 0, 0, 0);
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            ring.add(new THREE.BoxGeometry(0.6, 34, 0.6), '#dfe5ea', Math.cos(a) * 17, Math.sin(a) * 17, 0, 0, 0, a + Math.PI / 2);
            ring.add(new THREE.SphereGeometry(2.6, 8, 6), i % 4 === 0 ? '#ff6b6b' : '#bfe6ff', Math.cos(a) * 35, Math.sin(a) * 35, 0);
        }
        ring.cyl(3, 3, 3, '#9aa4ad', 0, -1.5, 0);
        c.anim(ring, 0, 0, 40, (o, t) => { o.rotation.z = t * 0.00008; });
        const legs = new Shape();
        legs.add(new THREE.CylinderGeometry(1.2, 1.6, 44, 6), '#dfe5ea', 6, 20, -6, 0, 0.0, -0.32);
        legs.add(new THREE.CylinderGeometry(1.2, 1.6, 44, 6), '#dfe5ea', 6, 20, 6, 0, 0.0, -0.32);
        c.shape(legs, 0, 0);
    },
    greenwich: (c) => {
        const sh = new Shape();
        sh.box(30, 16, 18, '#c96f4a', 0, 0, 0);
        sh.cyl(9, 9, 6, WHITE, 0, 16, 0, 14);
        sh.sphere(9, '#e7eef2', 0, 22, 0, 14);
        sh.box(1, 30, 1, '#e14b4b', -20, 0, 14); // the Prime Meridian line
        sh.box(1, 0.4, 70, '#e14b4b', -20, 0.2, 0);
        c.shape(sh, 0, -6);
        c.model('pirate/ship-large', 34, 10, 5.5, -0.5);
    },
    oxford: (c) => {
        const sh = new Shape();
        sh.box(56, 18, 20, '#e8d39a', 0, 0, 0);
        for (const dx of [-22, 0, 22]) {
            sh.box(9, 30, 9, '#e3cc8c', dx, 0, 10);
            sh.cone(6, 22, '#d9c07a', dx, 30, 10, 6);
        }
        sh.cyl(10, 10, 10, '#e8d39a', 0, 18, -4, 14);
        sh.sphere(10, '#9aa7a0', 0, 28, -4, 12);
        c.shape(sh, 0, 0);
    },
    cambridge: (c) => {
        const sh = new Shape();
        sh.box(54, 26, 16, '#efe2bd', 0, 0, 0);
        sh.roof(54, 6, 16, '#b8a77d', 0, 26, 0);
        for (const dx of [-27, 27])
            for (const dz of [-8, 8]) {
                sh.box(5, 36, 5, '#efe2bd', dx, 0, dz);
                sh.cone(3.5, 9, '#d8c896', dx, 36, dz, 6);
            }
        for (let i = -3; i <= 3; i++)
            sh.box(4, 16, 0.5, GLASS, i * 7, 6, 8.1);
        c.shape(sh, 0, -6);
        c.model('pirate/boat-row-small', -10, 22, 6, 1.4);
    },
    canterbury: (c) => { const sh = new Shape(); cathedral(sh, 1.05); c.shape(sh, 0, 0); },
    durham: (c) => {
        const sh = new Shape();
        cathedral(sh, 1.1);
        sh.box(26, 18, 18, STONE_D, 44, 0, -14);
        sh.box(4, 6, 19, STONE_D, 44, 18, -14); // the castle next door
        const hill = new Shape();
        hillBase(hill, 62, 22, 8, -4);
        c.shape(hill, 0, 0);
        c.shape(sh, -6, 0, 24);
        c.model('nature/tree-oak', -50, 18, 20, 0, 12);
        c.model('nature/tree-oak', 52, 20, 18, 0, 12);
    },
    york: (c) => {
        const sh = new Shape();
        cathedral(sh, 1.05, false);
        for (const dx of [-22, -10]) {
            sh.box(10, 46, 12, STONE_D, dx - 6, 0, 2);
        }
        sh.box(16, 52, 16, STONE_D, 18, 0, 0);
        c.shape(sh, 0, -4);
    },
    dover: (c) => {
        const sh = new Shape();
        sh.box(80, 26, 14, '#f4f4ee', 0, -8, 20);
        sh.box(70, 8, 12, '#e8e8e0', 4, 18, 18);
        sh.box(80, 1.5, 28, G.grass, 0, 26, 2); // grass on top
        castleShape(sh, 0.55);
        c.shape(sh, 0, 0, 0);
    },
    brighton: (c) => {
        const sh = new Shape();
        sh.box(26, 12, 18, WHITE, 0, 0, 0); // Royal Pavilion
        for (const dx of [-9, 0, 9]) {
            sh.sphere(dx === 0 ? 7 : 4.5, '#f6efe0', dx, 14, 0, 10);
            sh.cone(1.5, 6, '#f6efe0', dx, dx === 0 ? 19 : 17, 0, 6);
        }
        sh.box(70, 3, 9, '#b0835a', 38, 4, 26); // the pier on stilts, running out along the front
        for (let k = 8; k <= 70; k += 9) {
            sh.cyl(0.8, 0.8, 4, '#7a5a3a', k, 0, 22, 5);
            sh.cyl(0.8, 0.8, 4, '#7a5a3a', k, 0, 30, 5);
        }
        sh.box(14, 8, 12, '#f2efe4', 70, 7, 26);
        sh.roof(15, 5, 13, '#d64545', 70, 15, 26); // the pier-end pavilion
        sh.add(new THREE.TorusGeometry(7, 0.6, 5, 24), '#d64545', 52, 17, 26); // the fairground wheel
        c.shape(sh, -10, -6);
        c.model('city/detail-parasol-a', -36, 22, 16);
        c.model('city/detail-parasol-b', -22, 26, 16);
    },
    portsmouth: (c) => {
        const sh = new Shape();
        sh.add(new THREE.CylinderGeometry(1.5, 3.5, 70, 6), WHITE, -10, 35, 0); // Spinnaker Tower
        sh.add(new THREE.TorusGeometry(14, 1.8, 6, 20, Math.PI), WHITE, -2, 40, 0, 0, 0, -Math.PI / 2);
        sh.box(10, 2, 10, '#7a8a99', -10, 54, 0);
        c.shape(sh, 0, 0);
        c.seaModel('pirate/ship-large', 6.5, -0.6);
    },
    bristol: (c) => {
        const sh = new Shape();
        for (const dx of [-30, 30])
            sh.box(8, 34, 10, STONE_D, dx, 0, 0);
        for (let i = 0; i <= 12; i++) {
            const x = -30 + i * 5, y = 34 - Math.sin((i / 12) * Math.PI) * 18;
            sh.box(5.2, 0.8, 1, DARK, x + 2.5, y, -4);
            sh.box(5.2, 0.8, 1, DARK, x + 2.5, y, 4);
            sh.box(0.5, y - 18, 0.5, DARK, x, 18, 4);
        }
        sh.box(64, 2, 12, '#8b8b8b', 0, 17, 0);
        c.shape(sh, 0, 0);
        const balloon = (color, dx, dz, ph) => {
            const b = new Shape();
            b.sphere(9, color, 0, 12, 0, 12);
            b.cone(6.5, 8, color, 0, 2, 0, 12);
            b.box(4, 3.5, 4, '#8a5a36', 0, -4, 0);
            c.anim(b, dx, dz, 46, (o, t) => { o.position.y = c.y + 46 + Math.sin(t / 1400 + ph) * 5; });
        };
        balloon('#ff5a5a', -22, 10, 0);
        balloon('#ffcf3a', 26, -6, 2);
    },
    bath: (c) => {
        const sh = new Shape();
        sh.box(56, 4, 40, '#e9d7a8', 0, 0, 0);
        sh.box(36, 1, 20, '#5fbfb0', 0, 4, 2); // the green Roman bath
        for (let i = -2; i <= 2; i++) {
            sh.cyl(1.6, 1.8, 16, '#efe4c4', i * 10, 4, -12, 8);
            sh.cyl(1.6, 1.8, 16, '#efe4c4', i * 10, 4, 16, 8);
        }
        sh.box(56, 3, 6, '#e9d7a8', 0, 20, -12);
        c.shape(sh, 0, 0);
    },
    salisbury: (c) => {
        const sh = new Shape();
        stonesRing(sh, 26, 14, 14, true);
        stonesRing(sh, 12, 6, 17, true, '#8e928f');
        c.shape(sh, 0, 0);
        c.model('nature/tree-oak', 44, -10, 18);
        c.model('nature/tree-fat', -44, 6, 16);
    },
    exeter: (c) => {
        const sh = new Shape();
        cathedral(sh, 0.8);
        c.shape(sh, -10, -6);
        c.model('cube/animal-cow', 34, 16, 8, -0.6);
        c.model('cube/animal-cow', 46, 4, 8, 0.4);
        c.model('graveyard/hay-bale', 30, -6, 9);
    },
    plymouth: (c) => {
        const sh = new Shape();
        for (let i = 0; i < 5; i++)
            sh.cyl(8 - i * 0.8, 8.4 - i * 0.8, 9, i % 2 ? WHITE : RED, 0, i * 9, 0, 12);
        sh.cyl(4.4, 4.4, 6, GLASS, 0, 45, 0, 10);
        sh.cone(5.2, 6, DARK, 0, 51, 0, 10);
        c.shape(sh, 0, 0);
        c.seaModel('pirate/ship-small', 3.4, 0.3);
        c.seaModel('pirate/boat-row-small', 7, 0.6, 40, 10);
    },
    penzance: (c) => {
        // St Michael's Mount: a castle on a little island
        const sh = new Shape();
        sh.add(new THREE.CylinderGeometry(14, 40, 30, 10), G.grass, 0, 15, 0);
        sh.add(new THREE.CylinderGeometry(42, 46, 3, 10), '#f0dfa0', 0, 0.5, 0);
        const k = new Shape();
        castleShape(k, 0.42);
        if (c.sea) {
            c.seaShape(sh, -1);
            c.seaShape(k, 29);
        }
        else {
            c.shape(sh);
            c.shape(k, 0, 0, 30);
        }
        c.seaModel('pirate/boat-row-small', 6, 1.2, 60, 0);
    },
    birmingham: (c) => {
        c.model('city/building-skyscraper-b', -20, -10, 24);
        c.model('city/building-c', 14, -6, 26);
        c.model('city/building-f', 40, 12, 22);
        const sh = new Shape();
        chimney(sh, -46, 8, 34, '#6b3a8a');
        c.shape(sh, 0, 0);
    },
    stratford: (c) => {
        const sh = new Shape();
        tudor(sh, -14, 0);
        tudor(sh, 12, -4);
        c.shape(sh, 0, 0);
        c.model('nature/tree-oak', 40, 10, 18);
    },
    stoke: (c) => {
        const sh = new Shape();
        for (const [dx, dz, h] of [[-22, 0, 30], [0, -10, 36], [22, 4, 28]]) {
            sh.add(new THREE.SphereGeometry(12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#b9603e', dx, 0, dz);
            sh.add(new THREE.CylinderGeometry(3, 11, h - 8, 12), '#b9603e', dx, (h - 8) / 2 + 6, dz);
            sh.cyl(3.6, 3.6, 2, '#8a4027', dx, h - 2, dz, 10);
        }
        c.shape(sh, 0, 0);
    },
    nottingham: (c) => {
        const sh = new Shape();
        sh.add(new THREE.ConeGeometry(36, 18, 9), '#9c8b6a', 0, 9, 0);
        castleShape(sh, 0.5);
        c.shape(sh, 0, -6);
        c.model('nature/tree-oak', -42, 18, 22);
        c.model('nature/tree-default', 44, 16, 20);
        c.model('nature/tree-oak', 36, -24, 18);
    },
    leicester: (c) => {
        const sh = new Shape();
        sh.box(46, 14, 26, '#cfd8e0', 0, 0, 0);
        sh.add(new THREE.SphereGeometry(13, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#e6eef4', -10, 14, 0);
        sh.cyl(4, 4, 46, WHITE, 18, 0, 6, 12);
        sh.cone(4, 10, RED, 18, 46, 6, 12);
        for (const a of [0, 2.1, 4.2])
            sh.box(1, 9, 6, RED, 18 + Math.cos(a) * 4, 0, 6 + Math.sin(a) * 4, -a);
        sh.box(10, 1, 1, '#ffd84a', 18, 54, 6.5);
        sh.box(1, 1, 1, '#ffd84a', 18, 2, 10.5);
        c.shape(sh, 0, 0);
    },
    liverpool: (c) => {
        const sh = new Shape();
        sh.box(40, 30, 20, '#d9d4c7', 0, 0, 0);
        for (const dx of [-14, 14]) {
            sh.box(10, 16, 10, '#d9d4c7', dx, 30, 0);
            sh.clock(4.5, dx, 38, 5.2);
            sh.sphere(6, '#5f9a83', dx, 48, 0, 10);
            sh.sphere(2.2, '#2d6a5a', dx, 56, 0, 6);
        }
        c.shape(sh, 0, -6);
        c.seaModel('pirate/ship-medium', 4, -0.4);
    },
    manchester: (c) => {
        const sh = new Shape();
        sh.add(new THREE.CylinderGeometry(34, 30, 14, 20, 1, true), '#e8e8ee', 0, 7, 0);
        sh.add(new THREE.CylinderGeometry(26, 26, 1, 20), G.grass, 0, 1, 0);
        sh.add(new THREE.TorusGeometry(32, 1.2, 6, 20), '#c0392b', 0, 14, 0, 0, Math.PI / 2);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            sh.cyl(0.8, 0.8, 26, '#f2c230', Math.cos(a) * 34, 0, Math.sin(a) * 30, 6);
        }
        c.shape(sh, 0, 0);
        c.model('city/building-skyscraper-d', -50, -24, 20);
    },
    blackpool: (c) => {
        const sh = new Shape();
        for (let i = 0; i < 7; i++) {
            const w = 20 - i * 2.6;
            sh.add(new THREE.CylinderGeometry(w * 0.55, w * 0.7, 14, 4, 1, true), '#c0392b', 0, i * 14 + 7, 0, Math.PI / 4);
        }
        sh.box(8, 6, 8, '#c0392b', 0, 98, 0);
        sh.cone(3, 14, '#c0392b', 0, 104, 0, 4);
        sh.box(36, 14, 30, '#e0b06a', 0, 0, 0);
        c.shape(sh, 0, 0);
    },
    windermere: (c) => {
        const sh = new Shape();
        house(sh, -24, -8, '#e5e2da', '#4f5d6e');
        house(sh, -6, -12, '#ece6d6', '#4f5d6e');
        c.shape(sh, 0, 0);
        c.model('pirate/boat-row-small', 18, 18, 7, 0.8);
        c.model('nature/tree-pinetalla', 40, -10, 24);
        c.model('nature/tree-pinetalla', 48, 4, 20);
        const swan = new Shape();
        swan.sphere(3, WHITE, 0, 2, 0, 8);
        swan.cyl(0.8, 0.8, 5, WHITE, 2, 2, 0, 6);
        swan.sphere(1.2, WHITE, 2, 7.5, 0, 6);
        swan.cone(0.6, 1.6, '#f29a2e', 3.2, 7, 0, 5);
        c.animAt(swan, -2.93, 54.36, (o, t, y) => { o.position.y = y + 0.2; o.position.x += Math.sin(t / 3000) * 0.05; });
    },
    leeds: (c) => {
        c.model('city/building-g', -24, -8, 26);
        c.model('city/building-skyscraper-e', 10, -14, 22);
        const sh = new Shape();
        sh.box(30, 14, 16, '#c7a46b', 34, 0, 10);
        sh.roof(30, 6, 16, '#5f6f84', 34, 14, 10);
        c.shape(sh, 0, 0);
    },
    sheffield: (c) => {
        const sh = new Shape();
        sh.box(50, 18, 24, '#7f8c99', 0, 0, 0);
        sh.roof(50, 8, 24, '#4e5964', 0, 18, 0);
        for (const dx of [-16, 0, 16])
            chimney(sh, dx, -8, 44, '#8a5040');
        sh.box(10, 3, 0.6, '#ff8a2a', -12, 4, 12.2);
        sh.box(10, 3, 0.6, '#ff8a2a', 12, 4, 12.2);
        c.shape(sh, 0, 0);
    },
    newcastle: (c) => {
        const sh = new Shape();
        sh.box(4, 40, 3, '#a8562e', -26, 0, 0); // Angel of the North
        sh.box(42, 5, 2, '#a8562e', -26, 30, 0, 0);
        sh.sphere(2.6, '#a8562e', -26, 42, 0, 6);
        for (let i = 0; i <= 12; i++) {
            const a = (i / 12) * Math.PI;
            sh.box(4, 1.6, 2, '#3f8f5e', 10 + Math.cos(Math.PI - a) * 24 + 12, Math.sin(a) * 26, 6);
        } // Tyne Bridge arch
        sh.box(56, 2, 10, '#6c7a86', 22, 12, 6);
        c.shape(sh, 0, 0);
    },
    carlisle: (c) => {
        const sh = new Shape();
        for (let i = 0; i < 9; i++) {
            const x = -60 + i * 15, z = Math.sin(i * 0.8) * 6;
            sh.box(15.5, 7, 5, '#a9a296', x, 0, z, 0);
            if (i === 4) {
                sh.box(14, 14, 12, '#a9a296', x, 0, z);
            }
        }
        castleShape(sh, 0.4, '#b06a54', '#7a4030');
        c.shape(sh, 0, -10);
    },
    cardiff: (c) => {
        const sh = new Shape();
        castleShape(sh, 0.62, STONE_D, '#4a6fb0', 'wales');
        sh.add(new THREE.CylinderGeometry(24, 22, 12, 16, 1, true), '#e8e8ee', 54, 6, 10); // stadium
        sh.cyl(18, 18, 1, G.grass, 54, 0.5, 10, 16);
        for (const a of [0, 1.57, 3.14, 4.71])
            sh.cyl(0.8, 0.8, 26, WHITE, 54 + Math.cos(a) * 24, 0, 10 + Math.sin(a) * 22, 6);
        c.shape(sh, -12, 0);
        const dragon = new Shape();
        dragon.box(16, 5, 0.4, WHITE, 0, 0, 0);
        dragon.box(16, 5, 0.4, '#2e9b46', 0, -5, 0);
        dragon.box(7, 4, 0.6, RED, 0, -3.5, 0.1);
        dragon.cyl(0.5, 0.5, 18, DARK, -8, -14, 0, 6);
        c.anim(dragon, 30, -24, 36, (o, t) => { o.rotation.y = Math.sin(t / 700) * 0.15; });
    },
    swansea: (c) => {
        const sh = new Shape();
        house(sh, -24, -14, '#f2c6d0', '#4f5d6e');
        house(sh, -6, -14, '#cde7f2', '#4f5d6e');
        house(sh, 12, -14, '#fff1b8', '#4f5d6e');
        c.shape(sh, 0, 0);
        c.model('city/detail-parasol-a', 28, 16, 16);
        c.seaModel('pirate/boat-row-small', 6, 1);
    },
    aberystwyth: (c) => {
        const sh = new Shape();
        for (let i = 0; i < 5; i++)
            house(sh, -36 + i * 17, -8, ['#f2c6d0', '#cde7f2', '#fff1b8', '#d7f0c8', '#f6dcc0'][i], '#556677');
        c.shape(sh, 0, 0);
    },
    llanberis: (c) => mountain(c, 70, 52, true),
    fortwilliam: (c) => mountain(c, 86, 60, true),
    bangor: (c) => {
        const sh = new Shape();
        for (const dx of [-34, 34]) {
            sh.box(9, 36, 9, STONE, dx, 0, 0);
            sh.box(9, 6, 2, STONE, dx, 30, 0);
        }
        for (let i = 0; i <= 16; i++) {
            const x = -34 + i * (68 / 16), y = 34 - Math.sin((i / 16) * Math.PI) * 16;
            sh.box(4.4, 0.8, 1, DARK, x + 2, y, -4);
            sh.box(4.4, 0.8, 1, DARK, x + 2, y, 4);
        }
        sh.box(90, 2, 10, '#8b8b8b', 0, 16, 0);
        c.shape(sh, 0, 0);
    },
    conwy: (c) => { const sh = new Shape(); castleShape(sh, 0.85, '#a8a196', '#6d6a63', 'wales'); c.shape(sh, 0, 0); },
    edinburgh: (c) => {
        const sh = new Shape();
        sh.add(new THREE.CylinderGeometry(22, 40, 26, 9), G.rock, 0, 13, 0);
        sh.add(new THREE.CylinderGeometry(20, 22, 2, 9), G.grass, 0, 27, 0);
        const c2 = new Shape();
        castleShape(c2, 0.62, '#a9a08e', '#5b6b7a', 'scotland');
        c.shape(sh, 0, 0);
        c.shape(c2, 0, 0, 27);
    },
    glasgow: (c) => {
        const sh = new Shape();
        crane(sh, -20, 0, '#2a2a2a', 1);
        sh.box(40, 30, 16, '#c9c2b0', 26, 0, -10);
        sh.box(1, 1, 1, GLASS, 0, 0, 0);
        c.shape(sh, 0, 0);
        c.seaModel('pirate/ship-medium', 4.5, -0.3);
    },
    stirling: (c) => {
        const sh = new Shape();
        sh.add(new THREE.ConeGeometry(30, 22, 9), G.grass, 0, 11, 0);
        sh.box(10, 46, 10, '#9a937f', 0, 22, 0);
        sh.add(new THREE.ConeGeometry(8, 12, 4), '#9a937f', 0, 74, 0, Math.PI / 4);
        c.shape(sh, -8, -8);
        // Highland cows are shaggy and ginger
        c.model('cube/animal-cow', 30, 16, 9, -0.4, 0, new THREE.Color('#e08a4a'));
        c.model('cube/animal-cow', 44, 4, 8, 0.6, 0, new THREE.Color('#d0783a'));
    },
    standrews: (c) => {
        const sh = new Shape();
        sh.add(new THREE.CylinderGeometry(30, 32, 1.2, 18), G.grass, 0, 0.6, 0);
        sh.cyl(0.4, 0.4, 14, WHITE, 6, 1, 2, 6);
        sh.box(7, 4, 0.4, '#ff3b3b', 9.5, 11, 2);
        sh.cyl(1.4, 1.4, 0.4, '#222', 6, 1.2, 2, 8);
        sh.box(10, 16, 6, '#b5ab98', -36, 0, -10);
        sh.box(6, 22, 6, '#b5ab98', -26, 0, -12); // ruined cathedral
        c.shape(sh, 0, 0);
    },
    aberdeen: (c) => {
        const sh = new Shape();
        for (const dx of [-12, 12])
            for (const dz of [-10, 10])
                sh.cyl(2.2, 2.6, 30, '#f2c230', dx, -6, dz, 6);
        sh.box(36, 6, 30, '#9aa3ab', 0, 24, 0);
        sh.box(10, 34, 10, '#c0392b', -10, 30, -6);
        sh.box(26, 4, 4, '#f2c230', 6, 52, -6);
        sh.cyl(1.4, 1.4, 6, '#ff9a2a', 18, 64, -6, 6);
        if (c.sea)
            c.seaShape(sh, 0);
        else
            c.shape(sh);
        const town = new Shape();
        house(town, -10, 0, '#c9c9c9', '#55606b');
        house(town, 10, -6, '#d4d4d0', '#55606b');
        c.shape(town);
    },
    inverness: (c) => {
        const sh = new Shape();
        const ih = new Shape();
        hillBase(ih, 46, 16, 0, 0);
        c.shape(ih, -20, -12);
        castleShape(sh, 0.45, '#c98a6a', '#7a4a3a', 'scotland');
        c.shape(sh, -20, -12, 18);
        const nessie = new Shape();
        nessie.sphere(5, '#3f9a6a', 0, 0, 0, 8);
        nessie.sphere(4, '#3f9a6a', 10, 0, 0, 8);
        nessie.sphere(3, '#3f9a6a', 18, 0, 0, 8);
        nessie.cyl(2, 2.4, 12, '#3f9a6a', -6, 0, 0, 8);
        nessie.sphere(3, '#3f9a6a', -7, 13, 0, 8);
        nessie.sphere(0.8, '#ffffff', -8.5, 14, 2.4, 6);
        nessie.sphere(0.4, '#111', -8.8, 14, 3.1, 4);
        c.animAt(nessie, -4.42, 57.26, (o, t, y) => { o.position.y = y - 1.5 + Math.sin(t / 900) * 1.8; });
    },
    kirkwall: (c) => {
        const sh = new Shape();
        stonesRing(sh, 30, 16, 16, false, '#8d918d');
        c.shape(sh, 0, 0);
    },
    belfast: (c) => {
        const sh = new Shape();
        for (let i = 0; i < 4; i++)
            sh.add(new THREE.BoxGeometry(14, 38, 26), '#b9c6cf', -18 + i * 12, 19, 0, i * 0.06, 0, (i % 2 ? 1 : -1) * 0.1);
        crane(sh, 40, -8, '#f2c230', 0.8);
        crane(sh, 62, 4, '#f2c230', 0.8);
        c.shape(sh, -10, 0);
    },
    derry: (c) => {
        const sh = new Shape();
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.78;
            sh.box(46, 10, 6, '#9a917e', Math.cos(a) * 20, 0, Math.sin(a) * 16, -a + Math.PI / 2);
        }
        house(sh, -6, -2, '#efe3c8', '#5b6b7a');
        house(sh, 10, 4, '#f6dcc0', '#5b6b7a');
        c.shape(sh, 0, 0);
    },
    portrush: (c) => {
        const sh = new Shape();
        for (let i = 0; i < 40; i++) {
            const x = (i % 8) * 8 - 28 + (Math.floor(i / 8) % 2) * 4, z = Math.floor(i / 8) * 7 - 10, h = 4 + ((i * 37) % 11) + (4 - Math.floor(i / 8)) * 2;
            sh.add(new THREE.CylinderGeometry(4.2, 4.2, h, 6), i % 3 ? '#5a5d63' : '#4a4d53', x, h / 2, z);
        }
        c.shape(sh, 0, 0);
    },
};
export function mountain(c, h, r, railway) {
    const sh = new Shape();
    sh.add(new THREE.ConeGeometry(r, h, 7), G.rock, 0, h / 2, 0);
    sh.add(new THREE.ConeGeometry(r * G.cap, h * G.cap, 7), G.snow, 0, h * (1 - G.cap / 2) + 0.4, 0);
    sh.add(new THREE.ConeGeometry(r * 0.85, h * 0.35, 7), G.grass, 0, h * 0.175, 0, 0.3);
    if (railway)
        for (let i = 0; i < 10; i++) {
            const a = -0.6 + i * 0.12;
            sh.box(3, 1, 3, '#5a4a3a', Math.cos(a) * r * (1 - i / 11) * 0.9, h * i / 11, Math.sin(a) * r * 0.4 + r * 0.5 * (1 - i / 11));
        }
    c.shape(sh, 0, -10);
    c.model('nature/tree-pinetalla', r + 4, 10, 22);
    c.model('nature/tree-pinetalla', -r - 4, 14, 20);
}
/** The models every builder above may use. */
export const LANDMARK_MODELS = [
    'city/building-skyscraper-a', 'city/building-skyscraper-b', 'city/building-skyscraper-c', 'city/building-skyscraper-d', 'city/building-skyscraper-e',
    'city/building-c', 'city/building-f', 'city/building-g', 'city/detail-parasol-a', 'city/detail-parasol-b',
    'pirate/ship-large', 'pirate/ship-medium', 'pirate/ship-small', 'pirate/boat-row-small',
    'cube/animal-cow', 'cube/animal-bunny', 'graveyard/hay-bale',
    'nature/tree-default', 'nature/tree-oak', 'nature/tree-fat', 'nature/tree-pinetalla',
];
/** Picks a clear spot next to each station (away from the track and its name sign) and builds its landmark. */
export function buildLandmarks(b, anims, group) {
    const spots = [];
    const vc = materialFor('vc');
    for (const n of board.nodes) {
        if (!n.stationId)
            continue;
        const build = LANDMARKS[n.stationId];
        if (!build)
            continue;
        const lab = n.label ?? { dx: 0, dy: 52 };
        let best = { x: n.x, z: n.y - 90 }, bestScore = -Infinity;
        for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2;
            for (const dist of [84, 104, 128, 156]) {
                const x = n.x + Math.cos(a) * dist, z = n.y + Math.sin(a) * dist * 0.9;
                let clear = 99;
                for (let k2 = 0; k2 < 8; k2++) {
                    const b2 = (k2 / 8) * Math.PI * 2;
                    clear = Math.min(clear, trackDistAt(x + Math.cos(b2) * 30, z + Math.sin(b2) * 24));
                }
                let score = Math.min(clear, 50) * 2.5 - dist * 0.25;
                score -= Math.max(0, 30 - sdfAt(x, z)) * 2; // stay on land
                if (Math.abs(x - (n.x + lab.dx)) < 80 && Math.abs(z - (n.y + lab.dy)) < 44)
                    score -= 80; // keep the sign clear
                if (z > n.y + 20)
                    score -= 25; // prefer behind the station (up the screen)
                for (const m of board.nodes)
                    if (m.stationId && m !== n && Math.hypot(m.x - x, m.y - z) < 110)
                        score -= 60;
                for (const s of spots)
                    if (Math.hypot(s.x - x, s.z - z) < 110)
                        score -= 60;
                if (score > bestScore) {
                    bestScore = score;
                    best = { x, z };
                }
            }
        }
        // find the nearest open sea for builders that put things in the water
        let sea = null, seaD = Infinity;
        for (let k = 0; k < 24; k++) {
            const a = (k / 24) * Math.PI * 2;
            for (let d = 60; d < 320; d += 15) {
                const x = n.x + Math.cos(a) * d, z = n.y + Math.sin(a) * d;
                if (sdfAt(x, z) < -26) {
                    if (d < seaD && !nearFerry(x, z)) {
                        seaD = d;
                        sea = { x, z };
                    }
                    break;
                }
            }
        }
        const y = Math.max(heightAt(best.x, best.z), heightAt(best.x - 20, best.z), heightAt(best.x + 20, best.z)) - 1;
        const c = {
            b, anims, x: best.x, z: best.z, y, sea,
            seaModel: (path, sc, ry = 0, ox = 0, oz = 0) => { if (sea && has(path))
                b.addModel(path, sea.x + ox, -0.6, sea.z + oz, ry, sc); },
            seaShape: (sh, dy = 0) => { if (sea)
                b.addGeo(sh.geometry(), new THREE.Matrix4().makeTranslation(sea.x, dy, sea.z)); },
            animAt: (sh, lon, lat, update) => {
                const p = project(lon, lat);
                const m = new THREE.Mesh(sh.geometry(), vc);
                const gy = heightAt(p.x, p.y);
                m.position.set(p.x, gy, p.y);
                group.add(m);
                anims.push({ obj: m, update: (t) => update(m, t, gy) });
            },
            model: (path, dx, dz, s = 24, ry = 0, dy = 0, tint) => {
                if (!has(path))
                    return;
                b.addModel(path, best.x + dx, heightAt(best.x + dx, best.z + dz) - 0.5 + dy, best.z + dz, ry, s, tint);
            },
            shape: (sh, dx = 0, dz = 0, dy = 0) => b.addGeo(sh.geometry(), new THREE.Matrix4().makeTranslation(best.x + dx, y + dy, best.z + dz)),
            anim: (sh, dx, dz, dy, update) => {
                const m = new THREE.Mesh(sh.geometry(), vc);
                m.position.set(best.x + dx, y + dy, best.z + dz);
                m.castShadow = true;
                group.add(m);
                anims.push({ obj: m, update: (t) => update(m, t) });
            },
        };
        build(c);
        spots.push({ x: best.x, z: best.z, r: 60 });
    }
    return spots;
}
function nearFerry(x, z) {
    for (const e of board.edges)
        if (e.sea)
            for (const p of e.pts)
                if (Math.hypot(p.x - x, p.y - z) < 50)
                    return true;
    return false;
}
//# sourceMappingURL=landmarks.js.map