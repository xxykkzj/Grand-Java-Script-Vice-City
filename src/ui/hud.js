// DOM HUD: clock, circular minimap, context hints, toast, perf panel.
import { HX, HZ, PIER, zoneName } from '../world/layout.js';

const $ = (id) => document.getElementById(id);

export function createHud(L, groundCanvas, renderer) {
  const el = { hud: $('hud'), time: $('time'), phase: $('phase'), zone: $('zone'), hint: $('hint'), toast: $('toast'), perf: $('perf'), map: $('map') };

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
    b.fillStyle = s.hotel ? '#ff7ac8' : '#c9a6ff';
    b.fillRect(PAD + s.x0 + HX, PAD + s.z0 + HZ, s.w, s.d);
  }
  const g = el.map.getContext('2d');
  const R = el.map.width / 2, SCALE = 1.7;

  let toastT = 0, lastHint = '', lastClock = '', frames = 0, fpsT = 0, fps = 0, pageKB = 0, perfOn = false;
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
    update(dt, env, focus, heading, vehicles, inVehicle) {
      const h = Math.floor(env.tod), m = Math.floor((env.tod - h) * 60);
      const clock = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      if (clock !== lastClock) { lastClock = clock; el.time.textContent = clock; el.phase.textContent = env.storm ? 'STORM' : env.phase; el.zone.textContent = zoneName(focus.x, focus.z); }

      frames++; fpsT += dt;
      if (fpsT >= 0.5) {
        fps = frames / fpsT; frames = 0; fpsT = 0;
        if (perfOn) {
          const i = renderer.info.render;
          el.perf.textContent =
            `FPS         ${fps.toFixed(0)}\nDRAW CALLS  ${i.calls}\nTRIANGLES   ${(i.triangles / 1000).toFixed(1)}k\n` +
            `GEOMETRIES  ${renderer.info.memory.geometries}\nTEXTURES    ${renderer.info.memory.textures}\nPAGE SIZE   ${pageKB.toFixed(0)} KB (1 file)\nASSET FILES 0`;
        }
      }
      // minimap (north up), redrawn every third frame
      if (frames % 3 !== 0) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, R * 2, R * 2);
      g.save();
      g.beginPath(); g.arc(R, R, R, 0, 6.2832); g.clip();
      g.translate(R, R); g.scale(SCALE, SCALE); g.translate(-(focus.x + HX + PAD), -(focus.z + HZ + PAD));
      g.drawImage(base, 0, 0);
      for (const v of vehicles.all()) {
        if (v === inVehicle) continue;
        g.fillStyle = v.kind === 'car' ? '#ffe14a' : v.kind === 'tank' ? '#8dff5a' : '#27e8ff';
        const s = v.kind === 'car' ? 4 : 7;
        g.fillRect(v.x + HX + PAD - s / 2, v.z + HZ + PAD - s / 2, s, s);
      }
      g.restore();
      // player arrow
      g.translate(R, R); g.rotate(-heading + Math.PI);
      g.fillStyle = '#fff'; g.strokeStyle = '#0a0518'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.stroke(); g.fill();
    },
  };
  return hud;
}
