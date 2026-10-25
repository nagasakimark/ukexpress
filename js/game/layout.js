// Screen layout. The design is 1280x720; on a window wider than 16:9 the game spreads sideways by `ext`
// on each side (x runs from -ext to 1280 + ext), so a widescreen never shows empty bars.
// The board's map grows to fill the extra width and the Station guide moves to the right edge.
export const LAY = {
    ext: 0,
    /** visible left/right edge of the whole screen */
    vl: 0, vr: 1280,
    /** map window (left/right edges, bottom), and its centre */
    mapL: 0, mapR: 920, mapW: 920, mapTop: 64, mapBot: 556,
    cx: 460, cy: 318,
    panelX: 932, panelW: 340,
};
let full = false;
/** The board draws into the map window; the title screen uses the whole canvas. */
export function useView(f) { full = f; apply(); }
/** Called by the screen whenever the window changes shape. */
export function setExt(e) { LAY.ext = Math.max(0, Math.round(e)); apply(); }
function apply() {
    const e = LAY.ext;
    LAY.vl = -e;
    LAY.vr = 1280 + e;
    if (full)
        Object.assign(LAY, { mapL: -e, mapR: 1280 + e, mapW: 1280, mapTop: 0, mapBot: 720, cx: 640, cy: 400 });
    else
        Object.assign(LAY, { mapL: -e, mapR: 920 + e, mapW: 920, mapTop: 64, mapBot: 556, cx: 460, cy: 318 });
    LAY.panelX = 932 + e;
}
//# sourceMappingURL=layout.js.map