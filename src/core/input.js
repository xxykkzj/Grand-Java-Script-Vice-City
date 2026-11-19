// Keyboard + mouse-drag state. Gameplay keys are ignored while the cheat console has focus.
// The touch controls (ui/touch.js) feed the same state: virtual keys through vkey(), the stick
// through `stick`, and look-drags through look(), so the game logic only ever sees "keys".
export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const vdown = new Set(), vrelease = new Set(), vframe = new Map();
  let frameNo = 0;
  const input = {
    enabled: false,
    typing: false,
    dragDX: 0, dragDY: 0,
    dragging: false,
    lastDrag: -10,
    clicked: false,
    firePress: false,                       // left button pressed while the right one holds the camera
    wheel: 0,                               // mouse wheel notches this frame (+ down / - up)
    onKey: null,
    touchMode: false,
    // analog stick from the touch controls: x right, y down, -1..1
    stick: { on: false, x: 0, y: 0 },
    isDown: (...codes) => codes.some((c) => down.has(c) || vdown.has(c)),
    wasPressed: (c) => pressed.has(c),
    // an on-screen button acting as a key: down = keydown (fires onKey once), up = keyup.
    // A tap shorter than a frame is held until the end of the next frame so it is never lost.
    vkey(code, on) {
      if (on) {
        if (!input.enabled) return;
        vrelease.delete(code);
        if (!vdown.has(code)) { pressed.add(code); vframe.set(code, frameNo); if (input.onKey) input.onKey({ code, key: code, repeat: false, preventDefault() {} }); }
        vdown.add(code);
      } else if (vdown.has(code)) {
        if (vframe.get(code) === frameNo) vrelease.add(code); else vdown.delete(code);
      }
    },
    look(dx, dy) { input.dragDX += dx; input.dragDY += dy; input.dragging = true; input.lastDrag = performance.now() / 1000; },
    endFrame() {
      pressed.clear(); input.dragDX = 0; input.dragDY = 0; input.clicked = false; input.firePress = false; input.wheel = 0;
      for (const c of vrelease) vdown.delete(c);
      vrelease.clear(); frameNo++;
    },
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

  // left drag or right drag orbits the camera; a left click (no drag) is a click (fires a blaster, the
  // tank); with the right button held, every left press fires straight away
  let px = 0, py = 0, moved = 0, active = false, btn = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if ((e.button !== 0 && e.button !== 2) || (input.touchMode && e.pointerType === 'touch')) return;
    active = true; moved = 0; px = e.clientX; py = e.clientY; btn = e.button;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0 && (e.buttons & 2) && input.enabled) input.firePress = true; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (input.enabled && Math.abs(e.deltaY) > 0.5) input.wheel += Math.sign(e.deltaY); }, { passive: false });
  canvas.addEventListener('pointermove', (e) => {
    if (!active) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 4) { input.dragging = true; input.dragDX += dx; input.dragDY += dy; input.lastDrag = performance.now() / 1000; }
  });
  const up = () => {
    if (active && btn === 0 && moved <= 4 && input.enabled) input.clicked = true;
    active = false; input.dragging = false;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { active = false; input.dragging = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  input.clearKeys = () => { down.clear(); vdown.clear(); vrelease.clear(); input.stick.on = false; input.stick.x = input.stick.y = 0; };
  return input;
}
