// Drawing helpers: panels, text, ticket buttons, emoji. All placeholder art is built from these.
export const C = {
    green: '#1F5E3B',
    greenDark: '#123d27',
    greenLight: '#2f7a50',
    cream: '#F6EED8',
    creamDark: '#e4d6b0',
    brass: '#C9A13B',
    brassLight: '#e8c45f',
    gold: '#FFC93C',
    red: '#D7263D',
    sea: '#5BA4D6',
    ink: '#1d1d1b',
    white: '#ffffff',
    shadow: 'rgba(0,0,0,0.35)',
    players: ['#E8443A', '#3A7BE8', '#3DBE5A', '#F2C230'],
    playerShapes: ['circle', 'square', 'triangle', 'star'],
};
export const FONT = '"Pook", "M PLUS Rounded 1c", "BIZ UDPGothic", "Hiragino Maru Gothic ProN", "Meiryo", "Segoe UI", sans-serif';
export const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
export function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
// Railway-sign panel: dark outline, brass frame, cream or green body, rivets in the corners.
export function panel(ctx, x, y, w, h, o = {}) {
    const r = o.radius ?? 18;
    ctx.save();
    if (o.shadow !== false) {
        ctx.fillStyle = C.shadow;
        roundRect(ctx, x + 4, y + 7, w, h, r);
        ctx.fill();
    }
    ctx.fillStyle = '#2a1d0a';
    roundRect(ctx, x - 3, y - 3, w + 6, h + 6, r + 3);
    ctx.fill();
    ctx.fillStyle = o.border ?? C.brass;
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.fillStyle = o.fill ?? C.cream;
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 5));
    ctx.fill();
    // soft top highlight
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.4, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 5));
    ctx.fill();
    if (o.rivets !== false && w > 60 && h > 40) {
        ctx.fillStyle = C.brassLight;
        for (const [rx, ry] of [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]]) {
            ctx.beginPath();
            ctx.arc(rx, ry, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}
export function text(ctx, s, x, y, o = {}) {
    ctx.save();
    ctx.font = `${o.weight ?? 800} ${o.size ?? 24}px ${o.font ?? FONT}`;
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = o.baseline ?? 'middle';
    if (o.alpha !== undefined)
        ctx.globalAlpha *= o.alpha;
    if (o.maxWidth) {
        const w = ctx.measureText(s).width;
        if (w > o.maxWidth) {
            const size = Math.max(10, Math.floor((o.size ?? 24) * o.maxWidth / w));
            ctx.font = `${o.weight ?? 800} ${size}px ${o.font ?? FONT}`;
        }
    }
    if (o.outline) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = o.outline;
        ctx.strokeStyle = o.outlineColor ?? C.ink;
        ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = o.color ?? C.ink;
    ctx.fillText(s, x, y);
    ctx.restore();
}
export function measure(ctx, s, size, weight = 800) {
    ctx.save();
    ctx.font = `${weight} ${size}px ${FONT}`;
    const w = ctx.measureText(s).width;
    ctx.restore();
    return w;
}
// Wraps English on spaces and Japanese on characters (never starting a line with 、。」！？ and similar).
const NO_START = new Set([...'、。，．・：；？！ー」』）】〉》ゃゅょっャュョッぁぃぅぇぉァィゥェォ…‥%）)]!?,.:;']);
export function wrap(ctx, s, maxW, size, weight = 800) {
    ctx.save();
    ctx.font = `${weight} ${size}px ${FONT}`;
    const out = [];
    for (const para of s.split('\n')) {
        const cjk = /[\u3040-\u30ff\u4e00-\u9faf]/.test(para);
        const tokens = cjk ? [...para] : para.split(/(\s+)/);
        let line = '';
        for (const tk of tokens) {
            const test = line + tk;
            if (ctx.measureText(test).width > maxW && line.trim() !== '' && !(cjk && NO_START.has(tk))) {
                out.push(line.trim());
                line = tk.trimStart();
            }
            else
                line = test;
        }
        out.push(line.trim());
    }
    ctx.restore();
    return out;
}
/** Wraps text into a box, shrinking the font until it fits within maxLines. */
export function fitWrap(ctx, s, maxW, maxLines, size, minSize = 10, weight = 800) {
    let sz = size;
    let ls = wrap(ctx, s, maxW, sz, weight);
    while (ls.length > maxLines && sz > minSize) {
        sz -= 1;
        ls = wrap(ctx, s, maxW, sz, weight);
    }
    if (ls.length > maxLines) {
        ls = ls.slice(0, maxLines);
        ls[maxLines - 1] = ls[maxLines - 1].replace(/.$/, '…');
    }
    // a single long word can't wrap: cut it with an ellipsis so it never leaves its box
    ctx.save();
    ctx.font = `${weight} ${sz}px ${FONT}`;
    ls = ls.map((l) => { if (ctx.measureText(l).width <= maxW)
        return l; let t = l; while (t.length > 1 && ctx.measureText(t + '…').width > maxW)
        t = t.slice(0, -1); return t + '…'; });
    ctx.restore();
    return { lines: ls, size: sz };
}
/** Draws wrapped, fitted text centred on (cx, y) with the given line height factor. Returns the bottom y. */
export function textBox(ctx, s, cx, y, maxW, maxLines, size, o = {}) {
    const f = fitWrap(ctx, s, maxW, maxLines, size, 10, o.weight ?? 800);
    f.lines.forEach((l, i) => text(ctx, l, cx, y + f.size / 2 + i * f.size * 1.2, { ...o, size: f.size }));
    return y + f.lines.length * f.size * 1.2;
}
export function emoji(ctx, e, x, y, size, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e, x, y + size * 0.06);
    ctx.restore();
}
export function money(n) {
    const s = Math.abs(Math.round(n)).toLocaleString('en-GB');
    return (n < 0 ? '-£' : '£') + s;
}
export function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + amt * 255)));
    g = Math.max(0, Math.min(255, Math.round(g + amt * 255)));
    b = Math.max(0, Math.min(255, Math.round(b + amt * 255)));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
export function playerShape(ctx, i, x, y, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const shape = C.playerShapes[i % 4];
    if (shape === 'circle')
        ctx.arc(x, y, r, 0, Math.PI * 2);
    else if (shape === 'square')
        ctx.rect(x - r, y - r, r * 2, r * 2);
    else if (shape === 'triangle') {
        ctx.moveTo(x, y - r * 1.1);
        ctx.lineTo(x + r * 1.1, y + r * 0.8);
        ctx.lineTo(x - r * 1.1, y + r * 0.8);
        ctx.closePath();
    }
    else {
        for (let k = 0; k < 10; k++) {
            const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.5 : r * 1.15;
            ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}
//# sourceMappingURL=draw.js.map