// Pictures for places, heroes and events: assets/images/<kind>/<name>.png (see assets/images/README.md for every file name).
// A missing file never breaks the game: a coloured card with the emoji and name is drawn instead.
import { C, FONT, roundRect, emoji, shade } from '../engine/draw.js';
const cache = new Map();
const BASE = 'assets/images/';
export function picUrl(kind, name) { return `${BASE}${kind}/${name}.png`; }
/** The loaded picture, or null while loading or when the file does not exist. */
export function getPic(kind, name) {
    const key = kind + '/' + name;
    const c = cache.get(key);
    if (c === undefined) {
        cache.set(key, 'loading');
        const img = new Image();
        img.onload = () => cache.set(key, img);
        img.onerror = () => cache.set(key, null);
        img.src = picUrl(kind, name);
        return null;
    }
    return c === 'loading' ? null : c;
}
/** Loads pictures ahead of time. Resolves when all are loaded or failed (or after `timeout` ms), so a scene never draws half-loaded art. */
export function preload(kind, names, timeout = 6000) {
    const done = Promise.all(names.map((n) => new Promise((res) => {
        const key = kind + '/' + n;
        const c = cache.get(key);
        if (c !== undefined && c !== 'loading') {
            res();
            return;
        }
        const img = new Image();
        img.onload = () => { cache.set(key, img); res(); };
        img.onerror = () => { cache.set(key, null); res(); };
        cache.set(key, 'loading');
        img.src = picUrl(kind, n);
    }))).then(() => undefined);
    return Promise.race([done, new Promise((res) => setTimeout(res, timeout))]);
}
export const PRESENTER_PICS = ['studio', 'news', 'mark_happy', 'mark_excited', 'mark_surprised', 'mark_sad', 'mark_point'];
/** Draws a picture to fill the box (cropped to fit), with rounded corners and a frame. */
export function drawPic(ctx, kind, name, x, y, w, h, o = {}) {
    const r = o.radius ?? 14;
    ctx.fillStyle = '#20170a';
    roundRect(ctx, x - 5, y - 5, w + 10, h + 10, r + 4);
    ctx.fill();
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    const img = getPic(kind, name);
    if (img && img.naturalWidth) {
        const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const sw = w / k, sh = h / k;
        ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
    }
    else {
        const col = o.color ?? '#5f7d6a';
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, shade(col, 0.25));
        g.addColorStop(1, shade(col, -0.2));
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        if (o.emoji)
            emoji(ctx, o.emoji, x + w / 2, y + h * 0.42, Math.min(w, h) * 0.38);
        if (o.label) {
            ctx.font = `800 ${Math.max(14, Math.min(26, w / 12))}px ${FONT}`;
            ctx.fillStyle = C.cream;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(o.label, x + w / 2, y + h * 0.82, w - 20);
        }
    }
    ctx.restore();
}
/** The picture shown whole (not cropped) inside the box. */
export function drawPicWhole(ctx, kind, name, x, y, w, h, o = {}) {
    const img = getPic(kind, name);
    if (!img || !img.naturalWidth) {
        drawPic(ctx, kind, name, x, y, w, h, o);
        return;
    }
    const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    drawPic(ctx, kind, name, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, o);
}
//# sourceMappingURL=images.js.map