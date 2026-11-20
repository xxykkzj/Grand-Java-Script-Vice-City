// First-person cockpits: window frames, dashboards and live gauges that ride
// on the camera when you're in a vehicle and the view is set to first person.
// Everything is built from boxes and a canvas texture; no asset files.
import * as THREE from 'three';
import { EYE } from './camera.js';

const TAU = Math.PI * 2;

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.15, fog: false, depthTest: false, depthWrite: false, transparent: true, ...opts });
}
function box(w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z); b.rotation.set(rx, ry, rz);
  return b;
}
// a thin bar between two points (used for pillars and canopy frames)
function bar(a, b, t, m) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.BoxGeometry(t, t, len);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  mesh.lookAt(B);
  return mesh;
}

// one canvas per cockpit; redrawn about 12 times a second
function gaugeFace(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: tex, fog: false, depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
  return { c, x: c.getContext('2d'), tex, m };
}
function dial(x, cx, cy, r, v, max, label, unit, col) {
  x.save();
  x.fillStyle = '#0b0a18'; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  x.lineWidth = r * 0.06; x.strokeStyle = '#2a2546'; x.stroke();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  for (let i = 0; i <= 10; i++) {
    const a = a0 + (a1 - a0) * i / 10;
    x.strokeStyle = i >= 8 ? '#ff4f7a' : '#8fe3ff'; x.lineWidth = r * 0.04;
    x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
    x.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); x.stroke();
  }
  const f = Math.max(0, Math.min(1, v / max)), a = a0 + (a1 - a0) * f;
  x.strokeStyle = col; x.lineWidth = r * 0.07; x.lineCap = 'round';
  x.shadowColor = col; x.shadowBlur = r * 0.25;
  x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); x.stroke();
  x.shadowBlur = 0;
  x.fillStyle = '#f4eef7'; x.textAlign = 'center';
  x.font = `bold ${Math.round(r * 0.36)}px ui-monospace, Menlo, Consolas, monospace`;
  x.fillText(String(Math.round(v)), cx, cy + r * 0.5);
  x.fillStyle = '#9d93c4'; x.font = `${Math.round(r * 0.17)}px system-ui, sans-serif`;
  x.fillText(label + (unit ? ' · ' + unit : ''), cx, cy + r * 0.78);
  x.restore();
}

export function createCockpit(scene) {
  // the anchor follows the vehicle (position + heading); 'root' sits at the driver's eye
  // and is turned to face forward, so the parts below keep camera-style coordinates
  // (x right, y up, -z ahead) but stay fixed to the vehicle when you look around
  const anchor = new THREE.Group();
  const root = new THREE.Group();
  root.rotation.y = Math.PI;
  anchor.add(root);
  scene.add(anchor);

  const trim = mat('#1a1826'), dash = mat('#24212f'), dashTop = mat('#14121c'), chrome = mat('#c7c4d6', { metalness: 0.8, roughness: 0.3 });
  const neon = new THREE.MeshBasicMaterial({ color: '#ff3fb4', transparent: true, fog: false, depthTest: false, depthWrite: false, toneMapped: false });
  const cyan = new THREE.MeshBasicMaterial({ color: '#2ff3ff', transparent: true, fog: false, depthTest: false, depthWrite: false, toneMapped: false });
  const kinds = {};
  const order = (g, base) => g.traverse((o) => { if (o.isMesh) o.renderOrder = base + (o.userData.o || 0); });

  // ---------- car: A-pillars, roof edge, dashboard, wheel, cluster, mirror ----------
  {
    const g = new THREE.Group();
    g.add(bar([-0.78, -0.32, -0.62], [-0.58, 0.46, -0.38], 0.09, trim));
    g.add(bar([0.78, -0.32, -0.62], [0.58, 0.46, -0.38], 0.09, trim));
    g.add(box(1.5, 0.1, 0.5, trim, 0, 0.5, -0.2));                      // roof lining edge
    g.add(box(1.3, 0.03, 0.03, neon, 0, 0.44, -0.44));                  // neon trim strip
    const dashBody = box(1.9, 0.26, 0.55, dash, 0, -0.46, -0.72, -0.12); g.add(dashBody);
    g.add(box(1.9, 0.04, 0.5, dashTop, 0, -0.32, -0.74, -0.12));
    const hood = box(0.5, 0.18, 0.12, dashTop, 0, -0.27, -0.6, -0.4); g.add(hood); // cluster hood
    const face = gaugeFace(512, 192);
    const cluster = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.158), face.m);
    cluster.position.set(0, -0.31, -0.62); cluster.rotation.x = -0.25; cluster.userData.o = 3; g.add(cluster);
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 8, 28), trim);
    const hub = box(0.08, 0.08, 0.04, dashTop, 0, 0, 0);
    wheel.add(rim, hub, box(0.36, 0.03, 0.02, trim, 0, 0, 0), box(0.03, 0.18, 0.02, trim, 0, -0.09, 0));
    wheel.position.set(0, -0.42, -0.45); wheel.rotation.x = -0.35;
    g.add(wheel);
    g.add(box(0.26, 0.07, 0.02, chrome, 0.18, 0.4, -0.46));             // rear-view mirror
    g.add(box(0.24, 0.055, 0.01, mat('#8fb6d9', { metalness: 0.9, roughness: 0.1 }), 0.18, 0.4, -0.45));
    const radio = gaugeFace(256, 64);
    const rad = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), radio.m);
    rad.position.set(0.42, -0.36, -0.66); rad.rotation.x = -0.3; rad.userData.o = 3; g.add(rad);
    order(g, 50);
    kinds.car = { g, face, wheel, radio, draw(v, s) {
      const x = face.x; x.clearRect(0, 0, 512, 192);
      dial(x, 110, 96, 86, s * 3.6, 220, 'SPEED', 'km/h', '#ff3fb4');
      dial(x, 402, 96, 86, Math.min(8, 0.9 + (s % 14) / 14 * 6.5 + (s > 1 ? 0.6 : 0)), 8, 'RPM', 'x1000', '#2ff3ff');
      x.fillStyle = '#ffd23f'; x.font = 'bold 54px ui-monospace, Menlo, monospace'; x.textAlign = 'center';
      x.fillText(s < 0.5 ? 'N' : String(Math.min(5, 1 + Math.floor(s / 9))), 256, 112);
      face.tex.needsUpdate = true;
      const r = radio.x; r.fillStyle = '#071018'; r.fillRect(0, 0, 256, 64);
      r.fillStyle = '#2ff3ff'; r.font = 'bold 30px ui-monospace, Menlo, monospace'; r.textAlign = 'center';
      r.fillText('FM 98.6  NEON', 128, 42); radio.tex.needsUpdate = true;
    } };
  }

  // ---------- bike: handlebars, mirrors, small speedo, tank ----------
  {
    const g = new THREE.Group();
    g.add(box(0.9, 0.035, 0.035, chrome, 0, -0.42, -0.55, 0, 0, 0));
    g.add(box(0.12, 0.06, 0.06, trim, -0.44, -0.42, -0.55), box(0.12, 0.06, 0.06, trim, 0.44, -0.42, -0.55));
    g.add(bar([-0.36, -0.42, -0.56], [-0.46, -0.24, -0.62], 0.02, chrome), bar([0.36, -0.42, -0.56], [0.46, -0.24, -0.62], 0.02, chrome));
    g.add(box(0.13, 0.08, 0.02, mat('#8fb6d9', { metalness: 0.9, roughness: 0.1 }), -0.47, -0.21, -0.63), box(0.13, 0.08, 0.02, mat('#8fb6d9', { metalness: 0.9, roughness: 0.1 }), 0.47, -0.21, -0.63));
    g.add(box(0.32, 0.12, 0.5, mat('#e8336f', { metalness: 0.4, roughness: 0.35 }), 0, -0.62, -0.42, 0.2)); // fuel tank
    const face = gaugeFace(256, 256);
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), face.m);
    sp.position.set(0, -0.36, -0.6); sp.rotation.x = -0.5; sp.userData.o = 3; g.add(sp);
    order(g, 50);
    kinds.bike = { g, face, draw(v, s) {
      const x = face.x; x.clearRect(0, 0, 256, 256);
      dial(x, 128, 128, 118, s * 3.6, 260, 'SPEED', 'km/h', '#ff3fb4'); face.tex.needsUpdate = true;
    } };
  }

  // ---------- helicopter: canopy frame, instrument panel ----------
  {
    const g = new THREE.Group();
    g.add(bar([-0.9, -0.35, -0.8], [-0.5, 0.55, -0.5], 0.07, trim), bar([0.9, -0.35, -0.8], [0.5, 0.55, -0.5], 0.07, trim));
    g.add(bar([0, -0.3, -1.0], [0, 0.6, -0.55], 0.05, trim));            // centre canopy rib
    g.add(bar([-0.5, 0.55, -0.5], [0.5, 0.55, -0.5], 0.07, trim));
    g.add(box(1.5, 0.3, 0.4, dash, 0, -0.55, -0.85, -0.25));
    const face = gaugeFace(768, 192);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.19), face.m);
    panel.position.set(0, -0.42, -0.72); panel.rotation.x = -0.35; panel.userData.o = 3; g.add(panel);
    g.add(box(0.03, 0.3, 0.03, trim, 0, -0.58, -0.4, 0.3));               // cyclic stick
    order(g, 50);
    kinds.heli = { g, face, draw(v, s) {
      const x = face.x; x.clearRect(0, 0, 768, 192);
      dial(x, 110, 96, 86, s * 1.94, 160, 'AIRSPEED', 'kt', '#ff3fb4');
      dial(x, 384, 96, 86, Math.max(0, v.y) * 3.28, 1500, 'ALTITUDE', 'ft', '#2ff3ff');
      dial(x, 658, 96, 86, (v.spool || 0) * 100, 100, 'ROTOR', '%', '#ffd23f');
      face.tex.needsUpdate = true;
    } };
  }

  // ---------- tank: armoured vision slit with a reticle ----------
  {
    const g = new THREE.Group();
    const armour = mat('#2b3127', { roughness: 0.9 });
    g.add(box(3, 1.2, 0.05, armour, 0, 0.82, -0.6), box(3, 1.2, 0.05, armour, 0, -0.78, -0.6));
    g.add(box(1.2, 3, 0.05, armour, -1.0, 0, -0.6), box(1.2, 3, 0.05, armour, 1.0, 0, -0.6));
    g.add(box(0.8, 0.02, 0.02, cyan, 0, 0.215, -0.58), box(0.8, 0.02, 0.02, cyan, 0, -0.175, -0.58));
    const face = gaugeFace(256, 256);
    const ret = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), face.m);
    ret.position.set(0, 0.02, -0.6); ret.userData.o = 3; g.add(ret);
    const x = face.x; x.strokeStyle = '#ff3f6e'; x.lineWidth = 4;
    x.beginPath(); x.arc(128, 128, 60, 0, TAU); x.moveTo(128, 20); x.lineTo(128, 96); x.moveTo(128, 160); x.lineTo(128, 236);
    x.moveTo(20, 128); x.lineTo(96, 128); x.moveTo(160, 128); x.lineTo(236, 128); x.stroke(); face.tex.needsUpdate = true;
    order(g, 50);
    kinds.tank = { g, draw() {} };
  }

  for (const k in kinds) { kinds[k].g.visible = false; root.add(kinds[k].g); }
  let active = null, acc = 0;

  return {
    // call every frame after the camera has been placed
    update(dt, vehicle, show, steer) {
      const k = show && vehicle ? kinds[vehicle.kind] : null;
      if (k !== active) { if (active) active.g.visible = false; active = k; if (k) k.g.visible = true; }
      anchor.visible = !!k;
      if (!k) return;
      const [eh, ef] = (vehicle.spec && vehicle.spec.eye) || EYE[vehicle.kind];
      anchor.position.set(vehicle.x, vehicle.y || 0, vehicle.z);
      anchor.rotation.y = vehicle.yaw;
      root.position.set(0, eh, ef);
      const s = vehicle.kind === 'tank' ? Math.abs(vehicle.speed || 0) : Math.hypot(vehicle.vx || 0, vehicle.vz || 0);
      if (k.wheel) k.wheel.rotation.z += ((steer || 0) * 1.6 - k.wheel.rotation.z) * Math.min(1, dt * 10);
      acc += dt;
      if (acc > 0.08) { acc = 0; k.draw(vehicle, s); }
    },
    get visible() { return !!active; },
  };
}
