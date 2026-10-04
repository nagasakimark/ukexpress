// Pictures for places, heroes and events: assets/images/<kind>/<name>.png (see assets/images/README.md for every file name).
// Extra photos are picked up automatically: <name>2.png … <name>7.png (e.g. birmingham2.png) form a browsable
// gallery and one of them is shown first, at random.
// A missing file never breaks the game: a coloured card with the emoji and name is drawn instead.
import { C, FONT, roundRect, emoji, shade } from '../engine/draw.js';
const cache = new Map();
const BASE = 'assets/images/';
export function picUrl(kind, name) { return `${BASE}${kind}/${name}.png`; }
/** Starts loading the picture if needed and reports what is known right now. */
export function picStatus(kind, name) {
    getPic(kind, name);
    const c = cache.get(kind + '/' + name);
    return c === 'loading' || c === undefined ? 'loading' : c ? 'ok' : 'missing';
}
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
/** How many numbered variants are probed after the base picture: <name>2.png … <name>7.png. */
export const MAX_PHOTOS = 7;
const galleries = new Map();
/** Every file name to try for one picture: the base name plus numbered extras. Probing starts on first use. */
export function galleryOf(kind, base) {
    const key = kind + '/' + base;
    let g = galleries.get(key);
    if (!g) {
        const cands = [base];
        for (let i = 2; i <= MAX_PHOTOS; i++)
            cands.push(base + i);
        g = { kind, base, cands };
        galleries.set(key, g);
        for (const nm of cands)
            picStatus(kind, nm);
    }
    return g;
}
/** Variant names confirmed to exist so far, in order. Grows as files finish loading. */
export function galleryNames(g) {
    return g.cands.filter((nm) => picStatus(g.kind, nm) === 'ok');
}
/** True once every candidate has answered (found or missing): the list is final. */
export function gallerySettled(g) {
    return g.cands.every((nm) => picStatus(g.kind, nm) !== 'loading');
}
/** One modal's position inside a shared gallery: a random photo is shown first, then the player's choice. */
export class PhotoBrowser {
    constructor(kind, base) {
        this.sel = 0;
        this.locked = false;
        this.gallery = galleryOf(kind, base);
    }
    /** Photos confirmed to exist so far. */
    count() { return galleryNames(this.gallery).length; }
    settled() { return gallerySettled(this.gallery); }
    index() {
        const n = this.count();
        if (!n)
            return 0;
        if (this.sel >= n)
            this.sel = n - 1;
        return this.sel;
    }
    /** The variant to draw now (falls back to the base name while nothing has loaded yet). */
    name() {
        const names = galleryNames(this.gallery);
        if (!names.length)
            return this.gallery.base;
        if (!this.locked && gallerySettled(this.gallery)) {
            this.sel = Math.floor(Math.random() * names.length);
            this.locked = true;
        }
        return names[this.index()];
    }
    step(d) {
        const n = this.count();
        if (n < 2)
            return;
        this.sel = (((this.sel + d) % n) + n) % n;
        this.locked = true;
    }
}
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