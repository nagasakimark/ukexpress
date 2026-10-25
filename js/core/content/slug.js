// File names for pictures: the English name in lower case with only letters and digits (accents removed).
// "King's Cross" becomes kingscross, "Alan Turing" becomes alanturing, "Summer Solstice" becomes summersolstice.
export function slug(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
/** Places whose file name should not follow their display name. */
export const PLACE_IMAGE = { derry: 'derry' };
//# sourceMappingURL=slug.js.map