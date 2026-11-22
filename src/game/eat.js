// Eating and drinking: whatever you buy (Pelican Pantry, the street machines, the diner, Kiki's cart, the
// Blue Pelican, the Club Prism bar, the Coconut Shack on the beach, Rudy's taffy) shows up in Skye's hand as
// a little low-poly model, goes to the mouth a few times (a drink tips back) and is gone: about two seconds,
// cut short by moving. Health goes up straight away and never past 100; at full health it still charges and
// plays, and gives a short REFRESHED buff instead (a little faster sprint, swimming costs less stamina).
import * as THREE from 'three';
import { box, cyl, tint, merge, PI, clamp, angleDelta, reducedMotion } from '../core/util.js';

export const REFRESH_S = 40;          // how long the buff lasts (game seconds)
export const EAT_S = 2.1;             // how long the animation runs
// what each menu line looks like in the hand
const KIND = {
  soda: ['can', '#2f7fd8'], cw: ['can', '#19c9bd'], cwz: ['can', '#c9d0dc'], tide: ['can', '#ff8a3d'],
  dog: ['hotdog'], bar: ['bar', '#7a5cff'], curl: ['bag', '#ff8a3d'], gum: ['bag', '#ff5fa8'], trail: ['bag', '#8a6a4a'],
  coffee: ['mug', '#3a2418'], cider: ['mug', '#c8782a'], lime: ['pie'], stack: ['stack'], burger: ['burger'], plate: ['plate'], shake: ['shake'],
  knot: ['pretzel'], swirl: ['swirl'], taffy: ['taffy'],
  tea: ['tall', '#e0a040'], fizz: ['cocktail', '#4f8dff'], lager: ['beer'],
  laser: ['tall', '#e8ff5a'], ultra: ['cocktail', '#9b5cff'], mirror: ['cocktail', '#7fe0ff'], kilowatt: ['cocktail', '#ff3f6a'], filler: ['beer'],
  smoothie: ['smoothie'], softserve: ['cone'], coconut: ['coconut'],
  floss: ['floss'], popcorn: ['popcorn'], corndog: ['corndog'], lemonade: ['tall', '#ff9ac0'],
  snapper: ['plate'], sliders: ['burger'], tartlet: ['pie'], negroni: ['cocktail', '#d8402a'], fizzwine: ['tall', '#ffb0c0'], oldfash: ['cocktail', '#c8782a'],
  cooler: ['tall', '#8dff5a'], tlager: ['beer'], skysour: ['tall', '#ffd447'], sundown: ['cocktail', '#ff6a3d'], nightcap: ['cocktail', '#7a5cff'],
};
const DRINKS = new Set(['can', 'mug', 'tall', 'cocktail', 'beer', 'smoothie', 'shake', 'coconut']);
const CREAM = '#fff6ec', WHITE = '#ffffff';

// the models: a few boxes and cylinders each, origin at the grip, upright (+y), about 1.3x real size so
// they read on a blocky character
function model(kind, c) {
  const g = [];
  const sph = (r, x, y, z, hex, sy = 1) => g.push(tint(new THREE.SphereGeometry(r, 8, 6).scale(1, sy, 1).translate(x, y, z), hex));
  const cone = (r, h, x, y, z, hex, flip = false, seg = 8) => { const k = new THREE.ConeGeometry(r, h, seg); if (flip) k.rotateX(PI); g.push(tint(k.translate(x, y, z), hex)); };
  switch (kind) {
    case 'can': g.push(cyl(0.034, 0.034, 0.12, 10, 0, 0.02, 0, c), cyl(0.0345, 0.0345, 0.03, 10, 0, 0.03, 0, WHITE), cyl(0.028, 0.034, 0.012, 10, 0, 0.086, 0, '#d8dce4'), box(0.012, 0.004, 0.02, 0.008, 0.093, 0, '#b8bcc8')); break;
    case 'tall': g.push(cyl(0.036, 0.031, 0.16, 10, 0, 0.04, 0, c), cyl(0.037, 0.037, 0.012, 10, 0, 0.12, 0, '#f4fbff'), cyl(0.028, 0.028, 0.008, 8, 0.03, 0.118, 0, '#ffe14a', 0, PI / 2), box(0.008, 0.13, 0.008, -0.012, 0.17, 0, '#ff3f6a', 0, 0, 0.2)); break;
    case 'smoothie': g.push(cyl(0.046, 0.034, 0.14, 10, 0, 0.03, 0, '#ff8fb0'), cyl(0.047, 0.047, 0.03, 10, 0, 0.0, 0, '#27d8cf'), box(0.012, 0.13, 0.012, 0.01, 0.15, 0, '#ffd447', 0, 0, -0.15)); sph(0.046, 0, 0.1, 0, '#ffe4ee', 0.6); break;
    case 'shake': g.push(cyl(0.042, 0.03, 0.16, 10, 0, 0.03, 0, '#ffc2dc'), cyl(0.018, 0.026, 0.02, 8, 0, -0.06, 0, '#e8f4ff'), box(0.01, 0.15, 0.01, 0.015, 0.17, 0, '#ff3f6a', 0, 0, -0.2)); sph(0.044, 0, 0.12, 0, WHITE, 0.8); sph(0.014, 0, 0.165, 0, '#d0102a'); break;
    case 'cocktail': g.push(cyl(0.006, 0.006, 0.08, 6, 0, -0.03, 0, '#e8f4ff'), cyl(0.03, 0.03, 0.006, 10, 0, -0.07, 0, '#e8f4ff'));
      cone(0.05, 0.07, 0, 0.045, 0, c, true, 10); g.push(cyl(0.05, 0.05, 0.004, 10, 0, 0.08, 0, '#f4fbff'), box(0.004, 0.09, 0.004, 0.02, 0.115, 0, '#c9a46a', 0, 0, -0.35)); cone(0.045, 0.02, 0.04, 0.155, 0, '#ff5fa8', false, 8); g.push(cyl(0.016, 0.016, 0.006, 8, -0.04, 0.082, 0, '#8dff5a', PI / 2)); break;
    case 'beer': g.push(cyl(0.042, 0.034, 0.16, 10, 0, 0.03, 0, '#e8a832'), cyl(0.043, 0.043, 0.03, 10, 0, 0.12, 0, '#fff8e8')); sph(0.04, 0, 0.135, 0, '#ffffff', 0.4); break;
    case 'mug': g.push(cyl(0.04, 0.038, 0.09, 10, 0, 0.0, 0, CREAM), cyl(0.034, 0.034, 0.004, 10, 0, 0.043, 0, c), box(0.012, 0.06, 0.012, 0.05, 0.0, 0, CREAM), box(0.02, 0.012, 0.012, 0.044, 0.026, 0, CREAM), box(0.02, 0.012, 0.012, 0.044, -0.026, 0, CREAM)); break;
    case 'coconut': sph(0.065, 0, 0.02, 0, '#7a4a26', 0.95); g.push(box(0.01, 0.14, 0.01, 0.01, 0.12, 0, '#ff5fa8', 0, 0, -0.2), box(0.004, 0.08, 0.004, -0.02, 0.1, 0, '#c9a46a', 0, 0, 0.3)); cone(0.04, 0.016, -0.034, 0.142, 0, '#ffd447'); break;
    case 'cone': cone(0.034, 0.13, 0, -0.02, 0, '#e0b070', true, 8); sph(0.036, 0, 0.065, 0, '#ffb6d0'); sph(0.03, 0, 0.11, 0, '#fff3c0'); cone(0.016, 0.03, 0, 0.145, 0, '#fff3c0'); break;
    case 'hotdog': g.push(box(0.05, 0.03, 0.17, 0, 0, 0, '#e0a860'), cyl(0.016, 0.016, 0.2, 8, 0, 0.02, 0, '#b0482a', PI / 2), box(0.008, 0.006, 0.15, 0, 0.037, 0, '#ffd21a')); break;
    case 'burger': g.push(cyl(0.056, 0.05, 0.022, 10, 0, -0.03, 0, '#d9953e'), cyl(0.058, 0.058, 0.02, 10, 0, -0.01, 0, '#5a2a18'), box(0.1, 0.006, 0.1, 0, 0.002, 0, '#ffc93f', 0, PI / 4), cyl(0.06, 0.06, 0.008, 10, 0, 0.008, 0, '#5fbf4a')); sph(0.056, 0, 0.018, 0, '#e0a050', 0.55);
      for (let i = 0; i < 5; i++) g.push(box(0.008, 0.004, 0.012, Math.cos(i * 1.3) * 0.03, 0.046, Math.sin(i * 1.3) * 0.03, '#fff6dc', 0, i)); break;
    case 'fries': g.push(box(0.07, 0.07, 0.04, 0, 0, 0, '#ff3f3a'), box(0.072, 0.012, 0.042, 0, 0.0, 0, '#ffd447')); for (let i = 0; i < 7; i++) g.push(box(0.009, 0.07, 0.009, -0.026 + i * 0.009, 0.05 + (i % 3) * 0.008, (i % 2 - 0.5) * 0.016, '#ffd36a', 0, 0, (i - 3) * 0.06)); break;
    case 'bar': g.push(box(0.05, 0.12, 0.018, 0, 0, 0, c), box(0.052, 0.025, 0.02, 0, 0.0, 0, '#ffe14a'), box(0.044, 0.03, 0.014, 0, 0.073, 0, '#5a3220')); break;
    case 'bag': g.push(box(0.1, 0.13, 0.04, 0, 0.01, 0, c), box(0.1, 0.012, 0.012, 0, 0.08, 0, '#ffffff'), box(0.05, 0.04, 0.042, 0, 0.01, 0, '#ffe14a')); break;
    case 'pie': { const w = new THREE.CylinderGeometry(0.09, 0.09, 0.035, 6, 1, false, 0, PI / 3).translate(0, 0.0, 0); g.push(tint(w, '#d8f080'), tint(new THREE.CylinderGeometry(0.092, 0.092, 0.012, 6, 1, false, 0, PI / 3).translate(0, -0.02, 0), '#c8904a'), tint(new THREE.CylinderGeometry(0.09, 0.09, 0.014, 6, 1, false, 0, PI / 3).translate(0, 0.023, 0), WHITE)); break; }
    case 'stack': g.push(cyl(0.09, 0.08, 0.01, 12, 0, -0.03, 0, WHITE)); for (let i = 0; i < 3; i++) g.push(cyl(0.064, 0.064, 0.015, 10, 0, -0.016 + i * 0.016, 0, '#e0a050')); g.push(cyl(0.05, 0.05, 0.004, 10, 0, 0.026, 0, '#a0521a'), box(0.02, 0.012, 0.02, 0, 0.033, 0, '#fff0a0')); break;
    case 'plate': g.push(cyl(0.1, 0.085, 0.01, 12, 0, -0.03, 0, WHITE), box(0.07, 0.035, 0.045, -0.025, -0.008, 0.012, '#8a4a2a'), box(0.012, 0.006, 0.012, 0.03, -0.02, -0.04, '#3f9f4a'), box(0.016, 0.006, 0.01, 0.045, -0.02, -0.025, '#3f9f4a')); sph(0.032, 0.035, -0.015, 0.02, '#fffbe8', 0.6); break;
    case 'pretzel': for (const s of [-1, 1]) g.push(tint(new THREE.TorusGeometry(0.035, 0.012, 5, 10).translate(s * 0.026, 0, 0), '#b8743a')); g.push(box(0.012, 0.012, 0.012, 0.01, 0.03, 0.012, WHITE), box(0.01, 0.01, 0.01, -0.03, -0.02, 0.012, WHITE)); break;
    case 'swirl': g.push(cyl(0.06, 0.06, 0.028, 12, 0, 0, 0, '#d89a5a', PI / 2), cyl(0.05, 0.05, 0.004, 12, 0, 0, 0.016, WHITE, PI / 2), box(0.08, 0.006, 0.004, 0, 0, 0.019, '#a0622a')); break;
    case 'taffy': g.push(box(0.05, 0.026, 0.026, 0, 0, 0, '#ff8fc4'), box(0.052, 0.006, 0.027, 0, 0, 0, WHITE));
      for (const s of [-1, 1]) g.push(tint(new THREE.ConeGeometry(0.016, 0.022, 6).rotateZ(s * PI / 2).translate(s * 0.035, 0, 0), '#ff8fc4')); break;
    case 'floss': g.push(box(0.012, 0.22, 0.012, 0, 0.0, 0, '#f6f1e7')); sph(0.075, 0, 0.15, 0, '#ffb6d9', 1.1); sph(0.05, 0.04, 0.2, 0.02, '#ffc8e2'); sph(0.05, -0.04, 0.12, -0.02, '#ff9ccc'); break;
    case 'popcorn': for (let i = 0; i < 6; i++) g.push(box(0.03, 0.12, 0.012, -0.035 + (i % 3) * 0.035, 0.0, i < 3 ? 0.04 : -0.04, i % 2 ? '#ff3f3a' : WHITE)); g.push(box(0.012, 0.12, 0.08, 0.05, 0, 0, '#ff3f3a'), box(0.012, 0.12, 0.08, -0.05, 0, 0, WHITE));
      for (let i = 0; i < 9; i++) sph(0.018, -0.03 + (i % 3) * 0.03, 0.065 + (i % 2) * 0.01, -0.03 + Math.floor(i / 3) * 0.03, '#fff3c8'); break;
    case 'corndog': g.push(box(0.01, 0.12, 0.01, 0, -0.04, 0, '#e8d0a0'), cyl(0.026, 0.022, 0.14, 8, 0, 0.08, 0, '#d89040'), box(0.006, 0.12, 0.006, 0.024, 0.09, 0, '#ffd21a')); sph(0.026, 0, 0.15, 0, '#d89040'); break;
    default: g.push(box(0.06, 0.06, 0.06, 0, 0, 0, c || WHITE));
  }
  const geo = merge(g);
  geo.scale(1.3, 1.3, 1.3);
  return geo;
}

export function createEat(game) {
  const { player, hud, audio } = game;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const cache = {};
  const geoOf = (kind, c) => { const k = kind + (c || ''); return cache[k] || (cache[k] = model(kind, c)); };
  // holders at the hands: kept upright in the body's frame while the arm swings
  const mk = (arm) => { const h = new THREE.Group(); h.position.set(0, -0.6, 0.02); const m = new THREE.Mesh(geoOf('can', '#2f7fd8'), mat); m.frustumCulled = false; h.add(m); h.visible = false; arm.add(h); h.layers.enable(1); m.layers.enable(1); return [h, m]; };
  const [holdR, meshR] = mk(player.model.armR), [holdL, meshL] = mk(player.model.armL);
  const E = { active: false, t: 0, item: null, kind: null, drink: false, side: false, yaw0: 0, count: 0, last: null };
  const stats = { eaten: 0, refreshed: 0, cancelled: 0, overMax: 0 };
  let refreshT = 0;
  player.boost = 1;

  function start(item) {
    const k = KIND[item.id] || ['bag', '#ffd447'];
    E.kind = k[0]; E.drink = DRINKS.has(k[0]); E.t = 0; E.active = true; E.item = item.id; E.count++;
    meshR.geometry = geoOf(k[0], k[1]); holdR.visible = true; holdR.scale.setScalar(1);
    E.side = E.kind === 'burger';
    if (E.side) { meshL.geometry = geoOf('fries'); holdL.visible = true; holdL.scale.setScalar(1); } else holdL.visible = false;
    E.yaw0 = player.yaw;
  }
  function stop(cancel) {
    if (!E.active) return;
    E.active = false; holdR.visible = holdL.visible = false;
    if (cancel) stats.cancelled++;
    // put the arms back if nothing else is posing the courier right now (a shop on the street)
    const m = player.model;
    m.armR.rotation.set(0, 0, -0.08); m.armL.rotation.set(0, 0, 0.08); m.head.rotation.x = 0;
    if (!game.inside && !game.act.mode) m.root.rotation.y = player.yaw;
  }

  const api = {
    get active() { return E.active; },
    get refreshed() { return refreshT > 0; },
    stats,
    // a purchase went through (the caller took the money): heal or refresh, then the hand-to-mouth bit.
    // Returns the line for the shop panel.
    consume(item) {
      const before = game.health, heal = item.heal || 0;
      let line;
      if (before >= 100 - 1e-6) {
        refreshT = REFRESH_S; stats.refreshed++; player.boost = 1.08;
        hud.toast('+ REFRESHED', `${item.name} · A LITTLE EXTRA SPRINT FOR ${REFRESH_S} S`);
        line = `${item.name}: REFRESHED! + EXTRA SPRINT FOR A WHILE`;
      } else {
        game.health = Math.min(100, before + heal);
        line = `${item.name}: +${Math.round(game.health - before)} HEALTH`;
      }
      if (game.health > 100) { game.health = 100; stats.overMax++; }
      stats.eaten++; E.last = item.id;
      start(item);
      return line;
    },
    // after everything else has posed the courier this frame
    update(dt, ctl) {
      if (refreshT > 0) { refreshT -= dt; if (refreshT <= 0) player.boost = 1; }
      if (!E.active) return;
      const busy = game.busy;
      if (game.vehicle || player.hidden || (game.swim && game.swim.wet) || busy === 'cut' || busy === 'door' || busy === 'down' || busy === 'walkout' || game.act.mode === 'dance' || game.act.mode === 'pat') return stop(true);
      if (E.t > 0.2 && (Math.abs(ctl.move) > 0.1 || Math.abs(ctl.strafe) > 0.1 || ctl.jump)) return stop(true);
      E.t += dt;
      if (E.t >= EAT_S) return stop(false);
      const m = player.model, t = E.t;
      // raise (0.3 s), three trips to the mouth, lower (0.25 s); a drink tips back with the head
      const up = clamp(t / 0.3, 0, 1) * clamp((EAT_S - t) / 0.25, 0, 1);
      const trips = clamp((t - 0.3) / (EAT_S - 0.55), 0, 1);
      const mouth = up * (t > 0.3 && t < EAT_S - 0.25 ? Math.pow(Math.sin(trips * PI * 3), 2) : 0) * (reducedMotion ? 0.8 : 1);
      const rx = -0.35 - 0.6 * up - 1.25 * mouth, rz = 0.08 + 0.38 * mouth;
      m.armR.rotation.set(rx, 0, rz);
      holdR.rotation.set(-rx - (E.drink ? 0.75 : 0.2) * mouth, 0, -rz);
      if (E.side) { m.armL.rotation.set(-0.35 - 0.6 * up, 0, -0.1); holdL.rotation.set(0.35 + 0.6 * up, 0, 0.1); }
      m.head.rotation.x = (E.drink ? -0.28 : 0.12) * mouth;
      // the last bite: the item goes small and is gone
      const s = t > EAT_S - 0.3 ? clamp((EAT_S - t) / 0.3, 0, 1) : 1;
      holdR.scale.setScalar(Math.max(0.01, s)); holdL.scale.setScalar(Math.max(0.01, s));
      // at a counter or a machine (menu open), turn three-quarters to the camera so you can see it
      if (busy === 'shop' && !game.act.mode && !game.cam.first) {
        const c = game.camera.position, want = Math.atan2(c.x - player.pos.x, c.z - player.pos.z) + 0.75;
        E.yaw0 += angleDelta(E.yaw0, want) * (1 - Math.exp(-6 * dt));
        m.root.rotation.y = E.yaw0;
      } else E.yaw0 = m.root.rotation.y;
    },
    cancel: () => stop(true),
    // a shower or a soak at home (game/homes.js): the same buff, for as long as the home is good for
    refresh(sec = REFRESH_S) { refreshT = Math.max(refreshT, sec); stats.refreshed++; player.boost = 1.08; },
    state: () => ({ active: E.active, kind: E.kind, item: E.item, t: +E.t.toFixed(2), drink: E.drink, visible: holdR.visible, fries: holdL.visible, refreshed: refreshT > 0, refreshT: +refreshT.toFixed(1), boost: player.boost, health: game.health, ...stats }),
  };
  return api;
}
