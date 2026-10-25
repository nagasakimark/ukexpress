// The Graphics option shown in the Options and in-game menus.
import { app } from '../app.js';
import { gfx } from './gfx.js';
import { t2 } from '../i18n.js';
const GFX_NAMES = { auto: ['Auto', 'じどう'], high: ['High', '高'], medium: ['Medium', '中'], low: ['Low (fast)', '低（かるい）'] };
export function graphicsLabel() {
    const s = app.options.gfx || 'auto';
    const now = s === 'auto' ? ` (${GFX_NAMES[gfx.quality][0]})` : '';
    return t2(`Graphics: ${GFX_NAMES[s][0]}${now}`, `グラフィック：${GFX_NAMES[s][1]}`);
}
/** Auto → High → Medium → Low → Auto. Scenery density is fixed until the next page load; resolution and shadows change now. */
export function cycleGraphics() {
    const order = ['auto', 'high', 'medium', 'low'];
    const o = app.options;
    o.gfx = order[(order.indexOf(o.gfx || 'auto') + 1) % order.length];
    gfx.setting = o.gfx;
    gfx.setQuality(o.gfx === 'auto' ? gfx.guess() : o.gfx);
    app.saveOptions();
}
//# sourceMappingURL=gfxmenu.js.map