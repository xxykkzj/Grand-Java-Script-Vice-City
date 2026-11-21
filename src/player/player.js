// "Skye", the roller-skating courier: teal-and-magenta bomber jacket, white shorts, backwards cap,
// messenger bag, high-top skates. Refined blocks (actors/blocky.js): one skinned draw call plus the skirt,
// animated by swinging pivots; a pixel-art face that blinks, talks and pulls expressions.
import * as THREE from 'three';
import { damp, clamp, angleDelta, pushOut, PI, reducedMotion } from '../core/util.js';
import { clampToWorld, PIER, HZ } from '../world/layout.js';
import { APIER } from '../world/pier.js';
import { kit, rig, blockyMaterial, faceDriver, castAtlas, CAST_ROW } from '../actors/blocky.js';
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
  // two tiers: the lower one starts a little proud of the upper one, a darker seam band, a hem band
  const N = 16, rows = [0, 0.47, 0.5, 0.95, 1], verts = [];
  const geo = new THREE.BufferGeometry();
  for (let i = 0; i < N; i++) for (let r = 0; r < rows.length - 1; r++) {
    const a0 = (i / N) * PI * 2, a1 = ((i + 1) / N) * PI * 2, t0 = rows[r], t1 = rows[r + 1];
    for (const [a, t] of [[a0, t0], [a0, t1], [a1, t1], [a0, t0], [a1, t1], [a1, t0]]) verts.push([a, t, i, r]);
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
    verts.forEach(([, t, i, r], k) => {
      c.set(lk.pleat && i % 2 ? lk.pleat : lk.skirt);
      if (lk.sequin) { const j = 0.75 + ((i * 7 + Math.round(t * 2) * 3) % 5) * 0.12; c.multiplyScalar(j); }
      if (r === 1) c.multiplyScalar(0.72);
      if (r === 3) { if (lk.trimHem) c.copy(c2.set(lk.trimHem)); else c.multiplyScalar(0.82); }
      col.setXYZ(k, c.r, c.g, c.b);
    });
    col.needsUpdate = true;
  };
  // aL, zL / aR, zR: the thighs' swing (rx) and spread (rz)
  m.drape = (aL, zL, aR, zR) => {
    if (!m.visible) return;
    const pos = geo.attributes.position, len = look.len, fl = look.flare;
    verts.forEach(([a, t, , r], k) => {
      const sx = Math.sin(a), cz = Math.cos(a), wL = Math.min(1, Math.max(0, sx * 1.1 + 0.5));
      let ax = aL * wL + aR * (1 - wL), az = zL * wL + zR * (1 - wL);
      if (cz < 0) ax *= ax < 0 ? 0.3 : 1;                  // the back panel stays behind when the knees come up
      ax *= 0.85; az *= 0.9;
      const dx = Math.cos(ax) * Math.sin(az), dy = -Math.cos(ax) * Math.cos(az), dz = -Math.sin(ax);
      const spread = 1 + Math.abs(aL - aR) * 0.25 * t;
      const step = r >= 2 ? 0.022 : 0, rx = (0.235 + step + fl * t * spread), rz = (0.165 + step + fl * 0.8 * t * spread);
      pos.setXYZ(k, sx * rx + dx * len * t, dy * len * t, cz * rz + dz * len * t);
    });
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return m;
}

// The courier as refined blocks: one skinned mesh (one draw call) whose vertices each follow one of the
// pivots below, plus the skirt. Pivots, nesting and names are unchanged, so every animation still works.
function buildModel() {
  const atlas = castAtlas();
  const mat = blockyMaterial({ atlas, row: CAST_ROW.SKYE });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const K = kit(atlas, { roles: RI });
  // B(w, h, d, x, y, z, colour or role, pattern, { rx, ry, rz })
  const B = K.B, C = (rt, rb, h, seg, x, y, z, c, o) => K.C(rt, rb, h, seg, x, y, z, c, o);
  const pivot = (x, y, z, parent = body) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
  const SKIN2 = '#b97f56', STEEL = '#c9c0d8';
  // torso: shorts and belt, a bomber jacket in blocks (hem ribbing, chest stripe, zip, flap pockets,
  // stand-up collar, shoulder yokes), the messenger bag on its strap, a bolt badge and a star on the back
  const torso = pivot(0, 0, 0);
  const T = [
    B(0.4, 0.18, 0.25, 0, 0.95, 0, 'shorts', 'denim'), B(0.41, 0.045, 0.258, 0, 1.035, 0, DARK, 'leather'), B(0.06, 0.04, 0.012, 0.0, 1.035, 0.132, STEEL),
    B(0.43, 0.05, 0.27, 0, 1.075, 0, 'trim', 'rib'), B(0.42, 0.2, 0.26, 0, 1.19, 0, 'jacket', 'weave'),
    B(0.46, 0.26, 0.28, 0, 1.4, 0, 'jacket', 'weave'),
    B(0.465, 0.055, 0.285, 0, 1.4, 0, 'trim', 'knit'), B(0.465, 0.02, 0.285, 0, 1.362, 0, 'light'),
    B(0.13, 0.1, 0.27, 0.205, 1.51, 0, 'jacket', 'seam'), B(0.13, 0.1, 0.27, -0.205, 1.51, 0, 'jacket', 'seam'),
    B(0.024, 0.43, 0.012, 0, 1.3, 0.142, 'zip'), B(0.04, 0.035, 0.016, 0, 1.5, 0.146, 'zip'),
    B(0.28, 0.09, 0.05, 0, 1.585, -0.105, 'collar', 'rib'), B(0.045, 0.085, 0.16, 0.125, 1.58, -0.01, 'collar', 'rib'), B(0.045, 0.085, 0.16, -0.125, 1.58, -0.01, 'collar', 'rib'),
    B(0.11, 0.07, 0.014, 0.12, 1.2, 0.136, 'trim', 'seam'), B(0.11, 0.07, 0.014, -0.12, 1.2, 0.136, 'trim', 'seam'),
    K.decal(0.07, 0.07, 0.115, 1.29, 0.142, 'jacket', 'bolt'), K.decal(0.2, 0.2, 0, 1.3, -0.142, 'jacket', 'star', { ry: PI }),
    B(0.11, 0.08, 0.11, 0, 1.63, 0, SKIN),
    B(0.055, 0.6, 0.014, -0.02, 1.27, 0.147, DARK, 'stripe', { rz: -0.7 }), B(0.055, 0.6, 0.014, -0.02, 1.27, -0.147, DARK, 'stripe', { rz: 0.7 }),
    B(0.05, 0.05, 0.02, 0.06, 1.35, 0.153, STEEL),
    B(0.13, 0.26, 0.34, -0.31, 0.98, -0.02, 'bag', 'leather'), B(0.136, 0.12, 0.35, -0.31, 1.06, -0.02, 'trim', 'seam'),
    B(0.14, 0.04, 0.06, -0.31, 1.0, 0.13, STEEL), B(0.014, 0.1, 0.1, -0.378, 0.93, -0.02, 'light'),
  ];
  // head: a chunky block with a pixel face, nose, ears; hair masses (back, sides, sideburns, a fringe
  // poking out of the cap's strap gap) under a backwards cap with a button, a band and the brim behind
  const head = pivot(0, 1.66, 0);
  const H = [
    B(0.32, 0.32, 0.3, 0, 0.18, 0, SKIN, 'plain', { b: 0.022 }), K.face(0.276, 0.276, 0, 0.18, 0.1505, SKIN),
    B(0.04, 0.045, 0.03, 0, 0.142, 0.162, SKIN2), B(0.035, 0.075, 0.065, 0.168, 0.165, 0, SKIN2), B(0.035, 0.075, 0.065, -0.168, 0.165, 0, SKIN2),
    B(0.34, 0.24, 0.1, 0, 0.2, -0.12, HAIR, 'hair'), B(0.04, 0.17, 0.2, 0.166, 0.235, -0.035, HAIR, 'hair'), B(0.04, 0.17, 0.2, -0.166, 0.235, -0.035, HAIR, 'hair'),
    B(0.03, 0.08, 0.035, 0.157, 0.13, 0.11, HAIR, 'hair'), B(0.03, 0.08, 0.035, -0.157, 0.13, 0.11, HAIR, 'hair'),
    B(0.11, 0.05, 0.04, -0.08, 0.315, 0.15, HAIR, 'hair', { rz: 0.2 }), B(0.1, 0.05, 0.04, 0.03, 0.32, 0.155, HAIR, 'hair', { rz: -0.1 }), B(0.08, 0.045, 0.04, 0.11, 0.312, 0.148, HAIR, 'hair', { rz: -0.35 }),
    B(0.25, 0.1, 0.08, 0, 0.06, -0.13, HAIR, 'hair'),
    B(0.345, 0.11, 0.325, 0, 0.37, 0, 'trim', 'weave'), B(0.35, 0.045, 0.33, 0, 0.32, 0, 'jacket', 'rib'),
    B(0.24, 0.03, 0.17, 0, 0.32, -0.235, 'trim', 'seam'), B(0.08, 0.04, 0.02, 0, 0.345, 0.166, HAIR, 'hair'),
    C(0.028, 0.028, 0.025, 6, 0, 0.435, 0, 'jacket'),
  ];
  const eyes = pivot(0, 0.17, 0, head), mouth = pivot(0, 0.09, 0.006, head);
  // arms: upper sleeve with a shoulder seam, an elbow, the forearm, a ribbed cuff, a fingerless glove
  const arm = (sx) => {
    const a = pivot(sx * 0.3, 1.5, 0);
    a.geo = [
      B(0.145, 0.27, 0.15, 0, -0.13, 0, 'sleeve', 'weave'), B(0.15, 0.03, 0.155, 0, -0.04, 0, 'cuff'),
      B(0.128, 0.05, 0.135, 0, -0.29, 0, 'sleeve', 'seam'), B(0.135, 0.15, 0.142, 0, -0.39, 0, 'sleeve', 'weave'),
      B(0.145, 0.05, 0.152, 0, -0.47, 0, 'cuff', 'rib'),
      B(0.098, 0.08, 0.105, 0, -0.535, 0, DARK, 'leather'), B(0.088, 0.055, 0.09, 0, -0.6, 0.006, SKIN), B(0.036, 0.06, 0.036, -sx * 0.058, -0.535, 0.045, SKIN, 'plain', { rz: sx * 0.3 }),
    ];
    return a;
  };
  // legs: shorts with a rolled hem, thigh, a knee pad on the shin, striped socks, high-top skates
  // (padded collar, tongue with laces, toe cap, plate, toe stop, four wheels with hubs)
  const leg = (sx) => {
    const thigh = pivot(sx * 0.11, 0.96, 0);
    thigh.geo = [B(0.19, 0.22, 0.21, 0, -0.1, 0, 'shorts', 'denim'), B(0.198, 0.04, 0.218, 0, -0.21, 0, 'shorts', 'rib'), B(0.15, 0.22, 0.16, 0, -0.33, 0, 'thigh')];
    const shin = thigh.shin = pivot(0, -0.44, 0, thigh);
    shin.geo = [B(0.14, 0.2, 0.15, 0, -0.1, 0, 'shin'), B(0.15, 0.1, 0.06, 0, -0.03, 0.07, 'trim', 'seam'),
      B(0.143, 0.07, 0.152, 0, -0.215, 0, WHITE, 'rib'), B(0.145, 0.02, 0.155, 0, -0.2, 0, 'trim'),
      B(0.17, 0.15, 0.22, 0, -0.32, 0, 'boot', 'leather'), B(0.175, 0.04, 0.225, 0, -0.245, 0, 'jacket', 'rib'),
      B(0.16, 0.095, 0.13, 0, -0.35, 0.16, 'boot', 'leather'), B(0.1, 0.11, 0.03, 0, -0.29, 0.115, 'jacket', 'seam'),
      B(0.13, 0.035, 0.34, 0, -0.415, 0.04, DARK, 'tread'), B(0.05, 0.05, 0.05, 0, -0.44, 0.21, DARK)];
    for (let k = 0; k < 3; k++) shin.geo.push(B(0.09, 0.012, 0.012, 0, -0.26 - k * 0.032, 0.132, DARK));
    for (const wz of [0.15, -0.08]) for (const wx of [0.068, -0.068]) shin.geo.push(C(0.052, 0.052, 0.042, 8, wx, -0.47, wz, 'trim', { rz: PI / 2 }), C(0.024, 0.024, 0.048, 6, wx, -0.47, wz, STEEL, { rz: PI / 2 }));
    return thigh;
  };
  const armL = arm(1), armR = arm(-1), legL = leg(1), legR = leg(-1);
  const mesh = rig([[torso, T], [head, H], [armL, armL.geo], [armR, armR.geo], [legL, legL.geo], [legL.shin, legL.shin.geo], [legR, legR.geo], [legR.shin, legR.shin.geo]], mat);
  for (const o of [armL, armR, legL, legR, legL.shin, legR.shin]) delete o.geo;
  root.add(mesh);
  const skirt = buildSkirt(mat); skirt.position.set(0, 1.07, 0); body.add(skirt);
  // Outfits repaint the vertex colours by role
  const cA = mesh.geometry.attributes.color, rA = mesh.geometry.attributes.aRole;
  const c = new THREE.Color();
  let look = lookOf({});
  const setOutfit = (o) => {
    look = lookOf(o || {});
    const cols = ROLES.map((r) => new THREE.Color(look[r]));
    for (let i = 0; i < cA.count; i++) { const k = rA.getX(i); if (k >= 0) { c.copy(cols[k]); if (look.sequin && (k === 0 || k === 6)) c.multiplyScalar(0.8 + ((i * 13) % 7) * 0.07); cA.setXYZ(i, c.r, c.g, c.b); } }
    cA.needsUpdate = true;
    skirt.paint(look);
  };
  const face = faceDriver(mat.userData.face, reducedMotion);
  const api = { root, body, torso, head, eyes, mouth, armL, armR, legL, legR, skirt, mesh, setOutfit, face, get look() { return look; }, get faceState() { return mat.userData.face.x; } };
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
  let breathT = 0;
  const knees = (kl, kr) => { model.legL.shin.rotation.x = kl; model.legR.shin.rotation.x = kr; };
  const drape = () => { const m = model; m.skirt.drape(m.legL.rotation.x, m.legL.rotation.z, m.legR.rotation.x, m.legR.rotation.z); };
  const P = {
    talking: false,
    // blink, breathe, and move the mouth while talking in a scene (called every frame)
    tickFace(dt) {
      const m = model;
      m.face(dt, P.talking, P.expr);
      breathT += dt;
      const br = Math.sin(breathT * 1.7);
      m.torso.scale.set(1 + br * 0.006, 1, 1 + br * 0.022);
    },
    expr: null,          // a cutscene gesture ('wave', 'think'…): the face shows it
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
      const len = Math.hypot(dx, dz), top = inp.sprint ? 13.5 * (P.boost || 1) : 7.5;   // boost: REFRESHED (game/eat.js)
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
        // ...and the same over the side of Starlight Pier, past its solid rails on the sand
        const A = APIER;
        if (P.pos.y > -0.3 && px > A.x0 && px < A.x1 && pz > 163 && pz < A.z1 + 0.5 && (px < A.x0 + 1.5 || px > A.x1 - 1.5 || pz > A.z1 - 1.5)) {
          P.leap = true;
          if (px < A.x0 + 1.5) P.vel.x = Math.min(P.vel.x, -3.5); else if (px > A.x1 - 1.5) P.vel.x = Math.max(P.vel.x, 3.5); else P.vel.z = Math.max(P.vel.z, 3.5);
        }
      }
      // the ground: a roof, a ramp, a deck or a container top (world/surfaces.js), else the street or the sand shelf
      const ground = (x, z) => { const s = L.surf.at(x, z, P.pos.y + 0.6); return s > 0 ? s : P.groundAt ? P.groundAt(x, z) : 0; };
      const g0 = ground(P.pos.x, P.pos.z);
      const was = P.onGround;
      P.vy -= (P.lowGravity ? 4.2 : 23) * dt;
      P.pos.y += P.vy * dt;
      if (P.pos.y <= g0) {
        const hit = -P.vy;
        if (!P.onGround && P.vy < -4) audio.step(1);
        P.pos.y = g0; P.vy = 0; P.onGround = true;
        // a long drop hurts (a roof edge, a deck): game/rules.js decides how much, a big one knocks you out
        if (!was && hit > 13.6 && P.onFall) P.onFall(hit, (P.fallFrom || g0) - g0);
      } else { if (was) P.fallFrom = P.pos.y; P.onGround = false; P.fallFrom = Math.max(P.fallFrom || 0, P.pos.y); }
      const ox = P.pos.x, oz = P.pos.z;
      P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
      // a ramp side or a deck is a wall unless it is a step you can take
      if (L.surf.climb(P.pos.x, P.pos.z) - P.pos.y > 0.75) { P.pos.x = ox; P.pos.z = oz; P.vel.x *= 0.2; P.vel.z *= 0.2; }
      {          // walking down a slope (the sand shelf, a ramp): stay on it instead of hopping
        const g1 = ground(P.pos.x, P.pos.z); P.sy = g1;
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
      const sk = 1 / (1 + Math.max(0, P.pos.y - P.floor - P.sy) * 0.35); shadow.scale.set(sk, 1, sk);
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
    // at the wheel of an open car (the convertible): seated on the driver's seat (vehicles/types.js spec.seat),
    // thighs forward, shins down, hands on the wheel turning with the steering; follows the car's pitch and roll
    sitIn(v, steer = 0) {
      const m = model, st = (v.spec && v.spec.seat) || [0.42, 0.66, -0.55], c = Math.cos(v.yaw), sn = Math.sin(v.yaw);
      const lx = st[0], ly = st[1] - 0.86, lz = st[2] - 0.06;
      m.root.position.set(v.x + c * lx + sn * lz, v.y + ly, v.z - sn * lx + c * lz);
      m.root.rotation.set(v.tx || 0, v.yaw, v.tz || 0, 'YXZ');
      m.body.rotation.set(-0.12, 0, 0); m.body.position.y = 0;
      m.legL.rotation.set(-1.42, 0, 0.08); m.legR.rotation.set(-1.42, 0, -0.08); knees(1.35, 1.35); drape();
      const w = clamp(steer, -1, 1) * 0.22;
      m.armL.rotation.set(-1.15 + w, 0, -0.18); m.armR.rotation.set(-1.15 - w, 0, 0.18);
      m.head.rotation.set(-0.05, -steer * 0.15, 0);
      m.root.visible = true; shadow.visible = false;
    },
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
