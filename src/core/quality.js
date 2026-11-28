// Graphics quality (Low / High), remembered per device. One switch for the new effects: the night bloom,
// the neon light pools on the street, the shoreline foam and the night moths and fireflies.
// High on desktop, Low on touch devices (phones and tablets) until the player chooses.
const KEY = 'neon-coast-gfx';
const listeners = [];
const touchDevice = () => {
  try { return matchMedia('(pointer: coarse)').matches || (('ontouchstart' in window || navigator.maxTouchPoints > 0) && !matchMedia('(any-pointer: fine)').matches); } catch (e) { return false; }
};
let level = 'high';
try { const s = localStorage.getItem(KEY); level = s === 'low' || s === 'high' ? s : (touchDevice() ? 'low' : 'high'); } catch (e) { level = touchDevice() ? 'low' : 'high'; }

// big CanvasTextures are drawn at half size on Low graphics and touch devices (decided when the world is built)
export const texScale = () => (level === 'low' || touchDevice() ? 0.5 : 1);

export const quality = {
  get level() { return level; },
  get high() { return level === 'high'; },
  set(l, persist = true) {
    if (l !== 'low' && l !== 'high') return level;
    level = l;
    if (persist) { try { localStorage.setItem(KEY, l); } catch (e) { /* private mode */ } }
    for (const f of listeners) f(level);
    return level;
  },
  on(f) { listeners.push(f); },
};
