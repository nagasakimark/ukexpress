class Audio {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.musicGain = null;
        this.muted = false;
        this.musicOn = true;
        this.musicTimer = null;
        this.nextNoteTime = 0;
        this.step = 0;
        this.theme = 'none';
        // Recorded sounds the teacher can swap: assets/sounds/bgm.ogg (looping soundtrack) and assets/sounds/choochoo.mp3.
        // If a file is missing, the soundtrack falls back to the built-in synthesised tune and the choo-choo to the whistle.
        this.bgm = null;
        this.bgmOk = false;
        this.choo = null;
        this.chooOk = false;
        this.wantMusic = false;
    }
    loadFiles() {
        if (this.bgm)
            return;
        try {
            this.bgm = new window.Audio('assets/sounds/bgm.ogg');
            this.bgm.loop = true;
            this.bgm.volume = 0.4;
            this.bgm.preload = 'auto';
            this.bgm.addEventListener('canplay', () => { this.bgmOk = true; if (this.wantMusic) {
                this.stopMusicTimer();
                this.bgm.play().catch(() => { });
            } });
            this.bgm.addEventListener('error', () => { this.bgmOk = false; if (this.wantMusic && this.theme !== 'none')
                this.startMusic(this.theme); });
            this.choo = new window.Audio('assets/sounds/choochoo.mp3');
            this.choo.volume = 0.7;
            this.choo.preload = 'auto';
            this.choo.addEventListener('canplay', () => { this.chooOk = true; });
            this.bgm.muted = this.choo.muted = this.muted;
        }
        catch { /* no audio element support */ }
    }
    /** The choo-choo at the start of a turn. */
    chooChoo() {
        if (this.muted)
            return;
        if (this.chooOk && this.choo) {
            try {
                this.choo.currentTime = 0;
                this.choo.play().catch(() => { });
            }
            catch { /* ignore */ }
        }
        else
            this.play('whistle');
    }
    unlock() {
        this.loadFiles();
        if (this.wantMusic && this.bgmOk && this.bgm && this.bgm.paused)
            this.bgm.play().catch(() => { });
        if (this.ctx) {
            if (this.ctx.state === 'suspended')
                this.ctx.resume();
            return;
        }
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC)
                return;
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.muted ? 0 : 0.55;
            this.master.connect(this.ctx.destination);
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.16;
            this.musicGain.connect(this.master);
            if (this.theme !== 'none')
                this.startMusic(this.theme);
        }
        catch {
            this.ctx = null;
        }
    }
    setMuted(m) {
        this.muted = m;
        if (this.bgm)
            this.bgm.muted = m;
        if (this.choo)
            this.choo.muted = m;
        if (this.master && this.ctx)
            this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
    tone(freq, start, dur, type = 'square', vol = 0.2, slideTo, dest) {
        if (!this.ctx || !this.master)
            return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, start);
        if (slideTo)
            o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        o.connect(g);
        g.connect(dest ?? this.master);
        o.start(start);
        o.stop(start + dur + 0.05);
    }
    noise(start, dur, vol = 0.15, hp = 1000) {
        if (!this.ctx || !this.master)
            return;
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++)
            d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = hp;
        const g = this.ctx.createGain();
        g.gain.value = vol;
        src.connect(f);
        f.connect(g);
        g.connect(this.master);
        src.start(start);
    }
    play(s) {
        if (!this.ctx || this.muted)
            return;
        const t = this.ctx.currentTime;
        switch (s) {
            case 'click':
                this.tone(880, t, 0.06, 'square', 0.12);
                this.tone(1320, t + 0.03, 0.05, 'square', 0.08);
                break;
            case 'hover':
                this.tone(1200, t, 0.03, 'sine', 0.05);
                break;
            case 'open':
                this.tone(520, t, 0.08, 'triangle', 0.15, 900);
                break;
            case 'coin':
                this.tone(988, t, 0.08, 'square', 0.12);
                this.tone(1319, t + 0.07, 0.25, 'square', 0.12);
                break;
            case 'buy':
                this.tone(784, t, 0.07, 'square', 0.12);
                this.tone(1047, t + 0.06, 0.07, 'square', 0.12);
                this.tone(1568, t + 0.12, 0.22, 'square', 0.1);
                break;
            case 'bad':
                this.tone(400, t, 0.18, 'sawtooth', 0.12, 260);
                this.tone(260, t + 0.16, 0.3, 'sawtooth', 0.12, 150);
                break;
            case 'dice':
                for (let i = 0; i < 5; i++)
                    this.noise(t + i * 0.06, 0.04, 0.2, 2500);
                break;
            case 'step':
                this.tone(220, t, 0.05, 'triangle', 0.1);
                this.noise(t, 0.04, 0.05, 3000);
                break;
            case 'card':
                this.noise(t, 0.12, 0.12, 4000);
                this.tone(660, t + 0.05, 0.08, 'sine', 0.08);
                break;
            case 'roulette':
                this.tone(1500, t, 0.03, 'square', 0.06);
                break;
            case 'whistle': {
                if (!this.ctx)
                    break;
                this.tone(1180, t, 0.5, 'sine', 0.15);
                this.tone(1480, t, 0.5, 'sine', 0.1);
                this.tone(1180, t + 0.55, 0.7, 'sine', 0.15);
                this.tone(1480, t + 0.55, 0.7, 'sine', 0.1);
                break;
            }
            case 'fanfare': {
                const notes = [523, 659, 784, 1047, 784, 1047];
                const times = [0, 0.12, 0.24, 0.36, 0.56, 0.68];
                notes.forEach((n, i) => this.tone(n, t + times[i], i === 5 ? 0.6 : 0.14, 'square', 0.13));
                notes.forEach((n, i) => this.tone(n / 2, t + times[i], i === 5 ? 0.6 : 0.14, 'triangle', 0.1));
                break;
            }
            case 'quizRight':
                this.tone(659, t, 0.1, 'square', 0.12);
                this.tone(988, t + 0.1, 0.3, 'square', 0.12);
                break;
            case 'quizWrong':
                this.tone(300, t, 0.15, 'square', 0.1);
                this.tone(250, t + 0.15, 0.3, 'square', 0.1);
                break;
            case 'boggart':
                this.tone(180, t, 0.2, 'sawtooth', 0.12, 140);
                this.tone(140, t + 0.2, 0.2, 'sawtooth', 0.12, 220);
                this.tone(220, t + 0.42, 0.3, 'sawtooth', 0.1, 120);
                break;
        }
    }
    // A small original brass-band-style march, sequenced on the fly.
    startMusic(theme) {
        this.theme = theme;
        this.wantMusic = true;
        if (this.bgmOk && this.bgm) {
            this.stopMusicTimer();
            if (this.bgm.paused)
                this.bgm.play().catch(() => { });
            return;
        }
        if (this.bgm && !this.bgm.error && this.bgm.readyState < 3)
            return; // still loading: it starts itself when ready
        if (!this.ctx || !this.musicGain)
            return;
        this.stopMusicTimer();
        this.step = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.musicTimer = window.setInterval(() => this.schedule(), 50);
    }
    stopMusic() { this.theme = 'none'; this.wantMusic = false; this.bgm?.pause(); this.stopMusicTimer(); }
    stopMusicTimer() { if (this.musicTimer !== null) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
    } }
    schedule() {
        if (!this.ctx || !this.musicGain || !this.musicOn || this.muted) {
            if (this.ctx)
                this.nextNoteTime = this.ctx.currentTime + 0.1;
            return;
        }
        const tempo = this.theme === 'title' ? 0.2 : 0.24; // seconds per eighth note
        // Melody in C major, 0 = rest. 32 steps.
        const melodyA = [67, 0, 72, 0, 72, 74, 76, 0, 76, 0, 74, 72, 74, 0, 67, 0, 69, 0, 71, 0, 72, 74, 76, 79, 77, 0, 76, 74, 72, 0, 0, 0];
        const melodyB = [76, 0, 77, 0, 79, 0, 76, 72, 74, 0, 72, 71, 69, 0, 67, 0, 69, 71, 72, 74, 76, 0, 74, 0, 72, 0, 71, 74, 72, 0, 0, 0];
        const bass = [48, 55, 48, 55, 48, 55, 48, 55, 53, 57, 53, 57, 55, 59, 55, 59, 53, 57, 53, 57, 48, 55, 48, 55, 55, 59, 55, 59, 48, 55, 48, 55];
        while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
            const s = this.step % 64;
            const mel = s < 32 ? melodyA[s] : melodyB[s - 32];
            const b = bass[s % 32];
            const f = (m) => 440 * Math.pow(2, (m - 69) / 12);
            if (mel)
                this.tone(f(mel), this.nextNoteTime, tempo * 1.6, 'square', 0.18, undefined, this.musicGain);
            if (s % 2 === 0)
                this.tone(f(b), this.nextNoteTime, tempo * 0.9, 'triangle', 0.3, undefined, this.musicGain);
            if (s % 4 === 2)
                this.noiseTo(this.nextNoteTime);
            this.nextNoteTime += tempo;
            this.step++;
        }
    }
    noiseTo(start) {
        if (!this.ctx || !this.musicGain)
            return;
        const len = Math.floor(this.ctx.sampleRate * 0.05);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++)
            d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.value = 0.25;
        src.connect(g);
        g.connect(this.musicGain);
        src.start(start);
    }
}
export const audio = new Audio();
//# sourceMappingURL=audio.js.map