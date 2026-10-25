import { C, text, emoji, roundRect } from '../../engine/draw.js';
import { clock } from '../../engine/tween.js';
import { t2, main } from '../i18n.js';
export class LoadingScene {
    update() { }
    draw(ctx) {
        const t = clock.realTime;
        ctx.fillStyle = C.greenDark;
        ctx.fillRect(0, 0, 1280, 720);
        const f = (t / 3000) % 1;
        emoji(ctx, '🚂', 640 + Math.sin(t / 300) * 6, 300 - Math.abs(Math.sin(t / 200)) * 8, 90);
        text(ctx, main(t2('Building the railway…', '線路をつくっています…')), 640, 400, { size: 34, color: C.cream, align: 'center' });
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        roundRect(ctx, 440, 440, 400, 24, 12);
        ctx.fill();
        ctx.fillStyle = C.gold;
        roundRect(ctx, 440, 440, Math.max(24, 400 * f), 24, 12);
        ctx.fill();
    }
}
//# sourceMappingURL=loading.js.map