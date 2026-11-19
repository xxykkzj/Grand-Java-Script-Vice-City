// Neon Coast character lab: a turntable studio for the procedural cast (src/actors/figure.js).
// The figures are posed with the game's own code, copied here unchanged in spirit so the game files stay
// untouched: the courier's animate / applyPose / ride / tickFace (player/player.js), sitTarget
// (game/activity.js), the talk gestures (game/cutscene.js), the carjack reach (game/rules.js) and the
// room idles (game/interiors.js). Dance moves come straight from actors/moves.js.
import * as THREE from 'three';
import { createFigure, CAST, BONES, PIVOTS } from '../../src/actors/figure.js';
import { MOVES, newPose, dancePose, blendPose, copyPose, cheerPose } from '../../src/actors/moves.js';
import { OUTFITS } from '../../src/game/story.js';

const $ = (id) => document.getElementById(id);
const PI = Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const angleDelta = (a, b) => { let d = (b - a) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; return d; };
const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = (typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches) || 'ontouchstart' in window;
const BPM = 104;

const lab = (window.__lab = { ready: false, errors: [], frames: 0, reduced });
addEventListener('error', (e) => lab.errors.push(String((e && e.message) || e)));
addEventListener('unhandledrejection', (e) => lab.errors.push(String(e.reason)));

// ---------------------------------------------------------------------------------------------- studio
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#160b2e', 10, 30);
const camera = new THREE.PerspectiveCamera(34, 1, 0.03, 80);
const rimU = { value: new THREE.Color('#3a2560') };
const hemi = new THREE.HemisphereLight('#c6b8ff', '#3a1a4a', 1.0);
const key = new THREE.DirectionalLight('#fff0e4', 2.3); key.position.set(2.5, 4.2, 3.6);
const rimA = new THREE.DirectionalLight('#ff3fb4', 1.8); rimA.position.set(-3.2, 2.6, -3);
const rimB = new THREE.DirectionalLight('#27e8ff', 1.5); rimB.position.set(3.2, 2.1, -3.4);
const fill = new THREE.DirectionalLight('#8a7aff', 0.45); fill.position.set(-3, 1.2, 3);
scene.add(hemi, key, rimA, rimB, fill);
const LIGHTS = {
  studio: () => { hemi.color.set('#c6b8ff'); hemi.groundColor.set('#3a1a4a'); hemi.intensity = 1.0; key.color.set('#fff0e4'); key.intensity = 2.3; rimA.intensity = 1.8; rimB.intensity = 1.5; fill.intensity = 0.45; rimU.value.set('#3a2560'); },
  // the game's dusk street (world/environment.js): hemisphere + sun only
  dusk: () => { hemi.color.set('#c07ad8'); hemi.groundColor.set('#ff9a78'); hemi.intensity = 1.25; key.color.set('#ff9a5c'); key.intensity = 1.8; rimA.intensity = 0; rimB.intensity = 0; fill.intensity = 0; rimU.value.set('#000000'); },
  // indoors at Club Prism: the room light plus the soft character rim (places.js)
  club: () => { hemi.color.set('#fff0f6'); hemi.groundColor.set('#b090d0'); hemi.intensity = 2.1; key.color.set('#ffffff'); key.intensity = 0.5; rimA.intensity = 0; rimB.intensity = 0; fill.intensity = 0; rimU.value.set('#5a3a8a'); },
};
// floor: a soft disc with a neon grid and the turntable ring, fading out into the backdrop
const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 72).rotateX(-PI / 2), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `varying vec2 vP;
    void main(){
      float r = length(vP);
      vec2 g = abs(fract(vP * 1.0) - 0.5);
      float grid = smoothstep(0.47, 0.5, max(g.x, g.y)) * 0.35;
      float ring = smoothstep(0.035, 0.0, abs(r - 1.05)) * 0.9 + smoothstep(0.02, 0.0, abs(r - 1.12)) * 0.4;
      vec3 c = mix(vec3(0.16, 0.08, 0.3), vec3(0.05, 0.03, 0.11), smoothstep(0.0, 9.0, r));
      c += vec3(0.6, 0.25, 1.0) * grid * smoothstep(12.0, 2.0, r) + mix(vec3(1.0, 0.25, 0.7), vec3(0.15, 0.9, 1.0), 0.5 + 0.5 * sin(atan(vP.y, vP.x) * 2.0)) * ring;
      gl_FragColor = vec4(c, smoothstep(14.0, 6.0, r));
    }`,
}));
floor.renderOrder = -2;
scene.add(floor);
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
const seatMat = new THREE.MeshStandardMaterial({ color: '#3a2a6a', roughness: 0.5, metalness: 0.2 });

// ---------------------------------------------------------------------------------------------- pose code from the game
function makeDriver(fig) {
  const m = fig, H = fig.dims.hip;
  const D = { pos: new THREE.Vector3(), yaw: 0, onGround: true, phase: Math.random() * 3, speed: 0, lean: 0, talking: false };
  let blinkT = 0.8 + Math.random() * 2, blink = 0, breathT = Math.random() * 4, talkT = 0;
  const knees = (kl, kr) => { m.legL.shin.rotation.x = kl; m.legR.shin.rotation.x = kr; };
  const drape = () => m.skirt.drape(m.legL.rotation.x, m.legL.rotation.z, m.legR.rotation.x, m.legR.rotation.z);
  // player.js tickFace: blink, breathe, move the mouth while talking (drives the eyes / mouth hooks)
  D.tickFace = (dt) => {
    blinkT -= dt;
    if (blinkT <= 0) { blink = 0.13; blinkT = 2.2 + Math.random() * 3.5; }
    blink = Math.max(0, blink - dt);
    m.eyes.scale.y = blink > 0 ? 0.12 : 1;
    breathT += dt;
    const br = Math.sin(breathT * 1.7);
    m.torso.scale.set(1 + br * 0.006, 1, 1 + br * 0.022);
    talkT += dt;
    m.mouth.scale.y = D.talking && !reduced ? 1.3 + Math.abs(Math.sin(talkT * 17)) * 2.4 * (0.6 + 0.4 * Math.sin(talkT * 5.3)) : D.talking ? 1.8 : 1;
  };
  // player.js animate: skate / walk / sprint / in the air
  D.animate = (dt, turn = 0) => {
    const k = clamp(D.speed / 7.5, 0, 1.5);
    D.phase += dt * (2.2 + D.speed * 0.42) * (k > 0.05 ? 1 : 0.15);
    const s = Math.sin(D.phase), c = Math.cos(D.phase);
    D.lean = damp(D.lean, clamp(turn * 0.5, -0.3, 0.3) * k, 6, dt);
    if (D.onGround) {
      m.legL.rotation.set(s * 0.55 * k, 0, Math.max(0, -c) * 0.22 * k);
      m.legR.rotation.set(-s * 0.55 * k, 0, -Math.max(0, c) * 0.22 * k);
      m.armL.rotation.set(-s * 0.75 * k, 0, 0.08 + 0.1 * k);
      m.armR.rotation.set(s * 0.75 * k, 0, -0.08 - 0.1 * k);
      m.body.rotation.set(0.2 * k, 0, -D.lean);
      m.body.position.y = (reduced ? 0 : Math.abs(c) * 0.035 * k) - 0.03 * k + Math.sin(D.phase * 0.5) * 0.004;
      knees(0.12 * k + Math.max(0, s) * 0.5 * k, 0.12 * k + Math.max(0, -s) * 0.5 * k);
    } else {
      m.legL.rotation.set(-0.5, 0, 0.1); m.legR.rotation.set(0.35, 0, -0.1); knees(0.7, 0.3);
      m.armL.rotation.set(-0.4, 0, 0.9); m.armR.rotation.set(-0.4, 0, -0.9);
      m.body.rotation.set(0.08, 0, -D.lean); m.body.position.y = 0;
    }
    m.head.rotation.set(-0.15 * k, 0, 0); m.body.position.x = m.body.position.z = 0;
    m.root.position.copy(D.pos); m.root.rotation.set(0, D.yaw, 0);
    drape();
  };
  // player.js applyPose: dancing / sitting from a pose object, rotating the body about the hips (h)
  D.applyPose = (o) => {
    const rx = Math.cos(D.yaw), rz = -Math.sin(D.yaw);
    m.root.position.set(D.pos.x + rx * o.x, D.pos.y, D.pos.z + rz * o.x);
    m.root.rotation.set(0, D.yaw + o.spin, 0);
    const h = H, cx = Math.cos(o.rx), sx = Math.sin(o.rx), cy = Math.cos(o.ry), sy = Math.sin(o.ry), cz = Math.cos(o.rz), sz = Math.sin(o.rz);
    m.body.position.set(h * sz * cy, o.y + h - h * (cz * cx - sz * sy * sx), -h * (cz * sx + sz * sy * cx));
    m.body.rotation.set(o.rx, o.ry, o.rz);
    m.head.rotation.set(o.hx, o.hy || 0, o.hz);
    m.armL.rotation.set(o.aL[0], o.aL[1], o.aL[2]); m.armR.rotation.set(o.aR[0], o.aR[1], o.aR[2]);
    m.legL.rotation.set(o.lL[0], 0, o.lL[1]); m.legR.rotation.set(o.lR[0], 0, o.lR[1]);
    const kk = o.knee === undefined ? 1 : o.knee;
    knees(clamp(-o.lL[0] - 0.12, 0, 1.6) * kk, clamp(-o.lR[0] - 0.12, 0, 1.6) * kk);
    drape();
  };
  D.resetPose = () => { m.body.position.set(0, 0, 0); m.body.rotation.set(0, 0, 0); m.head.rotation.set(0, 0, 0); };
  // player.js ride: tucked in on the Comet
  D.ride = (v) => {
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), up = Math.sin(-Math.min(v.tx, 0));
    m.root.position.set(v.x - fx * up * 0.3, v.y + 0.02 + up * 0.5, v.z - fz * up * 0.3);   // (the game sits it 0.95 m behind the bike's centre)
    m.root.rotation.set(v.tx * 0.8, v.yaw, v.tz, 'YXZ');
    m.body.rotation.set(0.42, 0, 0); m.body.position.y = 0;
    m.legL.rotation.set(-1.25, 0, 0.28); m.legR.rotation.set(-1.25, 0, -0.28); knees(1.25, 1.25); drape();
    m.armL.rotation.set(-1.6, 0, -0.12); m.armR.rotation.set(-1.6, 0, 0.12);
    m.head.rotation.x = -0.35;
  };
  return D;
}
// activity.js sitTarget (the hips land on the seat; the legs pivot H up), with its seated idles
const STAND = newPose();
const groundSeat = (kind) => kind === 'sand' || kind === 'towel' || kind === 'ground';
function sitTarget(s, o, t, H, idleK, idleT) {
  const y = s.y + (groundSeat(s.kind) ? 0.12 : 0.06);
  copyPose(STAND, o);
  o.y = y - H; o.hx = 0; o.knee = 1;
  if (groundSeat(s.kind)) { o.rx = -0.3; o.lL[0] = -1.35; o.lR[0] = -1.2; o.lL[1] = 0.12; o.lR[1] = -0.12; o.aL[0] = 0.75; o.aL[2] = 0.35; o.aR[0] = 0.75; o.aR[2] = -0.35; }
  else if (s.kind === 'lounger') { o.rx = -0.6; o.lL[0] = o.lR[0] = -1.05; o.lL[1] = 0.05; o.lR[1] = -0.05; o.aL[2] = 0.3; o.aR[2] = -0.3; o.hx = 0.25; o.knee = 0.15; }
  else {
    const a = y < 0.35 ? Math.max(Math.acos(clamp(y / 0.9, -1, 1)), 0.95) : 1.45;
    o.rx = -0.06; o.lL[0] = -a; o.lR[0] = -a + 0.1; o.lL[1] = 0.06; o.lR[1] = -0.06;
    o.aL[0] = -0.5; o.aL[2] = 0.18; o.aR[0] = -0.5; o.aR[2] = -0.18;
  }
  const v = idleK % 3, w = ease(Math.min(idleT, 1.2) / 1.2);
  o.hy = Math.sin(t * 0.7) * (v === 0 ? 0.7 : 0.25) * (reduced ? 0.4 : 1);
  if (v === 1) {
    if (groundSeat(s.kind)) { o.rx = lerp(o.rx, -0.5, w); o.aL[0] = lerp(o.aL[0], 1.05, w); o.aR[0] = lerp(o.aR[0], 1.05, w); }
    else if (s.kind !== 'lounger') { o.rx = lerp(o.rx, -0.2, w); o.aL[2] = lerp(o.aL[2], 1.25, w); o.aR[2] = lerp(o.aR[2], -1.25, w); o.aL[0] = lerp(o.aL[0], 0.15, w); o.aR[0] = lerp(o.aR[0], 0.15, w); }
  } else if (v === 2 && (groundSeat(s.kind) || s.kind === 'lounger')) {
    o.rx = lerp(o.rx, groundSeat(s.kind) ? -0.75 : -0.65, w);
    o.aL[0] = lerp(o.aL[0], -3.1, w); o.aL[2] = lerp(o.aL[2], 0.75, w); o.aR[0] = lerp(o.aR[0], -3.1, w); o.aR[2] = lerp(o.aR[2], -0.75, w); o.hx = lerp(o.hx, 0.25, w);
  }
  return o;
}
// cutscene.js gesture (who is talking gestures while the line types)
function gesture(m, act, t) {
  const R = m.armR.rotation, Lr = m.armL.rotation, Hh = m.head.rotation, w = reduced ? 0 : 1;
  if (act === 'point') R.set(-1.4 + Math.sin(t * 3) * 0.05 * w, 0, 0.1);
  else if (act === 'shrug') { R.set(-0.5, 0, -0.75 - Math.sin(t * 4) * 0.08 * w); Lr.set(-0.5, 0, 0.75 + Math.sin(t * 4) * 0.08 * w); Hh.z = 0.12; }
  else if (act === 'wave') R.set(0, 0, -2.6 + Math.sin(t * 10) * 0.35 * w);
  else if (act === 'nod') { const u = t % 2.5; Hh.x = Math.sin(u * 8) * 0.2 * Math.max(0, 1 - u * 0.6); R.set(-0.3, 0, 0); }
  else if (act === 'think') { R.set(-2.2, 0, 0.35); Hh.z = 0.14; Hh.x = 0.06; }
  else { R.set(-0.75 + Math.sin(t * 7) * 0.22 * w, 0, 0.05 + Math.sin(t * 3.1) * 0.1 * w); Hh.x = Math.sin(t * 9) * 0.035 * w; }
}
// interiors.js room idles (and a few for the cast without one)
const ROOM_IDLE = {
  DEE: (m, t) => m.armL.rotation.set(-1.15, 0, Math.sin(t * 5) * 0.35 - 0.3),
  KILO: (m, t, b) => { const kb = Math.sin(b * PI * 2); m.armL.rotation.set(-1.2, 0, 0.2); m.armR.rotation.set(0, 0, -2.6 + kb * 0.25); m.head.rotation.x = kb * 0.12; },
  TAPS: (m, t, b) => { m.armR.rotation.set(-2.2 + Math.sin(b * PI * 2) * 0.35, 0, -0.3); m.armL.rotation.set(-2.0 + Math.sin(b * PI * 2) * 0.35, 0, 0.3); },
  MIMI: (m, t) => { m.armR.rotation.set(-0.9 + Math.sin(t * 2) * 0.15, 0, -0.2); m.head.rotation.z = Math.sin(t * 0.8) * 0.08; },
  GUS: (m, t) => { m.head.rotation.y = Math.sin(t * 1.7) * 0.5 * (Math.sin(t * 0.4) > 0 ? 1 : 0.1); m.armR.rotation.set(-0.5, 0, Math.sin(t * 9) * 0.05); m.armL.rotation.set(-0.5, 0, 0); },
  ZIZI: (m, t) => { m.armR.rotation.set(-1.1 + Math.sin(t * 3.2) * 0.25, 0, -0.25); m.armL.rotation.set(-0.9, 0, 0.3); m.head.rotation.y = Math.sin(t * 0.9) * 0.35; },
  GLITZ: (m, t) => { m.armR.rotation.set(-1.4 + Math.sin(t * 1.3) * 0.05, 0, 0.1); m.armL.rotation.set(-0.15, 0, 0.35); m.head.rotation.x = -0.08; },
  CHIP: (m, t, b) => { m.armR.rotation.set(-2.9, 0, -0.45); m.armL.rotation.set(-0.3, 0, 0.5); m.head.rotation.x = -0.2 + Math.sin(b * PI) * 0.05; },
  SKYE: (m, t) => { m.armR.rotation.set(0, 0, -2.6 + Math.sin(t * 10) * 0.35 * (reduced ? 0 : 1)); },
};

// ---------------------------------------------------------------------------------------------- the cast
const KEYS = Object.keys(CAST);
const F = {};
const state = { key: 'SKYE', anim: 'idle', act: 'talk', outfit: 'classic', lineup: false, turntable: !reduced, cam: 'body', lights: 'studio', look: false, expr: 'neutral', t: 0, paused: false };
function getFig(k) {
  if (F[k]) return F[k];
  const t0 = performance.now(), fig = createFigure(k, { rimU, reducedMotion: reduced, outfit: k === 'SKYE' ? OUTFITS.find((o) => o.id === state.outfit) : null });
  const ms = performance.now() - t0;
  fig.breathe = false;   // tickFace (the game's) breathes them
  const stage = new THREE.Group(), shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1).rotateX(-PI / 2), shadowMat);
  shadow.position.y = 0.004; shadow.renderOrder = -1;
  stage.add(fig.root, shadow);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 1, 20), seatMat);
  seat.visible = false; stage.add(seat);
  scene.add(stage);
  const D = makeDriver(fig);
  return (F[k] = { key: k, fig, stage, shadow, seat, D, ms, cur: newPose(), tgt: newPose(), idleK: 0, idleT: 0, seed: KEYS.indexOf(k) * 1.37 });
}
const SEATS = { chair: { y: 0.45, kind: 'chair' }, stool: { y: 0.83, kind: 'stool' }, sand: { y: 0, kind: 'sand' }, lounger: { y: 0.36, kind: 'lounger' } };
const ANIMS = [
  ['idle', 'Idle'], ['role', 'Room idle'], ['walk', 'Walk'], ['skate', 'Skate'], ['sprint', 'Sprint'], ['jump', 'Jump'], ['sit-chair', 'Sit: bench'], ['sit-stool', 'Sit: stool'],
  ['sit-sand', 'Sit: sand'], ['sit-lounger', 'Lounger'], ['cheer', 'Cheer'], ['carjack', 'Carjack'], ['ride', 'Ride the Comet'],
];
const ACTS = ['talk', 'point', 'shrug', 'wave', 'nod', 'think'];
function pose(E, dt, t) {
  const { fig, D } = E, a = state.anim, b = (t * BPM) / 60 + E.seed * 0.0;
  D.talking = false; D.onGround = true; D.speed = 0; fig.bend.L = fig.bend.R = null;
  E.seat.visible = false;
  if (!a.startsWith('sit')) E.idleT = 0;
  if (a === 'walk' || a === 'skate' || a === 'sprint' || a === 'idle' || a === 'role' || a === 'carjack') {
    D.speed = { walk: 3.5, skate: 7.5, sprint: 13.5 }[a] || 0;
    D.resetPose();
    if (a === 'carjack') {
      // rules.js stepJack: glide to the door, reach and haul (arms forward), hop in; looped
      const T = t % 2.2;
      D.speed = T < 0.45 ? 6 : T < 0.95 ? 0 : T < 1.35 ? 3 : 0;
      D.animate(dt, 0);
      if (T > 0.4 && T < 0.95) { fig.armR.rotation.x = -1.5; fig.armL.rotation.x = -1.3; }
    } else D.animate(dt, a === 'skate' || a === 'sprint' ? Math.sin(t * 0.7) * 0.25 : 0);
    if (a === 'role' && ROOM_IDLE[E.key]) ROOM_IDLE[E.key](fig, t, b);
  } else if (a === 'jump') {
    D.resetPose();
    const u = (t % 1.1) / 1.1;
    D.onGround = u > 0.06 && u < 0.86;
    D.animate(dt, 0);
    fig.root.position.y = D.onGround ? 0 : Math.max(0, Math.sin(clamp((u - 0.06) / 0.8, 0, 1) * PI)) * 0.75;
  } else if (a.startsWith('sit')) {
    const s = SEATS[a.slice(4)];
    E.idleT += dt;
    if (E.idleT > 7) { E.idleT = 0; E.idleK++; }
    sitTarget(s, E.tgt, t, fig.dims.hip, E.idleK, E.idleT);
    blendPose(E.cur, E.tgt, 1 - Math.exp(-6 * dt)); E.cur.hy = E.tgt.hy;
    D.applyPose(E.cur);
    if (s.kind !== 'sand') { E.seat.visible = true; E.seat.scale.set(s.kind === 'lounger' ? 1.4 : 1, s.y, s.kind === 'lounger' ? 3 : 1); E.seat.position.set(0, s.y / 2, s.kind === 'lounger' ? 0.25 : -0.02); }
  } else if (a.startsWith('dance') || a === 'cheer') {
    if (a === 'cheer') cheerPose(b, E.tgt); else dancePose(+a.slice(6), b, E.tgt, reduced ? 0.55 : 1);
    E.cur.spin = E.tgt.spin + angleDelta(E.tgt.spin, E.cur.spin);
    blendPose(E.cur, E.tgt, 1 - Math.exp(-12 * dt));
    D.applyPose(E.cur);
  } else if (a === 'ride') {
    D.resetPose();
    const tx = reduced ? -0.05 : -0.1 - 0.1 * Math.sin(t * 0.9), tz = reduced ? 0 : 0.22 * Math.sin(t * 0.7);
    D.ride({ x: 0, y: 0, z: 0, yaw: 0, tx, tz });
    E.seat.visible = true; E.seat.scale.set(0.45, 0.5, 2.4); E.seat.position.set(0, 0.62 + Math.sin(-Math.min(tx, 0)) * 0.5, 0.3);
  } else if (a === 'talk') {
    D.resetPose(); D.animate(dt, 0);
    const cyc = t % 4.5;
    D.talking = cyc < 3.2;
    gesture(fig, state.act, t);
  }
  D.tickFace(dt);
  fig.tick(dt, { blink: false });
  E.shadow.position.set(fig.root.position.x, 0.004, fig.root.position.z);
}

// ---------------------------------------------------------------------------------------------- camera
const cam = { yaw: 0.3, pitch: 0.1, dist: 4.4, fov: 34, target: new THREE.Vector3(0, 0.95, 0) };
const want = { yaw: 0.3, pitch: 0.1, dist: 4.4, fov: 34, target: new THREE.Vector3(0, 0.95, 0) };
let userYaw = 0;
function frameFor(mode) {
  const E = F[state.key];
  if (mode === 'face' && E) {
    const fig = E.fig, h = new THREE.Vector3(), h2 = new THREE.Vector3();
    fig.bones.eyeL.getWorldPosition(h); fig.bones.eyeR.getWorldPosition(h2);
    want.target.copy(h).add(h2).multiplyScalar(0.5); want.target.y -= 0.022 * fig.dims.headScale;
    want.dist = phone ? 0.78 : 0.62; want.fov = 28; want.pitch = 0.04;
  } else if (mode === 'lineup') { want.target.set(0, 0.95, 0); want.dist = phone ? 13.5 : 9.6; want.fov = 34; want.pitch = 0.06; }
  else { const h = E ? E.fig.dims.height : 1.8; want.target.set(0, h * 0.53, 0); want.dist = phone ? 5.4 : 4.3; want.fov = 34; want.pitch = 0.1; }
}
let drag = null, pinch = 0;
const pts = new Map();
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId)) return;
  const prev = pts.get(e.pointerId);
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size === 2) {
    const [a, b] = [...pts.values()], d1 = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinch) want.dist = clamp(want.dist * (pinch / d1), 0.35, 16);
    pinch = d1;
    return;
  }
  userYaw -= (e.clientX - prev[0]) * 0.008; want.pitch = clamp(want.pitch + (e.clientY - prev[1]) * 0.005, -0.4, 1.1);
});
const up = (e) => { pts.delete(e.pointerId); drag = null; pinch = 0; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); want.dist = clamp(want.dist * Math.exp(e.deltaY * 0.0012), 0.35, 16); }, { passive: false });

// ---------------------------------------------------------------------------------------------- UI
function btn(parent, label, on, sw) {
  const b = document.createElement('button');
  b.type = 'button';
  if (sw) { const s = document.createElement('span'); s.className = 'sw'; s.style.background = sw; b.appendChild(s); }
  b.appendChild(document.createTextNode(label));
  b.addEventListener('click', on);
  parent.appendChild(b);
  return b;
}
const ui = { cast: {}, anims: {}, outfits: {}, acts: {}, cams: {}, expr: {} };
const refresh = () => {
  for (const [k, b] of Object.entries(ui.cast)) b.classList.toggle('on', k === state.key && !state.lineup);
  for (const [k, b] of Object.entries(ui.anims)) b.classList.toggle('on', k === state.anim);
  for (const [k, b] of Object.entries(ui.outfits)) b.classList.toggle('on', k === state.outfit);
  for (const [k, b] of Object.entries(ui.acts)) b.classList.toggle('on', state.anim === 'talk' && k === state.act);
  for (const [k, b] of Object.entries(ui.expr)) b.classList.toggle('on', k === state.expr);
  ui.cams.body.classList.toggle('on', state.cam === 'body' && !state.lineup); ui.cams.face.classList.toggle('on', state.cam === 'face'); ui.cams.lineup.classList.toggle('on', state.lineup);
  ui.cams.turn.classList.toggle('on', state.turntable); ui.cams.look.classList.toggle('on', state.look);
  for (const k of ['studio', 'dusk', 'club']) ui.cams[k].classList.toggle('on', state.lights === k);
  $('outfits').parentElement && ($('outfits').style.opacity = state.key === 'SKYE' || state.lineup ? 1 : 0.45);
  const s = CAST[state.key];
  $('who').textContent = state.lineup ? 'The cast' : s.name;
  $('role').textContent = state.lineup ? KEYS.map((k) => CAST[k].name).join(' · ') : s.role || '';
};
function select(k) { state.key = k; state.lineup = false; getFig(k); layout(); if (state.cam === 'lineup') state.cam = 'body'; frameFor(state.cam); refresh(); }
function play(id) { state.anim = id; for (const E of Object.values(F)) { E.idleT = 0; E.idleK = 0; } refresh(); }
function setOutfit(id) { state.outfit = id; const o = OUTFITS.find((q) => q.id === id); if (F.SKYE) F.SKYE.fig.setOutfit(o); refresh(); }
function setCam(mode) { if (mode === 'lineup') return setLineup(true); state.cam = mode; if (state.lineup && mode !== 'lineup') { state.lineup = false; layout(); } userYaw = 0; frameFor(mode); refresh(); }
function setLineup(on) { state.lineup = on; if (on) { for (const k of KEYS) getFig(k); state.cam = 'lineup'; } else state.cam = 'body'; userYaw = 0; layout(); frameFor(state.cam); refresh(); }
function layout() {
  KEYS.forEach((k, i) => {
    const E = F[k];
    if (!E) return;
    const show = state.lineup || k === state.key;
    E.stage.visible = show;
    E.stage.position.set(state.lineup ? (i - (KEYS.length - 1) / 2) * 0.95 : 0, 0, state.lineup ? -Math.abs(i - (KEYS.length - 1) / 2) * 0.12 : 0);
    if (state.lineup) E.stage.rotation.y = 0;
  });
}
KEYS.forEach((k) => { ui.cast[k] = btn($('cast'), CAST[k].name.split(' ')[0] === 'DJ' ? 'Kilowatt' : CAST[k].name.split(' ')[0], () => select(k)); });
OUTFITS.forEach((o) => { ui.outfits[o.id] = btn($('outfits'), o.name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()), () => { if (state.key !== 'SKYE' && !state.lineup) select('SKYE'); setOutfit(o.id); }, o.jacket); });
ANIMS.forEach(([id, label]) => { ui.anims[id] = btn($('anims'), label, () => play(id)); });
MOVES.forEach((mv, i) => { ui.anims['dance-' + i] = btn($('moves'), `${i + 1} ${mv.name.toLowerCase().replace(/(^|\s|-)\S/g, (c) => c.toUpperCase())}`, () => play('dance-' + i)); });
ACTS.forEach((a) => { ui.acts[a] = btn($('talk'), a[0].toUpperCase() + a.slice(1), () => { state.act = a; play('talk'); }); });
['neutral', 'smile', 'grin', 'surprised', 'worried', 'smug', 'cross'].forEach((x) => { ui.expr[x] = btn($('talk'), x[0].toUpperCase() + x.slice(1), () => { state.expr = x; for (const E of Object.values(F)) E.fig.setExpression(x); refresh(); }); });
ui.cams.body = btn($('cams'), 'Full body', () => setCam('body'));
ui.cams.face = btn($('cams'), 'Face close-up', () => setCam('face'));
ui.cams.lineup = btn($('cams'), 'Line-up', () => setLineup(!state.lineup));
ui.cams.turn = btn($('cams'), 'Turntable', () => { state.turntable = !state.turntable; refresh(); });
ui.cams.look = btn($('cams'), 'Eyes on camera', () => { state.look = !state.look; refresh(); });
for (const k of ['studio', 'dusk', 'club']) ui.cams[k] = btn($('cams'), { studio: 'Studio light', dusk: 'Game: dusk', club: 'Game: club' }[k], () => { state.lights = k; LIGHTS[k](); refresh(); });

// ---------------------------------------------------------------------------------------------- loop
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
let last = performance.now(), statT = 0;
const tmp = new THREE.Vector3();
function frame(now) {
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  step(state.paused ? 0 : rdt);
  render();
  requestAnimationFrame(frame);
}
function step(dt) {
  state.t += dt;
  const t = state.t;
  for (const E of Object.values(F)) {
    if (!E.stage.visible) continue;
    pose(E, dt, t + E.seed * (state.lineup ? 0.37 : 0));
    if (!state.lineup && state.turntable && state.cam !== 'face' && !reduced) E.stage.rotation.y += dt * 0.32;
    if (state.look) { camera.getWorldPosition(tmp); E.fig.lookAt(tmp); } else E.fig.lookAt(null);
  }
  // camera
  const E = F[state.key];
  if (state.cam === 'face' && E) frameFor('face');
  const faceYaw = state.cam === 'face' && E ? E.stage.rotation.y + E.fig.root.rotation.y : 0;
  want.yaw = (state.cam === 'face' ? faceYaw + 0.32 : 0.3) + userYaw;
  const k = reduced ? 1 : 1 - Math.exp(-6 * Math.max(dt, 1 / 60));
  cam.yaw += angleDelta(cam.yaw, want.yaw) * k; cam.pitch = lerp(cam.pitch, want.pitch, k); cam.dist = lerp(cam.dist, want.dist, k); cam.fov = lerp(cam.fov, want.fov, k);
  cam.target.lerp(want.target, k);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
  if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  camera.lookAt(cam.target);
}
function render() {
  renderer.render(scene, camera);
  lab.frames++;
  statT -= 1;
  if (statT <= 0) {
    statT = 20;
    const E = F[state.key], s = E ? E.fig.stats() : null, inf = renderer.info.render;
    $('stats').textContent = (state.lineup ? `cast ${KEYS.length} figures\n` : s ? `tris ${s.tris}   draws ${s.draws}   bones ${s.bones}\nbuilt in ${E.ms.toFixed(0)} ms\n` : '') + `frame: ${inf.calls} calls, ${inf.triangles} tris`;
  }
}
// ---------------------------------------------------------------------------------------------- automation hooks
Object.assign(lab, {
  keys: KEYS, anims: [...ANIMS.map((a) => a[0]), ...MOVES.map((m, i) => 'dance-' + i), 'talk'], acts: ACTS, outfits: OUTFITS.map((o) => o.id),
  get figures() { return F; }, state, renderer, scene, camera,
  select, play, outfit: setOutfit, cam: setCam, lineup: setLineup, lights: (k) => { state.lights = k; LIGHTS[k](); refresh(); },
  act(a) { state.act = a; play('talk'); }, expr(x) { state.expr = x; for (const E of Object.values(F)) E.fig.setExpression(x); refresh(); },
  turntable(on) { state.turntable = on; refresh(); }, look(on) { state.look = on; refresh(); },
  pause(on) { state.paused = on; }, advance(sec, fps = 30) { const n = Math.max(1, Math.round(sec * fps)); for (let i = 0; i < n; i++) step(1 / fps); render(); },
  stats(k) { return getFig(k).fig.stats(); },
  // structural checks for automated tests
  checks() {
    const out = {};
    for (const k of KEYS) {
      const fig = getFig(k).fig, s = fig.stats(), names = fig.skeleton.bones.map((b) => b.name);
      out[k] = {
        tris: s.tris, draws: s.draws, bones: s.bones, ms: Math.round(F[k].ms),
        pivots: ['body', 'torso', 'head', 'armL', 'armR', 'legL', 'legR'].every((n) => fig[n] && fig[n].isBone && fig[n].name === n)
          && fig.legL.shin === fig.bones.shinL && fig.legR.shin === fig.bones.shinR && fig.legL.shin.parent === fig.legL && fig.legR.shin.parent === fig.legR
          && fig.head.parent === fig.body && fig.armL.parent === fig.body && fig.legL.parent === fig.body && fig.torso.parent === fig.body && fig.body.parent === fig.root
          && fig.torso.children.length === 0 && fig.eyes.parent === fig.head && fig.mouth.parent === fig.head && fig.skirt.parent === fig.body,
        boneNames: names.length === BONES.length && names.every((n, i) => n === BONES[i][0]),
        api: ['setOutfit', 'tick', 'lookAt', 'setExpression'].every((f) => typeof fig[f] === 'function') && typeof fig.skirt.drape === 'function' && !!fig.thighs && !!fig.shins,
        hip: +fig.dims.hip.toFixed(3),
      };
    }
    return out;
  },
  pivots: PIVOTS,
});

try {
  resize();
  LIGHTS.studio();
  getFig('SKYE');
  layout(); frameFor('body'); refresh();
  // build the rest of the cast in the background so the picker and the line-up are instant
  const rest = KEYS.filter((k) => k !== 'SKYE');
  const next = () => { const k = rest.shift(); if (!k) { lab.ready = true; $('load').remove(); return; } getFig(k); layout(); setTimeout(next, 0); };
  $('load').textContent = '';
  setTimeout(next, 0);
  requestAnimationFrame((t) => { last = t; frame(t); });
} catch (e) {
  lab.errors.push(String(e && e.stack || e));
  $('load').textContent = 'Could not start the lab: ' + e.message;
}
