// Vehicle types: what each kind of car, van, bus and two-wheeler on the coast is, how it drives, how big
// it is, what it sounds like and how often it turns up in the traffic. The sedan (models.js carGeometry) and
// the Comet (bikeGeometry) keep their own instanced meshes; every other type is drawn from one BatchedMesh in
// vehicles.js (one draw call for all of them), either a Kenney Car Kit model (CC0, baked by
// tools/bake-models.mjs) or one of the original low-poly designs below. All designs are generic: no real
// makes, models or liveries.
//
// Handling: acc (pull, m/s² scale), top (top speed, m/s), grip (lateral grip), steer (turn rate), brake,
// mass (collisions: who shoves whom). Size: len / w (metres), from which the collision circles are made.
// sound: the engine profile in audio/audio.js. eye: first-person eye [height, ahead]. cam: chase-camera
// distance factor. seat: the AI driver's torso [x, y, z] (left seat). hp: condition points (game/damage.js).
import * as THREE from 'three';
import { box, cyl, tint, merge, PI } from '../core/util.js';
import { shaped } from './models.js';

export const VTYPES = {
  sedan: { label: 'sedan', kind: 'car', len: 4.4, w: 1.9, mass: 1, acc: 26, top: 44, grip: 7.5, steer: 2.5, brake: 40, sound: 'sedan', eye: [1.25, 0.35], cam: 1, seat: [0.42, 0.66, -0.55], hp: 100, cruise: 1 },
  hatch: { label: 'hatchback', kind: 'car', kit: 'hatch', s: 1.45, len: 4.13, w: 1.9, mass: 0.8, acc: 25, top: 38, grip: 8.4, steer: 2.85, brake: 42, sound: 'hatch', eye: [1.2, 0.25], cam: 0.95, seat: [0.4, 0.62, -0.25], hp: 85, cruise: 1.02, paint: true },
  coupe: { label: 'convertible', kind: 'car', geo: coupeGeometry, len: 4.3, w: 1.86, mass: 0.9, acc: 32, top: 53, grip: 8.2, steer: 2.75, brake: 44, sound: 'sports', eye: [1.12, -0.25], cam: 0.95, seat: [0.4, 1.07, -0.42], hp: 85, cruise: 1.1, paint: true },
  muscle: { label: 'muscle car', kind: 'car', geo: muscleGeometry, len: 4.9, w: 1.96, mass: 1.25, acc: 35, top: 50, grip: 5.8, steer: 2.3, brake: 38, sound: 'v8', eye: [1.2, -0.3], cam: 1.05, seat: [0.42, 0.62, -0.5], hp: 115, cruise: 1.05, paint: true },
  pickup: { label: 'pickup truck', kind: 'car', kit: 'truck', s: 1.5, len: 4.43, w: 2.25, mass: 1.5, acc: 22, top: 39, grip: 6.6, steer: 2.2, brake: 36, sound: 'pickup', eye: [1.55, 0.5], cam: 1.1, seat: [0.45, 0.85, 0.35], hp: 125, cruise: 0.98, paint: true },
  suv: { label: 'SUV', kind: 'car', kit: 'suv', s: 1.6, len: 4.32, w: 2.4, mass: 1.5, acc: 23, top: 41, grip: 6.9, steer: 2.2, brake: 38, sound: 'suv', eye: [1.6, 0.25], cam: 1.1, seat: [0.45, 0.85, 0.1], hp: 130, cruise: 1, paint: true },
  taxi: { label: 'taxi', kind: 'car', kit: 'taxi', s: 1.5, len: 4.13, w: 2.25, mass: 1.1, acc: 24, top: 42, grip: 7.3, steer: 2.5, brake: 40, sound: 'taxi', eye: [1.4, 0.2], cam: 1.05, seat: [0.45, 0.8, 0.1], hp: 100, cruise: 1.04 },
  van: { label: 'van', kind: 'car', kit: 'van', s: 1.55, len: 4.26, w: 2.33, mass: 1.6, acc: 18, top: 35, grip: 6.4, steer: 2.05, brake: 34, sound: 'diesel', eye: [1.7, 0.9], cam: 1.15, seat: [0.45, 0.9, 0.8], hp: 130, cruise: 0.92, paint: true },
  delivery: { label: 'delivery van', kind: 'car', kit: 'delivery', s: 1.45, len: 4.71, w: 2.18, mass: 2, acc: 15, top: 31, grip: 6.2, steer: 1.85, brake: 32, sound: 'diesel', eye: [1.85, 1.3], cam: 1.25, seat: [0.45, 0.95, 1.2], hp: 150, cruise: 0.85, paint: true },
  icecream: { label: 'ice-cream truck', kind: 'car', geo: icecreamGeometry, len: 5.4, w: 2.06, mass: 1.9, acc: 13, top: 27, grip: 6, steer: 1.8, brake: 32, sound: 'diesel', eye: [1.75, 1.75], cam: 1.3, seat: [0.45, 0.95, 1.75], hp: 140, cruise: 0.72 },
  bus: { label: 'bus', kind: 'car', geo: busGeometry, len: 10.6, w: 2.52, mass: 5, acc: 10, top: 25, grip: 5.6, steer: 1.45, brake: 28, sound: 'bus', eye: [2.25, 4.5], cam: 1.75, seat: [0.75, 1.2, 4.35], hp: 230, cruise: 0.78, big: true },
  garbage: { label: 'garbage truck', kind: 'car', kit: 'garbage', s: 1.45, len: 5.0, w: 2.32, mass: 4, acc: 11, top: 24, grip: 5.5, steer: 1.5, brake: 28, sound: 'bus', eye: [2.0, 1.9], cam: 1.4, seat: [0.45, 1.15, 1.8], hp: 210, cruise: 0.7, big: true },
  ambulance: { label: 'ambulance', kind: 'car', kit: 'ambulance', s: 1.45, len: 4.71, w: 2.18, mass: 1.8, acc: 22, top: 40, grip: 6.8, steer: 2.1, brake: 36, sound: 'van', eye: [1.85, 1.3], cam: 1.25, seat: [0.45, 0.95, 1.2], hp: 140, cruise: 1.2 },
  comet: { label: 'Comet', kind: 'bike', len: 2.4, w: 0.9, mass: 0.45, acc: 38, top: 58, grip: 9, steer: 3, brake: 40, sound: 'comet', hp: 60, cruise: 1 },
  scooter: { label: 'scooter', kind: 'bike', geo: scooterGeometry, len: 1.8, w: 0.75, mass: 0.32, acc: 24, top: 27, grip: 9.5, steer: 3.3, brake: 38, sound: 'scooter', hp: 45, cruise: 0.8, paint: true },
};
export const CAR_TYPES = Object.keys(VTYPES).filter((k) => VTYPES[k].kind === 'car');
export const BATCHED = Object.keys(VTYPES).filter((k) => VTYPES[k].kit || VTYPES[k].geo);

// Collision circles along the body ([offset ahead, radius]), from the length and width. The sedan and the
// Comet keep their hand-tuned shapes (vehicles.js).
export function shapeOf(T) {
  const r = T.w / 2 + 0.03, half = T.len / 2 - r, n = Math.max(2, Math.ceil((2 * half) / (r * 1.35)) + 1), out = [];
  for (let i = 0; i < n; i++) out.push([+(half - (2 * half * i) / (n - 1)).toFixed(3), +r.toFixed(3)]);
  return out;
}

// ---- traffic mix: weights by district and hour. Day and night shift the mix (more taxis downtown at
// night, delivery vans and the garbage truck by day, the ice-cream truck on sunny afternoons, cruisers
// at night). Big vehicles are capped so the streets don't fill with buses.
export const CAPS = { bus: 2, garbage: 1, icecream: 1, ambulance: 1, delivery: 3 };
export function trafficWeights(key, hour) {
  const night = hour >= 20 || hour < 5, day = hour >= 8 && hour < 18, early = hour >= 5 && hour < 10;
  const w = { sedan: 22, hatch: 13, coupe: 6, muscle: 5, pickup: 7, suv: 8, taxi: 7, van: 7, delivery: 6, icecream: 0, bus: 3, garbage: 0, ambulance: 1 };
  if (key) { w.taxi *= 1.6; w.suv *= 1.5; w.hatch *= 0.8; w.pickup *= 1.3; w.bus *= 1.3; }        // Solano Key: downtown and the docks
  else { w.hatch *= 1.2; w.coupe *= 1.3; w.icecream = day && hour >= 11 ? 3 : 0; }            // the old town: the beach strip
  if (night) { w.taxi *= key ? 4 : 2.6; w.delivery *= 0.15; w.van *= 0.4; w.bus *= 0.5; w.coupe *= 1.8; w.muscle *= 2; w.pickup *= 0.6; w.icecream = 0; }
  else if (day) { w.delivery *= 1.6; w.van *= 1.3; }
  if (early) w.garbage = 2.5;
  return w;
}
export function pickWeighted(w, rnd = Math.random) {
  let sum = 0;
  for (const k in w) sum += Math.max(0, w[k]);
  let t = rnd() * sum;
  for (const k in w) { t -= Math.max(0, w[k]); if (t <= 0) return k; }
  return 'sedan';
}
// what's parked at the kerb when you arrive: no buses or garbage trucks (spares bring those where they fit)
export const PARKED_WEIGHTS = { sedan: 9, hatch: 7, coupe: 4, muscle: 3, pickup: 4, suv: 4, taxi: 1, van: 3 };

// ---------------------------------------------------------------- the original designs
// Parts tinted pure white take the instance paint (aFlag 1); everything else keeps its own colour.
const W = '#ffffff', TYRE = '#0c0c10', TRIM = '#15131c', CHROME = '#d4d6de', GLASS = '#22324a', RIM = '#b9b4c6';
function done(parts) {
  for (const g of parts) {
    const c = g.attributes.color.array, n = g.attributes.position.count, f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = c[i * 3] === 1 && c[i * 3 + 1] === 1 && c[i * 3 + 2] === 1 ? 1 : 0;
    g.setAttribute('aFlag', new THREE.BufferAttribute(f, 1));
  }
  return merge(parts);
}
function wheels(parts, xs, zs, r, wd, rim = RIM) {
  for (const sx of xs) for (const sz of zs) {
    parts.push(cyl(r, r, wd, 10, sx, r, sz, TYRE, 0, PI / 2), cyl(r * 0.55, r * 0.55, wd + 0.02, 6, sx, r, sz, rim, 0, PI / 2));
  }
}

// A low two-seat convertible: long bonnet, wedge waist, the top down, a chrome windscreen frame and roll hoop.
export function coupeGeometry() {
  const p = [
    box(1.86, 0.4, 4.3, 0, 0.52, 0, W),
    shaped(1.86, 0.26, 4.3, 0, 0.85, 0, W, (x, y, z) => [x * (z > 1 ? 0.93 : 1), y > 0 && z > 0.4 ? y - 0.1 - (z - 0.4) * 0.06 : y, z]),
    box(1.5, 0.08, 1.55, 0, 0.99, -0.45, '#2a1830'),                                                 // the tub
    box(0.55, 0.14, 0.6, 0.4, 1.06, -0.45, '#7a1f3a'), box(0.55, 0.14, 0.6, -0.4, 1.06, -0.45, '#7a1f3a'),
    box(0.5, 0.55, 0.12, 0.4, 1.32, -0.78, '#7a1f3a', -0.15), box(0.5, 0.55, 0.12, -0.4, 1.32, -0.78, '#7a1f3a', -0.15),
    box(0.3, 0.2, 0.14, 0.4, 1.66, -0.86, '#7a1f3a'), box(0.3, 0.2, 0.14, -0.4, 1.66, -0.86, '#7a1f3a'),
    shaped(1.7, 0.18, 1.0, 0, 1.06, -1.55, W, (x, y, z) => [x, y > 0 && Math.abs(x) < 0.1 ? y - 0.08 : y, z]),   // rear deck
    box(1.62, 0.06, 0.06, 0, 1.47, 0.07, CHROME, -0.55), box(0.06, 0.48, 0.06, 0.8, 1.22, 0.2, CHROME, -0.55), box(0.06, 0.48, 0.06, -0.8, 1.22, 0.2, CHROME, -0.55),
    box(1.5, 0.4, 0.04, 0, 1.24, 0.2, '#5f8fb0', -0.55), box(1.5, 0.12, 0.3, 0, 1.05, 0.25, TRIM),    // windscreen just ahead of the seats, on the dash
    box(0.07, 0.07, 1.3, 0, 1.0, 0.95, CHROME), box(1.0, 0.03, 0.8, 0, 0.99, 1.4, TRIM),            // bonnet line, vents
    box(1.9, 0.12, 0.12, 0, 0.38, 2.16, CHROME), box(1.9, 0.12, 0.12, 0, 0.38, -2.16, CHROME),
    box(1.88, 0.05, 3.6, 0, 0.7, 0, '#18f0ff'),                                                      // a thin neon-blue swage line
    box(0.5, 0.06, 0.05, -0.55, 0.62, 2.16, '#fff6c8'), box(0.5, 0.06, 0.05, 0.55, 0.62, 2.16, '#fff6c8'),
    box(1.6, 0.11, 0.05, 0, 0.82, -2.16, '#ff1028'),
  ];
  // the roll hoop behind the seats
  p.push(box(0.07, 0.42, 0.07, 0.62, 1.33, -1.0, CHROME), box(0.07, 0.42, 0.07, -0.62, 1.33, -1.0, CHROME), box(1.3, 0.07, 0.07, 0, 1.54, -1.0, CHROME));
  wheels(p, [-0.92, 0.92], [-1.38, 1.4], 0.34, 0.28);
  return done(p);
}

// A big-engined fastback: long bonnet with a scoop, haunches over the fat rear tyres, chrome bumpers,
// quad lamps and two dark stripes nose to tail.
export function muscleGeometry() {
  const p = [
    box(1.96, 0.5, 4.9, 0, 0.6, 0, W),
    shaped(1.96, 0.22, 2.2, 0, 0.96, 1.3, W, (x, y, z) => [x, y > 0 && z > 0.6 ? y - 0.06 : y, z]),     // bonnet
    box(0.62, 0.17, 0.95, 0, 1.13, 1.15, TRIM), box(0.5, 0.1, 0.05, 0, 1.15, 1.63, '#2d2a3a'),            // the scoop
    shaped(1.68, 0.56, 1.9, 0, 1.33, -0.55, W, (x, y, z) => (y > 0 ? [x * 0.84, y, z > 0 ? z - 0.42 : z * 1.35 + 0.15] : [x, y, z])),  // cabin, fastback
    shaped(1.69, 0.36, 1.25, 0, 1.33, -0.5, GLASS, (x, y, z) => (y > 0 ? [x * 0.82, y, z > 0 ? z - 0.3 : z + 0.1] : [x * 1.0, y, z])),
    shaped(1.96, 0.2, 1.1, 0, 0.96, -1.9, W, (x, y, z) => [x, z < -0.3 && y > 0 ? y + 0.07 : y, z]),      // ducktail
    box(2.06, 0.34, 1.2, 0, 0.82, -1.45, W), box(2.02, 0.28, 1.0, 0, 0.78, 1.55, W),                      // haunches
    box(2.0, 0.16, 0.14, 0, 0.42, 2.48, CHROME), box(2.0, 0.16, 0.14, 0, 0.42, -2.48, CHROME),
    box(1.5, 0.28, 0.06, 0, 0.72, 2.45, TRIM), box(1.4, 0.04, 0.07, 0, 0.72, 2.47, CHROME),
    box(1.7, 0.14, 0.06, 0, 0.82, -2.46, '#ff1028'),
    box(0.2, 0.06, 4.92, 0.22, 1.08, 0, '#1d1630'), box(0.2, 0.06, 4.92, -0.22, 1.08, 0, '#1d1630'),    // stripes (bonnet / boot level)
    box(0.2, 0.04, 1.2, 0.18, 1.62, -0.6, '#1d1630'), box(0.2, 0.04, 1.2, -0.18, 1.62, -0.6, '#1d1630'),
    cyl(0.07, 0.07, 0.3, 6, 0.55, 0.32, -2.5, CHROME, PI / 2), cyl(0.07, 0.07, 0.3, 6, -0.55, 0.32, -2.5, CHROME, PI / 2),
  ];
  for (const sx of [-0.62, -0.38, 0.38, 0.62]) p.push(cyl(0.1, 0.1, 0.06, 8, sx, 0.73, 2.47, '#fff6c8', PI / 2));
  wheels(p, [-0.95, 0.95], [1.55], 0.36, 0.3);
  wheels(p, [-0.98, 0.98], [-1.5], 0.41, 0.4);
  return done(p);
}

// A pastel ice-cream truck: a short cab, a tall box body with a cream drip band, a serving hatch with a
// striped awning on the kerb side (right, -x) and a giant cone on the roof.
export function icecreamGeometry() {
  const CREAM = '#fbf7f0', PINK = '#ff5fa8';
  const p = [
    box(2.0, 0.9, 1.5, 0, 0.95, 1.9, W),                                                              // cab
    shaped(2.0, 0.85, 1.3, 0, 1.82, 1.6, W, (x, y, z) => (y > 0 ? [x * 0.94, y, z > 0 ? z - 0.45 : z] : [x, y, z])),
    shaped(1.9, 0.6, 0.06, 0, 1.85, 2.0, GLASS, (x, y, z) => [x, y, y > 0 ? z - 0.35 : z]),            // windscreen
    box(2.03, 0.5, 0.9, 0, 1.85, 1.4, GLASS),
    box(2.06, 2.0, 3.8, 0, 1.5, -0.75, W),                                                            // the box
    box(2.08, 0.3, 3.82, 0, 2.35, -0.75, CREAM),
    box(2.1, 0.08, 3.84, 0, 0.62, -0.75, '#1d1630'),
    box(0.06, 0.75, 1.7, -1.04, 1.65, -0.55, '#3a2a48'), box(0.5, 0.05, 1.9, -1.25, 1.24, -0.55, CREAM),   // hatch + counter
    box(0.9, 0.06, 2.1, -1.4, 2.2, -0.55, PINK, 0, 0, -0.35),
    box(2.04, 0.2, 0.2, 0, 0.42, 2.66, CHROME), box(2.06, 0.2, 0.2, 0, 0.5, -2.66, CHROME),
    box(0.36, 0.14, 0.05, -0.62, 0.92, 2.66, '#fff6c8'), box(0.36, 0.14, 0.05, 0.62, 0.92, 2.66, '#fff6c8'),
    box(0.3, 0.14, 0.05, -0.75, 0.9, -2.66, '#ff1028'), box(0.3, 0.14, 0.05, 0.75, 0.9, -2.66, '#ff1028'),
    cyl(0.08, 0.16, 0.3, 8, 0.4, 2.42, 1.4, '#cfd3da'),                                                // the chime horn
  ];
  for (let k = 0; k < 7; k++) p.push(cyl(0.13, 0.13, 0.12, 8, -1.08, 2.27 - (k % 2) * 0.05, -2.45 + k * 0.57, CREAM, 0, PI / 2), cyl(0.13, 0.13, 0.12, 8, 1.08, 2.27 - (k % 2) * 0.05, -2.45 + k * 0.57, CREAM, 0, PI / 2));
  for (let k = 0; k < 4; k++) p.push(box(0.92, 0.065, 0.24, -1.4, 2.205, -1.4 + k * 0.56, CREAM, 0, 0, -0.35));
  // the cone: wafer, two scoops and a cherry
  const cone = new THREE.ConeGeometry(0.42, 1.05, 8); cone.rotateX(PI); cone.translate(0, 3.0, -0.9);
  p.push(tint(cone, '#d9a05b'), tint(new THREE.SphereGeometry(0.46, 8, 6).translate(0, 3.62, -0.9), '#ffb3d1'),
    tint(new THREE.SphereGeometry(0.36, 8, 6).translate(0, 4.02, -0.9), '#a5e6cf'), tint(new THREE.SphereGeometry(0.1, 6, 4).translate(0, 4.42, -0.9), '#ff1f4f'));
  wheels(p, [-0.95, 0.95], [1.85, -1.75], 0.42, 0.34);
  return done(p);
}

// A city bus: long two-tone body, a band of dark windows with cream pillars, a big windscreen and a
// destination board, doors on the kerb side.
export function busGeometry() {
  const CREAM = '#fbf7f0', L = 10.6, h = L / 2;
  const p = [
    box(2.5, 1.05, L, 0, 0.98, 0, W),
    box(2.52, 0.95, L - 0.5, 0, 1.98, -0.1, '#2c4a66'),
    box(2.5, 0.42, L, 0, 2.66, 0, CREAM), box(2.2, 0.08, L - 0.6, 0, 2.9, 0, '#dcd6cc'),
    box(2.54, 0.12, L, 0, 1.47, 0, '#ff4fa3'),
    box(2.3, 1.25, 0.08, 0, 1.95, h + 0.01, '#3a5a78'), box(1.6, 0.3, 0.06, 0, 2.62, h + 0.02, '#1d1630'), box(1.3, 0.16, 0.04, 0, 2.62, h + 0.05, '#ffb000'),
    box(2.3, 0.7, 0.08, 0, 2.0, -h - 0.01, '#3a5a78'),
    box(2.52, 0.24, 0.2, 0, 0.45, h, TRIM), box(2.52, 0.24, 0.2, 0, 0.45, -h, TRIM),
    box(0.4, 0.16, 0.05, -0.85, 0.82, h + 0.04, '#fff6c8'), box(0.4, 0.16, 0.05, 0.85, 0.82, h + 0.04, '#fff6c8'),
    box(0.3, 0.3, 0.05, -1.0, 1.0, -h - 0.04, '#ff1028'), box(0.3, 0.3, 0.05, 1.0, 1.0, -h - 0.04, '#ff1028'),
    box(0.06, 2.1, 1.1, -1.27, 1.45, h - 1.0, '#2c4a66'), box(0.06, 2.1, 1.1, -1.27, 1.45, -0.6, '#2c4a66'),   // doors (kerb side)
    box(1.2, 0.3, 1.6, 0, 3.0, -3.2, '#cfd3da'), box(0.8, 0.2, 0.8, 0, 2.98, 1.6, '#cfd3da'),                // roof units
  ];
  for (let z = -h + 0.6; z < h - 1.4; z += 1.25) for (const sx of [-1.265, 1.265]) if (!(sx < 0 && (Math.abs(z - (h - 1.0)) < 0.7 || Math.abs(z + 0.6) < 0.7))) p.push(box(0.04, 0.95, 0.14, sx, 1.98, z, CREAM));
  wheels(p, [-1.12, 1.12], [h - 1.9, -h + 2.2], 0.5, 0.36);
  return done(p);
}

// A step-through scooter: small wheels, a rounded apron, a floorboard, a bulbous rear and a round lamp.
export function scooterGeometry() {
  const p = [
    cyl(0.23, 0.23, 0.13, 10, 0, 0.23, 0.6, TYRE, 0, PI / 2), cyl(0.23, 0.23, 0.15, 10, 0, 0.23, -0.6, TYRE, 0, PI / 2),
    cyl(0.12, 0.12, 0.15, 6, 0, 0.23, 0.6, RIM, 0, PI / 2), cyl(0.12, 0.12, 0.17, 6, 0, 0.23, -0.6, RIM, 0, PI / 2),
    shaped(0.5, 0.86, 0.16, 0, 0.78, 0.5, W, (x, y, z) => [x * (y > 0 ? 0.7 : 1), y, z + (y > 0 ? -0.08 : 0.06)]),   // apron
    box(0.36, 0.06, 0.62, 0, 0.36, 0.08, '#2d2a3a'),                                                          // floorboard
    shaped(0.5, 0.42, 0.75, 0, 0.6, -0.45, W, (x, y, z) => [x * (z < 0 ? 0.8 : 1) * (y > 0 ? 0.85 : 1), y, z]),     // rear body
    box(0.3, 0.1, 0.55, 0, 0.86, -0.42, '#6b2a3a'),                                                           // seat
    box(0.06, 0.55, 0.06, 0, 1.0, 0.56, CHROME, -0.2), box(0.62, 0.05, 0.05, 0, 1.25, 0.5, CHROME),           // steering column, bars
    shaped(0.3, 0.18, 0.2, 0, 1.2, 0.56, W, (x, y, z) => [x * (y > 0 ? 0.8 : 1), y, z]),                      // headset
    cyl(0.08, 0.08, 0.04, 8, 0, 1.2, 0.67, '#fff6c8', PI / 2), box(0.36, 0.3, 0.03, 0, 1.42, 0.6, '#9fd0e8', -0.25),
    box(0.03, 0.18, 0.03, 0.27, 1.34, 0.5, CHROME), box(0.03, 0.18, 0.03, -0.27, 1.34, 0.5, CHROME),
    box(0.16, 0.06, 0.04, 0, 0.72, -0.84, '#ff1028'),
    cyl(0.04, 0.05, 0.42, 6, 0.17, 0.28, -0.5, CHROME, PI / 2 - 0.1),
  ];
  return done(p);
}

// A far-away stand-in for a batched type (about 70 triangles instead of 2,000-3,000): a painted body, a cabin
// or box, dark wheels. vehicles.js swaps it in past a distance (shorter on Low graphics).
const BOXY = ['van', 'delivery', 'icecream', 'ambulance', 'garbage', 'bus'];
export function proxyGeometry(id, full) {
  // a stand-in with the real model's own silhouette: its length, width and height, and its roof line sampled in
  // eight slices along the body (a pickup's bed, an SUV's tall cabin, a hatch's short tail, a van's box), so the
  // swap to the full model up close reads as the same vehicle getting sharper, never as a different type
  const T = VTYPES[id];
  full.computeBoundingBox();
  const bb = full.boundingBox, H = bb.max.y, z0 = bb.min.z, z1 = bb.max.z, L = z1 - z0, Wd = Math.min(T.w, bb.max.x - bb.min.x) * 0.95, NB = 8;
  const top = new Array(NB).fill(0), pos = full.attributes.position;
  for (let i = 0; i < pos.count; i++) { const k = Math.min(NB - 1, Math.max(0, Math.floor((pos.getZ(i) - z0) / L * NB))); if (Math.abs(pos.getX(i)) < Wd * 0.45) top[k] = Math.max(top[k], pos.getY(i)); }
  const belt = H * (BOXY.includes(id) ? 0.5 : 0.56), p = [box(Wd, belt - H * 0.12, L * 0.98, 0, H * 0.12 + (belt - H * 0.12) / 2, (z0 + z1) / 2, W)];
  for (let k = 0; k < NB; k++) {
    const h = top[k], zc = z0 + (k + 0.5) * L / NB;
    if (h <= belt + 0.05) continue;
    const cab = h > H * 0.72, hh = h - belt;
    // the cabin part: glass between the belt and a painted roof; lower humps (a bonnet, a bed rail) in paint
    if (cab) p.push(box(Wd * 0.9, hh * 0.72, L / NB * 1.02, 0, belt + hh * 0.36, zc, id === 'bus' ? '#2c4a66' : GLASS), box(Wd * 0.88, hh * 0.28, L / NB * 1.02, 0, belt + hh * 0.86, zc, W));
    else p.push(box(Wd * 0.98, hh, L / NB * 1.02, 0, belt + hh / 2, zc, W));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(box(0.22, H * 0.3, H * 0.3, sx * Wd * 0.47, H * 0.15, (z0 + z1) / 2 + sz * L * 0.32, TYRE));
  return done(p);
}
