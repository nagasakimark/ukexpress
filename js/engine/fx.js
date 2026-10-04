// Particles, floating text and screen shake: the "juice" layer, drawn in screen space.
import { C, emoji, text } from './draw.js';
export class Fx {
    constructor() {
        this.parts = [];
        this.floaters = [];
        this.shakeAmp = 0;
    }
    burst(x, y, kind, n, opts = {}) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = (opts.speed ?? 6) * (0.4 + Math.random() * 0.8);
            const colors = ['#E8443A', '#3A7BE8', '#3DBE5A', '#F2C230', '#ffffff', '#c06bd6'];
            this.parts.push({
                x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up ?? 4), life: 0, max: 900 + Math.random() * 700,
                kind, color: opts.color ?? colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
                size: opts.size ?? (kind === 'puff' ? 10 + Math.random() * 10 : 8), e: opts.e,
            });
        }
    }
    puff(x, y) {
        this.parts.push({ x, y, vx: (Math.random() - 0.5) * 0.8, vy: -0.8 - Math.random() * 0.6, life: 0, max: 900, kind: 'puff', color: '#ffffff', rot: 0, vr: 0, size: 6 + Math.random() * 6 });
    }
    float(s, x, y, color = C.gold, size = 34) {
        this.floaters.push({ s, x, y, life: 0, color, size });
    }
    shake(a = 10) { this.shakeAmp = Math.max(this.shakeAmp, a); }
    offset() {
        if (this.shakeAmp < 0.3)
            return { x: 0, y: 0 };
        return { x: (Math.random() - 0.5) * this.shakeAmp, y: (Math.random() - 0.5) * this.shakeAmp };
    }
    update(dt) {
        const k = dt / 16.67;
        this.shakeAmp *= Math.pow(0.85, k);
        let n = 0;
        for (const p of this.parts) {
            p.life += dt;
            p.x += p.vx * k;
            p.y += p.vy * k;
            if (p.kind === 'puff') {
                p.size += 0.25 * k;
                p.vx *= 0.98;
            }
            else {
                p.vy += 0.25 * k;
                p.vx *= 0.99;
            }
            if (p.kind === 'confetti') {
                p.vy = Math.min(p.vy, 2.2);
                p.vx += Math.sin(p.life / 120) * 0.05;
            }
            p.rot += p.vr * k;
            if (p.life < p.max)
                this.parts[n++] = p;
        }
        this.parts.length = n;
        let m = 0;
        for (const f of this.floaters) {
            f.life += dt;
            f.y -= 0.6 * k;
            if (f.life < 1400)
                this.floaters[m++] = f;
        }
        this.floaters.length = m;
    }
    draw(ctx) {
        for (const p of this.parts) {
            const a = 1 - p.life / p.max;
            ctx.save();
            ctx.globalAlpha = Math.max(0, a);
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            if (p.kind === 'coin') {
                ctx.fillStyle = C.gold;
                ctx.strokeStyle = '#a77a10';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size, p.size * Math.abs(Math.cos(p.life / 90)) + 1, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            else if (p.kind === 'confetti') {
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            }
            else if (p.kind === 'puff') {
                ctx.globalAlpha = Math.max(0, a * 0.7);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            else if (p.kind === 'star') {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                for (let i = 0; i < 10; i++) {
                    const an = i * Math.PI / 5, r = i % 2 ? p.size * 0.45 : p.size;
                    ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
                }
                ctx.closePath();
                ctx.fill();
            }
            else if (p.kind === 'emoji' && p.e) {
                emoji(ctx, p.e, 0, 0, p.size * 3);
            }
            ctx.restore();
        }
        for (const f of this.floaters) {
            const a = f.life < 1000 ? 1 : 1 - (f.life - 1000) / 400;
            const pop = f.life < 150 ? 0.6 + 0.4 * (f.life / 150) * 1.2 : 1;
            ctx.save();
            ctx.globalAlpha = Math.max(0, a);
            ctx.translate(f.x, f.y);
            ctx.scale(pop, pop);
            text(ctx, f.s, 0, 0, { size: f.size, color: f.color, align: 'center', outline: 7 });
            ctx.restore();
        }
    }
}
export const fx = new Fx();
//# sourceMappingURL=fx.js.map