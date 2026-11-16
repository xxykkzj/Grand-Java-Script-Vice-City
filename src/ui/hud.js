// DOM HUD. Top-left: a round minimap that turns with the camera, and beside it a stack of
// clock, cash, health and wanted stars. Also the objective chip, hints, toast and perf panel.
import { HX, HZ, PIER, zoneName } from '../world/layout.js';
import { WEATHER } from '../world/environment.js';

const $ = (id) => document.getElementById(id);

export function createHud(L, groundCanvas, renderer) {
  const el = {};
  for (const id of ['hud', 'time', 'phase', 'wx', 'zone', 'hint', 'toast', 'perf', 'map', 'money', 'cash', 'hpfill', 'stars', 'obj', 'objt', 'objs']) el[id] = $(id);
  const starEls = [...el.stars.children];

  // static minimap layer: 1 px per world unit, painted once
  const PAD = 110, MW = HX * 2 + PAD * 2, MH = HZ * 2 + PAD * 2;
  const base = document.createElement('canvas');
  base.width = MW; base.height = MH;
  const b = base.getContext('2d');
  b.fillStyle = '#0d1440'; b.fillRect(0, 0, MW, MH);
  b.globalAlpha = 0.55; b.drawImage(groundCanvas, PAD, PAD, HX * 2, HZ * 2); b.globalAlpha = 1;
  b.fillStyle = 'rgba(20,8,48,.35)'; b.fillRect(PAD, PAD, HX * 2, HZ * 2);
  b.fillStyle = '#b98a5e'; b.fillRect(PAD + PIER.x0 + HX, PAD + PIER.z0 + HZ, PIER.x1 - PIER.x0, PIER.z1 - PIER.z0);
  for (const s of L.buildings) {
    b.fillStyle = s.bar ? '#ff2bd1' : s.hotel ? '#ff7ac8' : '#c9a6ff';
    b.fillRect(PAD + s.x0 + HX, PAD + s.z0 + HZ, s.w, s.d);
  }
  const g = el.map.getContext('2d');
  const R = el.map.width / 2, SCALE = 1.5, VIEW = R / SCALE - 9;

  let toastT = 0, lastHint = '', lastClock = '', frames = 0, fpsT = 0, fps = 0, pageKB = 0, perfOn = false;
  let shown = -1, lastHp = -1, lastStars = -1, lastObj = '', tick = 0;
  const hud = {
    show() { el.hud.hidden = false; },
    toast(title, sub = '') {
      el.toast.textContent = title;
      if (sub) { const s = document.createElement('small'); s.textContent = sub; el.toast.appendChild(s); }
      el.toast.classList.add('on');
      clearTimeout(toastT);
      toastT = setTimeout(() => el.toast.classList.remove('on'), 2800);
    },
    // hints: array of [key, text]
    setHint(items) {
      const key = items.map((i) => i.join(':')).join('|');
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
        el.wx.textContent = WEATHER[env.weather].label; el.zone.textContent = zoneName(focus.x, focus.z);
      }
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
      const obj = ms ? Math.ceil(ms.time) + '|' + ms.text : '';
      if (obj !== lastObj) {
        lastObj = obj; el.obj.hidden = !ms;
        if (ms) {
          const s = Math.max(0, Math.ceil(ms.time));
          el.objt.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
          el.objs.textContent = ms.text; el.obj.classList.toggle('late', s <= 10);
        }
      }

      frames++; fpsT += dt;
      if (fpsT >= 0.5) {
        fps = frames / fpsT; frames = 0; fpsT = 0;
        if (perfOn) {
          const i = renderer.info.render;
          el.perf.textContent =
            `FPS         ${fps.toFixed(0)}\nDRAW CALLS  ${i.calls}\nTRIANGLES   ${(i.triangles / 1000).toFixed(1)}k\n` +
            `AI CARS     ${st.counts[0]}\nPEDESTRIANS ${st.counts[1]}\n` +
            `GEOMETRIES  ${renderer.info.memory.geometries}\nTEXTURES    ${renderer.info.memory.textures}\nPAGE SIZE   ${pageKB.toFixed(0)} KB (1 file)\nASSET FILES 0`;
        }
      }
      // minimap, redrawn every third frame; "up" is where the camera looks
      if (frames % 3 !== 0) return;
      const rot = st.camYaw + Math.PI, cs = Math.cos(rot), sn = Math.sin(rot);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, R * 2, R * 2);
      g.save();
      g.beginPath(); g.arc(R, R, R, 0, 6.2832); g.clip();
      g.translate(R, R); g.rotate(rot); g.scale(SCALE, SCALE); g.translate(-(focus.x + HX + PAD), -(focus.z + HZ + PAD));
      g.drawImage(base, 0, 0);
      const flash = (performance.now() / 250) % 2 < 1;
      for (const v of st.vehicles.all()) {
        if (v === st.inVehicle) continue;
        let s = 4;
        if (v.police) { g.fillStyle = v.ai && v.ai.siren ? (flash ? '#ff2a3a' : '#3a7aff') : '#9fd8ff'; s = 6; }
        else if (v.kind === 'car') { g.fillStyle = v.ai ? 'rgba(255,225,74,.6)' : '#ffe14a'; s = v.ai ? 3 : 4; }
        else { g.fillStyle = v.kind === 'tank' ? '#8dff5a' : '#27e8ff'; s = 7; }
        g.fillRect(v.x + HX + PAD - s / 2, v.z + HZ + PAD - s / 2, s, s);
      }
      g.restore();
      // blips are clamped to the rim so far-off places still point the way
      const pulse = 1 + Math.sin(performance.now() / 180) * 0.18;
      for (const p of st.blips) {
        let dx = p.x - focus.x, dz = p.z - focus.z;
        const d = Math.hypot(dx, dz);
        if (d > VIEW) { if (p.near) continue; dx *= VIEW / d; dz *= VIEW / d; }
        const x = R + (dx * cs - dz * sn) * SCALE, y = R + (dx * sn + dz * cs) * SCALE, r = (p.big ? 7 : 4) * (p.big ? pulse : 1);
        g.fillStyle = p.color; g.strokeStyle = '#0a0518'; g.lineWidth = 2.5;
        g.beginPath();
        if (p.diamond) { g.moveTo(x, y - r - 2); g.lineTo(x + r + 2, y); g.lineTo(x, y + r + 2); g.lineTo(x - r - 2, y); g.closePath(); } else g.arc(x, y, r, 0, 6.2832);
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
