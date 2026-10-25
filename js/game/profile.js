// Place, hero and event "factfile" windows: a picture plus a few light facts.
//  - PlaceModal: the small window shown when you visit a station (one fact and a picture).
//  - ProfileModal: the full-screen factfile (destinations, events, heroes) with a picture that can be enlarged.
import { Button } from '../engine/ui.js';
import { C, panel, text, emoji, roundRect } from '../engine/draw.js';
import { audio } from '../engine/audio.js';
import { app } from './app.js';
import { lines, t2, UI } from './i18n.js';
import { PModal, header, dual, dualHeight, ImageViewer, photoCounter } from "./dialogs.js";
import { drawPic, PhotoBrowser } from "./images.js";
import { STATION_BY_ID } from "../core/content/stations.js";
import { REGIONS } from "../core/content/game-data.js";
const lbl = (t) => lines(t).main;
const sub = (t) => lines(t).sub ?? undefined;
/** Full-screen factfile with a picture on the left (tap the magnifier to see it big). */
export class ProfileModal extends PModal {
    constructor(o) {
        super();
        this.o = o;
        this.size = 26;
        this.scroll = 0;
        this.scrollMax = 0;
        this.dim = 0.6;
        this.photos = new PhotoBrowser(o.pic.kind, o.pic.name);
        const zoom = new Button({ x: 60 + 560 - 150, y: 112 + 420 - 58, w: 140, h: 48, label: lbl(t2('Big', '大きく')), icon: '🔍', size: 20, color: '#3a5a8a', onClick: () => app.show(new ImageViewer(o.pic, o.title, this.photos)) });
        this.buttons.push(zoom);
        this.buttons.push(new Button({ x: 640 - 170, y: 618, w: 340, h: 72, label: lbl(o.button) + ' ▶', sub: sub(o.button), color: o.buttonColor ?? C.green, pulse: true, onClick: () => this.resolveWith(undefined) }));
        this.prevBtn = new Button({ x: 70, y: 544, w: 64, h: 48, label: '◀', size: 24, color: '#3a5a8a', onClick: () => this.photos.step(-1) });
        this.nextBtn = new Button({ x: 536, y: 544, w: 64, h: 48, label: '▶', size: 24, color: '#3a5a8a', onClick: () => this.photos.step(1) });
        this.buttons.push(this.prevBtn, this.nextBtn);
        this.onBack = null;
        this.focus = 1;
        // Fit the text: shrink until every row fits in the right-hand column.
        const ctx = app.screen.ctx;
        this.size = 24;
        while (this.size > 20 && this.rowsHeight(ctx) > 470)
            this.size -= 1;
    }
    drag(_dx = 0, dy = 0) { this.scroll = Math.max(0, Math.min(this.scrollMax, this.scroll - dy)); return true; }
    zoom(f = 1) { this.scroll = Math.max(0, Math.min(this.scrollMax, this.scroll + (f > 1 ? -80 : 80))); return true; }
    rowsHeight(ctx) {
        return this.o.rows.reduce((a, r) => a + 22 + dualHeight(ctx, r.text, this.size, 520) + 16, 0);
    }
    autoValue() { return undefined; }
    drawBody(ctx) {
        const { o } = this;
        panel(ctx, 24, 14, 1232, 692);
        header(ctx, o.title, 24, 14, 1232, o.color);
        if (o.badge) {
            ctx.font = '800 18px sans-serif';
            const w = Math.min(420, ctx.measureText(o.badge).width + 34);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            roundRect(ctx, 1256 - w - 28, 22, w, 30, 15);
            ctx.fill();
            text(ctx, o.badge, 1256 - w / 2 - 28, 38, { size: 18, color: '#fff', align: 'center', maxWidth: w - 20 });
        }
        drawPic(ctx, o.pic.kind, this.photos.name(), 60, 112, 560, 420, { emoji: o.pic.emoji, label: o.pic.label, color: o.pic.color });
        const multi = this.photos.count() > 1;
        this.prevBtn.hidden = this.nextBtn.hidden = !multi;
        if (!multi && this.focus > 1)
            this.focus = 1;
        if (multi)
            photoCounter(ctx, 340, 564, this.photos.index() + 1, this.photos.count());
        // rows: a scrolling column that stops above the Close button
        const cx = 660, cy0 = 104, cw = 580, ch = 498;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx, cy0, cw, ch);
        ctx.clip();
        let y = cy0 + 4 - this.scroll;
        for (const r of o.rows) {
            emoji(ctx, r.icon, 684, y + 14, 28);
            ctx.fillStyle = 'rgba(0,0,0,0.07)';
            roundRect(ctx, 710, y + 2, 14 + lbl(r.label).length * 15, 24, 12);
            ctx.fill();
            text(ctx, lbl(r.label), 720, y + 14, { size: 16, color: '#7a6a4a', weight: 800 });
            y = dual(ctx, r.text, 712, y + 34, this.size, 500) + 18;
        }
        ctx.restore();
        const total = y + this.scroll - cy0;
        this.scrollMax = Math.max(0, total - ch);
        if (this.scroll > this.scrollMax)
            this.scroll = this.scrollMax;
        if (this.scrollMax > 0) {
            const th = Math.max(36, ch * ch / total), ty = cy0 + (ch - th) * (this.scroll / this.scrollMax);
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            roundRect(ctx, 1240, cy0, 6, ch, 3);
            ctx.fill();
            ctx.fillStyle = o.color;
            roundRect(ctx, 1240, ty, 6, th, 3);
            ctx.fill();
            if (this.scroll < this.scrollMax - 2) {
                const g = ctx.createLinearGradient(0, cy0 + ch - 40, 0, cy0 + ch);
                g.addColorStop(0, 'rgba(255,250,240,0)');
                g.addColorStop(1, 'rgba(255,250,240,1)');
                ctx.fillStyle = g;
                ctx.fillRect(cx, cy0 + ch - 40, cw, 40);
                text(ctx, '▼', 950, cy0 + ch - 12, { size: 16, color: o.color, align: 'center' });
            }
        }
    }
}
/** The small window shown when you visit a station: one fact and a picture. */
export class PlaceModal extends PModal {
    constructor(title, color, pic, fact, badge) {
        super();
        this.title = title;
        this.color = color;
        this.pic = pic;
        this.fact = fact;
        this.badge = badge;
        this.x = 190;
        this.y = 130;
        this.w = 900;
        this.h = 460;
        this.photos = new PhotoBrowser(pic.kind, pic.name);
        this.buttons.push(new Button({ x: 640 - 130, y: this.y + this.h - 84, w: 260, h: 64, label: lbl(UI.ok), sub: sub(UI.ok), color: C.green, onClick: () => this.resolveWith(undefined) }));
        this.buttons.push(new Button({ x: this.x + 36 + 330 - 150, y: this.y + 106 + 248 - 58, w: 140, h: 48, label: lbl(t2('Big', '大きく')), icon: '🔍', size: 20, color: '#3a5a8a', onClick: () => app.show(new ImageViewer(this.pic, this.title, this.photos)) }));
        this.prevBtn = new Button({ x: this.x + 46, y: this.y + 206, w: 52, h: 48, label: '◀', size: 22, color: '#3a5a8a', onClick: () => this.photos.step(-1) });
        this.nextBtn = new Button({ x: this.x + 304, y: this.y + 206, w: 52, h: 48, label: '▶', size: 22, color: '#3a5a8a', onClick: () => this.photos.step(1) });
        this.buttons.push(this.prevBtn, this.nextBtn);
        this.onBack = () => this.resolveWith(undefined);
        this.focus = 0;
        audio.play('open');
    }
    drawBody(ctx) {
        const { x, y, w, h } = this;
        panel(ctx, x, y, w, h);
        header(ctx, this.title, x, y, w, this.color);
        drawPic(ctx, this.pic.kind, this.photos.name(), x + 36, y + 106, 330, 248, { emoji: this.pic.emoji, label: this.pic.label, color: this.pic.color, thumb: true });
        const multi = this.photos.count() > 1;
        this.prevBtn.hidden = this.nextBtn.hidden = !multi;
        if (!multi && this.focus > 0)
            this.focus = 0;
        if (multi)
            photoCounter(ctx, x + 36 + 70, y + 106 + 248 - 24, this.photos.index() + 1, this.photos.count());
        if (this.badge)
            text(ctx, this.badge, x + 36 + 165, y + 380, { size: 18, color: '#5a5a50', align: 'center', maxWidth: 320 });
        let size = 30;
        const ctxm = app.screen.ctx;
        while (size > 18 && dualHeight(ctxm, this.fact, size, 450) > 230)
            size -= 1;
        const hgt = dualHeight(ctxm, this.fact, size, 450);
        text(ctx, '💡 ' + lbl(t2('Did you know?', 'しってた？')), x + 410, y + 112, { size: 20, color: '#8a7a60' });
        dual(ctx, this.fact, x + 410, y + 130 + Math.max(0, (240 - hgt) / 2), size, 450);
    }
}
/** The full factfile for a station (picture, region, facts, local team and famous things): "More" in the Station guide and the UK Book. */
export function stationProfile(sid) {
    const st = STATION_BY_ID[sid];
    const reg = REGIONS[st.region];
    const rows = [{ icon: '🗺️', label: t2('Where', 'どこ'), text: reg.name }];
    st.facts.slice(0, 3).forEach((f, i) => rows.push({ icon: i === 0 ? '💡' : '✨', label: i === 0 ? t2('Did you know?', 'しってた？') : t2('Also', 'ほかにも'), text: f }));
    if (st.team)
        rows.push({ icon: '⚽', label: t2('Local team', 'ちほうの チーム'), text: st.team });
    if (st.famous)
        rows.push({ icon: '🛍️', label: t2('Famous for', 'ゆうめいな もの'), text: st.famous });
    return app.show(new ProfileModal({
        title: st.name, color: reg.color, badge: lines(reg.name).main, rows,
        pic: { kind: 'places', name: st.image, emoji: st.emoji, label: st.name.en, color: reg.color }, button: t2('Close', 'とじる'),
    }));
}
//# sourceMappingURL=profile.js.map