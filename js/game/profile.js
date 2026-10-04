// Place, hero and event "factfile" windows: a picture plus a few light facts.
//  - PlaceModal: the small window shown when you visit a station (one fact and a picture).
//  - ProfileModal: the full-screen factfile (destinations, events, heroes) with a picture that can be enlarged.
import { Button } from '../engine/ui.js';
import { C, panel, text, emoji, roundRect } from '../engine/draw.js';
import { audio } from '../engine/audio.js';
import { app } from './app.js';
import { lines, t2, UI } from './i18n.js';
import { PModal, header, dual, dualHeight } from './dialogs.js';
import { drawPic, drawPicWhole, PhotoBrowser } from './images.js';
const lbl = (t) => lines(t).main;
const sub = (t) => lines(t).sub ?? undefined;
/** A "2 / 5" pill over a photo, so players can see there is more to browse. */
function photoCounter(ctx, cx, cy, pos, total) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, cx - 52, cy - 17, 104, 34, 17);
    ctx.fill();
    text(ctx, `${pos} / ${total}`, cx, cy + 1, { size: 20, color: '#fff', align: 'center' });
}
/** The picture, full screen, so students can look closely. */
export class ImageViewer extends PModal {
    constructor(pic, caption, photos) {
        super();
        this.pic = pic;
        this.caption = caption;
        this.photos = photos;
        this.dim = 0.8;
        this.buttons.push(new Button({ x: 640 - 130, y: 640, w: 260, h: 62, label: lbl(UI.back), sub: sub(UI.back), color: '#7a6a55', onClick: () => this.resolveWith(undefined) }));
        this.prevBtn = new Button({ x: 52, y: 324, w: 60, h: 52, label: '◀', size: 24, color: '#3a5a8a', onClick: () => this.photos?.step(-1) });
        this.nextBtn = new Button({ x: 1168, y: 324, w: 60, h: 52, label: '▶', size: 24, color: '#3a5a8a', onClick: () => this.photos?.step(1) });
        this.buttons.push(this.prevBtn, this.nextBtn);
        this.onBack = () => this.resolveWith(undefined);
        this.focus = 0;
    }
    drawBody(ctx) {
        ctx.fillStyle = '#11151a';
        ctx.fillRect(0, 0, 1280, 720);
        const multi = (this.photos?.count() ?? 0) > 1;
        this.prevBtn.hidden = this.nextBtn.hidden = !multi;
        if (!multi && this.focus > 0)
            this.focus = 0;
        drawPicWhole(ctx, this.pic.kind, this.photos ? this.photos.name() : this.pic.name, 40, 76, 1200, 548, { emoji: this.pic.emoji, label: this.pic.label, color: this.pic.color });
        if (multi)
            photoCounter(ctx, 640, 598, this.photos.index() + 1, this.photos.count());
        text(ctx, lbl(this.caption), 640, 40, { size: 30, color: '#fff', align: 'center', maxWidth: 1100 });
    }
}
/** Full-screen factfile with a picture on the left (tap the magnifier to see it big). */
export class ProfileModal extends PModal {
    constructor(o) {
        super();
        this.o = o;
        this.size = 26;
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
        while (this.size > 16 && this.rowsHeight(ctx) > 470)
            this.size -= 1;
    }
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
        // rows
        let y = 112;
        for (const r of o.rows) {
            emoji(ctx, r.icon, 668, y + 20, 34);
            text(ctx, lbl(r.label).toUpperCase(), 700, y + 10, { size: 15, color: '#8a7a60', weight: 800 });
            y = dual(ctx, r.text, 700, y + 22, this.size, 520) + 16;
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
        drawPic(ctx, this.pic.kind, this.photos.name(), x + 36, y + 106, 330, 248, { emoji: this.pic.emoji, label: this.pic.label, color: this.pic.color });
        const multi = this.photos.count() > 1;
        this.prevBtn.hidden = this.nextBtn.hidden = !multi;
        if (!multi && this.focus > 0)
            this.focus = 0;
        if (multi)
            photoCounter(ctx, x + 36 + 165, y + 106 + 248 - 24, this.photos.index() + 1, this.photos.count());
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
//# sourceMappingURL=profile.js.map