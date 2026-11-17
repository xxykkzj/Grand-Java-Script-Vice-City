// The dance moves, shared by the courier and the Club Prism crowd. All original, built from simple
// timing curves on the beat. dancePose(move, beat, out) fills a pose:
//   y        body bounce (m)            x       sideways slide (m, along the dancer's right)
//   rx ry rz body lean / twist / tilt    spin    extra turn of the whole dancer (rad)
//   hx hz    head nod / tilt             aL aR   arm [rx, ry, rz]       lL lR   leg [rx, rz]
// Arms and legs hang straight down at 0; negative rx swings them forward, +rz lifts the left arm
// (the dancer's left is +x) out sideways, -rz the right one. One beat = 1.0.
export const MOVES = [
  { id: 'step', name: 'STEP-TOUCH' },
  { id: 'bounce', name: 'SHOULDER BOUNCE' },
  { id: 'wave', name: 'NEON WAVE' },
  { id: 'spin', name: 'TURNTABLE SPIN' },
  { id: 'glide', name: 'BOARDWALK GLIDE' },
  { id: 'point', name: 'SKY POINT' },
  { id: 'drop', name: 'LOW TIDE' },
  { id: 'robot', name: 'CIRCUIT BOT' },
];
const PI = Math.PI;
const sm = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

export const newPose = () => ({ knee: 1, y: 0, x: 0, rx: 0, ry: 0, rz: 0, spin: 0, hx: 0, hz: 0, aL: [0, 0, 0.1], aR: [0, 0, -0.1], lL: [0, 0], lR: [0, 0] });
const A3 = (a, x, y, z) => { a[0] = x; a[1] = y; a[2] = z; };
const ROBOT = [
  [[-PI / 2, 0, 0], [0, 0, -1.5], 0.35],
  [[0, 0, 1.5], [-PI / 2, 0, 0], -0.35],
  [[-2.6, 0, 0.2], [-0.4, 0, -0.2], 0],
  [[-1.2, 0, 1.2], [-1.2, 0, -1.2], 0],
];

// amp scales the whole thing (the crowd during the breakdown, a gentle reduced-motion version)
export function dancePose(m, b, o, amp = 1) {
  const c = Math.cos(PI * b), s = Math.sin(PI * b), t = b - Math.floor(b);
  const dip = 0.5 + 0.5 * Math.cos(2 * PI * b);            // 1 on the beat, 0 on the off-beat
  const snap = Math.pow(1 - t, 4);                           // a sharp hit right on the beat
  o.y = -0.06 * dip; o.x = 0; o.rx = 0.05 * dip; o.ry = 0; o.rz = 0; o.spin = 0; o.hx = 0.1 * dip; o.hz = 0;
  A3(o.aL, -0.15, 0, 0.12); A3(o.aR, -0.15, 0, -0.12); o.lL[0] = o.lL[1] = o.lR[0] = o.lR[1] = 0;
  switch (m) {
    case 0: {   // step-touch: weight over to one side, tap the other foot in, clap across the body every other beat
      o.x = 0.2 * c; o.rz = -0.07 * c; o.ry = 0.15 * c;
      o.lL[1] = 0.22 * Math.max(0, -c); o.lR[1] = -0.22 * Math.max(0, c);
      const clap = Math.max(0, -Math.cos(PI * b * 0.5)) * snap;
      A3(o.aL, -0.6 - 0.5 * clap + 0.3 * c, 0, -0.1 - 0.35 * clap); A3(o.aR, -0.6 - 0.5 * clap - 0.3 * c, 0, 0.1 + 0.35 * clap);
      break;
    }
    case 1: {   // shoulder bounce: knees pump, shoulders pop up one at a time, elbows tucked
      o.y = -0.1 * dip; o.rz = 0.12 * s; o.rx = 0.12;
      o.lL[1] = 0.12; o.lR[1] = -0.12; o.lL[0] = -0.12 * dip; o.lR[0] = -0.12 * dip;
      A3(o.aL, -1.1 - 0.35 * Math.max(0, s), 0.4, 0.35 + 0.25 * Math.max(0, s)); A3(o.aR, -1.1 - 0.35 * Math.max(0, -s), -0.4, -0.35 - 0.25 * Math.max(0, -s));
      o.hz = -0.1 * s;
      break;
    }
    case 2: {   // neon wave: arms out wide, a ripple runs from one hand to the other and back
      const w1 = Math.sin(PI * b * 0.5), w2 = Math.sin(PI * b * 0.5 - 1.1);
      A3(o.aL, -0.1, 0, 1.45 + 0.45 * w1); A3(o.aR, -0.1, 0, -1.45 + 0.45 * w2);
      o.rz = 0.1 * Math.sin(PI * b * 0.5 - 0.55); o.hz = -0.15 * Math.sin(PI * b * 0.5 - 0.55); o.ry = 0.1 * s;
      o.lL[1] = 0.1; o.lR[1] = -0.1;
      break;
    }
    case 3: {   // turntable spin: two beats of groove, then a full turn over beats three and four, arms flung out
      const u = b - Math.floor(b / 4) * 4, k = sm((u - 2) / 2);
      o.spin = k * 2 * PI;
      const out = Math.sin(k * PI);
      A3(o.aL, -0.3, 0, 0.2 + 1.2 * out); A3(o.aR, -0.3, 0, -0.2 - 1.2 * out);
      o.y = u < 2 ? -0.08 * dip : 0.04 * out; o.lL[1] = 0.15 * out; o.lR[1] = -0.15 * out;
      if (u < 2) { o.ry = 0.25 * c; A3(o.aL, -0.9, 0, 0.3); A3(o.aR, -0.9 + 0.5 * c, 0, -0.3); }
      break;
    }
    case 4: {   // boardwalk glide: long skating pushes left and right, the free leg sweeps out behind
      const g = Math.sin(PI * b * 0.5);
      o.x = 0.32 * g; o.rz = -0.18 * g; o.rx = 0.22; o.y = -0.1;
      o.lL[0] = 0.5 * Math.max(0, -g); o.lL[1] = 0.25 * Math.max(0, -g);
      o.lR[0] = 0.5 * Math.max(0, g); o.lR[1] = -0.25 * Math.max(0, g);
      A3(o.aL, -0.9 * g, 0, 0.25); A3(o.aR, 0.9 * g, 0, -0.25);
      o.hz = 0.1 * g;
      break;
    }
    case 5: {   // sky point: point up to the corner on beat one, down across on beat three, hip pop between
      const u = b - Math.floor(b / 4) * 4, up = u < 2, hit = sm((u % 2) * 4);
      o.x = (up ? 0.08 : -0.08) * hit; o.rz = (up ? -0.12 : 0.12) * hit;
      if (up) { A3(o.aR, -2.9 * hit - 0.1, 0, -0.45 * hit); A3(o.aL, -0.3, 0, 0.5 * hit); o.hx = -0.25 * hit; o.hz = 0.15 * hit; }
      else { A3(o.aR, -0.8 * hit, 0, 0.5 * hit); A3(o.aL, -0.2, 0, 0.4); o.hx = 0.25 * hit; }
      o.lL[1] = 0.2 * hit; o.lR[1] = -0.05;
      break;
    }
    case 6: {   // low tide: sink into a lunge on beat one, roll back up on beat three, arms riding the swell
      const u = b - Math.floor(b / 4) * 4, k = u < 2 ? sm(u * 1.5) : 1 - sm((u - 2) * 1.2);
      o.y = -0.42 * k; o.rx = 0.2 * k;
      o.lL[0] = -1.15 * k; o.lR[0] = 0.85 * k; o.lL[1] = 0.1; o.lR[1] = -0.1;
      A3(o.aL, -1.5 * k - 0.2, 0, 0.6 + 0.6 * k); A3(o.aR, -1.5 * k - 0.2, 0, -0.6 - 0.6 * k);
      o.hx = 0.2 * k;
      break;
    }
    case 7: {   // circuit bot: a new stiff pose snapped onto every beat, a mechanical head tick on the off-beat
      const p = ROBOT[Math.floor(b) & 3], q = ROBOT[(Math.floor(b) + 1) & 3], k = sm((t - 0.82) / 0.18);
      for (let i = 0; i < 3; i++) { o.aL[i] = p[0][i] + (q[0][i] - p[0][i]) * k; o.aR[i] = p[1][i] + (q[1][i] - p[1][i]) * k; }
      o.ry = p[2] + (q[2] - p[2]) * k; o.y = -0.03 * snap; o.rx = 0;
      o.hz = t < 0.5 ? 0.12 : -0.12; o.hx = 0;
      break;
    }
    default: break;   // a plain bounce
  }
  if (amp !== 1) scale(o, amp);
  return o;
}
function scale(o, k) {
  o.y *= k; o.x *= k; o.rx *= k; o.ry *= k; o.rz *= k; o.spin *= k > 0.6 ? 1 : 0; o.hx *= k; o.hz *= k;
  for (let i = 0; i < 3; i++) { o.aL[i] *= k; o.aR[i] *= k; }
  o.aL[2] += 0.1 * (1 - k); o.aR[2] -= 0.1 * (1 - k);
  for (let i = 0; i < 2; i++) { o.lL[i] *= k; o.lR[i] *= k; }
}
// blend a towards b by k (into out; out may be a)
export function blendPose(a, b, k, out = a) {
  for (const f of ['knee', 'y', 'x', 'rx', 'ry', 'rz', 'spin', 'hx', 'hz']) out[f] = a[f] + (b[f] - a[f]) * k;
  for (const f of ['aL', 'aR']) for (let i = 0; i < 3; i++) out[f][i] = a[f][i] + (b[f][i] - a[f][i]) * k;
  for (const f of ['lL', 'lR']) for (let i = 0; i < 2; i++) out[f][i] = a[f][i] + (b[f][i] - a[f][i]) * k;
  return out;
}
export function copyPose(src, out) { return blendPose(src, src, 0, out); }
// cheering: both arms up, a hop on the beat
export function cheerPose(b, o) {
  const dip = 0.5 + 0.5 * Math.cos(2 * PI * b), s = Math.sin(PI * b);
  o.y = 0.06 * (1 - dip); o.x = 0; o.rx = -0.05; o.ry = 0; o.rz = 0.05 * s; o.spin = 0; o.hx = -0.2; o.hz = 0;
  A3(o.aL, -0.2, 0, 2.6 + 0.3 * s); A3(o.aR, -0.2, 0, -2.6 + 0.3 * s);
  o.lL[0] = o.lR[0] = 0; o.lL[1] = 0.08; o.lR[1] = -0.08;
  return o;
}
// seated: hips at seat height y (the legs pivot 0.92 m up), a nod to the beat and an arm now and then
export function sitPose(y, b, o, seed = 0, still = false) {
  const dip = still ? 0 : 0.5 + 0.5 * Math.cos(2 * PI * b);
  o.y = y + 0.05 - 0.92; o.x = 0; o.rx = -0.08; o.ry = 0; o.rz = 0; o.spin = 0; o.hx = 0.12 * dip; o.hz = 0;
  const a = Math.acos(Math.min(1, (y + 0.05) / 0.85));
  o.lL[0] = o.lR[0] = -Math.max(a, 0.9); o.lL[1] = 0.08; o.lR[1] = -0.08;
  A3(o.aL, -0.55, 0, 0.15); A3(o.aR, -0.55, 0, -0.15);
  if (!still && Math.sin(b * 0.37 + seed * 3.1) > 0.75) A3(o.aR, -2.8, 0, -0.2 + 0.25 * Math.sin(PI * b));   // hands up for the drop
  return o;
}
