// Keyboard + mouse-drag state. Gameplay keys are ignored while the cheat console has focus.
export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const input = {
    enabled: false,
    typing: false,
    dragDX: 0, dragDY: 0,
    dragging: false,
    lastDrag: -10,
    clicked: false,
    onKey: null,
    isDown: (...codes) => codes.some((c) => down.has(c)),
    wasPressed: (c) => pressed.has(c),
    endFrame() { pressed.clear(); input.dragDX = 0; input.dragDY = 0; input.clicked = false; },
    axis(neg, pos) { return (input.isDown(...pos) ? 1 : 0) - (input.isDown(...neg) ? 1 : 0); },
  };
  const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backquote']);

  addEventListener('keydown', (e) => {
    if (input.typing || !input.enabled) return;
    if (BLOCK.has(e.code)) e.preventDefault();
    // Ctrl is "descend" in the helicopter: stop Ctrl+S / Ctrl+D etc. from opening browser dialogs.
    if (e.ctrlKey && ['KeyS', 'KeyD', 'KeyA', 'KeyF', 'KeyP', 'KeyE'].includes(e.code)) e.preventDefault();
    if (!e.repeat) { pressed.add(e.code); if (input.onKey) input.onKey(e); }
    down.add(e.code);
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => down.clear());

  let px = 0, py = 0, moved = 0, active = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    active = true; moved = 0; px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!active) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 4) { input.dragging = true; input.dragDX += dx; input.dragDY += dy; input.lastDrag = performance.now() / 1000; }
  });
  const up = () => {
    if (active && moved <= 4 && input.enabled) input.clicked = true;
    active = false; input.dragging = false;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { active = false; input.dragging = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  input.clearKeys = () => down.clear();
  return input;
}
