// The swell: one wave function shared by the ocean's vertex shader (world/sky.js), the wakes (vehicles/wake.js)
// and the boats' buoyancy (vehicles/boats.js), so a hull rides exactly the surface you see.
//   three long-crested trains (38 m, 23 m and 13 m), deep-water speeds (w = sqrt(g k)), crossing at an angle
//   SEA.amp (metres, set from the weather each frame: calm ~0.16, rain ~0.28, a storm ~0.5)
//   calm inshore: the swell fades out over the last 60 m to the seawalls and the beach (harbours are flat), so the
//   beach shelf, the seawall foam and the marina stay where they always were
import { HX, HZ, KEY } from './layout.js';

export const SEA = { amp: 0.16 };
const KCX = (KEY.x0 + KEY.x1) / 2, KHX = (KEY.x1 - KEY.x0) / 2, KHZ = (KEY.z1 - KEY.z0) / 2;
const rd = (x, z, hx, hz) => { const qx = Math.abs(x) - hx, qz = Math.abs(z) - hz; return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0); };
export const shoreDist = (x, z) => Math.min(rd(x, z, HX, HZ), rd(x - KCX, z, KHX, KHZ));
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// direction (unit), wavenumber, angular speed, phase, weight
const T = [[0.8, 0.6, 0.16, 1.25, 0, 0.5], [0.287, 0.958, 0.27, 1.63, 1.7, 0.32], [-0.6, 0.8, 0.47, 2.15, 4.1, 0.18]];
export const shoreAtt = (x, z) => ss(14, 60, shoreDist(x, z));
// surface height above the still water line (WL) at (x, z), time t (the shaders' uTime = timeU)
export function waveAt(x, z, t, att = shoreAtt(x, z)) {
  if (att <= 0) return 0;
  let h = 0;
  for (let i = 0; i < 3; i++) { const w = T[i]; h += w[5] * Math.sin((x * w[0] + z * w[1]) * w[2] - w[3] * t + w[4]); }
  return h * SEA.amp * att;
}
// GLSL: the same function (needs uniforms uWaveA, uIsle, uKey and the shader's own time)
export const WAVE_GLSL = /* glsl */`
  uniform float uWaveA; uniform vec2 uIsle; uniform vec4 uKey;
  float shoreD(vec2 p){
    vec2 q = abs(p) - uIsle; float a = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    vec2 qk = abs(p - uKey.xy) - uKey.zw; float b = length(max(qk, 0.0)) + min(max(qk.x, qk.y), 0.0);
    return min(a, b);
  }
  float seaWave(vec2 p, float t){
    float att = smoothstep(14.0, 60.0, shoreD(p));
    if (att <= 0.0) return 0.0;
    float h = ${T.map((w) => `${w[5].toFixed(3)} * sin(dot(p, vec2(${w[0].toFixed(3)}, ${w[1].toFixed(3)})) * ${w[2].toFixed(3)} - ${w[3].toFixed(3)} * t + ${w[4].toFixed(3)})`).join(' + ')};
    return h * uWaveA * att;
  }`;
export const waveU = { value: SEA.amp };
