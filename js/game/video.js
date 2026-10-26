// Short video clips for the TV studio: assets/video/news.mp4 (the looping idle screen) and one clip per event
// (assets/video/events/<name>.mp4, made by tools/fetch_event_videos.py). Clips are played in a hidden <video> and
// drawn onto the canvas, so they look like part of the game. Japanese subtitles (<name>.ja.vtt) are drawn by the game too.
import { text, roundRect } from '../engine/draw.js';
import { audio } from '../engine/audio.js';
const DIR = 'assets/video/events/';
let index = {};
let indexLoaded = false;
/** Reads the list of clips that exist (a tiny JSON). Never throws: with no list there are simply no event videos. */
export async function loadVideoIndex() {
    if (indexLoaded)
        return;
    try {
        const r = await fetch(DIR + 'index.json', { cache: 'no-cache' });
        if (r.ok)
            index = await r.json();
    }
    catch { /* no videos */ }
    indexLoaded = true;
}
export const clipInfo = (key) => { const i = index[key]; return i && !i.error ? i : null; };
export const hasClip = (key) => !!key && !!clipInfo(key);
export const allClips = () => index;
function parseVtt(src) {
    const ts = (s) => { const p = s.replace(',', '.').split(':').map(Number); while (p.length < 3)
        p.unshift(0); return p[0] * 3600 + p[1] * 60 + p[2]; };
    const out = [];
    for (const blk of src.split(/\r?\n\r?\n/)) {
        const m = /([\d:.,]+)\s+-->\s+([\d:.,]+)/.exec(blk);
        if (!m)
            continue;
        const t = blk.split(/\r?\n/).filter((l) => !l.includes('-->') && l.trim() && !/^\d+$/.test(l.trim())).map((l) => l.replace(/<[^>]+>/g, '').trim()).join(' ').trim();
        if (t)
            out.push({ a: ts(m[1]), b: ts(m[2]), t });
    }
    return out;
}
export class Clip {
    constructor(src, opts) {
        this.src = src;
        this.opts = opts;
        this.cues = [];
        this.failed = false;
        this.asked = false;
        const v = document.createElement('video');
        v.preload = 'auto';
        v.playsInline = true;
        v.loop = opts.loop;
        v.muted = true;
        v.setAttribute('playsinline', '');
        v.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
        v.addEventListener('error', () => { this.failed = true; });
        document.body.appendChild(v);
        v.src = src;
        this.el = v;
        if (opts.vtt)
            fetch(opts.vtt).then((r) => (r.ok ? r.text() : '')).then((t) => { this.cues = parseVtt(t); }).catch(() => { });
    }
    get ready() { return this.el.readyState >= 2 && !this.failed; }
    get ended() { return this.el.ended; }
    /** Starts from the beginning. `sound` false keeps it silent (the news loop, or the teacher turned sound off). */
    start(sound) {
        const v = this.el;
        try {
            v.currentTime = 0;
        }
        catch { /* not ready yet */ }
        v.muted = !sound;
        this.asked = true;
        v.play().catch(() => { v.muted = true; v.play().catch(() => { }); });
    }
    stop() { this.asked = false; this.el.pause(); }
    /** Keeps a clip that should be playing playing (browsers sometimes refuse the first play()). */
    keepAlive() { if (this.asked && this.el.paused && !this.el.ended)
        this.el.play().catch(() => { }); }
    cue() {
        const t = this.el.currentTime;
        for (const c of this.cues)
            if (t >= c.a && t <= c.b)
                return c.t;
        return '';
    }
    /** Draws the current frame filling the box (cropped, never letterboxed). Returns false while there is no frame yet. */
    draw(ctx, x, y, w, h, subtitles = true) {
        this.keepAlive();
        const v = this.el;
        if (!this.ready || !v.videoWidth)
            return false;
        const k = Math.max(w / v.videoWidth, h / v.videoHeight), sw = w / k, sh = h / k;
        ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, x, y, w, h);
        if (subtitles) {
            const c = this.cue();
            if (c) {
                const size = Math.max(16, Math.round(w / 26));
                ctx.save();
                ctx.font = `800 ${size}px sans-serif`;
                // wrap onto at most two lines
                const words = c.split(/(?<=[、。！？])|\s+/).filter(Boolean);
                const lines = [];
                let cur = '';
                for (const wd of words) {
                    if (ctx.measureText(cur + wd).width > w - 40 && cur) {
                        lines.push(cur);
                        cur = wd;
                    }
                    else
                        cur += (cur && /^[a-z0-9]/i.test(wd) ? ' ' : '') + wd;
                }
                if (cur)
                    lines.push(cur);
                const ls = lines.slice(-2), bh = ls.length * (size + 6) + 14;
                ctx.fillStyle = 'rgba(0,0,0,0.62)';
                roundRect(ctx, x + 16, y + h - bh - 14, w - 32, bh, 10);
                ctx.fill();
                ls.forEach((l, i) => text(ctx, l, x + w / 2, y + h - bh - 14 + 8 + size / 2 + i * (size + 6) + 3, { size, color: '#fff', align: 'center', maxWidth: w - 44 }));
                ctx.restore();
            }
        }
        return true;
    }
}
const clips = new Map();
/** The clip for an event (created on first use, so it starts downloading as soon as it is asked for). */
export function eventClip(key) {
    const info = clipInfo(key);
    if (!info)
        return null;
    let c = clips.get(key);
    if (!c) {
        c = new Clip(`${DIR}${key}.mp4`, { loop: true, info, vtt: info.subs ? `${DIR}${key}.ja.vtt` : undefined });
        clips.set(key, c);
    }
    return c;
}
/** Begins downloading an event's clip in the background (call when the month's event is known). */
export function prefetchClip(key) { if (key)
    eventClip(key); }
let news = null;
/** The "UK Express News" loop shown on the studio TV when nothing else is on it. */
export function newsLoop() { return (news || (news = new Clip('assets/video/news.mp4', { loop: true }))); }
/** Lowers the soundtrack while a clip with sound is playing. */
export function duckMusic(on) { audio.duck(on); }
//# sourceMappingURL=video.js.map