// Procedural low-poly vehicle geometry. All models face +Z and sit on y = 0.
import * as THREE from 'three';
import { box, cyl, tint, merge, PI } from '../core/util.js';

// A box whose vertices are reshaped by fn(x, y, z) -> [x, y, z] before placement.
function shaped(w, h, d, x, y, z, hex, fn) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const o = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, o[0], o[1], o[2]); }
  g.computeVertexNormals();
  g.translate(x, y, z);
  return tint(g, hex);
}

// Boxy wedge-nosed 80s sports coupe. Body panels are white so the per-instance
// colour paints them; glass, tyres and lamps keep their own (dark / red) colours.
export function carGeometry() {
  const W = '#ffffff', GLASS = '#18202e', TYRE = '#0c0c10', TRIM = '#15131c';
  const parts = [
    box(1.9, 0.42, 4.4, 0, 0.56, 0, W),
    shaped(1.9, 0.3, 4.4, 0, 0.92, 0, W, (x, y, z) => [x * (z > 0 ? 0.96 : 1), y > 0 && z > 0 ? y - 0.26 : y, z]),            // sloping bonnet
    box(0.5, 0.12, 0.5, 0.42, 0.98, -0.5, TRIM), box(0.5, 0.12, 0.5, -0.42, 0.98, -0.5, TRIM),                               // seats
    box(0.5, 0.5, 0.1, 0.42, 1.2, -0.8, TRIM), box(0.5, 0.5, 0.1, -0.42, 1.2, -0.8, TRIM),
    box(0.06, 0.5, 0.06, -0.66, 1.3, -1.36, W), box(0.06, 0.5, 0.06, 0.66, 1.3, -1.36, W),                                    // rear pillars
    box(1.3, 0.06, 0.95, 0, 1.57, -0.52, W),                                                                                  // roof
    box(1.84, 0.07, 0.42, 0, 1.3, -2.02, W), box(0.08, 0.26, 0.2, -0.78, 1.16, -2.0, W), box(0.08, 0.26, 0.2, 0.78, 1.16, -2.0, W), // spoiler
    box(1.94, 0.16, 0.12, 0, 0.44, 2.2, TRIM), box(1.94, 0.16, 0.12, 0, 0.44, -2.2, TRIM),                                    // bumpers
    box(1.92, 0.06, 4.0, 0, 0.72, 0, TRIM),                                                                                    // side stripe
    box(1.7, 0.15, 0.06, 0, 0.9, -2.21, '#ff1028'),                                                                            // tail-light bar
    box(0.34, 0.1, 0.06, -0.62, 0.62, 2.21, '#fff6c8'), box(0.34, 0.1, 0.06, 0.62, 0.62, 2.21, '#fff6c8'),                    // headlights
    box(1.0, 0.03, 0.9, 0, 0.8, 1.35, TRIM),                                                                                   // bonnet louvres
  ];
  for (const sx of [-0.93, 0.93]) for (const sz of [-1.4, 1.42]) {
    parts.push(cyl(0.36, 0.36, 0.3, 10, sx, 0.36, sz, TYRE, 0, PI / 2));
    parts.push(cyl(0.2, 0.2, 0.32, 6, sx, 0.36, sz, '#b9b4c6', 0, PI / 2));
  }
  return merge(parts);
}
// The cabin glass is its own see-through instanced mesh so you can see who is driving.
export function carGlassGeometry() {
  return shaped(1.66, 0.5, 2.1, 0, 1.3, -0.35, '#3a5a78', (x, y, z) => (y > 0 ? [x * 0.8, y, z > 0 ? z - 0.75 : z + 0.4] : [x, y, z]));
}
// The "Comet": a wedge-faired 80s sport bike. White panels take the instance colour.
export function bikeGeometry() {
  const W = '#ffffff', TYRE = '#0c0c10', TRIM = '#15131c', STEEL = '#b9b4c6';
  const parts = [
    cyl(0.33, 0.33, 0.16, 12, 0, 0.33, 0.74, TYRE, 0, PI / 2), cyl(0.33, 0.33, 0.2, 12, 0, 0.33, -0.72, TYRE, 0, PI / 2),
    cyl(0.17, 0.17, 0.18, 6, 0, 0.33, 0.74, STEEL, 0, PI / 2), cyl(0.17, 0.17, 0.22, 6, 0, 0.33, -0.72, STEEL, 0, PI / 2),
    box(0.06, 0.8, 0.07, 0.12, 0.68, 0.62, STEEL, -0.4), box(0.06, 0.8, 0.07, -0.12, 0.68, 0.62, STEEL, -0.4),                // forks
    shaped(0.5, 0.56, 0.95, 0, 0.84, 0.4, W, (x, y, z) => [x * (z > 0 ? 0.55 : 1), z > 0 ? y * 0.6 + 0.04 : y, z]),          // wedge fairing
    box(0.36, 0.28, 0.66, 0, 0.92, -0.12, W),                                                                                  // tank
    box(0.3, 0.09, 0.56, 0, 0.9, -0.66, TRIM),                                                                                 // seat
    shaped(0.34, 0.2, 0.62, 0, 0.93, -1.0, W, (x, y, z) => [x * (z < 0 ? 0.6 : 1), z < 0 ? y + 0.14 : y, z]),                // kicked-up tail
    box(0.3, 0.34, 0.56, 0, 0.5, -0.05, TRIM), box(0.34, 0.1, 0.3, 0, 0.36, -0.1, STEEL),                                      // engine
    box(0.4, 0.04, 0.34, 0, 1.22, 0.5, '#3a5a78', -0.95), box(0.7, 0.05, 0.05, 0, 1.1, 0.36, TRIM),                            // screen, bars
    box(0.22, 0.13, 0.05, 0, 0.9, 0.88, '#fff6c8'), box(0.26, 0.07, 0.05, 0, 1.06, -1.31, '#ff1028'),                          // square headlight, tail light
    cyl(0.06, 0.09, 0.85, 6, 0.21, 0.44, -0.78, STEEL, PI / 2 - 0.12), cyl(0.06, 0.09, 0.85, 6, -0.21, 0.44, -0.78, STEEL, PI / 2 - 0.12),
    box(0.51, 0.07, 0.9, 0, 0.72, 0.38, '#ff2bd1'), box(0.37, 0.05, 0.67, 0, 0.84, -0.12, '#18f0ff'),                          // racing stripes
  ];
  return merge(parts);
}

// Coast Patrol livery kit: white door panels, a red / blue roof bar and, at the front of the roof,
// the pulse-laser emitter (a squat turret with a cyan lens), drawn over a teal car.
export const LASER_MOUNT = [0, 1.72, 0.24];            // the lens, in car space (x, y, z ahead)
export function patrolKitGeometry() {
  return merge([
    box(1.935, 0.27, 1.7, 0, 0.56, -0.35, '#f6f8fb'), box(1.94, 0.05, 1.7, 0, 0.56, -0.35, '#12b5a6'),
    box(1.2, 0.07, 0.34, 0, 1.63, -0.5, '#d9dde6'),
    box(0.52, 0.17, 0.28, -0.32, 1.72, -0.5, '#ff2a3a'), box(0.52, 0.17, 0.28, 0.32, 1.72, -0.5, '#2a6aff'),
    box(0.9, 0.02, 1.1, 0, 0.955, 1.5, '#f6f8fb', 0.2),
    box(0.34, 0.1, 0.3, 0, 1.64, -0.16, '#2a2f3a'), box(0.2, 0.1, 0.22, 0, 1.72, -0.12, '#3a4458'),
    box(0.09, 0.09, 0.34, 0, 1.72, 0.06, '#3a4458'), box(0.11, 0.11, 0.05, 0, 1.72, 0.24, '#9ff6ff'),
    box(0.35, 0.03, 0.31, 0, 1.695, -0.16, '#18f0ff'),
  ]);
}

// The "Disco Tank": chunky, teal and magenta. Returns separate hull / turret / barrel parts.
export function tankGeometry() {
  const TEAL = '#1b8f8a', DARK = '#1c1a2a', MAG = '#e6258f', STEEL = '#3a4458';
  const hull = [
    shaped(3.4, 1.0, 6.2, 0, 1.2, 0, TEAL, (x, y, z) => [x, y > 0 && z > 2 ? y - 0.5 : y, y < 0 && z > 2 ? z - 0.6 : z]),
    box(0.9, 1.1, 6.6, -1.75, 0.55, 0, DARK), box(0.9, 1.1, 6.6, 1.75, 0.55, 0, DARK),
    box(1.0, 0.12, 6.7, -1.75, 1.14, 0, STEEL), box(1.0, 0.12, 6.7, 1.75, 1.14, 0, STEEL),
    box(3.44, 0.14, 4.4, 0, 1.25, -0.6, MAG),
    box(2.2, 0.3, 0.8, 0, 1.75, -2.5, STEEL),
    box(0.3, 0.14, 0.1, -1.2, 1.5, -3.12, '#ff1028'), box(0.3, 0.14, 0.1, 1.2, 1.5, -3.12, '#ff1028'),
  ];
  for (const sx of [-1.75, 1.75]) for (let z = -2.6; z <= 2.61; z += 1.3) hull.push(cyl(0.5, 0.5, 0.94, 8, sx, 0.52, z, STEEL, 0, PI / 2));
  const turret = [
    shaped(2.4, 0.85, 2.8, 0, 0.42, -0.1, TEAL, (x, y, z) => (y > 0 ? [x * 0.78, y, z * 0.8] : [x, y, z])),
    box(2.0, 0.1, 2.3, 0, 0.3, -0.1, MAG),
    cyl(0.4, 0.4, 0.22, 8, -0.5, 0.95, -0.5, STEEL), box(0.06, 1.3, 0.06, 0.9, 1.4, -1.1, STEEL),
  ];
  const barrel = [
    cyl(0.17, 0.2, 3.8, 8, 0, 0, 1.9, STEEL, PI / 2), cyl(0.27, 0.27, 0.55, 8, 0, 0, 3.75, DARK, PI / 2),
    box(0.7, 0.6, 0.6, 0, 0, 0.1, TEAL),
  ];
  return { hull: merge(hull), turret: merge(turret), barrel: merge(barrel) };
}

// A bubble-nosed light helicopter in white with sunset stripes.
export function heliGeometry() {
  const WHITE = '#f6f1e7', GLASS = '#1d3350', PINK = '#ff4fa3', TEAL = '#19c9bd', DARK = '#22203a';
  const body = [
    shaped(1.9, 1.7, 3.4, 0, 1.55, 0.2, WHITE, (x, y, z) => (z > 0 ? [x * 0.7, y * (y > 0 ? 0.75 : 0.8), z] : [x, y, z * 1.0])),
    shaped(1.5, 1.0, 1.5, 0, 1.75, 1.3, GLASS, (x, y, z) => (z > 0 ? [x * 0.6, y * 0.6 - 0.12, z] : [x, y, z])),
    box(1.94, 0.22, 3.0, 0, 1.2, 0.1, PINK), box(1.95, 0.12, 3.0, 0, 0.98, 0.1, TEAL),
    shaped(0.5, 0.55, 4.2, 0, 1.85, -3.4, WHITE, (x, y, z) => (z < 0 ? [x * 0.45, y * 0.45 + 0.1, z] : [x, y, z])),
    box(0.1, 1.3, 0.8, 0, 2.5, -5.2, PINK, -0.35),
    box(1.4, 0.06, 0.5, 0, 2.0, -5.0, WHITE),
    cyl(0.12, 0.16, 0.6, 6, 0, 2.65, 0, DARK),
    box(0.1, 0.1, 3.4, -0.95, 0.05, 0.2, DARK), box(0.1, 0.1, 3.4, 0.95, 0.05, 0.2, DARK),
  ];
  for (const sx of [-0.95, 0.95]) for (const sz of [-0.7, 1.1]) body.push(box(0.07, 0.75, 0.07, sx * 0.93, 0.42, sz, DARK, 0, 0, sx > 0 ? 0.18 : -0.18));
  const rotor = [box(9.4, 0.05, 0.34, 0, 0, 0, DARK), box(0.34, 0.05, 9.4, 0, 0, 0, DARK), cyl(0.22, 0.22, 0.16, 8, 0, 0, 0, PINK)];
  const tail = [box(0.05, 1.5, 0.16, 0, 0, 0, DARK), box(0.05, 0.16, 1.5, 0, 0, 0, DARK)];
  return { body: merge(body), rotor: merge(rotor), tail: merge(tail) };
}
