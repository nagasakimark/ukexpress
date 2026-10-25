// Tweens and timers, all driven by the game clock so the whole game can speed up (CPU turns, autoplay tests).
export const Ease = {
    linear: (t) => t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outBounce: (t) => {
        const n1 = 7.5625, d1 = 2.75;
        if (t < 1 / d1)
            return n1 * t * t;
        if (t < 2 / d1)
            return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1)
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
};
class Clock {
    constructor() {
        this.time = 0; // game time in ms (scaled)
        this.realTime = 0; // unscaled ms
        this.timeScale = 1;
        this.jobs = [];
    }
    update(dtReal) {
        const dt = dtReal * this.timeScale;
        this.realTime += dtReal;
        this.time += dt;
        const jobs = this.jobs;
        this.jobs = [];
        const keep = [];
        for (const j of jobs) {
            j.elapsed += dt;
            const t = j.dur <= 0 ? 1 : Math.min(1, j.elapsed / j.dur);
            j.step(t);
            if (t >= 1)
                j.resolve();
            else
                keep.push(j);
        }
        this.jobs = keep.concat(this.jobs);
    }
    animate(ms, step) {
        return new Promise((resolve) => { this.jobs.push({ elapsed: 0, dur: ms, step, resolve }); });
    }
    wait(ms) { return this.animate(ms, () => { }); }
    tween(obj, to, ms, ease = Ease.outQuad) {
        const from = {};
        for (const k in to)
            from[k] = obj[k];
        return this.animate(ms, (t) => {
            const e = ease(t);
            for (const k in to)
                obj[k] = from[k] + (to[k] - from[k]) * e;
        });
    }
}
export const clock = new Clock();
//# sourceMappingURL=tween.js.map