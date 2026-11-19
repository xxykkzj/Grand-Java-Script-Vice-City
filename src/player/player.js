// "Skye", the roller-skating courier: teal-and-magenta bomber jacket, white shorts,
// backwards cap, messenger bag. Built from boxes, six draw calls, animated by swinging pivots.
import * as THREE from 'three';
import { box, cyl, merge, damp, clamp, angleDelta, pushOut, PI, reducedMotion } from '../core/util.js';
import { clampToWorld, PIER, HZ } from '../world/layout.js';
import { pushFromSolids } from '../world/sea.js';

const TEAL = '#12b5a6', MAG = '#e6258f', WHITE = '#f7f5ef', SKIN = '#c98d62', BAG = '#f2b63a', HAIR = '#2a2140', DARK = '#1b1830';
// Outfit roles: every vertex carries the index of the outfit colour it takes (-1 = keeps its own colour)
const ROLES = ['jacket', 'trim', 'light', 'bag', 'sleeve', 'cuff', 'shorts', 'thigh', 'shin', 'zip', 'boot', 'collar'];
const RI = Object.fromEntries(ROLES.map((r, i) => [r, i]));
// what each role is for a given outfit (dresses bare the arms, skirts and trousers recolour the legs)
export function lookOf(o) {
  const bottom = o.bottom || 'shorts', dress = bottom === 'dress', skirt = dress || bottom === 'skirt', trousers = bottom === 'trousers';
  return {
    jacket: o.jacket || TEAL, trim: o.trim || MAG, light: o.light || WHITE, bag: o.bag || BAG,
    sleeve: o.sleeve || (dress ? SKIN : o.jacket || TEAL), cuff: o.cuff || (dress ? SKIN : o.trim || MAG),
    shorts: skirt ? o.skirt : trousers ? o.legs : o.light || WHITE, thigh: trousers ? o.legs : SKIN, shin: trousers ? o.legs : o.tights || SKIN,
    zip: dress ? o.jacket : o.light || WHITE, boot: o.boot || o.light || WHITE, collar: dress ? SKIN : o.trim || MAG,
    skirt: skirt ? o.skirt : null, pleat: o.pleat || o.skirt, len: o.len || 0.42, flare: o.flare || 0.26, sequin: !!o.sequin, bottom,
  };
}

// The skirt: a ring of panels from the waist to the hem whose hem is swung by the legs every frame
// (it follows the hips and thighs when skating, dancing and sitting). Non-indexed so pleats can alternate.
function buildSkirt(mat) {
  const N = 16, rows = [0, 0.5, 1], verts = [];
  const geo = new THREE.BufferGeometry();
  for (let i = 0; i < N; i++) for (let r = 0; r < 2; r++) {
    const a0 = (i / N) * PI * 2, a1 = ((i + 1) / N) * PI * 2, t0 = rows[r], t1 = rows[r + 1];
    for (const [a, t] of [[a0, t0], [a0, t1], [a1, t1], [a0, t0], [a1, t1], [a1, t0]]) verts.push([a, t, i]);
  }
  const n = verts.length;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  m.frustumCulled = false; m.visible = false;
  const c = new THREE.Color(), c2 = new THREE.Color();
  let look = null;
  m.paint = (lk) => {
    look = lk; m.visible = !!lk.skirt;
    if (!lk.skirt) return;
    const col = geo.attributes.color;
    verts.forEach(([, t, i], k) => {
      c.set(lk.pleat && i % 2 ? lk.pleat : lk.skirt);
      if (lk.sequin) { const j = 0.75 + ((i * 7 + Math.round(t * 2) * 3) % 5) * 0.12; c.multiplyScalar(j); }
      if (t > 0.99 && lk.trimHem) c.copy(c2.set(lk.trimHem));
      col.setXYZ(k, c.r, c.g, c.b);
    });
    col.needsUpdate = true;
  };
  // aL, zL / aR, zR: the thighs' swing (rx) and spread (rz)
  m.drape = (aL, zL, aR, zR) => {
    if (!m.visible) return;
    const pos = geo.attributes.position, len = look.len, fl = look.flare;
    verts.forEach(([a, t], k) => {
      const sx = Math.sin(a), cz = Math.cos(a), wL = Math.min(1, Math.max(0, sx * 1.1 + 0.5));
      let ax = aL * wL + aR * (1 - wL), az = zL * wL + zR * (1 - wL);
      if (cz < 0) ax *= ax < 0 ? 0.3 : 1;                  // the back panel stays behind when the knees come up
      ax *= 0.85; az *= 0.9;
      const dx = Math.cos(ax) * Math.sin(az), dy = -Math.cos(ax) * Math.cos(az), dz = -Math.sin(ax);
      const spread = 1 + Math.abs(aL - aR) * 0.25 * t;
      const rx = (0.235 + fl * t * spread), rz = (0.165 + fl * 0.8 * t * spread);
      pos.setXYZ(k, sx * rx + dx * len * t, dy * len * t, cz * rz + dz * len * t);
    });
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return m;
}

function buildModel() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const role = (g, r) => { const n = g.attributes.position.count; g.setAttribute('aRole', new THREE.BufferAttribute(new Float32Array(n).fill(r === undefined ? -1 : RI[r]), 1)); return g; };
  // B(w, h, d, x, y, z, colour or role, rx, ry, rz)
  const B = (w, h, d, x, y, z, c, rx, ry, rz) => role(box(w, h, d, x, y, z, RI[c] !== undefined ? '#ffffff' : c, rx, ry, rz), c);
  const C = (rt, rb, h, seg, x, y, z, c, rx, rz) => role(cyl(rt, rb, h, seg, x, y, z, RI[c] !== undefined ? '#ffffff' : c, rx, rz), c);
  const part = (geos, x, y, z, parent = body) => {
    const m = new THREE.Mesh(merge(geos), mat);
    m.position.set(x, y, z); parent.add(m);
    return m;
  };
  // torso: tapered jacket with a stand-up collar, zip, chest stripe, pockets and ribbed hem; shorts;
  // the messenger bag on its strap (across the chest and the back)
  const torso = part([
    B(0.4, 0.22, 0.25, 0, 0.94, 0, 'shorts'),
    B(0.42, 0.2, 0.26, 0, 1.14, 0, 'jacket'), B(0.47, 0.3, 0.28, 0, 1.36, 0, 'jacket'), B(0.52, 0.08, 0.26, 0, 1.52, 0, 'jacket'),
    B(0.44, 0.06, 0.275, 0, 1.05, 0, 'trim'),
    B(0.475, 0.06, 0.285, 0, 1.4, 0, 'trim'), B(0.475, 0.025, 0.285, 0, 1.355, 0, 'light'),
    B(0.03, 0.46, 0.012, 0, 1.3, 0.141, 'zip'), B(0.05, 0.035, 0.015, 0, 1.53, 0.143, 'zip'),
    B(0.27, 0.1, 0.04, 0, 1.6, -0.1, 'collar'), B(0.04, 0.09, 0.15, 0.125, 1.595, -0.01, 'collar'), B(0.04, 0.09, 0.15, -0.125, 1.595, -0.01, 'collar'),
    B(0.1, 0.07, 0.012, 0.12, 1.16, 0.136, 'trim'), B(0.1, 0.07, 0.012, -0.12, 1.16, 0.136, 'trim'),
    B(0.11, 0.1, 0.11, 0, 1.63, 0, SKIN),
    B(0.06, 0.62, 0.012, -0.02, 1.27, 0.146, DARK, 0, 0, -0.7), B(0.06, 0.62, 0.012, -0.02, 1.27, -0.146, DARK, 0, 0, 0.7),
    B(0.05, 0.05, 0.018, 0.06, 1.35, 0.152, '#c9c0d8'),
    B(0.13, 0.26, 0.34, -0.31, 0.98, -0.02, 'bag'), B(0.135, 0.12, 0.35, -0.31, 1.06, -0.02, 'trim'), B(0.14, 0.04, 0.06, -0.31, 1.0, 0.13, '#c9c0d8'),
  ], 0, 0, 0);
  // head: jaw, ears, nose, brows, hair with volume under a backwards cap; eyes and mouth are their own
  // little meshes so they can blink and talk
  const head = part([
    B(0.26, 0.21, 0.25, 0, 0.17, 0, SKIN), B(0.22, 0.09, 0.21, 0, 0.045, 0.01, SKIN),
    B(0.03, 0.07, 0.05, 0.135, 0.13, 0, '#b97f56'), B(0.03, 0.07, 0.05, -0.135, 0.13, 0, '#b97f56'),
    B(0.035, 0.06, 0.04, 0, 0.115, 0.135, '#b97f56'), B(0.05, 0.02, 0.03, 0, 0.088, 0.14, '#a86e48'),
    B(0.07, 0.018, 0.02, 0.065, 0.205, 0.128, HAIR, 0, 0, -0.12), B(0.07, 0.018, 0.02, -0.065, 0.205, 0.128, HAIR, 0, 0, 0.12),
    B(0.29, 0.2, 0.09, 0, 0.14, -0.12, HAIR), B(0.24, 0.1, 0.06, 0, 0.03, -0.12, HAIR),
    B(0.035, 0.15, 0.19, 0.142, 0.17, -0.025, HAIR), B(0.035, 0.15, 0.19, -0.142, 0.17, -0.025, HAIR),
    B(0.1, 0.05, 0.05, -0.07, 0.235, 0.115, HAIR, 0.3, 0, 0.25), B(0.1, 0.05, 0.05, 0.03, 0.24, 0.12, HAIR, 0.35, 0, -0.1), B(0.08, 0.045, 0.05, 0.095, 0.232, 0.112, HAIR, 0.3, 0, -0.35),
    B(0.29, 0.11, 0.29, 0, 0.3, 0, 'trim'), B(0.295, 0.05, 0.295, 0, 0.25, 0, 'jacket'), B(0.22, 0.03, 0.17, 0, 0.25, -0.215, 'trim'),
    C(0.025, 0.025, 0.02, 6, 0, 0.36, 0, 'jacket'),
  ], 0, 1.66, 0);
  const eyes = part([B(0.056, 0.042, 0.01, 0.065, 0, 0.127, '#fbf7f0'), B(0.056, 0.042, 0.01, -0.065, 0, 0.127, '#fbf7f0'),
    B(0.03, 0.036, 0.012, 0.06, -0.002, 0.131, DARK), B(0.03, 0.036, 0.012, -0.06, -0.002, 0.131, DARK)], 0, 0.158, 0, head);
  const mouth = part([B(0.08, 0.016, 0.012, 0, 0, 0.127, '#7a2f3a'), B(0.06, 0.01, 0.013, 0, 0.006, 0.128, '#b25a5a')], 0, 0.06, 0.006, head);
  const arm = (sx) => part([
    B(0.145, 0.3, 0.15, 0, -0.15, 0, 'sleeve'), B(0.13, 0.18, 0.14, 0, -0.37, 0, 'sleeve'),
    B(0.15, 0.03, 0.155, 0, -0.09, 0, 'cuff'), B(0.145, 0.05, 0.155, 0, -0.47, 0, 'cuff'),
    B(0.09, 0.1, 0.1, 0, -0.545, 0, SKIN), B(0.07, 0.05, 0.08, 0, -0.615, 0.005, SKIN),
    B(0.035, 0.065, 0.035, -sx * 0.045, -0.53, 0.05, SKIN, 0, 0, sx * 0.3),
  ], sx * 0.3, 1.5, 0);
  const leg = (sx) => {
    const thigh = part([B(0.19, 0.25, 0.21, 0, -0.11, 0, 'shorts'), B(0.15, 0.22, 0.16, 0, -0.33, 0, 'thigh')], sx * 0.11, 0.96, 0);
    const P = [B(0.135, 0.22, 0.145, 0, -0.1, 0, 'shin'), B(0.14, 0.07, 0.15, 0, -0.22, 0, WHITE), B(0.142, 0.025, 0.152, 0, -0.205, 0, 'trim'),
      B(0.17, 0.17, 0.3, 0, -0.33, 0.04, 'boot'), B(0.175, 0.04, 0.31, 0, -0.29, 0.04, 'jacket'), B(0.1, 0.12, 0.03, 0, -0.29, 0.18, 'boot'),
      B(0.12, 0.035, 0.32, 0, -0.43, 0.04, DARK), B(0.05, 0.05, 0.05, 0, -0.455, 0.2, DARK)];
    for (let k = 0; k < 3; k++) P.push(B(0.1, 0.012, 0.012, 0, -0.27 - k * 0.035, 0.196 - k * 0.006, DARK));
    for (const wz of [0.14, -0.08]) for (const wx of [0.07, -0.07]) P.push(C(0.055, 0.055, 0.045, 8, wx, -0.465, wz, 'trim', 0, PI / 2), C(0.025, 0.025, 0.05, 6, wx, -0.465, wz, '#c9c0d8', 0, PI / 2));
    thigh.shin = part(P, 0, -0.44, 0, thigh);
    return thigh;
  };
  const armL = arm(1), armR = arm(-1), legL = leg(1), legR = leg(-1);
  const skirt = buildSkirt(mat); skirt.position.set(0, 1.07, 0); body.add(skirt);
  // Outfits repaint the vertex colours by role
  const meshes = [];
  root.traverse((m) => { if (m.isMesh && m.geometry.attributes.aRole) meshes.push({ a: m.geometry.attributes.color, r: m.geometry.attributes.aRole }); });
  const c = new THREE.Color();
  let look = lookOf({});
  const setOutfit = (o) => {
    look = lookOf(o || {});
    const cols = ROLES.map((r) => new THREE.Color(look[r]));
    for (const { a, r } of meshes) {
      for (let i = 0; i < a.count; i++) { const k = r.getX(i); if (k >= 0) { c.copy(cols[k]); if (look.sequin && (k === 0 || k === 6)) c.multiplyScalar(0.8 + ((i * 13) % 7) * 0.07); a.setXYZ(i, c.r, c.g, c.b); } }
      a.needsUpdate = true;
    }
    skirt.paint(look);
  };
  const api = { root, body, torso, head, eyes, mouth, armL, armR, legL, legR, skirt, setOutfit, get look() { return look; } };
  setOutfit({});
  return api;
}

export function createPlayer(scene, L) {
  const model = buildModel();
  scene.add(model.root);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16).rotateX(-PI / 2), new THREE.MeshBasicMaterial({
    color: 0, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  shadow.renderOrder = 1;
  scene.add(shadow);

  const CS = [];
  let blinkT = 2, blink = 0, breathT = 0, talkT = 0;
  const knees = (kl, kr) => { model.legL.shin.rotation.x = kl; model.legR.shin.rotation.x = kr; };
  const drape = () => { const m = model; m.skirt.drape(m.legL.rotation.x, m.legL.rotation.z, m.legR.rotation.x, m.legR.rotation.z); };
  const P = {
    talking: false,
    // blink, breathe, and move the mouth while talking in a scene (called every frame)
    tickFace(dt) {
      const m = model;
      blinkT -= dt;
      if (blinkT <= 0) { blink = 0.13; blinkT = 2.2 + Math.random() * 3.5; }
      blink = Math.max(0, blink - dt);
      m.eyes.scale.y = blink > 0 ? 0.12 : 1;
      breathT += dt;
      const br = Math.sin(breathT * 1.7);
      m.torso.scale.set(1 + br * 0.006, 1, 1 + br * 0.022);
      talkT += dt;
      m.mouth.scale.y = P.talking && !reducedMotion ? 1.3 + Math.abs(Math.sin(talkT * 17)) * 2.4 * (0.6 + 0.4 * Math.sin(talkT * 5.3)) : P.talking ? 1.8 : 1;
    },
    pos: new THREE.Vector3(-10, 0, 67), vel: new THREE.Vector3(), vy: 0, yaw: PI / 2,
    onGround: true, hidden: false, lowGravity: false, phase: 0, speed: 0, lean: 0, model, floor: 0, shadow,
    groundAt: null,      // optional (x, z) -> ground height: the sand shelf that slopes into the sea (player/swim.js)
    sy: 0,               // how far the ground under the courier is below the floor (lowers the blob shadow)
    leap: false,         // jumping off the pier into the water: the pier edge lets go
    swimming: false,     // set by player/swim.js while it drives the courier
    setHidden(h) { P.hidden = h; model.root.visible = !h; shadow.visible = !h; },
    update(dt, inp, camYaw, vehicles, audio) {
      if (P.hidden) return;
      // camera-relative movement with a bit of glide: you're on skates
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      let dx = fx * inp.move - fz * inp.strafe, dz = fz * inp.move + fx * inp.strafe;
      const len = Math.hypot(dx, dz), top = inp.sprint ? 13.5 : 7.5;
      if (len > 0) { const k = top * Math.min(1, len) / len; dx *= k; dz *= k; }   // keys give len >= 1, the touch stick less
      const rate = P.onGround ? (len > 0 ? 5 : 1.7) : 1;
      P.vel.x = damp(P.vel.x, dx, rate, dt); P.vel.z = damp(P.vel.z, dz, rate, dt);
      if (inp.jump && P.onGround) {
        P.vy = 8.4; P.onGround = false; audio.jump();
        // at the pier's edge a jump is a leap into the sea
        const px = P.pos.x, pz = P.pos.z;
        if (P.pos.y > -0.3 && px > PIER.x0 && px < PIER.x1 && pz > HZ + 12 && (px < PIER.x0 + 1.5 || px > PIER.x1 - 1.5 || pz > PIER.z1 - 1.5)) {
          P.leap = true;
          if (px < PIER.x0 + 1.5) P.vel.x = Math.min(P.vel.x, -3.5); else if (px > PIER.x1 - 1.5) P.vel.x = Math.max(P.vel.x, 3.5); else P.vel.z = Math.max(P.vel.z, 3.5);
        }
      }
      const g0 = P.groundAt ? P.groundAt(P.pos.x, P.pos.z) : 0;
      P.vy -= (P.lowGravity ? 4.2 : 23) * dt;
      P.pos.y += P.vy * dt;
      if (P.pos.y <= g0) { if (!P.onGround && P.vy < -4) audio.step(1); P.pos.y = g0; P.vy = 0; P.onGround = true; } else P.onGround = false;
      P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
      if (P.groundAt) {          // walking down the sand shelf: stay on it instead of hopping
        const g1 = P.groundAt(P.pos.x, P.pos.z); P.sy = g1;
        if (P.onGround && P.vy <= 0 && P.pos.y > g1 && P.pos.y - g1 < 0.35) P.pos.y = g1;
      }

      for (const b of L.solids) {
        if (P.pos.y > b.h) continue;
        const n = pushOut(P.pos, 0.45, b);
        if (n) { const vn = P.vel.x * n.nx + P.vel.z * n.nz; if (vn < 0) { P.vel.x -= vn * n.nx; P.vel.z -= vn * n.nz; } }
      }
      L.props.collide(P.pos, 0.42, P.pos.y, P.vel);
      for (const v of vehicles.all()) {
        if (Math.abs(v.y - P.pos.y) > 1.6 || Math.abs(P.pos.x - v.x) > 6 || Math.abs(P.pos.z - v.z) > 6) continue;
        for (const c of vehicles.circlesOf(v, CS)) {
          const ddx = P.pos.x - c[0], ddz = P.pos.z - c[1], rr = c[2] + 0.4, d = Math.hypot(ddx, ddz);
          if (d < rr && d > 1e-4) { P.pos.x += ddx / d * (rr - d); P.pos.z += ddz / d * (rr - d); }
        }
      }
      if (P.pos.y < -0.25 && !P.leap) pushFromSolids(P.pos, 0.5, P.pos.y);     // below the pier deck: the sand beside the pier piles
      clampToWorld(P.pos, 0.6, P.leap ? 3 : 1);
      if (P.leap && (P.onGround || P.pos.y < -0.2)) P.leap = false;

      P.speed = Math.hypot(P.vel.x, P.vel.z);
      let turn = 0;
      if (P.speed > 0.6) { turn = angleDelta(P.yaw, Math.atan2(P.vel.x, P.vel.z)); P.yaw += turn * (1 - Math.exp(-10 * dt)); }

      P.animate(dt, turn, audio);
    },
    // pose the model from P.pos / P.yaw / P.speed (also used by cutscenes and the carjack)
    animate(dt, turn, audio) {
      const k = clamp(P.speed / 7.5, 0, 1.5), m = model;
      const prev = P.phase;
      P.phase += dt * (2.2 + P.speed * 0.42) * (k > 0.05 ? 1 : 0.15);
      if (audio && P.onGround && k > 0.2 && Math.floor(prev / PI) !== Math.floor(P.phase / PI)) audio.step(k);
      const s = Math.sin(P.phase), c = Math.cos(P.phase);
      P.lean = damp(P.lean, clamp(turn * 0.5, -0.3, 0.3) * k, 6, dt);
      if (P.onGround) {
        m.legL.rotation.set(s * 0.55 * k, 0, Math.max(0, -c) * 0.22 * k);
        m.legR.rotation.set(-s * 0.55 * k, 0, -Math.max(0, c) * 0.22 * k);
        m.armL.rotation.set(-s * 0.75 * k, 0, 0.08 + 0.1 * k);
        m.armR.rotation.set(s * 0.75 * k, 0, -0.08 - 0.1 * k);
        m.body.rotation.set(0.2 * k, 0, -P.lean);
        m.body.position.y = (reducedMotion ? 0 : Math.abs(c) * 0.035 * k) - 0.03 * k + Math.sin(P.phase * 0.5) * 0.004;
        knees(0.12 * k + Math.max(0, s) * 0.5 * k, 0.12 * k + Math.max(0, -s) * 0.5 * k);
      } else {
        m.legL.rotation.set(-0.5, 0, 0.1); m.legR.rotation.set(0.35, 0, -0.1); knees(0.7, 0.3);
        m.armL.rotation.set(-0.4, 0, 0.9); m.armR.rotation.set(-0.4, 0, -0.9);
        m.body.rotation.set(0.08, 0, -P.lean); m.body.position.y = 0;
      }
      m.head.rotation.set(-0.15 * k, 0, 0); m.body.position.x = m.body.position.z = 0;
      m.root.position.copy(P.pos); m.root.rotation.set(0, P.yaw, 0);
      drape();
      shadow.position.set(P.pos.x, P.floor + P.sy + 0.03, P.pos.z);
      const sk = 1 / (1 + (P.pos.y - P.floor) * 0.35); shadow.scale.set(sk, 1, sk);
    },
    // dancing / sitting: pose the model from a pose object (see actors/moves.js); the legs pivot at the hips
    applyPose(o) {
      const m = model, rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
      m.root.position.set(P.pos.x + rx * o.x, P.pos.y, P.pos.z + rz * o.x);
      m.root.rotation.set(0, P.yaw + o.spin, 0);
      // rotate the body about the hips, not the feet
      const h = 0.96, cx = Math.cos(o.rx), sx = Math.sin(o.rx), cy = Math.cos(o.ry), sy = Math.sin(o.ry), cz = Math.cos(o.rz), sz = Math.sin(o.rz);
      m.body.position.set(h * sz * cy, o.y + h - h * (cz * cx - sz * sy * sx), -h * (cz * sx + sz * sy * cx));
      m.body.rotation.set(o.rx, o.ry, o.rz);
      m.head.rotation.set(o.hx, o.hy || 0, o.hz);
      m.armL.rotation.set(o.aL[0], o.aL[1], o.aL[2]); m.armR.rotation.set(o.aR[0], o.aR[1], o.aR[2]);
      m.legL.rotation.set(o.lL[0], 0, o.lL[1]); m.legR.rotation.set(o.lR[0], 0, o.lR[1]);
      // knees bend with the thighs (sitting, lunging); `knee` scales it (a sun lounger keeps legs long)
      const kk = o.knee === undefined ? 1 : o.knee;
      knees(clamp(-o.lL[0] - 0.12, 0, 1.6) * kk, clamp(-o.lR[0] - 0.12, 0, 1.6) * kk);
      drape();
      shadow.visible = !P.hidden;
      shadow.position.set(m.root.position.x, P.floor + 0.03, m.root.position.z); shadow.scale.set(1, 1, 1);
    },
    // back to the plain standing rig (after dancing or sitting)
    resetPose() { model.body.position.set(0, 0, 0); model.body.rotation.set(0, 0, 0); model.head.rotation.set(0, 0, 0); },
    // sat on the Comet: tucked in behind the screen, leaning and wheelie-ing with the bike
    ride(v) {
      const m = model, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), up = Math.sin(-Math.min(v.tx, 0));
      P.pos.set(v.x, v.y, v.z); P.yaw = v.yaw; P.speed = 0; P.vel.set(0, 0, 0); P.vy = 0; P.onGround = true;
      m.root.position.set(v.x - fx * (0.95 + up * 0.3), v.y + 0.02 + up * 0.5, v.z - fz * (0.95 + up * 0.3));
      m.root.rotation.set(v.tx * 0.8, v.yaw, v.tz, 'YXZ');
      m.body.rotation.set(0.42, 0, 0); m.body.position.y = 0;
      m.legL.rotation.set(-1.25, 0, 0.28); m.legR.rotation.set(-1.25, 0, -0.28); knees(1.25, 1.25); drape();
      m.armL.rotation.set(-1.6, 0, -0.12); m.armR.rotation.set(-1.6, 0, 0.12);
      m.head.rotation.x = -0.35;
      shadow.visible = false;
    },
  };
  return P;
}
