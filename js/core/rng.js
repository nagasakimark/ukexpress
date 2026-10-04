// Seeded RNG (mulberry32). The state is a single number stored in the save, so games replay exactly.
export class Rng {
    constructor(state) {
        this.state = state;
    }
    next() {
        let t = (this.state = (this.state + 0x6d2b79f5) | 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    chance(p) { return this.next() < p; }
    weighted(items, w) {
        const ws = items.map(w);
        const total = ws.reduce((a, b) => a + b, 0);
        let r = this.next() * total;
        for (let i = 0; i < items.length; i++) {
            r -= ws[i];
            if (r <= 0)
                return items[i];
        }
        return items[items.length - 1];
    }
    shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
}
//# sourceMappingURL=rng.js.map