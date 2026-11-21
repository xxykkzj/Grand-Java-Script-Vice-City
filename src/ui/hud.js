// DOM HUD. Top-left: a round minimap that turns with the camera, the district name and the
// current objective. Top-right: cash, health, wanted stars and the clock. Also hints, toast, perf panel.
import { HX, HZ, PIER, CAUSEWAY, KEY, MPIER, zoneName } from '../world/layout.js';
import { WEATHER } from '../world/environment.js';

const $ = (id) => document.getElementById(id);

export function createHud(L, groundCanvas, renderer, keyCanvas) {
  const el = {};
  for (const id of ['hud', 'time', 'phase', 'wx', 'zone', 'hint', 'toast', 'perf', 'map', 'money', 'cash', 'hpfill', 'stars', 'obj', 'objt', 'objs', 'objm']) el[id] = $(id);
  const starEls = [...el.stars.children];
  // breath meter (swimming): ten bubbles, plus a thin stamina line
  const bEl = $('breath'), bubs = [...$('bubbles').children], stamEl = $('stamfill');
  let bOn = false, bKey = '';
  function breath(sw) {
    const on = !!sw && ((sw.S.wet && sw.S.mode !== 'wade') || sw.S.breath < 0.995);
    if (on !== bOn) { bOn = on; bEl.hidden = !on; bKey = ''; }
    if (!on) return;
    const n = Math.ceil(sw.S.breath * 10 - 0.001), st = Math.round(sw.S.stamina * 20), low = sw.S.breath < 0.3, key = n + '|' + st + '|' + low;
    if (key === bKey) return;
    bKey = key;
    bubs.forEach((b, i) => b.classList.toggle('off', i >= n));
    stamEl.style.transform = `scaleX(${(st / 20).toFixed(2)})`;
    bEl.classList.toggle('low', low);
    bEl.setAttribute('aria-label', 'Breath ' + Math.round(sw.S.breath * 100) + ' percent');
  }

  // static minimap layer: 1 px per world unit, painted once; both islands and the causeway between them
  const PAD = 110, OX = PAD - KEY.x0, OZ = PAD + HZ, MW = HX - KEY.x0 + PAD * 2, MH = HZ * 2 + PAD * 2;
  const base = document.createElement('canvas');
  base.width = MW; base.height = MH;
  const b = base.getContext('2d');
  b.fillStyle = '#0d1440'; b.fillRect(0, 0, MW, MH);
  b.globalAlpha = 0.55; b.drawImage(groundCanvas, OX - HX, OZ - HZ, HX * 2, HZ * 2);
  if (keyCanvas) b.drawImage(keyCanvas, OX + KEY.x0, OZ + KEY.z0, KEY.x1 - KEY.x0, KEY.z1 - KEY.z0);
  b.globalAlpha = 1;
  b.fillStyle = 'rgba(20,8,48,.35)'; b.fillRect(OX - HX, OZ - HZ, HX * 2, HZ * 2); b.fillRect(OX + KEY.x0, OZ + KEY.z0, KEY.x1 - KEY.x0, KEY.z1 - KEY.z0);
  b.fillStyle = '#b98a5e'; b.fillRect(OX + PIER.x0, OZ + PIER.z0, PIER.x1 - PIER.x0, PIER.z1 - PIER.z0); b.fillRect(OX + MPIER.x0, OZ + MPIER.z0, MPIER.x1 - MPIER.x0, MPIER.z1 - MPIER.z0);
  b.fillStyle = '#3b3548'; b.fillRect(OX + CAUSEWAY.x0, OZ + CAUSEWAY.z0, -HX - CAUSEWAY.x0, CAUSEWAY.z1 - CAUSEWAY.z0);
  b.strokeStyle = 'rgba(233,216,196,.7)'; b.lineWidth = 1.5; b.strokeRect(OX - HX - 0.5, OZ - HZ - 0.5, HX * 2 + 1, HZ * 2 + 1); b.strokeRect(OX + KEY.x0 - 0.5, OZ + KEY.z0 - 0.5, KEY.x1 - KEY.x0 + 1, KEY.z1 - KEY.z0 + 1);
  for (const s of L.buildings) {
    b.fillStyle = s.bar ? '#ff2bd1' : s.hotel ? '#ff7ac8' : '#c9a6ff';
    b.fillRect(OX + s.x0, OZ + s.z0, s.w, s.d);
  }
  if (L.key) {
    for (const s of L.key.buildings) { b.fillStyle = s.style === 'tower' ? '#7fd8ff' : s.style === 'warehouse' ? '#a8a0b8' : s.hotel ? '#ff7ac8' : '#c9a6ff'; b.fillRect(OX + s.x0, OZ + s.z0, s.w, s.d); }
    const st = L.key.stadium;
    b.strokeStyle = '#ffe14a'; b.lineWidth = 6; b.strokeRect(OX + st.x0 + 5, OZ + st.z0 + 5, st.w - 10, st.d - 10);
    b.fillStyle = '#ffd447'; for (const s of L.key.buildings) if (s.pad) { b.beginPath(); b.arc(OX + s.pad.x, OZ + s.pad.z, 4, 0, 6.3); b.fill(); }
    b.fillStyle = '#e0a0a0'; for (const h of L.key.houses) b.fillRect(OX + h.x - 4.5, OZ + h.z - 4, 9, 8);
  }
  // stunt ramps: small orange arrows
  for (const rp of L.ramps || []) {
    b.save(); b.translate(OX + rp.x, OZ + rp.z); b.rotate(-rp.yaw); b.fillStyle = '#ff8a3d';
    b.beginPath(); b.moveTo(-4, -4); b.lineTo(0, 6); b.lineTo(4, -4); b.closePath(); b.fill(); b.restore();
  }
  // the minimap is drawn in a fixed 312-unit space; the canvas backing store follows its CSS size
  // times the device pixel ratio (re-read on every resize), so it stays sharp at any window size
  const g = el.map.getContext('2d');
  const R = 156, SCALE = 1.5, VIEW = R / SCALE - 9;
  let mk = 1;
  const fitMap = () => {
    const css = el.map.clientWidth || 156;
    const px = Math.round(Math.min(640, Math.max(160, css * Math.min(window.devicePixelRatio || 1, 2))));
    if (el.map.width !== px) { el.map.width = el.map.height = px; }
    mk = px / (R * 2);
  };
  fitMap();
  // touch mode: only hints that match an on-screen button (E, F, the door) are worth showing
  const TOUCH_KEY = { E: 'E', F: 'F', 'F / E / WASD': 'F', 'F / WASD': 'F', '1-8': '1-8', Door: 'DOOR' };

  let toastT = 0, lastHint = '', lastClock = '', frames = 0, fpsT = 0, fps = 0, pageKB = 0, perfOn = false;
  let shown = -1, lastHp = -1, lastStars = -1, lastObj = '', tick = 0;
  const hud = {
    show() { el.hud.hidden = false; fitMap(); },
    resize() { fitMap(); lastHint = ''; },
    touch: false,
    toast(title, sub = '') {
      el.toast.textContent = title;
      if (sub) { const s = document.createElement('small'); s.textContent = sub; el.toast.appendChild(s); }
      el.toast.classList.add('on');
      clearTimeout(toastT);
      toastT = setTimeout(() => el.toast.classList.remove('on'), 2800);
    },
    // hints: array of [key, text]
    setHint(items) {
      if (hud.touch) items = items.filter((i) => TOUCH_KEY[i[0]]).map((i) => [TOUCH_KEY[i[0]], i[1]]);
      const key = items.map((i) => i.join(':')).join('|') + hud.touch;
      if (key === lastHint) return;
      lastHint = key;
      el.hint.textContent = '';
      for (const [k, text] of items) {
        const s = document.createElement('span'), kb = document.createElement('kbd');
        kb.textContent = k; s.append(kb, text); el.hint.appendChild(s);
      }
    },
    togglePerf() {
      perfOn = !perfOn; el.perf.hidden = !perfOn;
      if (perfOn && !pageKB) { pageKB = document.documentElement.outerHTML.length / 1024; el.perf.textContent = 'MEASURING…'; }
    },
    // st: { env, focus, heading, camYaw, vehicles, inVehicle, game, counts: [cars, peds], blips: [{x, z, color, big, ring}] }
    update(dt, st) {
      const { env, focus, game } = st;
      const h = Math.floor(env.tod), m = Math.floor((env.tod - h) * 60);
      const clock = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      if (clock !== lastClock) {
        lastClock = clock; el.time.textContent = clock; el.phase.textContent = env.phase;
        el.wx.textContent = WEATHER[env.weather].label; el.zone.textContent = game.spire && game.spire.on ? 'SOLSTICE TERRACE' : zoneName(focus.x, focus.z);
      }
      breath(game.swim);
      // cash rolls towards its real value like a tape counter
      if (shown < 0) shown = game.money;
      if (shown !== game.money) {
        const d = game.money - shown, stepN = Math.max(1, Math.ceil(Math.abs(d) * Math.min(1, dt * 6)));
        el.cash.className = 'chip ' + (d > 0 ? 'up' : 'dn');
        shown += Math.sign(d) * Math.min(Math.abs(d), stepN);
        el.money.textContent = shown.toLocaleString('en-US');
        if ((tick += dt) > 0.06) { tick = 0; game.audio.cash(); }
        if (shown === game.money) el.cash.className = 'chip';
      } else if (!el.money.textContent || el.money.textContent === '0') el.money.textContent = shown.toLocaleString('en-US');
      const hp = Math.round(game.health);
      if (hp !== lastHp) { lastHp = hp; el.hpfill.style.transform = `scaleX(${Math.max(0, hp) / 100})`; }
      const sk = game.wanted * 2 + (game.cooling ? 1 : 0);
      if (sk !== lastStars) {
        lastStars = sk;
        starEls.forEach((s, i) => s.classList.toggle('on', i < game.wanted));
        el.stars.classList.toggle('cool', game.cooling);
        el.stars.setAttribute('aria-label', 'Wanted level ' + game.wanted);
      }
      const ms = game.mission;
      const timed = ms && ms.time != null;
      const obj = ms ? (timed ? Math.ceil(ms.time) : '') + '|' + ms.text + '|' + ms.title : '';
      if (obj !== lastObj) {
        lastObj = obj; el.obj.hidden = !ms;
        if (ms) {
          const s = timed ? Math.max(0, Math.ceil(ms.time)) : 0;
          el.objm.textContent = ms.title;
          el.objt.hidden = !timed;
          el.objt.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
          el.objs.textContent = ms.text; el.obj.classList.toggle('late', timed && s <= 10);
        }
      }

      frames++; fpsT += dt;
      if (fpsT >= 0.5) {
        fps = frames / fpsT; frames = 0; fpsT = 0;
        if (perfOn) {
          const i = renderer.info.render;
          el.perf.textContent =
            `FPS         ${fps.toFixed(0)}\nDRAW CALLS  ${i.calls}\nTRIANGLES   ${(i.triangles / 1000).toFixed(1)}k\n` +
            `RES SCALE   ${st.res || ''}\nGRAPHICS    ${st.gfx || ''}\n` +
            `AI CARS     ${st.counts[0]} (TARGET ${st.counts[2]})\nPEDESTRIANS ${st.counts[1]} (TARGET ${st.counts[3]})\nANIMALS     ${st.counts[4]}\n` +
            `GEOMETRIES  ${renderer.info.memory.geometries}\nTEXTURES    ${renderer.info.memory.textures}\nPAGE SIZE   ${pageKB.toFixed(0)} KB (1 file)\nDISTRICTS   ${st.districts || ''}`;
        }
      }
      // minimap, redrawn every third frame; "up" is where the camera looks
      if (frames % 3 !== 0) return;
      const rot = st.camYaw + Math.PI, cs = Math.cos(rot), sn = Math.sin(rot);
      g.setTransform(mk, 0, 0, mk, 0, 0);
      g.clearRect(0, 0, R * 2, R * 2);
      g.save();
      g.beginPath(); g.arc(R, R, R, 0, 6.2832); g.clip();
      g.translate(R, R); g.rotate(rot); g.scale(SCALE, SCALE); g.translate(-(focus.x + OX), -(focus.z + OZ));
      g.drawImage(base, 0, 0);
      const flash = (performance.now() / 250) % 2 < 1;
      const dots = hud.dots || (hud.dots = { police: 0, traffic: 0, other: 0, vacantSkipped: 0 });
      dots.police = dots.traffic = dots.other = dots.vacantSkipped = 0;
      for (const v of st.vehicles.all()) {
        if (v === st.inVehicle || v.sink) continue;
        // vacant parked cars and bikes aren't drawn (too many dots); moving traffic, the patrol and the
        // helicopters / tank are
        if (!v.ai && !v.police && (v.kind === 'car' || v.kind === 'bike')) { dots.vacantSkipped++; continue; }
        if (v.police) dots.police++; else if (v.ai) dots.traffic++; else dots.other++;
        let s = 4;
        if (v.police) { g.fillStyle = v.ai && v.ai.siren ? (flash ? '#ff2a3a' : '#3a7aff') : '#9fd8ff'; s = 6; }
        else if (v.kind === 'car') { g.fillStyle = v.ai ? 'rgba(255,225,74,.6)' : '#ffe14a'; s = (v.ai ? 3 : 4) * (v.len > 6 ? 1.6 : v.len > 4.6 ? 1.25 : 1); }
        else if (v.kind === 'bike') { g.fillStyle = v.ai ? 'rgba(255,140,220,.7)' : '#ff8ad0'; s = 3; }
        else { g.fillStyle = v.kind === 'tank' ? '#8dff5a' : '#27e8ff'; s = 7; }
        g.fillRect(v.x + OX - s / 2, v.z + OZ - s / 2, s, s);
      }
      g.restore();
      // blips are clamped to the rim so far-off places still point the way
      const pulse = 1 + Math.sin(performance.now() / 180) * 0.18;
      for (const p of st.blips) {
        let dx = p.x - focus.x, dz = p.z - focus.z;
        const d = Math.hypot(dx, dz);
        if (d > VIEW) { if (p.near) continue; dx *= VIEW / d; dz *= VIEW / d; }
        if (p.blink && !flash) continue;                          // street events blink
        const x = R + (dx * cs - dz * sn) * SCALE, y = R + (dx * sn + dz * cs) * SCALE, r = (p.big ? 7 : 4) * (p.big ? pulse : 1);
        g.fillStyle = p.color; g.strokeStyle = '#0a0518'; g.lineWidth = 2.5;
        g.beginPath();
        if (p.diamond) { g.moveTo(x, y - r - 2); g.lineTo(x + r + 2, y); g.lineTo(x, y + r + 2); g.lineTo(x - r - 2, y); g.closePath(); }
        else if (p.sq) g.rect(x - 4, y - 4, 8, 8);
        else if (p.star) { for (let k = 0; k < 10; k++) { const a = k * 0.6283 - 1.5708, q = k % 2 ? r * 0.55 : r + 3; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); }
        else g.arc(x, y, r, 0, 6.2832);
        g.stroke(); g.fill();
      }
      // north marker rides the rim
      const nx = R + sn * (R - 13), ny = R - cs * (R - 13);
      g.fillStyle = '#0a0518'; g.beginPath(); g.arc(nx, ny, 10, 0, 6.2832); g.fill();
      g.strokeStyle = '#27e8ff'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#27e8ff'; g.font = '700 13px ui-monospace,Menlo,Consolas,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('N', nx, ny + 1);
      // player arrow
      g.translate(R, R); g.rotate(rot + Math.PI - st.heading);
      g.fillStyle = '#fff'; g.strokeStyle = '#0a0518'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.stroke(); g.fill();
    },
  };
  return hud;
}
