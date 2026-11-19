// The neon blasters, firework bangs and the Coast Patrol's roof lasers.
//   You: on foot you aim with the camera (crosshair; soft auto-aim at the nearest vehicle in a narrow
//   cone, a wide one on touch). Click or R fires (hold R to keep firing), Q / the mouse wheel / 1-5
//   switch (Q also holsters), G throws a firework bang (hold for distance). From a car or the Comet you
//   fire forwards with auto-aim and G drops a bang behind you to shake off a chase.
//   Shots only ever damage vehicles (game/damage.js) and knock loose props about: people flinch, shout
//   "hey!" and run. Damaging patrol cars, or cars in front of a patrol car, raises the heat.
//   The patrol, from 3 stars: each chasing car telegraphs with a flickering aim line (0.6 s), then fires
//   a burst of three pulse beams. The hit chance falls with distance and with how fast you cross its line
//   of fire, and buildings block it, so weaving and breaking line of sight work. More units and faster
//   fire at 4 and 5 stars. On foot the beams are stun shots: a little health and a stagger.
// Projectiles are one instanced mesh, beams and sparks are the shared effect pools (vehicles/effects.js).
import * as THREE from 'three';
import { clamp, angleDelta, segBlocked, pushOut, PI, box, cyl, merge, timeU } from '../core/util.js';
import { ARMS } from './story.js';
import { circlesOf } from '../vehicles/vehicles.js';
import { LASER_MOUNT } from '../vehicles/models.js';
import { disabled } from './damage.js';

const $ = (id) => document.getElementById(id);
export const BYID = Object.fromEntries(ARMS.map((w) => [w.id, w]));

// first hit of a ray (unit direction) with an axis-aligned box standing on the ground (0..h); -1 = none
function rayBox(ox, oy, oz, dx, dy, dz, b, max) {
  let t0 = 0, t1 = max;
  if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) return -1; } else {
    let a = (b.x0 - ox) / dx, c = (b.x1 - ox) / dx; if (a > c) { const s = a; a = c; c = s; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return -1;
  }
  if (Math.abs(dy) < 1e-9) { if (oy < 0 || oy > b.h) return -1; } else {
    let a = -oy / dy, c = (b.h - oy) / dy; if (a > c) { const s = a; a = c; c = s; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return -1;
  }
  if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) return -1; } else {
    let a = (b.z0 - oz) / dz, c = (b.z1 - oz) / dz; if (a > c) { const s = a; a = c; c = s; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return -1;
  }
  return t0;
}
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = l2 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};
const vSpan = (v) => (v.kind === 'heli' ? [v.y + 0.3, v.y + 3.1] : v.kind === 'tank' ? [0, 3] : [(v.y || 0) - 0.1, (v.y || 0) + 1.75]);
const vMid = (v) => (v.kind === 'heli' ? v.y + 1.6 : v.kind === 'tank' ? 1.5 : (v.y || 0) + 0.85);

// the blaster in Skye's hand: one small model per weapon, forward = +z, grip at the origin
function heldGeometry(id) {
  const P = [];
  const g = (geo, k = 0) => { const n = geo.attributes.position.count; geo.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(k), 1)); P.push(geo); };
  const DARK = '#22203a', W = BYID[id].color;
  if (id === 'pop') {
    g(box(0.09, 0.12, 0.26, 0, 0.04, 0.09, DARK)); g(box(0.07, 0.15, 0.08, 0, -0.06, -0.01, '#3a3550', 0.25));
    g(cyl(0.035, 0.035, 0.14, 6, 0, 0.06, 0.27, '#c9c0d8', PI / 2)); g(box(0.095, 0.03, 0.22, 0, 0.11, 0.09, W), 1); g(cyl(0.045, 0.045, 0.02, 8, 0, 0.06, 0.34, W, PI / 2), 1);
  } else if (id === 'prism') {
    g(box(0.08, 0.1, 0.6, 0, 0.04, 0.2, DARK)); g(box(0.07, 0.13, 0.2, 0, 0.0, -0.14, '#3a3550')); g(box(0.06, 0.14, 0.07, 0, -0.06, 0.04, '#3a3550'));
    g(cyl(0.08, 0.08, 0.14, 3, 0, 0.05, 0.52, '#bff8ff', PI / 2), 1); g(box(0.085, 0.025, 0.46, 0, 0.1, 0.2, W), 1); g(box(0.02, 0.06, 0.12, 0, 0.13, 0.05, '#ff3fb4'), 1);
  } else if (id === 'arc') {
    g(box(0.07, 0.15, 0.08, 0, -0.06, 0, '#3a3550')); g(cyl(0.03, 0.03, 0.46, 6, 0, 0.05, 0.2, '#c9c0d8', PI / 2));
    for (let i = 0; i < 3; i++) g(cyl(0.085 - i * 0.012, 0.085 - i * 0.012, 0.03, 10, 0, 0.05, 0.12 + i * 0.11, W, PI / 2), 1);
    g(cyl(0.05, 0.05, 0.08, 8, 0, 0.05, 0.45, '#ffffff', PI / 2), 1);
  } else if (id === 'bang') {
    g(cyl(0.055, 0.055, 0.22, 8, 0, 0.0, 0.06, '#ff3f6a', PI / 2)); g(cyl(0.058, 0.058, 0.04, 8, 0, 0.0, 0.1, '#ffe14a', PI / 2), 0.6); g(cyl(0.058, 0.058, 0.04, 8, 0, 0.0, 0.0, '#ffe14a', PI / 2), 0.6);
    g(box(0.012, 0.012, 0.08, 0, 0.0, 0.2, '#c9c0d8')); g(box(0.03, 0.03, 0.03, 0, 0.0, 0.24, '#fff3c4'), 1);
  } else {
    g(cyl(0.065, 0.075, 0.6, 8, 0, 0.05, 0.18, '#3a1d8a', PI / 2)); g(box(0.07, 0.15, 0.08, 0, -0.07, 0, '#3a3550'));
    for (let i = 0; i < 3; i++) g(cyl(0.078, 0.078, 0.035, 8, 0, 0.05, 0.0 + i * 0.17, i % 2 ? '#ffe14a' : W, PI / 2), 1);
    g(cyl(0.05, 0.05, 0.02, 8, 0, 0.05, 0.48, '#fff3c4', PI / 2), 1);
  }
  return merge(P);
}

// the little weapon icon in the HUD chip (108 x 48 canvas)
function drawIcon(ctx, id) {
  ctx.clearRect(0, 0, 108, 48);
  if (!id) return;
  const c = BYID[id].color;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.shadowColor = c; ctx.shadowBlur = 8; ctx.strokeStyle = c; ctx.fillStyle = 'rgba(10,5,24,.6)'; ctx.lineWidth = 3;
  const path = (pts, close = true) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (close) ctx.closePath(); ctx.fill(); ctx.stroke(); };
  if (id === 'pop') { path([[22, 14], [78, 14], [86, 20], [86, 24], [46, 24], [42, 38], [30, 38], [32, 24], [22, 24]]); ctx.beginPath(); ctx.arc(90, 19, 3, 0, 6.3); ctx.stroke(); }
  else if (id === 'prism') { path([[8, 18], [72, 18], [72, 26], [30, 26], [26, 36], [16, 36], [18, 26], [8, 28]]); path([[74, 12], [96, 22], [74, 32]]); }
  else if (id === 'arc') { ctx.beginPath(); ctx.moveTo(10, 24); ctx.lineTo(84, 24); ctx.stroke(); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(36 + i * 18, 24, 5, 12, 0, 0, 6.3); ctx.stroke(); } path([[84, 24], [92, 14], [90, 22], [100, 20], [90, 36], [92, 27]], false); }
  else if (id === 'bang') { ctx.fillStyle = 'rgba(255,63,106,.5)'; path([[30, 16], [70, 16], [70, 34], [30, 34]]); ctx.beginPath(); ctx.moveTo(70, 25); ctx.quadraticCurveTo(80, 14, 88, 18); ctx.stroke(); ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(90, 17, 3.5, 0, 6.3); ctx.fill(); }
  else { path([[10, 18], [80, 14], [80, 34], [10, 30]]); for (const [x, y] of [[90, 12], [98, 24], [90, 36]]) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 6.3); ctx.stroke(); } }
  ctx.restore();
}

export function createCombat(game, scene) {
  const { vehicles, fx, audio, hud, player, peds, L, input, cam, camera, save, traffic, damage, rules } = game;
  const solids = L.solids;
  const stats = { shots: 0, hits: 0, laserShots: 0, laserHits: 0, stuns: 0, bangs: 0, stars: 0, scared: 0 };

  // ---- what you carry (kept in the save, like the outfits)
  const inv = game.arms = { owned: {}, ammo: {}, cur: null };
  {
    const sv = save.arms || {};
    for (const w of ARMS) { inv.owned[w.id] = !!(sv.owned && sv.owned[w.id]); inv.ammo[w.id] = clamp(Math.floor((sv.ammo && sv.ammo[w.id]) || 0), 0, w.max); }
    if (sv.cur && inv.owned[sv.cur]) inv.cur = sv.cur;
  }
  let dirty = false, saveT = 0;
  const persist = () => { save.arms = { owned: { ...inv.owned }, ammo: { ...inv.ammo }, cur: inv.cur }; game.persist(); dirty = false; };

  // ---- projectiles: bolts, firework bangs, candle stars (one instanced mesh, additive)
  const PN = 48;
  const projMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), PN);
  projMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PN * 3), 3);
  projMesh.frustumCulled = false; projMesh.count = 0; projMesh.visible = false; projMesh.renderOrder = 8;
  scene.add(projMesh);
  const P = [];
  for (let i = 0; i < PN; i++) P.push({ on: false, col: new THREE.Color() });
  function launch(o) {
    const p = P.find((k) => !k.on);
    if (!p) return null;
    Object.assign(p, { on: true, t: 0, scared: false, target: null, owner: null, fuse: 0, arm: 0, turn: 0, scale: 1 }, o);
    p.col.set(o.color || '#ffffff');
    return p;
  }

  // ---- the blaster in the courier's hand
  const holder = new THREE.Group();
  holder.position.set(0, -0.58, 0.03); holder.rotation.x = PI / 2;
  const heldMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  heldMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aGlow; varying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlow = aGlow;');
    sh.fragmentShader = 'varying float vGlow;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vGlow * 1.2;');
  };
  const held = new THREE.Mesh(heldGeometry('pop'), heldMat);
  const heldGeo = { pop: held.geometry };
  holder.add(held); holder.visible = false;
  player.model.armR.add(holder);
  let heldId = 'pop';
  if (inv.cur && inv.cur !== 'pop') { held.geometry = heldGeo[inv.cur] = heldGeometry(inv.cur); heldId = inv.cur; }

  // ---- ray casting against the ground, the buildings and the vehicles
  const R = { t: 0, v: null };
  const CS = [];
  function ray(ox, oy, oz, dx, dy, dz, max, skip) {
    let best = max, hv = null;
    if (dy < -1e-5) { const t = (0.02 - oy) / dy; if (t >= 0 && t < best) best = t; }
    for (const b of solids) {
      if (Math.min(ox, ox + dx * best) > b.x1 + 1 || Math.max(ox, ox + dx * best) < b.x0 - 1 || Math.min(oz, oz + dz * best) > b.z1 + 1 || Math.max(oz, oz + dz * best) < b.z0 - 1) continue;
      const t = rayBox(ox, oy, oz, dx, dy, dz, b, best);
      if (t >= 0 && t < best) best = t;
    }
    const a2 = dx * dx + dz * dz;
    if (a2 > 1e-8) for (const v of vehicles.all()) {
      if (v === skip) continue;
      const tc = clamp(((v.x - ox) * dx + (v.z - oz) * dz) / a2, 0, best);
      if (Math.hypot(ox + dx * tc - v.x, oz + dz * tc - v.z) > 5) continue;
      const [y0, y1] = vSpan(v);
      for (const c of circlesOf(v, CS)) {
        const fx_ = ox - c[0], fz = oz - c[1], b = 2 * (fx_ * dx + fz * dz), cc = fx_ * fx_ + fz * fz - c[2] * c[2], disc = b * b - 4 * a2 * cc;
        if (disc < 0) continue;
        let t = (-b - Math.sqrt(disc)) / (2 * a2);
        if (t < 0) { if (cc <= 0) t = 0; else continue; }
        const y = oy + dy * t;
        if (t < best && y >= y0 && y <= y1) { best = t; hv = v; }
      }
    }
    R.t = best; R.v = hv;
    return R;
  }
  // anyone near the line of fire flinches, shouts and runs (never hurt)
  function scareAlong(ax, az, bx, bz) {
    let n = 0;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, r = Math.hypot(bx - ax, bz - az) / 2 + 2.4;
    game.grid.query(mx, mz, r, (o) => {
      if (!o.isPed || o.isPlayer || n) return;
      if (segDist(o.x, o.z, ax, az, bx, bz) < 2.1) n = peds.scare(o.x, o.z, 10, 2.4) + 1;
    });
    if (n) stats.scared++;
    return n > 0;
  }

  // ---- aiming
  const dirV = new THREE.Vector3();
  const aim = { x: 0, y: 0, z: 0, ox: 0, oy: 0, oz: 0, v: null, yaw: 0, pitch: 0 };
  // the vehicle closest to the line of sight (ox, oy, oz + d), within range of the courier and the cone
  function pickTarget(ox, oy, oz, dx, dy, dz, range, cone, skip) {
    let best = null, bs = cone;
    const f = game.focus();
    for (const v of vehicles.all()) {
      if (v === skip || v === game.vehicle || v.wreck) continue;
      if (Math.hypot(v.x - f.x, v.z - f.z) > range) continue;
      const tx = v.x - ox, ty = vMid(v) - oy, tz = v.z - oz, tl = Math.hypot(tx, ty, tz) || 1;
      const ang = Math.acos(clamp((tx * dx + ty * dy + tz * dz) / tl, -1, 1)) + tl * 0.0015;
      if (ang < bs && !segBlocked(f.x, f.z, v.x, v.z, solids)) { bs = ang; best = v; }
    }
    return best;
  }
  function solveAim(w, force) {
    const v = game.vehicle, range = w.range || 24;
    if (v) {
      const s = Math.sin(v.yaw), c = Math.cos(v.yaw), fwd = v.kind === 'bike' ? 1.3 : 2.6;
      aim.ox = v.x + s * fwd; aim.oy = (v.y || 0) + (v.kind === 'bike' ? 1.15 : 1.05); aim.oz = v.z + c * fwd;
      aim.v = force || pickTarget(aim.ox, aim.oy, aim.oz, s, 0, c, range, 0.4, v);
      if (!aim.v) { aim.x = aim.ox + s * range; aim.y = aim.oy; aim.z = aim.oz + c * range; }
    } else {
      camera.getWorldDirection(dirV);
      const yaw = Math.atan2(dirV.x, dirV.z), s = Math.sin(yaw), c = Math.cos(yaw);
      aim.ox = player.pos.x + s * 0.5 - c * 0.3; aim.oy = player.pos.y + 1.38; aim.oz = player.pos.z + c * 0.5 + s * 0.3;
      const cp = camera.position;
      aim.v = force || pickTarget(cp.x, cp.y, cp.z, dirV.x, dirV.y, dirV.z, range + 6, input.touchMode ? 0.6 : 0.15, null);
      if (!aim.v) {
        if (input.touchMode) { aim.x = aim.ox + s * range; aim.y = aim.oy; aim.z = aim.oz + c * range; }
        else {
          // whatever is under the crosshair (the camera's ray), or straight on at the weapon's range
          const r = ray(cp.x, cp.y, cp.z, dirV.x, dirV.y, dirV.z, range + Math.hypot(cp.x - player.pos.x, cp.z - player.pos.z), null);
          aim.x = cp.x + dirV.x * r.t; aim.y = cp.y + dirV.y * r.t; aim.z = cp.z + dirV.z * r.t;
          if (Math.hypot(aim.x - aim.ox, aim.z - aim.oz) < 1.5) { aim.x = aim.ox + s * range; aim.y = aim.oy; aim.z = aim.oz + c * range; }
        }
      }
    }
    if (aim.v) { aim.x = aim.v.x; aim.y = vMid(aim.v); aim.z = aim.v.z; }
    const hz = Math.hypot(aim.x - aim.ox, aim.z - aim.oz);
    aim.yaw = Math.atan2(aim.x - aim.ox, aim.z - aim.oz); aim.pitch = Math.atan2(aim.y - aim.oy, hz);
    return aim;
  }
  const unit = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; dirV.set(x / l, y / l, z / l); return dirV; };
  const jitter = (s) => { if (!s) return; dirV.x += (Math.random() - 0.5) * s * 2; dirV.y += (Math.random() - 0.5) * s * 2; dirV.z += (Math.random() - 0.5) * s * 2; dirV.normalize(); };

  // ---- the five weapons
  function fireBolt(w) {
    const a = aim, d = unit(a.x - a.ox, a.y - a.oy, a.z - a.oz);
    jitter(w.spread);
    launch({ kind: 'bolt', w, x: a.ox, y: a.oy, z: a.oz, vx: d.x * w.speed, vy: d.y * w.speed, vz: d.z * w.speed, life: w.range / w.speed, color: w.color, owner: game.vehicle });
    fx.sparks(a.ox, a.oy, a.oz, 3, w.color);
    audio.pop();
  }
  function fireBeam(w) {
    const a = aim, d = unit(a.x - a.ox, a.y - a.oy, a.z - a.oz);
    jitter(w.spread);
    const dx = d.x, dy = d.y, dz = d.z, r = ray(a.ox, a.oy, a.oz, dx, dy, dz, w.range, game.vehicle), hv = r.v, t = r.t;
    const ex = a.ox + dx * t, ey = a.oy + dy * t, ez = a.oz + dz * t, px = -dz, pz = dx;
    fx.beam(a.ox, a.oy, a.oz, ex, ey, ez, '#ffffff', 0.05, 0.09);
    fx.beam(a.ox, a.oy, a.oz, ex, ey, ez, w.color, 0.16, 0.13);
    fx.beam(a.ox, a.oy, a.oz, ex + px * 0.35, ey + 0.1, ez + pz * 0.35, '#ff3fb4', 0.06, 0.12);
    fx.beam(a.ox, a.oy, a.oz, ex - px * 0.35, ey - 0.1, ez - pz * 0.35, '#ffe14a', 0.06, 0.12);
    if (hv) { if (damage.hit(hv, w.dmg, 'player') > 0) stats.hits++; fx.sparks(ex, ey, ez, 10, w.color); audio.zapHit(0.7); }
    else if (t < w.range - 0.1) { fx.sparks(ex, ey, ez, 6, w.color); if (game.loose) game.loose.hitAt(ex, ey, ez, dx, dz, 1); }
    scareAlong(a.ox, a.oz, ex, ez);
    audio.prism();
  }
  function zigzag(ax, ay, az, bx, by, bz, col) {
    let px = ax, py = ay, pz = az;
    for (let i = 1; i <= 3; i++) {
      const k = i / 3;
      let x = ax + (bx - ax) * k, y = ay + (by - ay) * k, z = az + (bz - az) * k;
      if (i < 3) { x += (Math.random() - 0.5) * 1.1; y += (Math.random() - 0.5) * 0.8; z += (Math.random() - 0.5) * 1.1; }
      fx.beam(px, py, pz, x, y, z, col, 0.15, 0.16, 0.3); fx.beam(px, py, pz, x, y, z, '#ffffff', 0.045, 0.12);
      px = x; py = y; pz = z;
    }
  }
  function fireArc(w) {
    const a = aim;
    let cur = a.v && Math.hypot(a.v.x - a.ox, a.v.z - a.oz) <= w.range + 2 ? a.v : null;
    if (!cur) {
      // nothing in reach: a short fizzle of lightning into the ground
      const yaw = a.yaw, ex = a.ox + Math.sin(yaw) * 5, ez = a.oz + Math.cos(yaw) * 5;
      zigzag(a.ox, a.oy, a.oz, ex, 0.1, ez, w.color); fx.sparks(ex, 0.2, ez, 8, w.color);
      scareAlong(a.ox, a.oz, ex, ez); audio.arc();
      return;
    }
    let fx0 = a.ox, fy0 = a.oy, fz0 = a.oz, k = 1;
    const done = [];
    for (let i = 0; i <= w.chain && cur; i++) {
      const tx = cur.x, ty = vMid(cur), tz = cur.z;
      zigzag(fx0, fy0, fz0, tx, ty, tz, w.color);
      if (damage.hit(cur, w.dmg * k, 'player') > 0) stats.hits++;
      fx.sparks(tx, ty, tz, 8, w.color);
      scareAlong(fx0, fz0, tx, tz);
      done.push(cur); k *= 0.7; fx0 = tx; fy0 = ty; fz0 = tz;
      let nx = null, nd = w.jump;
      for (const v of vehicles.all()) {
        if (v.wreck || v === game.vehicle || done.includes(v)) continue;
        const d = Math.hypot(v.x - tx, v.z - tz);
        if (d < nd) { nd = d; nx = v; }
      }
      cur = nx;
    }
    audio.arc();
  }
  function throwBang(charge, behind) {
    const w = BYID.bang, v = game.vehicle;
    if (!inv.owned.bang || inv.ammo.bang <= 0) { audio.empty(); return false; }
    let x, y, z, vx, vy, vz;
    if (v) {
      const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
      if (behind) {
        const back = v.kind === 'bike' ? 1.5 : 2.9, sp = 3 + charge * 5;
        x = v.x - s * back; y = (v.y || 0) + 0.9; z = v.z - c * back;
        vx = (v.vx || 0) * 0.45 - s * sp; vz = (v.vz || 0) * 0.45 - c * sp; vy = 2.2 + charge * 2;
      } else {
        const fwd = v.kind === 'bike' ? 1.4 : 2.8, sp = 10 + charge * 8;
        x = v.x + s * fwd; y = (v.y || 0) + 1.3; z = v.z + c * fwd;
        vx = (v.vx || 0) + s * sp; vz = (v.vz || 0) + c * sp; vy = 5;
      }
    } else {
      camera.getWorldDirection(dirV);
      const yaw = Math.atan2(dirV.x, dirV.z), p = clamp(Math.asin(clamp(dirV.y, -1, 1)) + 0.45, 0.2, 1.0), sp = 8 + charge * 14;
      const s = Math.sin(yaw), c = Math.cos(yaw);
      x = player.pos.x + s * 0.5 - c * 0.3; y = player.pos.y + 1.6; z = player.pos.z + c * 0.5 + s * 0.3;
      vx = s * Math.cos(p) * sp + player.vel.x * 0.5; vy = Math.sin(p) * sp; vz = c * Math.cos(p) * sp + player.vel.z * 0.5;
      aimT = 0.6; aim.yaw = yaw; aim.pitch = 0.3;
    }
    if (!launch({ kind: 'bang', w, x, y, z, vx, vy, vz, fuse: behind ? 1.15 : w.fuse, life: 8, color: '#ffe14a', owner: v, scale: 0.55 })) return false;
    inv.ammo.bang--; dirty = true; stats.shots++;
    audio.throw();
    return true;
  }
  function bangAt(x, y, z, w) {
    fx.burst(x, Math.max(y, 0.3) + 0.4, z, 85, 10);
    fx.ring(x, 0.2, z, w.radius * 0.95, fx.FIREWORK[Math.floor(Math.random() * 6)], 0.45);
    audio.bang(1);
    damage.blast(x, Math.max(y, 0.3) + 0.3, z, { r: w.radius, dmg: w.dmg, by: 'player', push: 9, props: 1.25, knock: 0, scare: 35 });
    stats.bangs++;
  }
  function starAt(x, y, z, w) {
    fx.burst(x, y, z, 32, 6);
    audio.bang(0.45);
    damage.blast(x, y, z, { r: w.radius, dmg: w.dmg, by: 'player', push: 4, props: 0.8, knock: 0, scare: 22 });
    stats.stars++;
  }

  // fire the current weapon (aim already solved)
  let cool = 0, burstN = 0, burstT = 0, volley = null, gHeld = 0, aimT = 0, lockV = null, emptyT = 0;
  function shoot(w) {
    if (inv.ammo[w.id] <= 0) {
      if (emptyT <= 0) { audio.empty(); hud.toast('OUT OF AMMO', 'VOLT & SPARK SUPPLY HAS MORE'); emptyT = 2.5; }
      cool = 0.3;
      return false;
    }
    aimT = 1.2;
    if (w.kind === 'bolt') { fireBolt(w); inv.ammo[w.id]--; cool = w.rate; stats.shots++; }
    else if (w.kind === 'beam') { burstN = w.burst; burstT = 0; cool = w.rate; }
    else if (w.kind === 'arc') { fireArc(w); inv.ammo[w.id]--; cool = w.rate; stats.shots++; }
    else if (w.kind === 'volley') { volley = { n: Math.min(w.shots, inv.ammo[w.id]), t: 0, target: aim.v }; cool = w.rate; }
    else if (w.kind === 'throw') { throwBang(0.45, false); cool = w.rate; }
    dirty = true;
    return true;
  }
  function launchStar(w, target) {
    const a = aim;
    const d = unit(a.x - a.ox, a.y - a.oy, a.z - a.oz);
    dirV.y += 0.3 + Math.random() * 0.15; dirV.x += (Math.random() - 0.5) * 0.35; dirV.z += (Math.random() - 0.5) * 0.35; dirV.normalize();
    launch({ kind: 'star', w, x: a.ox, y: a.oy, z: a.oz, vx: d.x * w.speed, vy: d.y * w.speed, vz: d.z * w.speed, life: w.range / w.speed + 0.6, color: fx.FIREWORK[Math.floor(Math.random() * 6)], owner: game.vehicle, target, turn: w.turn, scale: 0.8 });
    inv.ammo[w.id]--; stats.shots++;
    audio.whoosh();
  }

  // ---- projectiles step
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), tp = { x: 0, z: 0 };
  function stepProjectiles(dt) {
    let n = 0;
    for (const p of P) {
      if (!p.on) continue;
      p.t += dt; p.life -= dt;
      if (p.kind === 'bolt' || p.kind === 'star') {
        if (p.kind === 'star') {
          const t = p.target && !p.target.wreck && !p.target.off ? p.target : null;
          const sp = Math.hypot(p.vx, p.vy, p.vz) || 1;
          if (t && p.t > 0.15) {
            const tx = t.x - p.x, ty = vMid(t) - p.y, tz = t.z - p.z, tl = Math.hypot(tx, ty, tz) || 1;
            const k = Math.min(1, p.turn * dt);
            let nx = p.vx / sp + (tx / tl - p.vx / sp) * k, ny = p.vy / sp + (ty / tl - p.vy / sp) * k, nz = p.vz / sp + (tz / tl - p.vz / sp) * k;
            const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
            p.vx = nx * sp; p.vy = ny * sp; p.vz = nz * sp;
          } else p.vy -= 5 * dt;
          fx.trail(p.x, p.y, p.z, p.col);
        }
        const sp = Math.hypot(p.vx, p.vy, p.vz) || 1, step = sp * dt, dx = p.vx / sp, dy = p.vy / sp, dz = p.vz / sp;
        const r = ray(p.x, p.y, p.z, dx, dy, dz, step, p.owner);
        let t = r.t;
        const hv = r.v;
        // a light prop in the way takes the hit (bins and cones go flying)
        let prop = null;
        if (p.kind === 'bolt' && game.loose) for (let k = 1; k <= 3 && !prop; k++) { const tk = Math.min(t, step * k / 3); prop = game.loose.hitAt(p.x + dx * tk, p.y + dy * tk, p.z + dz * tk, p.vx, p.vz, 1); if (prop) t = tk; }
        const nx = p.x + dx * t, ny = p.y + dy * t, nz = p.z + dz * t;
        if (!p.scared) p.scared = scareAlong(p.x, p.z, nx, nz);
        p.x = nx; p.y = ny; p.z = nz;
        if (p.kind === 'star') {
          // a proximity fuse: a star that passes close to its target bursts there
          const tg = p.target && !p.target.wreck && !p.target.off ? p.target : null;
          const close = !!tg && Math.hypot(tg.x - nx, vMid(tg) - ny, tg.z - nz) < (tg.kind === 'tank' ? 3 : 2.2);
          if (hv || close || t < step - 1e-4 || p.life <= 0) { starAt(nx, ny, nz, p.w); p.on = false; continue; }
        } else if (hv && !prop) { if (damage.hit(hv, p.w.dmg, 'player') > 0) stats.hits++; fx.sparks(nx, ny, nz, 8, p.w.color); audio.zapHit(0.5); p.on = false; continue; }
        else if (prop || t < step - 1e-4) { fx.sparks(nx, ny, nz, 5, p.w.color); p.on = false; continue; }
        else if (p.life <= 0) { p.on = false; continue; }
      } else if (p.kind === 'bang') {
        p.vy -= 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.12) {
          p.y = 0.12;
          if (p.vy < -1.5) { p.vy = -p.vy * 0.4; p.vx *= 0.7; p.vz *= 0.7; audio.knock(0.25); } else { p.vy = 0; const f = Math.exp(-3 * dt); p.vx *= f; p.vz *= f; }
        }
        tp.x = p.x; tp.z = p.z;
        for (const b of solids) { if (p.y > b.h) continue; const nrm = pushOut(tp, 0.15, b); if (nrm) { const vn = p.vx * nrm.nx + p.vz * nrm.nz; if (vn < 0) { p.vx -= 1.6 * vn * nrm.nx; p.vz -= 1.6 * vn * nrm.nz; } } }
        p.x = tp.x; p.z = tp.z;
        if (Math.random() < 0.6) fx.trail(p.x, p.y + 0.12, p.z, Math.random() < 0.5 ? '#ffe14a' : '#fff3c4');
        p.fuse -= dt; p.arm += dt;
        let go = p.fuse <= 0;
        if (!go && p.arm > 0.3) for (const v of vehicles.all()) {
          if (v === p.owner || v === game.vehicle || v.wreck || Math.abs(vMid(v) - p.y) > 2.2) continue;
          if (vehicles.bodyDist(v, p.x, p.z) < 0.9) { go = true; break; }
        }
        if (go) { bangAt(p.x, p.y, p.z, p.w); p.on = false; continue; }
      }
      // draw it
      const sp = Math.hypot(p.vx, p.vy, p.vz);
      if (sp > 0.5) q.setFromUnitVectors(Z, v3.set(p.vx / sp, p.vy / sp, p.vz / sp)); else q.identity();
      const pulse = p.kind === 'bang' ? 0.8 + 0.4 * Math.sin(p.t * 30) : 1;
      if (p.kind === 'bolt') s3.set(0.2, 0.2, 1.1); else if (p.kind === 'star') s3.set(0.34, 0.34, 0.75); else s3.setScalar(p.scale * pulse);
      m4.compose(v3.set(p.x, p.y, p.z), q, s3);
      projMesh.setMatrixAt(n, m4); projMesh.setColorAt(n, p.col);
      n++;
    }
    projMesh.count = n; projMesh.visible = n > 0;
    if (n) { projMesh.instanceMatrix.needsUpdate = true; projMesh.instanceColor.needsUpdate = true; }
  }

  // ---- the Coast Patrol's pulse lasers (3 stars and up)
  function laserTarget() {
    const v = game.vehicle;
    if (v) return { x: v.x, y: vMid(v), z: v.z, vx: v.vx || 0, vz: v.vz || 0, v };
    return { x: player.pos.x, y: player.pos.y + 1.1, z: player.pos.z, vx: player.vel.x, vz: player.vel.z, v: null };
  }
  function laserShot(c, T, d) {
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw), mx = c.x + s * LASER_MOUNT[2], my = (c.y || 0) + LASER_MOUNT[1], mz = c.z + co * LASER_MOUNT[2];
    const dx = T.x - mx, dz = T.z - mz, dl = Math.hypot(dx, dz) || 1, ux = dx / dl, uz = dz / dl;
    // crossing its line of fire fast is what makes it miss
    const perp = Math.abs(T.vx * uz - T.vz * ux);
    let p = 0.92 * clamp(1 - d / 70, 0.25, 1) * clamp(1 - perp / 30, 0.25, 1);
    if (!T.v) p *= 0.85;
    const hitIt = Math.random() < p;
    let ex = T.x, ey = T.y, ez = T.z;
    if (hitIt) { ex += (Math.random() - 0.5) * 0.5; ey += (Math.random() - 0.5) * 0.3; ez += (Math.random() - 0.5) * 0.5; }
    else { const side = (Math.random() < 0.5 ? -1 : 1) * (1.3 + Math.random() * 1.6); ex += -uz * side + ux * 7; ez += ux * side + uz * 7; ey = Math.max(0.1, ey - 0.5 - Math.random()); }
    fx.beam(mx, my, mz, ex, ey, ez, '#ff2bd1', 0.13, 0.09);
    fx.beam(mx, my, mz, ex, ey, ez, '#ffffff', 0.04, 0.07);
    const cp = camera.position, vol = clamp(1 - Math.hypot(cp.x - mx, cp.z - mz) / 90, 0.12, 1);
    audio.laser(vol);
    stats.laserShots++;
    if (hitIt) {
      stats.laserHits++;
      fx.sparks(ex, ey, ez, 10, '#ff8af0'); audio.zapHit(vol);
      if (T.v) damage.hit(T.v, 4, 'police');
      else {
        // on foot: a stun shot, a little health and a stagger
        stats.stuns++;
        rules.hurt(4);
        player.stagger = 0.45; player.vel.x += ux * 4; player.vel.z += uz * 4;
      }
    } else fx.sparks(ex, ey, ez, 5, '#ff8af0');
  }
  function policeLasers(dt) {
    const on = game.wanted >= 3 && !game.busy && !game.inside && game.started;
    const T = on ? laserTarget() : null;
    const cool = game.wanted >= 5 ? 1.25 : game.wanted >= 4 ? 1.9 : 2.7;
    for (const c of traffic.police) {
      const S = c.laser || (c.laser = { t: 1 + Math.random() * 1.5, phase: 'idle', shots: 0, los: false, losT: 0 });
      if (!on || c.off || !c.ai || !c.ai.siren || c.ai.chase || disabled(c)) { if (S.phase !== 'idle') { S.phase = 'idle'; S.t = 1; } continue; }
      const d = Math.hypot(T.x - c.x, T.z - c.z);
      S.losT -= dt;
      if (S.losT <= 0) { S.losT = 0.15; S.los = d < 55 && !segBlocked(c.x, c.z, T.x, T.z, solids); }
      S.t -= dt;
      if (S.phase === 'idle') {
        if (S.t <= 0 && S.los) { S.phase = 'aim'; S.t = 0.6; audio.charge(clamp(1 - d / 70, 0.15, 1)); }
      } else if (S.phase === 'aim') {
        // the telegraph: a thin flickering aim line from the roof to you
        const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
        fx.beam(c.x + s * LASER_MOUNT[2], (c.y || 0) + LASER_MOUNT[1], c.z + co * LASER_MOUNT[2], T.x, T.y, T.z, '#ff3a6a', 0.035, Math.max(dt * 1.5, 0.02), 0.35);
        if (!S.los) { S.phase = 'idle'; S.t = 0.6; }
        else if (S.t <= 0) { S.phase = 'fire'; S.shots = 3; S.t = 0; }
      } else if (S.phase === 'fire') {
        if (S.t <= 0) {
          laserShot(c, T, d); S.shots--; S.t = 0.11;
          if (S.shots <= 0) { S.phase = 'idle'; S.t = cool + Math.random() * 0.8; }
        }
      }
    }
  }

  // ---- HUD: the weapon chip and the crosshair
  const el = { chip: $('arms'), icon: $('armsi'), name: $('armsn'), ammo: $('armsa'), xh: $('xhair') };
  const ictx = el.icon.getContext('2d');
  let chipKey = null, xhOn = false, lockOn = false;
  function hudUpdate(showX) {
    const any = ARMS.some((w) => inv.owned[w.id]);
    const key = !game.started || !any ? '' : (inv.cur || '-') + '|' + (inv.cur ? inv.ammo[inv.cur] : '');
    if (key !== chipKey) {
      chipKey = key;
      el.chip.hidden = !key;
      if (key) {
        drawIcon(ictx, inv.cur);
        el.name.textContent = inv.cur ? BYID[inv.cur].name : input.touchMode ? 'HOLSTERED · SWAP' : 'HOLSTERED · Q';
        el.ammo.textContent = inv.cur ? String(inv.ammo[inv.cur]) : '';
        el.chip.classList.toggle('empty', !!inv.cur && inv.ammo[inv.cur] <= 0);
        if (inv.cur) el.chip.style.borderColor = BYID[inv.cur].color; else el.chip.style.borderColor = '';
      }
    }
    if (showX !== xhOn) { xhOn = showX; el.xh.hidden = !showX; }
    const lk = showX && !!lockV;
    if (lk !== lockOn) { lockOn = lk; el.xh.classList.toggle('lock', lk); }
  }

  function set(id) {
    if (id && !inv.owned[id]) return false;
    if (inv.cur === id) return true;
    inv.cur = id; dirty = true; audio.swap(); burstN = 0; volley = null;
    if (id && heldId !== id) { held.geometry = heldGeo[id] || (heldGeo[id] = heldGeometry(id)); heldId = id; }
    return true;
  }

  const api = {
    inv, stats, BYID,
    get held() { return holder.visible; },
    // a weapon you own and the context to use it: on foot (not sitting / dancing / indoors), a car or the Comet
    armedContext() {
      const m = game.mode, v = game.vehicle;
      return game.started && !game.busy && !game.inside && !game.cheats.open && !game.act.mode && !(v && v.wreck) && (m === 'foot' || m === 'car' || m === 'bike');
    },
    cycle(d = 1, quiet = false) {
      const list = [null, ...ARMS.filter((w) => inv.owned[w.id]).map((w) => w.id)];
      if (list.length < 2) { if (!quiet) hud.toast('NO BLASTERS YET', 'VOLT & SPARK SUPPLY ON LUMINA BOULEVARD'); return false; }
      let i = list.indexOf(inv.cur);
      i = (i + d + list.length) % list.length;
      return set(list[i]);
    },
    select(n) {
      const w = ARMS[n - 1];
      if (!w) return false;
      if (!inv.owned[w.id]) { hud.toast(w.name, `$${w.price} AT VOLT & SPARK SUPPLY`); return false; }
      return set(inv.cur === w.id ? null : w.id);
    },
    set,
    // the shop (game/places.js): buy a weapon, or more ammo for one you own
    buy(w) {
      if (!inv.owned[w.id]) {
        if (game.money < w.price) return [false, `NOT ENOUGH CASH: ${w.name} IS $${w.price}`];
        game.money -= w.price; inv.owned[w.id] = true; inv.ammo[w.id] = w.ammo; set(w.id); persist();
        return [true, `${w.name} IS YOURS · ${w.ammo} SHOTS`];
      }
      if (inv.ammo[w.id] >= w.max) return [false, `YOU CAN'T CARRY MORE THAN ${w.max}`];
      if (game.money < w.refill) return [false, `NOT ENOUGH CASH: AMMO IS $${w.refill}`];
      game.money -= w.refill; inv.ammo[w.id] = Math.min(w.max, inv.ammo[w.id] + w.ammo); set(w.id); persist();
      return [true, `${w.name}: +${w.ammo} · ${inv.ammo[w.id]} CARRIED`];
    },
    // the REWIND code: an empty bag again
    reset() { for (const w of ARMS) { inv.owned[w.id] = false; inv.ammo[w.id] = 0; } set(null); chipKey = null; },
    // the SPARKCRATE code: every weapon, full
    giveAll() { for (const w of ARMS) { inv.owned[w.id] = true; inv.ammo[w.id] = w.max; } if (!inv.cur) set('pop'); persist(); chipKey = null; },
    // debug / tests: fire the current weapon at a vehicle (or straight ahead), throw a bang
    fireAt(v) {
      const w = inv.cur && BYID[inv.cur];
      if (!w) return false;
      solveAim(w, v || null);
      cool = 0; burstN = 0; volley = null;
      if (!shoot(w)) return false;
      if (w.kind === 'beam') { while (burstN > 0 && inv.ammo[w.id] > 0) { solveAim(w, v || null); fireBeam(w); inv.ammo[w.id]--; burstN--; stats.shots++; } burstN = 0; }
      return true;
    },
    throwBang,
    projectiles: () => P.filter((p) => p.on).map((p) => ({ kind: p.kind, x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) })),
    lasers: () => traffic.police.filter((c) => !c.off).map((c) => ({ phase: c.laser ? c.laser.phase : 'idle', siren: !!(c.ai && c.ai.siren), d: +Math.hypot(c.x - game.focus().x, c.z - game.focus().z).toFixed(1), hp: Math.round(c.hp), disabled: disabled(c), pursuit: !!(c.ai && c.ai.pursuit) })),
    // touch: the buttons this situation wants (game/ui/touch.js)
    touchButtons() {
      if (!api.armedContext()) return [];
      const out = [], w = inv.cur && BYID[inv.cur];
      if (w) out.push(['KeyR', w.kind === 'throw' ? 'THROW' : 'FIRE']);
      if (inv.owned.bang && inv.ammo.bang > 0 && !(w && w.kind === 'throw' && !game.vehicle)) out.push(['KeyG', game.vehicle ? 'DROP' : 'BANG']);
      if (ARMS.some((x) => inv.owned[x.id])) out.push(['KeyQ', 'SWAP']);
      return out;
    },
    hints() {
      if (!api.armedContext()) return [];
      const w = inv.cur && BYID[inv.cur], out = [];
      if (w) out.push(['Click / R', w.kind === 'throw' ? 'throw a bang' : game.vehicle ? 'fire ahead' : 'fire']);
      if (inv.owned.bang && inv.ammo.bang > 0) out.push(['G', game.vehicle ? 'drop a bang behind' : 'throw a bang (hold)']);
      if (ARMS.some((x) => inv.owned[x.id])) out.push(['Q / wheel', 'switch']);
      return out;
    },
    update(dt) {
      cool -= dt; aimT -= dt; emptyT -= dt;
      if (player.stagger > 0) player.stagger -= dt;
      const can = api.armedContext() && !game.paused;
      const w = inv.cur ? BYID[inv.cur] : null;
      const live = can && (!player.hidden || game.mode === 'car');
      // aim every frame while armed (for the crosshair lock), fire on click / R
      if (live && w) {
        solveAim(w, null); lockV = aim.v;
        const press = input.clicked || input.firePress || input.wasPressed('KeyR'), hold = input.isDown('KeyR');
        if ((press || hold) && cool <= 0 && !burstN && !volley) shoot(w);
      } else lockV = null;
      if (!live) { burstN = 0; volley = null; }
      // prism bursts and candle volleys play out over a few frames
      if (burstN > 0) {
        burstT -= dt;
        if (burstT <= 0 && w && w.kind === 'beam') {
          if (inv.ammo[w.id] > 0) { solveAim(w, null); fireBeam(w); inv.ammo[w.id]--; stats.shots++; dirty = true; aimT = 1.2; }
          burstN--; burstT = w.gap;
          if (inv.ammo[w.id] <= 0) burstN = 0;
        }
      }
      if (volley) {
        volley.t -= dt;
        if (volley.t <= 0 && w && w.kind === 'volley') { solveAim(w, null); launchStar(w, volley.target && !volley.target.wreck ? volley.target : aim.v); volley.n--; volley.t = w.gap; dirty = true; aimT = 1.2; }
        if (!w || w.kind !== 'volley' || volley.n <= 0 || inv.ammo[w.id] <= 0) volley = null;
      }
      // G: a firework bang. On foot hold for distance (thrown on release); from a vehicle it drops behind you
      if (live && input.isDown('KeyG')) {
        if (game.vehicle) { if (input.wasPressed('KeyG')) throwBang(0.3, true); gHeld = 0; }
        else gHeld += dt;
      } else if (gHeld > 0) { if (live) throwBang(clamp(gHeld / 0.8, 0, 1), false); gHeld = 0; }
      // the mouse wheel switches
      if (input.wheel && can) api.cycle(input.wheel > 0 ? 1 : -1, true);
      stepProjectiles(dt);
      policeLasers(dt);
      // the shoulder camera while a blaster is out on foot
      const onFoot = can && game.mode === 'foot' && !!w && !player.hidden;
      cam.shoulder = (cam.shoulder || 0) + ((onFoot ? 1 : 0) - (cam.shoulder || 0)) * (1 - Math.exp(-6 * dt));
      hudUpdate(onFoot);
      saveT -= dt;
      if (dirty && saveT <= 0) { saveT = 4; persist(); }
    },
    // after the courier has been posed: the blaster in hand, the arm raised to aim, a stagger wobble
    pose() {
      const w = inv.cur ? BYID[inv.cur] : null;
      const show = !!w && !player.hidden && !game.inside && game.started && game.busy !== 'cut' && game.busy !== 'down' && game.busy !== 'walkout' && !game.act.mode && (game.mode === 'foot' || game.mode === 'bike');
      holder.visible = show;
      if (!show) return;
      const m = player.model;
      if (aimT > 0 || gHeld > 0) {
        const pitch = clamp(aim.pitch, -0.6, 0.8);
        if (game.mode === 'foot') {
          player.yaw = aim.yaw; m.root.rotation.y = aim.yaw;
          m.armR.rotation.set(-PI / 2 - pitch, 0, 0.05);
          if (w.id === 'prism' || w.id === 'candle') m.armL.rotation.set(-PI / 2 - pitch * 0.8, 0, -0.55);
          m.head.rotation.x = -pitch * 0.5;
        } else m.armR.rotation.set(-PI / 2 - pitch, angleDelta(game.vehicle.yaw, aim.yaw) * 0.6, 0);
      }
      if (player.stagger > 0 && game.mode === 'foot') m.body.rotation.z += Math.sin(timeU.value * 40) * 0.12 * player.stagger;
    },
  };
  return api;
}
