export class Input {
    constructor(screen, route) {
        this.screen = screen;
        this.route = route;
        this.mouseX = -1;
        this.mouseY = -1;
        this.isDown = false;
        this.dragDist = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.pointers = new Map();
        this.pinchStart = 0;
        this.usingKeyboard = false;
        this.onFirstGesture = null;
        const c = screen.canvas;
        c.addEventListener('pointerdown', (e) => this.down(e));
        window.addEventListener('pointermove', (e) => this.move(e));
        window.addEventListener('pointerup', (e) => this.up(e));
        window.addEventListener('pointercancel', (e) => this.up(e));
        c.addEventListener('wheel', (e) => {
            e.preventDefault();
            const p = screen.toVirtual(e.clientX, e.clientY);
            this.dispatch((h) => h.zoom && h.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, p.x, p.y));
        }, { passive: false });
        c.addEventListener('contextmenu', (e) => e.preventDefault());
        window.addEventListener('keydown', (e) => this.keydown(e));
    }
    gesture() {
        if (this.onFirstGesture) {
            const f = this.onFirstGesture;
            this.onFirstGesture = null;
            f();
        }
    }
    dispatch(fn) {
        const hs = this.route();
        for (const h of hs) {
            if (fn(h))
                return true;
        }
        return false;
    }
    down(e) {
        this.gesture();
        this.usingKeyboard = false;
        this.screen.canvas.focus();
        const p = this.screen.toVirtual(e.clientX, e.clientY);
        this.pointers.set(e.pointerId, p);
        if (this.pointers.size === 2) {
            const [a, b] = [...this.pointers.values()];
            this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
            return;
        }
        this.isDown = true;
        this.dragDist = 0;
        this.lastX = p.x;
        this.lastY = p.y;
        this.mouseX = p.x;
        this.mouseY = p.y;
        this.dispatch((h) => h.pointerDown && h.pointerDown(p.x, p.y));
    }
    move(e) {
        const p = this.screen.toVirtual(e.clientX, e.clientY);
        if (this.pointers.has(e.pointerId))
            this.pointers.set(e.pointerId, p);
        if (this.pointers.size === 2 && this.pinchStart > 0) {
            const [a, b] = [...this.pointers.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            const f = d / this.pinchStart;
            if (Math.abs(f - 1) > 0.02) {
                this.dispatch((h) => h.zoom && h.zoom(f, (a.x + b.x) / 2, (a.y + b.y) / 2));
                this.pinchStart = d;
            }
            return;
        }
        this.mouseX = p.x;
        this.mouseY = p.y;
        if (e.pointerType === 'mouse')
            this.usingKeyboard = false;
        if (this.isDown) {
            const dx = p.x - this.lastX, dy = p.y - this.lastY;
            this.dragDist += Math.abs(dx) + Math.abs(dy);
            this.lastX = p.x;
            this.lastY = p.y;
            if (this.dragDist > 10)
                this.dispatch((h) => h.drag && h.drag(dx, dy));
        }
        this.dispatch((h) => h.pointerMove && h.pointerMove(p.x, p.y, this.isDown));
    }
    up(e) {
        this.pointers.delete(e.pointerId);
        if (this.pointers.size < 2)
            this.pinchStart = 0;
        if (!this.isDown)
            return;
        this.isDown = false;
        const p = this.screen.toVirtual(e.clientX, e.clientY);
        const wasDrag = this.dragDist > 10;
        this.dispatch((h) => h.pointerUp && h.pointerUp(p.x, p.y, wasDrag));
        if (e.pointerType !== 'mouse') {
            this.mouseX = -1;
            this.mouseY = -1;
        }
    }
    keydown(e) {
        const el = document.activeElement;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'))
            return; // typing into a text field
        this.gesture();
        let a = 'other';
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                a = 'up';
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                a = 'down';
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                a = 'left';
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                a = 'right';
                break;
            case 'Enter':
            case ' ':
            case 'z':
            case 'Z':
                a = 'confirm';
                break;
            case 'Escape':
            case 'x':
            case 'X':
            case 'Backspace':
                a = 'back';
                break;
        }
        if (a !== 'other') {
            e.preventDefault();
            this.usingKeyboard = true;
        }
        this.dispatch((h) => h.key && h.key(a, e));
    }
}
//# sourceMappingURL=input.js.map