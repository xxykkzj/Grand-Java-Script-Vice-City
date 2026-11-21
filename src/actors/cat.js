// Marmalade, the alley cat: a ginger tabby who suns herself on the same windowsill in an old-town back alley
// every afternoon (the wall faces the setting sun). Blocky like everyone else, one skinned mesh (one draw call)
// with a dozen rigid bones, posed procedurally; animated only within ~40 m of the camera.
//   by day in the sun: a loaf or a sprawl on the sill, slow breathing, ear twitches, slow blinks, tail-tip flicks,
//     now and then a stretch, a roll onto her back, a paw to groom
//   evening: sitting up, watching the alley · night: curled up asleep, tail over her nose · rain: inside the bay
//     window behind the glass, looking out
//   you come within ~3 m: she lifts her head and watches you; E pats her (she leans into it, purrs, a heart);
//     keep patting and she rolls over for a belly rub
//   a sprint past, a fast car, a bang or a siren nearby: ears back, she jumps inside, and comes back later
import * as THREE from 'three';
import { box, merge, PI, clamp, damp, lerp, angleDelta, timeU, reducedMotion } from '../core/util.js';

export const CAT_NAME = 'MARMALADE';
const GINGER = '#e8873a', STRIPE = '#b8541c', CREAMC = '#fff1dc', PINK = '#ff8fa8', EYE = '#7ee05a';

export function createCat(game, scene) {
  const { L, player, hud, audio, env, camera } = game;
  // ---- where: the alley nearest the middle of town in the midtown row; the west building's wall faces +x
  const al = [...L.alleys].filter((a) => a.row === 1).sort((p, q) => Math.abs(p.x) - Math.abs(q.x))[0];
  const WX = al.x0, cands = [];
  for (let z = al.z0 + 2.5; z <= al.z1 - 2.5; z += 1.5) cands.push(z);
  const clearAt = (z) => !L.props.cols.some((o) => (o.c ? Math.abs(o.x - (WX + 1)) < 1.6 + o.r && Math.abs(o.z - z) < 1.4 + o.r : o.x1 > WX && o.x0 < WX + 2.2 && o.z1 > z - 1.4 && o.z0 < z + 1.4)) && !L.loose.some((b) => Math.abs(b.hx - (WX + 1)) < 1.8 && Math.abs(b.hz - z) < 1.6);
  const SZ = cands.find(clearAt) ?? (al.z0 + al.z1) / 2;
  const SILL = { x: WX + 1.1, y: 1.0, z: SZ };                // on the outer ledge of the bay window
  const IN = { x: WX + 0.5, y: 1.0, z: SZ + 0.25 };          // inside the bay, behind the half-open glass
  const PAT_SPOT = { x: WX + 1.9, z: SZ };

  // ---- the bay window: ledge, sides, a little roof, the raised sash, a dark room behind, a plant, a bowl below
  {
    const g = [], W0 = WX, F = WX + 0.95;
    g.push(box(1.3, 0.1, 1.7, W0 + 0.65, 0.95, SZ, '#f6f1e7'), box(1.3, 0.12, 1.75, W0 + 0.66, 0.84, SZ, '#d8c8b8'));
    for (const s of [-1, 1]) g.push(box(0.95, 1.4, 0.08, W0 + 0.47, 1.7, SZ + s * 0.8, '#7fc8c0'));
    g.push(box(1.05, 0.08, 1.8, W0 + 0.52, 2.44, SZ, '#ff8a6a', 0, 0, -0.18), box(0.06, 1.42, 0.08, F, 1.7, SZ - 0.78, '#f6f1e7'), box(0.06, 1.42, 0.08, F, 1.7, SZ + 0.78, '#f6f1e7'));
    g.push(box(0.06, 0.08, 1.6, F, 2.38, SZ, '#f6f1e7'));
    // the sash pushed up: a glass pane over the top half, its frame; the bottom half is open
    g.push(box(0.04, 0.62, 1.5, F - 0.04, 2.06, SZ, '#9fd0e8'), box(0.06, 0.06, 1.56, F - 0.03, 1.74, SZ, '#f6f1e7'));
    g.push(box(0.03, 1.38, 1.56, W0 + 0.02, 1.7, SZ, '#3a2a40'), box(0.02, 1.2, 0.5, W0 + 0.05, 1.7, SZ - 0.5, '#c86a8a'), box(0.02, 1.2, 0.5, W0 + 0.05, 1.7, SZ + 0.5, '#c86a8a'));
    // a pot of geraniums at the far end of the bay, a food bowl and a water bowl on the ground below the sill
    g.push(box(0.2, 0.18, 0.2, W0 + 0.5, 1.09, SZ - 0.55, '#c0603a'), box(0.26, 0.16, 0.26, W0 + 0.5, 1.26, SZ - 0.55, '#4f9a4a'), box(0.07, 0.07, 0.07, W0 + 0.56, 1.36, SZ - 0.5, '#ff3f6a'), box(0.07, 0.07, 0.07, W0 + 0.44, 1.37, SZ - 0.6, '#ff3f6a'));
    g.push(box(0.26, 0.06, 0.26, WX + 1.2, 0.03, SZ + 0.45, '#ff5fa8'), box(0.2, 0.02, 0.2, WX + 1.2, 0.065, SZ + 0.45, '#a0623a'), box(0.22, 0.06, 0.22, WX + 1.2, 0.03, SZ - 0.1, '#27d8cf'), box(0.17, 0.02, 0.17, WX + 1.2, 0.065, SZ - 0.1, '#bfe6ff'));
    g.push(box(0.5, 0.25, 0.04, WX + 0.02 + 0.02, 2.75, SZ, '#2a2140'));
    const m = new THREE.Mesh(merge(g), new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.add(m); var bay = m;
    L.props.box(WX + 0.65, SZ, 1.3, 1.75, 2.5).tag = 'bay window';
    L.props.build();
  }

  // ---- the cat: one skinned mesh. Bones, then the pieces on each bone (in the bind pose, cat-local: +z forward)
  const bones = {}, list = [];
  const bone = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); (parent ? bones[parent] : null)?.add(b); bones[name] = b; list.push(b); return b; };
  bone('root', null, 0, 0, 0); bone('body', 'root', 0, 0.17, 0); bone('neck', 'body', 0, 0.03, 0.18); bone('head', 'neck', 0, 0.07, 0.05);
  bone('earL', 'head', 0.05, 0.07, -0.01); bone('earR', 'head', -0.05, 0.07, -0.01); bone('lids', 'head', 0, 0.02, 0.07);
  for (const [n, x, z] of [['fl', 0.055, 0.14], ['fr', -0.055, 0.14], ['bl', 0.055, -0.14], ['br', -0.055, -0.14]]) bone(n, 'body', x, -0.05, z);
  bone('t1', 'body', 0, 0.04, -0.2); bone('t2', 't1', 0, 0, -0.1); bone('t3', 't2', 0, 0, -0.1); bone('t4', 't3', 0, 0, -0.1);
  const root = bones.root; root.updateMatrixWorld(true);
  const parts = [];
  const P = (bn, g) => { parts.push([list.indexOf(bones[bn]), g]); };
  // torso: ginger with tabby stripes over the back, a cream belly
  P('body', box(0.17, 0.15, 0.4, 0, 0.17, 0, GINGER));
  for (const z of [-0.13, -0.05, 0.03, 0.11]) P('body', box(0.176, 0.03, 0.035, 0, 0.235, z, STRIPE));
  P('body', box(0.12, 0.02, 0.3, 0, 0.094, 0, CREAMC));
  P('neck', box(0.15, 0.15, 0.1, 0, 0.21, 0.2, GINGER)); P('neck', box(0.1, 0.1, 0.02, 0, 0.19, 0.25, CREAMC));
  // head: muzzle, nose, eyes (on the lids bone so they can close), a dark line under them for closed eyes, stripes
  P('head', box(0.16, 0.13, 0.14, 0, 0.28, 0.25, GINGER)); P('head', box(0.085, 0.05, 0.04, 0, 0.247, 0.33, CREAMC));
  P('head', box(0.026, 0.02, 0.012, 0, 0.268, 0.352, PINK)); P('head', box(0.024, 0.006, 0.01, 0.04, 0.29, 0.321, '#3a2418')); P('head', box(0.024, 0.006, 0.01, -0.04, 0.29, 0.321, '#3a2418'));
  for (const x of [-0.04, 0, 0.04]) P('head', box(0.014, 0.012, 0.06, x, 0.348, 0.24, STRIPE));
  for (const s of [-1, 1]) { P('lids', box(0.032, 0.026, 0.008, s * 0.04, 0.297, 0.325, EYE)); P('lids', box(0.008, 0.022, 0.009, s * 0.04, 0.297, 0.326, '#101010')); }
  for (const [bn, s] of [['earL', 1], ['earR', -1]]) { P(bn, box(0.05, 0.055, 0.022, s * 0.05, 0.365, 0.24, GINGER, 0, 0, s * -0.2)); P(bn, box(0.028, 0.032, 0.006, s * 0.05, 0.36, 0.252, PINK, 0, 0, s * -0.2)); }
  // legs with white socks
  for (const [bn, x, z] of [['fl', 0.055, 0.14], ['fr', -0.055, 0.14], ['bl', 0.055, -0.14], ['br', -0.055, -0.14]]) { P(bn, box(0.05, 0.11, 0.055, x, 0.065, z, GINGER)); P(bn, box(0.054, 0.03, 0.06, x, 0.015, z + 0.004, CREAMC)); }
  // the tail: four blocks, banded, a dark tip
  ['t1', 't2', 't3', 't4'].forEach((bn, i) => P(bn, box(0.045 - i * 0.004, 0.045 - i * 0.004, 0.105, 0, 0.21, -0.255 - i * 0.1, i === 3 ? STRIPE : i % 2 ? STRIPE : GINGER)));
  const geo = merge(parts.map(([, g]) => g.clone()));
  { const n = geo.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); let o = 0;
    for (const [bi, g] of parts) { const c = g.attributes.position.count; for (let k = 0; k < c; k++) { si[(o + k) * 4] = bi; sw[(o + k) * 4] = 1; } o += c; g.dispose(); }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); }
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.add(root); mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list));
  mesh.frustumCulled = false;
  const holder = new THREE.Group(); holder.add(mesh); scene.add(holder);
  // bind-pose bone positions (poses only rotate, except the root and the body's height)
  const rest = {}; for (const k in bones) rest[k] = bones[k].position.clone();

  // ---- a couple of hearts that float up after a pat
  const heartGeo = merge([box(0.09, 0.09, 0.03, 0, 0, 0, '#ff4f9a', 0, 0, PI / 4), box(0.07, 0.07, 0.032, -0.035, 0.035, 0, '#ff4f9a'), box(0.07, 0.07, 0.032, 0.035, 0.035, 0, '#ff4f9a')]);
  const hearts = new THREE.InstancedMesh(heartGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), 3); hearts.frustumCulled = false; hearts.visible = false; scene.add(hearts);
  const HS = [0, 1, 2].map(() => ({ t: 0, x: 0, y: 0, z: 0 }));

  // ---- the state machine
  const S = { where: 'sill', pos: new THREE.Vector3(SILL.x, SILL.y, SILL.z), yaw: PI, mode: 'sun', base: 'loaf', baseT: 8, act: null, actT: 0, hideT: 0, pats: 0, patT: 0, patting: 0,
    purr: 0, meowT: 30 + Math.random() * 40, blinkT: 3, blink: 0, ear: 0, earT: 2, look: 0, lookYaw: 0, lookPitch: 0, jump: null, belly: 0, startles: 0, patsTotal: 0, meows: 0 };
  const cur = {}, tgt = {};
  const POSE = (o) => Object.assign({ rootY: 0, rootRz: 0, rootRx: 0, bodyY: 0, bodyRx: 0, neckRx: 0, headRx: 0, headRy: 0, headRz: 0, fl: 0, fr: 0, bl: 0, br: 0, tRy: 0.15, tRx: 0.25, tCurl: 0, ears: 0, lids: 1 }, o);
  const POSES = {
    loaf: POSE({ bodyY: -0.1, fl: -1.45, fr: -1.45, bl: 1.45, br: 1.45, tRy: 0.42, tRx: 0.05, headRx: 0.05 }),
    sprawl: POSE({ rootRz: 1.3, rootY: 0.02, bodyY: -0.07, fl: -0.5, fr: -0.35, bl: 0.45, br: 0.3, tRy: 0.08, tRx: 0.02, headRz: -1.0, headRx: -0.1 }),
    sit: POSE({ bodyRx: -0.8, bodyY: -0.03, fl: 0.8, fr: 0.8, bl: -0.8, br: -0.8, headRx: 0.6, neckRx: 0.1, tRy: 0.5, tRx: 0.7 }),
    curl: POSE({ bodyY: -0.11, fl: -1.45, fr: -1.45, bl: 1.45, br: 1.45, headRx: 0.6, headRy: 0.7, neckRx: 0.25, tRy: 0.85, tRx: 0.05, tCurl: 1, lids: 0.12, ears: -0.3 }),
    belly: POSE({ rootRz: 2.9, rootY: 0.24, bodyY: -0.08, fl: -2.2, fr: -2.0, bl: 2.0, br: 2.2, tRy: 0.1, tRx: -0.3, headRz: 0.4, headRx: -0.4 }),
    groom: POSE({ bodyRx: -0.8, bodyY: -0.03, fl: -0.9, fr: 0.8, bl: -0.8, br: -0.8, headRx: 1.0, headRy: 0.35, neckRx: 0.25, tRy: 0.5, tRx: 0.7, lids: 0.3 }),
    stretch: POSE({ bodyRx: 0.32, bodyY: -0.02, fl: -1.1, fr: -1.1, bl: -0.3, br: -0.3, headRx: -0.25, tRy: 0, tRx: -0.6, lids: 0.3 }),
    alert: POSE({ bodyRx: -0.7, fl: 0.7, fr: 0.7, bl: -0.8, br: -0.8, headRx: 0.6, ears: -0.9, tRy: 0, tRx: 1.2, lids: 1.25 }),
  };
  Object.assign(cur, POSES.loaf);
  const near = (r) => !game.inside && !game.vehicle && Math.hypot(player.pos.x - S.pos.x, player.pos.z - S.pos.z) < r && player.pos.y < 3;
  function moodFor() {
    const h = env.tod;
    if (env.w.rain > 0.25) return 'rain';
    if (S.hideT > 0) return 'hide';
    if (h >= 22 || h < 6) return 'sleep';
    if (h >= 18.5) return 'evening';
    if (h >= 8.5) return 'sun';
    return 'morning';
  }
  function startle(why) {
    if (S.hideT > 0 || S.where !== 'sill' || S.mode === 'rain') return;
    S.hideT = 25 + Math.random() * 20; S.startles++; S.act = null; S.patting = 0; S.purr = 0; S.why = why;
    S.jump = { t: 0, from: S.pos.clone(), to: new THREE.Vector3(IN.x, IN.y, IN.z) };
    S.where = 'in';
    if (Math.hypot(camera.position.x - S.pos.x, camera.position.z - S.pos.z) < 30) audio.meow(0.6, true);
  }
  // listen to the town: anything that scares people near here scares her too
  if (game.peds) for (const k of ['alarm', 'scare']) { const f = game.peds[k].bind(game.peds); game.peds[k] = (x, z, r, ...a) => { if (Math.hypot(x - SILL.x, z - SILL.z) < Math.max(r, 30)) startle(k); return f(x, z, r, ...a); }; }
  function pat() {
    if (S.where !== 'sill' || S.jump || S.hideT > 0 || S.mode === 'rain' || !near(2.4)) return false;
    S.pats = S.patT > 0 ? S.pats + 1 : 1; S.patT = 12; S.patting = 2.4; S.patsTotal++;
    S.purr = 1;
    player.vel.set(0, 0, 0); player.speed = 0; player.yaw = Math.atan2(S.pos.x - player.pos.x, S.pos.z - player.pos.z);
    if (S.pats >= 3) { S.belly = 4.5; S.pats = 0; }
    for (let i = 0; i < 3; i++) { const h = HS[i]; h.t = 1.4 + i * 0.25; h.d = i * 0.25; h.x = S.pos.x + (i - 1) * 0.08; h.y = S.pos.y + 0.45; h.z = S.pos.z; }
    hud.toast(CAT_NAME, S.belly > 0 ? 'SHE ROLLS OVER FOR A BELLY RUB' : ['SHE LEANS INTO YOUR HAND, PURRING', 'A SLOW BLINK. YOU ARE APPROVED', 'PURRING LIKE A LITTLE ENGINE'][S.patsTotal % 3]);
    return true;
  }
  const api = {
    S, bones, mesh, sill: SILL, inside: IN, spot: PAT_SPOT, alley: al, bay, name: CAT_NAME,
    canPat: () => S.where === 'sill' && !S.jump && S.hideT <= 0 && S.mode !== 'rain' && near(2.4),
    pat, startle,
    hint: () => (api.canPat() ? ['E', 'pat ' + CAT_NAME.charAt(0) + CAT_NAME.slice(1).toLowerCase()] : null),
    get purring() { return S.purr > 0.05; },
    update(dt) {
      const cd = Math.hypot(camera.position.x - SILL.x, camera.position.z - SILL.z);
      holder.visible = !game.inside && cd < 120 && camera.position.y < 90;
      bay.visible = holder.visible || (!game.inside && cd < 250);
      const t = timeU.value, rm = reducedMotion ? 0.35 : 1;
      S.patT -= dt; S.hideT -= dt; S.patting -= dt; S.belly -= dt;
      S.purr = S.patting > 0 || S.belly > 0 ? Math.min(1, S.purr + dt * 3) : Math.max(0, S.purr - dt * 0.6);
      // the noise test: a sprint past, a fast vehicle close by (sirens and bangs come through peds.alarm / scare)
      if (S.where === 'sill' && !S.jump) {
        const v = game.vehicle;
        if (!v && near(5) && player.speed > 11) startle('sprint');
        if ((S.chk = (S.chk || 0) - dt) <= 0) { S.chk = 0.3; for (const c of game.vehicles.cars) if (!c.off && Math.abs(c.x - SILL.x) < 12 && Math.abs(c.z - SILL.z) < 12 && Math.hypot(c.vx, c.vz) > 9) { startle('car'); break; } }
      }
      const mode = moodFor(); S.mode = mode;
      // back out onto the sill when she is over the fright (and it is not raining)
      if (S.where === 'in' && !S.jump && mode !== 'rain' && mode !== 'hide') S.jump = { t: 0, from: S.pos.clone(), to: new THREE.Vector3(SILL.x, SILL.y, SILL.z), out: true };
      if (S.where === 'sill' && !S.jump && mode === 'rain') { S.jump = { t: 0, from: S.pos.clone(), to: new THREE.Vector3(IN.x, IN.y, IN.z) }; }
      if (S.jump) {
        const J = S.jump; J.t += dt / 0.55; const k = clamp(J.t, 0, 1);
        S.pos.lerpVectors(J.from, J.to, k); S.pos.y += Math.sin(k * PI) * 0.35;
        if (k >= 1) { S.where = J.out ? 'sill' : 'in'; S.jump = null; }
      }
      if (!holder.visible || cd > 40) { holder.position.copy(S.pos); return; }
      // the pose for the moment
      let base = 'loaf';
      if (S.where === 'in' || S.jump) base = S.jump ? 'alert' : mode === 'hide' ? 'alert' : 'sit';
      else if (S.belly > 0) base = 'belly';
      else if (mode === 'sleep') base = near(1.8) ? 'loaf' : 'curl';
      else if (mode === 'evening' || mode === 'morning') base = 'sit';
      else {
        S.baseT -= dt; if (S.baseT <= 0) { S.baseT = 15 + Math.random() * 20; S.base = Math.random() < 0.6 ? 'loaf' : 'sprawl'; }
        base = S.base;
        S.actT -= dt;
        if (S.act && near(3.2) && S.patting <= 0) { S.act = null; S.actT = 8; }        // someone comes up: she stops to look
        if (!S.act && S.actT <= 0 && S.patting <= 0) { const r = Math.random(); S.act = r < 0.45 ? 'groom' : r < 0.75 ? 'stretch' : 'roll'; S.actT = S.act === 'roll' ? 4 : 3.5; }
        if (S.act) { if (S.actT <= 0) { S.act = null; S.actT = 10 + Math.random() * 18; } else base = S.act === 'roll' ? 'belly' : S.act; }
      }
      Object.assign(tgt, POSES[base]);
      // she watches you: head tracks within ~3 m, ears forward (asleep, only if you come right up)
      const watching = near(3.2) && base !== 'belly' && !S.jump && !(mode === 'sleep' && !near(1.8));
      const hx = player.pos.x - S.pos.x, hz = player.pos.z - S.pos.z, hy = player.pos.y + 1.45 - (S.pos.y + 0.3);
      const yawTo = clamp(angleDelta(S.yaw, Math.atan2(hx, hz)), -1.25, 1.25), pitchTo = clamp(-Math.atan2(hy, Math.hypot(hx, hz)), -0.8, 0.5);
      S.look = damp(S.look, watching ? 1 : 0, 4, dt);
      S.lookYaw = yawTo; S.lookPitch = pitchTo;
      tgt.headRy = lerp(tgt.headRy, yawTo, S.look * (base === 'sprawl' ? 0.6 : 1)); tgt.headRx = lerp(tgt.headRx, (base === 'sit' || base === 'alert' ? 0.6 : 0.1) + pitchTo, S.look);
      if (S.look > 0.5 && base === 'curl') tgt.lids = 0.8;
      // a pat: lean into the hand, eyes closed
      if (S.patting > 0 && base !== 'belly') { tgt.headRz = 0.45; tgt.lids = 0.1; tgt.headRx += 0.15; }
      if (S.belly > 0) tgt.lids = 0.15;
      // a slow blink now and then, the ears twitch, the tail tip flicks
      S.blinkT -= dt; if (S.blinkT <= 0) { S.blinkT = 3 + Math.random() * 5; S.blink = 1; }
      S.blink = Math.max(0, S.blink - dt * 1.6);
      const lidK = tgt.lids * (1 - Math.sin(Math.min(1, S.blink) * PI) * 0.9);
      S.earT -= dt; if (S.earT <= 0) { S.earT = 2 + Math.random() * 4; S.ear = 1; }
      S.ear = Math.max(0, S.ear - dt * 5);
      for (const k in tgt) if (k !== 'lids') cur[k] = damp(cur[k] ?? 0, tgt[k], base === 'alert' ? 12 : 3.2, dt);
      cur.lids = damp(cur.lids, lidK, 10, dt);
      const breathe = 1 + Math.sin(t * (mode === 'sleep' ? 1.6 : 2.4)) * 0.035 * rm;
      const flick = Math.sin(t * 3.1) * Math.sin(t * 0.7) * 0.5 * rm;
      // apply: rotations on the bones from rest; the root carries the pose's roll and height
      const B = bones;
      holder.position.copy(S.pos); holder.rotation.set(0, S.where === 'in' && !S.jump ? PI / 2 : S.yaw, 0);
      B.root.position.set(0, cur.rootY, 0); B.root.rotation.set(cur.rootRx, 0, cur.rootRz);
      B.body.position.set(0, rest.body.y + cur.bodyY, 0); B.body.rotation.set(cur.bodyRx, 0, 0); B.body.scale.set(1, breathe, 1);
      B.neck.rotation.set(cur.neckRx, 0, 0);
      B.head.rotation.set(cur.headRx, cur.headRy, cur.headRz + (S.purr > 0.5 ? Math.sin(t * 9) * 0.02 : 0), 'YXZ');
      B.earL.rotation.set(cur.ears - S.ear * 0.5, 0, 0); B.earR.rotation.set(cur.ears - (S.ear > 0.5 ? 0 : S.ear * 0.3), 0, 0);
      B.lids.scale.set(1, Math.max(0.08, cur.lids), 1);
      B.fl.rotation.set(cur.fl + (S.act === 'groom' ? Math.sin(t * 6) * 0.15 : 0), 0, 0); B.fr.rotation.set(cur.fr, 0, 0); B.bl.rotation.set(cur.bl, 0, 0); B.br.rotation.set(cur.br, 0, 0);
      const ts = ['t1', 't2', 't3', 't4'];
      ts.forEach((n, i) => {
        const k = i / 3, curl = cur.tCurl;
        B[n].rotation.set(i === 0 ? cur.tRx : cur.tRx * 0.15 * (1 - curl), cur.tRy * (1 + curl * 0.6) + (i >= 2 ? flick * (0.4 + k) * (1 - curl * 0.8) : 0) + (S.purr > 0.5 ? Math.sin(t * 2 + i) * 0.1 : 0), 0);
      });
      // purring, and a soft meow now and then when someone is nearby
      S.meowT -= dt;
      if (S.meowT <= 0) { S.meowT = 45 + Math.random() * 60; if (near(15) && S.where === 'sill' && mode !== 'sleep') { audio.meow(0.5); S.meows++; } }
      // hearts
      let any = false; const M4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(camera.position.x - S.pos.x, camera.position.z - S.pos.z), 0));
      for (let i = 0; i < 3; i++) {
        const h = HS[i];
        if (h.t <= 0) { hearts.setMatrixAt(i, M4.makeScale(0, 0, 0)); continue; }
        h.t -= dt; any = true;
        if (h.d > 0) { h.d -= dt; hearts.setMatrixAt(i, M4.makeScale(0, 0, 0)); continue; }
        h.y += dt * 0.35; const s = Math.min(1, h.t * 1.5);
        M4.compose(new THREE.Vector3(h.x + Math.sin(t * 4 + i) * 0.05, h.y, h.z), q, new THREE.Vector3(s, s, s)); hearts.setMatrixAt(i, M4);
      }
      hearts.visible = any; hearts.instanceMatrix.needsUpdate = true;
    },
    // ---- automated checks
    state: () => ({ where: S.where, mode: S.mode, base: S.jump ? 'jump' : S.act || S.base, pos: S.pos.toArray().map((v) => +v.toFixed(2)), look: +S.look.toFixed(2), headRy: +bones.head.rotation.y.toFixed(2), lookYaw: +S.lookYaw.toFixed(2), purr: +S.purr.toFixed(2),
      hearts: HS.filter((h) => h.t > 0).length, hideT: +Math.max(0, S.hideT).toFixed(1), startles: S.startles, why: S.why || null, pats: S.patsTotal, belly: S.belly > 0, lids: +cur.lids.toFixed(2), drawn: holder.visible, spot: PAT_SPOT, sill: SILL }),
  };
  return api;
}
