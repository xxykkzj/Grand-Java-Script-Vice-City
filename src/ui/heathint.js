// While you have stars, a small panel slides in on the right edge now and then (about 6 s in, 20 s out)
// to remind you that the heat can be cleared with a cheat code. It stops as soon as the stars are gone.
import { CODE_CLEAR_HEAT } from '../cheats/cheats.js';

const SHOW = 6, HIDE = 20, FIRST = 4;

export function createHeatHint(game) {
  const el = document.createElement('div');
  el.id = 'heathint'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  const h = document.createElement('b'), code = document.createElement('kbd'), how = document.createElement('small');
  h.textContent = 'TOO HOT?';
  const line = document.createElement('span'); line.append('Cheat code ', code, ' clears your stars');
  code.textContent = CODE_CLEAR_HEAT;
  el.append(h, line, how);
  document.getElementById('hud').appendChild(el);
  let t = 0, on = false, shown = 0, touch = null;
  const set = (v) => { if (v !== on) { on = v; el.classList.toggle('on', v); if (v) shown++; } };
  return {
    update(dt) {
      const want = game.wanted > 0 && game.started && !game.busy && !game.cheats.open && !(game.cine && game.cine.active);
      if (game.wanted === 0) { t = 0; set(false); return; }
      if (game.input.touchMode !== touch) { touch = game.input.touchMode; how.textContent = touch ? 'Tap CODES in the top bar, then the code' : 'Press T or ~ to open the cheat console'; }
      t += dt;
      // cycle: wait FIRST s, show SHOW s, hide HIDE s, show again...
      const k = t < FIRST ? -1 : (t - FIRST) % (SHOW + HIDE);
      set(want && k >= 0 && k < SHOW);
    },
    state() { return { on, shown, t: +t.toFixed(1), text: el.textContent }; },
  };
}
