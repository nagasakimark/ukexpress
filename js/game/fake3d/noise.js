// Deterministic noise shared by the ground painter and the scenery planner, so fields and forests line up.
export function hash(x, y, k = 0) { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const s = (t) => t * t * (3 - 2 * t);
    const a = hash(xi, yi, 3), b = hash(xi + 1, yi, 3), c = hash(xi, yi + 1, 3), d = hash(xi + 1, yi + 1, 3);
    return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}
export function fbm(x, y) { return vnoise(x, y) * 0.6 + vnoise(x * 2.1 + 5, y * 2.1 + 9) * 0.3 + vnoise(x * 4.3 + 1, y * 4.3 + 3) * 0.1; }
/** What grows on a piece of countryside: thick forest, a few trees, or a patchwork of fields with hedges. */
export function landUse(x, y) {
    const f = fbm(x * 0.3, y * 0.3);
    return f > 0.5 ? 'forest' : f > 0.44 ? 'edge' : f > 0.36 ? 'meadow' : 'field';
}
//# sourceMappingURL=noise.js.map