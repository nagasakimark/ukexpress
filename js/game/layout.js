// Screen layout (1280x720): the map on the left, the Station guide on the right, players under the map.
export const LAY = {
    mapW: 920, mapTop: 64, mapBot: 556,
    cx: 460, cy: 318,
    panelX: 932, panelW: 340,
};
const GAME = { mapW: 920, mapTop: 64, mapBot: 556, cx: 460, cy: 318 };
const FULL = { mapW: 1280, mapTop: 0, mapBot: 720, cx: 640, cy: 400 };
/** The board draws into the map window; the title screen uses the whole canvas. */
export function useView(full) { Object.assign(LAY, full ? FULL : GAME); }
//# sourceMappingURL=layout.js.map