// Touch controls and the control-mode choice (keyboard & mouse / touch), plus the pause + settings panel.
// Everything here feeds the existing input state (core/input.js): buttons press virtual keys, the stick
// writes input.stick, the right half writes look-drags. No game logic is duplicated.
import { MOVES } from '../actors/moves.js';
import { quality } from '../core/quality.js';

const $ = (id) => document.getElementById(id);
const KEY = 'neon-controls';
export const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
const touchy = () => coarse() || (('ontouchstart' in window || navigator.maxTouchPoints > 0) && !matchMedia('(any-pointer: fine)').matches);

export function createTouch(game) {
  const { input, hud, audio, player, vehicles } = game;
  let mode = 'keys';
  try { mode = localStorage.getItem(KEY) || ''; } catch (e) { mode = ''; }
  if (mode !== 'touch' && mode !== 'keys') mode = touchy() ? 'touch' : 'keys';

  const zone = $('tzone'), ctlEl = $('tctl'), stickEl = $('stick'), knob = stickEl.firstElementChild;
  const btnBox = $('tbtns'), ringEl = $('tdance'), settings = $('settings'), go = $('go');

  // ---------------------------------------------------------------- mode
  function setMode(m, persist = true) {
    mode = m;
    const t = m === 'touch';
    input.touchMode = t; hud.touch = t;
    document.body.classList.toggle('touch', t);
    zone.hidden = ctlEl.hidden = !t;
    for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
    if (go) go.textContent = t ? 'TAP TO START' : 'CLICK TO START';
    releaseAll();
    hud.resize();
    if (persist) api.save();
  }
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.addEventListener('click', (e) => { e.stopPropagation(); setMode(b.dataset.mode); });
  }

  // ---------------------------------------------------------------- stick + look
  const stick = input.stick;
  let stickId = null, ox = 0, oy = 0, lookId = null, lx = 0, ly = 0;
  const idle = () => { stickEl.classList.add('idle'); stickEl.style.left = stickEl.style.top = ''; knob.style.transform = ''; };
  idle();
  const zl = $('tzl'), zr = $('tzr');
  zl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (stickId !== null) return;
    stickId = e.pointerId; ox = e.clientX; oy = e.clientY;
    try { zl.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    stickEl.classList.remove('idle');
    stickEl.style.left = ox + 'px'; stickEl.style.top = oy + 'px';
    stick.on = true; stick.x = stick.y = 0;
  });
  zl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    const R = stickEl.offsetWidth / 2 || 60;
    let dx = e.clientX - ox, dy = e.clientY - oy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
    // small dead zone, then a linear ramp to full; direction from the (clamped) offset
    const c = Math.min(d, R), m = c / R, k = m < 0.14 ? 0 : (m - 0.14) / 0.86;
    stick.on = true; stick.x = c ? dx / c * k : 0; stick.y = c ? dy / c * k : 0;
  });
  const stickUp = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null; stick.on = false; stick.x = stick.y = 0; idle();
  };
  zl.addEventListener('pointerup', stickUp); zl.addEventListener('pointercancel', stickUp);

  zr.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (lookId !== null) return;
    lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
    try { zr.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
  });
  zr.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    if (input.enabled && !game.paused) input.look(dx * 1.5, dy * 1.5);
  });
  const lookUp = (e) => { if (e.pointerId === lookId) { lookId = null; input.dragging = false; } };
  zr.addEventListener('pointerup', lookUp); zr.addEventListener('pointercancel', lookUp);

  // ---------------------------------------------------------------- buttons as keys
  const held = new Map();                    // element -> code
  function bindKey(el, code, after) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      const c = typeof code === 'function' ? code() : code;
      held.set(el, c); el.classList.add('on');
      input.vkey(c, true);
      if (after) after();
    });
    const up = () => { const c = held.get(el); if (c === undefined) return; held.delete(el); el.classList.remove('on'); input.vkey(c, false); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('click', (e) => e.stopPropagation());
    el.release = up;
  }
  function releaseAll() { for (const el of [...held.keys()]) el.release(); }

  // context buttons: a small pool keyed by "code|label", rebuilt only when the situation changes
  let sig = '';
  const pool = new Map();
  function button(code, label) {
    const id = code + '|' + label;
    let b = pool.get(id);
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.className = 'tbtn';
      const t = document.createElement('b'); t.textContent = label;
      const k = document.createElement('small'); k.textContent = { Space: '', KeyE: 'E', KeyF: 'F', KeyX: 'X', KeyS: '', KeyC: '', Enter: '', Escape: '', KeyR: '', KeyG: 'G', KeyQ: 'Q', ArrowLeft: '', ArrowRight: '' }[code] ?? '';
      b.append(t, k); b.setAttribute('aria-label', label);
      bindKey(b, code);
      pool.set(id, b);
    }
    return b;
  }
  function contextButtons() {
    if (!game.started || game.paused || game.cheats.open) return [];
    const b = game.busy, v = game.vehicle, act = game.act;
    if (b === 'cut') return [['Space', 'NEXT'], ['KeyX', 'SKIP']];
    if (b === 'fail') return [['Enter', 'RETRY'], ['Escape', 'DROP']];
    if (b === 'arcade') return game.venues.touchButtons();
    if (b) return [];
    // weapons (game/combat.js): FIRE, a firework BANG (DROP behind a vehicle) and SWAP, all with auto-aim
    const wb = game.combat ? game.combat.touchButtons() : [];
    if (v) {
      if (v.kind === 'car') return [['Space', 'DRIFT'], ['KeyE', 'EXIT'], ['KeyS', 'BRAKE'], ...wb];
      if (v.kind === 'bike') return [['KeyS', 'BRAKE'], ['KeyE', 'GET OFF'], ...wb];
      if (v.kind === 'tank') return [['KeyF', 'FIRE'], ['KeyE', 'EXIT']];
      return [['Space', 'UP'], ['KeyC', 'DOWN'], ['KeyE', v.y - (v.floor || 0) > 0.6 ? 'LAND' : 'EXIT']];
    }
    if (game.swim && game.swim.wet) return game.swim.touchButtons();
    if (act.dancing) return [];
    if (act.mode === 'sit') return [['KeyF', 'GET UP']];
    const f = act.fHint(), fb = f ? [['KeyF', f[1].toUpperCase()]] : [];
    if (game.inside) {
      const h = game.places.hint(), e = h.find((i) => i[0] === 'E');
      return [...fb, ...(e ? [['KeyE', 'USE']] : [])];
    }
    const n = vehicles.nearest(player.pos);
    // armed: FIRE is the big button
    return [...wb.slice(0, 1), ['Space', 'JUMP'], ...(n ? [['KeyE', n.ai ? 'TAKE' : n.kind === 'bike' ? 'RIDE' : 'ENTER']] : []), ...fb, ...wb.slice(1)];
  }

  // dance ring: the eight moves round a STOP button
  const ringBtns = MOVES.map((m, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tbtn tmove';
    const a = -Math.PI / 2 + i * Math.PI / 4;
    b.style.left = (50 + Math.cos(a) * 38).toFixed(2) + '%'; b.style.top = (50 + Math.sin(a) * 38).toFixed(2) + '%';
    const n = document.createElement('small'); n.textContent = String(i + 1);
    const t = document.createElement('b'); t.textContent = m.name.split(/[ -]/)[0];
    b.append(n, t); b.setAttribute('aria-label', `Move ${i + 1}: ${m.name}`);
    bindKey(b, 'Digit' + (i + 1));
    ringEl.appendChild(b);
    return b;
  });
  const stopB = document.createElement('button'); stopB.type = 'button'; stopB.className = 'tbtn tstop';
  stopB.innerHTML = '<b>STOP</b><small>F</small>'; bindKey(stopB, 'KeyF'); ringEl.appendChild(stopB);

  // ---------------------------------------------------------------- top bar
  const tap = (id, fn) => { const el = $(id); el.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); el.addEventListener('pointerdown', (e) => e.stopPropagation()); };
  tap('bview', () => { if (input.enabled) input.onKey({ code: 'KeyV', repeat: false, preventDefault() {} }); });
  tap('bmute', () => { if (input.enabled) input.onKey({ code: 'KeyM', repeat: false, preventDefault() {} }); });
  tap('bcodes', () => { if (input.enabled && !game.busy) game.cheats.toggle(true); });
  tap('bgear', () => openSettings(true));

  // ---------------------------------------------------------------- pause + settings
  function openSettings(on) {
    if (on === !settings.hidden) return;
    settings.hidden = !on;
    game.paused = on;
    if (on && game.stunts) $('stuntc').textContent = `STUNTS FOUND ${game.stunts.found()}/${game.stunts.total}`;
    releaseAll(); input.clearKeys();
    if (on) { audio.suspend(); const b = settings.querySelector('[aria-pressed="true"]'); if (b && !input.touchMode) b.focus(); }
    else if (game.started) audio.resume();
  }
  $('sresume').addEventListener('click', () => openSettings(false));
  // subtitle size: Normal / Large, remembered on this device
  const SUBK = 'neon-coast-subs';
  const setSub = (v) => {
    document.body.classList.toggle('subL', v === 'l');
    for (const b of document.querySelectorAll('[data-sub]')) b.setAttribute('aria-pressed', String(b.dataset.sub === v));
    try { localStorage.setItem(SUBK, v); } catch (e) { /* private mode */ }
  };
  let subV = 'n';
  try { subV = localStorage.getItem(SUBK) || 'n'; } catch (e) { subV = 'n'; }
  setSub(subV);
  for (const b of document.querySelectorAll('[data-sub]')) b.addEventListener('click', () => setSub(b.dataset.sub));
  // graphics quality (Low / High: night bloom, neon pools, shoreline foam, moths and fireflies) and adaptive resolution
  const syncGfx = () => { for (const b of document.querySelectorAll('[data-gfx]')) b.setAttribute('aria-pressed', String(b.dataset.gfx === quality.level)); };
  for (const b of document.querySelectorAll('[data-gfx]')) b.addEventListener('click', () => { quality.set(b.dataset.gfx); syncGfx(); });
  syncGfx();
  const RESK = 'neon-coast-res';
  const setRes = (v, persist = true) => {
    for (const b of document.querySelectorAll('[data-res]')) b.setAttribute('aria-pressed', String(b.dataset.res === v));
    if (game.adaptive) { game.adaptive.enabled = v === 'auto'; if (v === 'full') game.adaptive.set(1); else game.adaptive.reset(); }
    if (persist) { try { localStorage.setItem(RESK, v); } catch (e) { /* private mode */ } }
  };
  let resV = 'auto';
  try { resV = localStorage.getItem(RESK) === 'full' ? 'full' : 'auto'; } catch (e) { resV = 'auto'; }
  setRes(resV, false);
  for (const b of document.querySelectorAll('[data-res]')) b.addEventListener('click', () => setRes(b.dataset.res));
  // cinematic camera: leave the pause panel and fly
  $('scine').addEventListener('click', () => {
    openSettings(false);
    if (!game.cine.start()) hud.toast('CINEMATIC MODE UNAVAILABLE', 'NOT DURING A SCENE, A SHOP OR INDOORS');
  });
  addEventListener('keydown', (e) => { if (!settings.hidden && e.code === 'Escape') { e.preventDefault(); openSettings(false); } });

  // ---------------------------------------------------------------- no page zoom / scroll / long-press menus
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1 || !e.target.closest('#log,#title,#shop,#codes,#settings')) e.preventDefault();
  }, { passive: false });
  document.addEventListener('contextmenu', (e) => { if (input.touchMode) e.preventDefault(); });

  const api = {
    get mode() { return mode; },
    setMode,
    openSettings,
    save() { try { localStorage.setItem(KEY, mode); } catch (e) { /* private mode */ } },
    // once per frame (cheap: only touches the DOM when the situation changes)
    update() {
      if (mode !== 'touch') return;
      const dancing = game.act.dancing && !game.busy && !game.paused && !game.cheats.open;
      ringEl.hidden = !dancing;
      if (dancing) ringBtns.forEach((b, i) => b.classList.toggle('cur', i === game.act.move));
      const list = contextButtons(), s = list.map((i) => i.join(':')).join('|');
      if (s === sig) return;
      sig = s;
      const keep = new Set(list.map(([c, l]) => button(c, l)));
      for (const el of [...btnBox.children]) if (!keep.has(el)) { if (el.release) el.release(); el.remove(); }
      list.forEach(([c, l], i) => { const el = button(c, l); el.classList.toggle('big', i === 0); btnBox.appendChild(el); });
      ctlEl.classList.toggle('cine', game.busy === 'cut');
    },
  };
  setMode(mode, false);
  return api;
}
