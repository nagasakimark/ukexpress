export function askText(screen, o) {
    return new Promise((resolve) => {
        const el = document.createElement('input');
        el.className = 'text-entry';
        el.type = o.numeric ? 'tel' : 'text';
        if (o.numeric)
            el.inputMode = 'numeric';
        el.value = o.value ?? '';
        el.maxLength = o.maxLength ?? 60;
        el.placeholder = o.placeholder ?? '';
        const place = () => {
            el.style.left = `${screen.ox + o.x * screen.scale}px`;
            el.style.top = `${screen.oy + o.y * screen.scale}px`;
            el.style.width = `${o.w * screen.scale}px`;
            el.style.height = `${o.h * screen.scale}px`;
            el.style.fontSize = `${o.h * 0.5 * screen.scale}px`;
        };
        place();
        window.addEventListener('resize', place);
        let done = false;
        const finish = (v) => {
            if (done)
                return;
            done = true;
            window.removeEventListener('resize', place);
            el.remove();
            screen.canvas.focus();
            resolve(v);
        };
        el.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter')
                finish(el.value.trim());
            if (e.key === 'Escape')
                finish(null);
        });
        el.addEventListener('blur', () => finish(el.value.trim()));
        document.body.appendChild(el);
        setTimeout(() => { el.focus(); el.select(); }, 30);
    });
}
//# sourceMappingURL=textinput.js.map