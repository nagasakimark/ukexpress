// Place, hero and event "factfile" windows: a picture plus a few light facts.
//  - PlaceModal: the small window shown when you visit a station (one fact and a picture).
//  - ProfileModal: the full-screen factfile (destinations, events, heroes) with a picture that can be enlarged.
import { Button } from '../engine/ui.js';
import { C, panel, text, emoji, roundRect } from '../engine/draw.js';
import { audio } from '../engine/audio.js';
import { app } from './app.js';
import { lines, t2, UI } from './i18n.js';
import { PModal, header, dual, dualHeight } from './dialogs.js';
import { drawPic, drawPicWhole } from './images.js';
import { STATION_BY_ID } from '../core/content/stations.js';
import { REGIONS } from '../core/content/game-data.js';
const lbl = (t) => lines(t).main;
const sub = (t) => lines(t).sub ?? undefined;
/** The picture, full screen, so students can look closely. */
export class ImageViewer extends PModal {
    constructor(pic, caption) {
        super();
        this.pic = pic;
        this.caption = caption;
        this.dim = 0.8;
        this.buttons.push(new Button({ x: 640 - 130, y: 640, w: 260, h: 62, label: lbl(UI.back), sub: sub(UI.back), color: '#7a6a55', onClick: () => this.resolveWith(undefined) }));
        this.onBack = () => this.resolveWith(undefined);
        this.focus = 0;
    }
    drawBody(ctx) {
        ctx.fillStyle = '#11151a';
        ctx.fillRect(0, 0, 1280, 720);
        drawPicWhole(ctx, this.pic.kind, this.pic.name, 40, 76, 1200, 548, { emoji: this.pic.emoji, label: this.pic.label, color: this.pic.color });
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
        const zoom = new Button({ x: 60 + 560 - 150, y: 112 + 420 - 58, w: 140, h: 48, label: lbl(t2('Big', '大きく')), icon: '🔍', size: 20, color: '#3a5a8a', onClick: () => app.show(new ImageViewer(o.pic, o.title)) });
        this.buttons.push(zoom);
        this.buttons.push(new Button({ x: 640 - 170, y: 618, w: 340, h: 72, label: lbl(o.button) + ' ▶', sub: sub(o.button), color: o.buttonColor ?? C.green, pulse: true, onClick: () => this.resolveWith(undefined) }));
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
        drawPic(ctx, o.pic.kind, o.pic.name, 60, 112, 560, 420, { emoji: o.pic.emoji, label: o.pic.label, color: o.pic.color });
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
        this.buttons.push(new Button({ x: 640 - 130, y: this.y + this.h - 84, w: 260, h: 64, label: lbl(UI.ok), sub: sub(UI.ok), color: C.green, onClick: () => this.resolveWith(undefined) }));
        this.onBack = () => this.resolveWith(undefined);
        this.focus = 0;
        audio.play('open');
    }
    drawBody(ctx) {
        const { x, y, w, h } = this;
        panel(ctx, x, y, w, h);
        header(ctx, this.title, x, y, w, this.color);
        drawPic(ctx, this.pic.kind, this.pic.name, x + 36, y + 106, 330, 248, { emoji: this.pic.emoji, label: this.pic.label, color: this.pic.color });
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