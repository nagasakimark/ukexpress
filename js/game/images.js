// Pictures for places, heroes and events: assets/images/<kind>/<name>.png (see assets/images/README.md for every file name).
// Extra photos are picked up automatically: <name>2.png … <name>7.png (e.g. birmingham2.png) form a browsable
// gallery and one of them is shown first, at random.
// A missing file never breaks the game: a coloured card with the emoji and name is drawn instead.
import { C, FONT, roundRect, emoji, shade } from '../engine/draw.js';
const cache = new Map();
/** When each big photo finished loading (for the fade from its preview). */
const loadedAt = new Map();
const BASE = 'assets/images/';
/** Web-size copies (tools/make_display.py) are what loads; the PNG masters stay in the source folder. The presenter art keeps its PNGs. */
export function picUrl(kind, name) { return `${BASE}${kind}/${name}.${kind === 'presenter' ? 'png' : 'webp'}`; }
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
        picVer++;
        const img = new Image();
        img.onload = () => { cache.set(key, img); loadedAt.set(key, performance.now()); picVer++; };
        img.onerror = () => { cache.set(key, null); picVer++; };
        img.src = picUrl(kind, name);
        return null;
    }
    return c === 'loading' ? null : c;
}
/** The best picture available right now: the big photo if it is loaded, else its small preview. The big photo's
 * download only starts once the preview has arrived, so the two never fight over a slow connection. */
export function peekPic(kind, name) {
    const key = kind + '/' + name;
    let th = null, thWait = false;
    if (hasThumb(kind, name)) {
        th = getThumb(kind, name);
        thWait = !th && thumbCache.get(key) !== null;
    }
    const c = cache.get(key);
    if (c && c !== 'loading' && c.naturalWidth)
        return { img: c, thumb: th, full: true };
    if (!thWait)
        getPic(kind, name);
    return { img: th && th.naturalWidth ? th : null, thumb: th, full: false };
}
// ---- reading ahead: fetch the big photos of places the train is heading for, two at a time ----
const aheadQueue = [];
const aheadSeen = new Set();
let aheadBusy = 0;
function pumpAhead() {
    while (aheadBusy < 2 && aheadQueue.length) {
        const [kind, name] = aheadQueue.shift();
        const key = kind + '/' + name;
        if (cache.has(key))
            continue;
        aheadBusy++;
        cache.set(key, 'loading');
        const img = new Image();
        const done = (ok) => { cache.set(key, ok ? img : null); if (ok) {
            loadedAt.set(key, performance.now() - 1000);
            picVer++;
        } aheadBusy--; pumpAhead(); };
        img.onload = () => done(true);
        img.onerror = () => done(false);
        img.src = picUrl(kind, name);
    }
}
/** Quietly loads the big photos of a station (its first photo before the others). Call as the train gets close. */
export function prefetchPlace(sid, all = false) {
    const g = galleryOf('places', sid);
    const names = all ? g.cands : g.cands.slice(0, 1);
    for (const n of names) {
        const key = 'places/' + n;
        if (aheadSeen.has(key))
            continue;
        aheadSeen.add(key);
        if (!cache.has(key))
            aheadQueue.push(['places', n]);
    }
    pumpAhead();
}
/** Bumps every time a picture finishes loading (or fails), so cached screens can repaint. */
let picVer = 0;
export function picVersion() { return picVer; }
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
        img.onload = () => { cache.set(key, img); loadedAt.set(key, performance.now() - 1000); picVer++; res(); };
        img.onerror = () => { cache.set(key, null); picVer++; res(); };
        cache.set(key, 'loading');
        img.src = picUrl(kind, n);
    }))).then(() => undefined);
    return Promise.race([done, new Promise((res) => setTimeout(res, timeout))]);
}
export const PRESENTER_PICS = ['studio', 'news', 'mark_happy', 'mark_excited', 'mark_surprised', 'mark_sad', 'mark_point'];
// ---- small preview copies (assets/images/thumbs/<kind>/<name>.webp, made by tools/make_thumbs.py) ----
// A full photo is a 1 MB+ PNG, so on school Wi-Fi it can take seconds. The ~20 KB previews load almost at
// once, are all fetched quietly in the background after start-up, and are what the side panel shows.
let thumbIndex = null;
const thumbCache = new Map();
const thumbUrl = (kind, name) => `${BASE}thumbs/${kind}/${name}.webp`;
/** Loads the list of existing photos (tiny JSON). Safe to call more than once; never throws. */
export async function loadThumbIndex() {
    if (thumbIndex)
        return;
    try {
        const r = await fetch(`${BASE}thumbs/index.json`);
        if (!r.ok)
            return;
        const j = await r.json();
        const m = {};
        for (const k of Object.keys(j))
            m[k] = new Set(j[k]);
        thumbIndex = m;
        galleries.clear(); // any gallery built before the list arrived is rebuilt from it
    }
    catch { /* no index: fall back to probing for numbered photos */ }
}
const hasThumb = (kind, name) => !!thumbIndex?.[kind]?.has(name);
/** The preview picture if it is loaded; starts loading it otherwise. */
export function getThumb(kind, name) {
    if (!hasThumb(kind, name))
        return null;
    const key = kind + '/' + name;
    const c = thumbCache.get(key);
    if (c === undefined) {
        thumbCache.set(key, 'loading');
        const img = new Image();
        img.onload = () => { thumbCache.set(key, img); picVer++; };
        img.onerror = () => { thumbCache.set(key, null); };
        img.src = thumbUrl(kind, name);
        return null;
    }
    return c === 'loading' ? null : c;
}
/** Loads the previews for these names (resolves when done or after `timeout` ms). */
export function preloadThumbs(kind, names, timeout = 1500) {
    const done = Promise.all(names.map((n) => new Promise((res) => {
        if (!hasThumb(kind, n)) {
            res();
            return;
        }
        const key = kind + '/' + n, c = thumbCache.get(key);
        if (c !== undefined && c !== 'loading') {
            res();
            return;
        }
        const img = new Image();
        img.onload = () => { thumbCache.set(key, img); picVer++; res(); };
        img.onerror = () => { thumbCache.set(key, null); res(); };
        thumbCache.set(key, 'loading');
        img.src = thumbUrl(kind, n);
    }))).then(() => undefined);
    return Promise.race([done, new Promise((res) => setTimeout(res, timeout))]);
}
/** Quietly fetches every preview a few at a time, base photos first. Call once, after the game is up. */
export function warmThumbs(kind = 'places', concurrency = 4) {
    const all = [...(thumbIndex?.[kind] ?? [])];
    all.sort((a, b) => Number(/\d$/.test(a)) - Number(/\d$/.test(b)));
    let i = 0;
    const next = () => {
        if (i >= all.length)
            return;
        const nm = all[i++], key = kind + '/' + nm;
        if (thumbCache.has(key)) {
            next();
            return;
        }
        thumbCache.set(key, 'loading');
        const img = new Image();
        const done = (ok) => { thumbCache.set(key, ok ? img : null); if (ok)
            picVer++; setTimeout(next, 0); };
        img.onload = () => done(true);
        img.onerror = () => done(false);
        img.src = thumbUrl(kind, nm);
    };
    for (let k = 0; k < concurrency; k++)
        next();
}
/** How many numbered variants are probed after the base picture: <name>2.png … <name>7.png. */
export const MAX_PHOTOS = 7;
const galleries = new Map();
/** Every file name to try for one picture: the base name plus numbered extras. With the index the list is
 * exact (no probing); without it, probing starts on first use. */
export function galleryOf(kind, base) {
    const key = kind + '/' + base;
    let g = galleries.get(key);
    if (!g) {
        const idx = thumbIndex?.[kind];
        const cands = [base];
        for (let i = 2; i <= MAX_PHOTOS; i++)
            cands.push(base + i);
        if (idx) {
            g = { kind, base, cands: cands.filter((nm) => idx.has(nm)), known: true };
            if (!g.cands.length)
                g.cands = [base];
        }
        else {
            g = { kind, base, cands, known: false };
            for (const nm of cands)
                picStatus(kind, nm);
        }
        galleries.set(key, g);
    }
    return g;
}
/** Variant names confirmed to exist so far, in order. Grows as files finish loading. */
export function galleryNames(g) {
    return g.known ? g.cands : g.cands.filter((nm) => picStatus(g.kind, nm) === 'ok');
}
/** True once every candidate has answered (found or missing): the list is final. */
export function gallerySettled(g) {
    return g.known || g.cands.every((nm) => picStatus(g.kind, nm) !== 'loading');
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
/** Draws a picture so it fills the box (the photo is cropped a little rather than letterboxed, so there are
 * never black bars), with rounded corners and a frame. While the big photo is still loading, its small preview
 * is drawn instead. */
export function drawPic(ctx, kind, name, x, y, w, h, o = {}) {
    const r = o.radius ?? 14;
    ctx.fillStyle = '#20170a';
    roundRect(ctx, x - 5, y - 5, w + 10, h + 10, r + 4);
    ctx.fill();
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    let img = null, under = null, fade = 1;
    if (o.thumb) {
        const c = cache.get(kind + '/' + name);
        img = (c && c !== 'loading') ? c : getThumb(kind, name);
        if (!img && !hasThumb(kind, name))
            img = getPic(kind, name);
    }
    else {
        const pk = peekPic(kind, name);
        img = pk.img;
        if (pk.full && pk.thumb && pk.thumb.naturalWidth) { // the big photo fades in over its preview: same crop, so nothing moves
            const t = performance.now() - (loadedAt.get(kind + '/' + name) ?? 0);
            if (t < 350) {
                under = pk.thumb;
                fade = t / 350;
            }
        }
    }
    if (img && img.naturalWidth) {
        ctx.fillStyle = '#22271f';
        ctx.fillRect(x, y, w, h);
        // fill the box; keep the upper-middle of tall photos (sky, faces, towers) rather than dead centre
        const cover = (im) => {
            const k = Math.max(w / im.naturalWidth, h / im.naturalHeight);
            const sw = w / k, sh = h / k;
            ctx.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) * 0.4, sw, sh, x, y, w, h);
        };
        if (under) {
            cover(under);
            ctx.globalAlpha = fade;
            cover(img);
            ctx.globalAlpha = 1;
        }
        else
            cover(img);
    }
    else if (!o.bare) {
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
    else {
        const col = o.color ?? '#5f7d6a';
        ctx.fillStyle = shade(col, -0.1);
        ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
}
/** Draws a photo clipped in a circle (for hero portraits): a square taken from the
 * upper part of the picture, where faces usually are. Returns false while loading
 * or when the file does not exist, so the caller can draw its emoji fallback. */
export function drawPhotoCircle(ctx, kind, name, x, y, r, ring = '#c99a1a') {
    const img = getPic(kind, name);
    if (!img || !img.naturalWidth)
        return false;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(x + 3, y + 6, r + 4, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#1d1d1b';
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, 7);
    ctx.fill();
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r - 2, 0, 7);
    ctx.clip();
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - s) / 2;
    const sy = img.naturalHeight > img.naturalWidth ? (img.naturalHeight - s) * 0.18 : (img.naturalHeight - s) / 2;
    ctx.drawImage(img, sx, sy, s, s, x - (r - 2), y - (r - 2), (r - 2) * 2, (r - 2) * 2);
    ctx.restore();
    return true;
}
/** The picture shown whole (not cropped) inside the box. */
export function drawPicWhole(ctx, kind, name, x, y, w, h, o = {}) {
    const img = peekPic(kind, name).img; // the preview has the same shape as the big photo, so the box does not jump when it arrives
    if (!img || !img.naturalWidth) {
        drawPic(ctx, kind, name, x, y, w, h, o);
        return;
    }
    const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    drawPic(ctx, kind, name, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, o);
}
/** The photos that exist for an event: its own picture, then <name>2 … <name>7. The studio shows one per line. */
export async function eventPhotos(base) {
    const g = galleryOf('events', base);
    await preload('events', g.cands, 2500);
    const names = galleryNames(g);
    return names.length ? names : [base];
}
//# sourceMappingURL=images.js.map