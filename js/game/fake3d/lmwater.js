/** Open water that belongs to a landmark (the Thames beside the London Eye, the Channel below Dover's cliffs), in sprite units:
 *  [x, z, w, d, round] per rectangle. The sprites leave it out and the ground paints it, so it joins the real sea. */
export const lmWater = {};
export const LM_SCALE = 1.3 / 100; // landmark sprite units -> cells
export async function loadLmWater(base) {
    try {
        Object.assign(lmWater, await (await fetch(base + 'lmwater.json', { cache: 'no-cache' })).json());
    }
    catch { /* optional */ }
}
//# sourceMappingURL=lmwater.js.map