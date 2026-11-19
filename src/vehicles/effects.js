// Effects, all pooled: additive point sprites (sparks, flames, fireworks, explosion fire), one
// reusable flash light, a normal-blended smoke / debris pool, additive beams (lasers, prism shots,
// lightning) and expanding shockwave rings. Each pool is one draw call, and the smoke, beam and ring
// pools are only drawn while something in them is alive.
import * as THREE from 'three';
import { pointScaleU, reducedMotion, nightU, fogU, FOG_PARS } from '../core/util.js';

export function createFx(scene) {
  const N = 1200;
  const pos = new Float32Array(N * 3), colr = new Float32Array(N * 3), size = new Float32Array(N);
  const vel = new Float32Array(N * 3), life = new Float32Array(N), max = new Float32Array(N), base = new Float32Array(N), grav = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colr, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: { uScale: pointScaleU },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      attribute vec3 aColor; attribute float aSize; uniform float uScale; varying vec3 vCol;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vCol = aColor;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 300.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol;
      void main(){
        float a = max(1.0 - length(gl_PointCoord - 0.5) * 2.0, 0.0);
        gl_FragColor = vec4(vCol * a * a, 1.0);
      }`,
  }));
  pts.frustumCulled = false; pts.renderOrder = 7;
  scene.add(pts);
  const light = new THREE.PointLight(0xffb060, 0, 60, 1.6);
  scene.add(light);

  const c = new THREE.Color();
  let cursor = 0;
  function spawn(x, y, z, vx, vy, vz, hex, s, l, g) {
    const i = cursor; cursor = (cursor + 1) % N;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    c.set(hex); colr[i * 3] = c.r; colr[i * 3 + 1] = c.g; colr[i * 3 + 2] = c.b;
    base[i] = s; life[i] = max[i] = l; grav[i] = g;
  }

  // ---- smoke and debris: normal blending, darker at night, faded into the fog
  const SN = 460;
  const sPos = new Float32Array(SN * 3), sCol = new Float32Array(SN * 3), sSize = new Float32Array(SN), sAlpha = new Float32Array(SN);
  const sVel = new Float32Array(SN * 3), sLife = new Float32Array(SN), sMax = new Float32Array(SN), sBase = new Float32Array(SN), sGrow = new Float32Array(SN), sGrav = new Float32Array(SN), sA0 = new Float32Array(SN);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aColor', new THREE.BufferAttribute(sCol, 3));
  sGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
  sGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sAlpha, 1));
  const smokePts = new THREE.Points(sGeo, new THREE.ShaderMaterial({
    uniforms: { uScale: pointScaleU, uNight: nightU, ...fogU },
    transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale, uNight;
      ${FOG_PARS}
      varying vec3 vCol; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = -mv.z;
        vCol = aColor * mix(1.0, 0.42, uNight);
        vA = aAlpha * (1.0 - smoothstep(uFogNear, uFogFar, d));
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(aSize * uScale / max(d, 0.1), 320.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.3, d) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vCol, a);
      }`,
  }));
  smokePts.frustumCulled = false; smokePts.renderOrder = 6; smokePts.visible = false;
  scene.add(smokePts);
  let sCursor = 0, sLive = 0;
  function smokeSpawn(x, y, z, vx, vy, vz, shade, s, l, grow, a0, g = 0, hex = null) {
    const i = sCursor; sCursor = (sCursor + 1) % SN;
    sPos[i * 3] = x; sPos[i * 3 + 1] = y; sPos[i * 3 + 2] = z;
    sVel[i * 3] = vx; sVel[i * 3 + 1] = vy; sVel[i * 3 + 2] = vz;
    if (hex) c.set(hex); else c.setScalar(shade);
    sCol[i * 3] = c.r; sCol[i * 3 + 1] = c.g; sCol[i * 3 + 2] = c.b;
    sBase[i] = s; sLife[i] = sMax[i] = l; sGrow[i] = grow; sA0[i] = a0; sGrav[i] = g;
    smokePts.visible = true;
  }

  // ---- beams: a cross of two quads along +z, stretched between two points (lasers, prism shots, arcs)
  const BN = 64;
  const bGeo = new THREE.BufferGeometry();
  {
    const p = [], uv = [];
    for (const [ax, ay] of [[1, 0], [0, 1]]) {
      const q = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
      for (const [u, z] of q) { p.push(u * ax, u * ay, z); uv.push(u + 0.5, z + 0.5); }
    }
    bGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    bGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  }
  const beams = new THREE.InstancedMesh(bGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv; varying vec3 vC; void main(){ vUv = uv; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; varying vec3 vC; void main(){ float a = 1.0 - abs(vUv.x - 0.5) * 2.0; gl_FragColor = vec4(vC * (a * a * 1.3) + vec3(1.0) * pow(a, 8.0) * length(vC) * 0.5, 1.0); }',
  }), BN);
  beams.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BN * 3), 3);
  beams.frustumCulled = false; beams.renderOrder = 8; beams.count = 0; beams.visible = false;
  scene.add(beams);
  const B = [];
  for (let i = 0; i < BN; i++) B.push({ on: false, a: new THREE.Vector3(), b: new THREE.Vector3(), col: new THREE.Color(), w: 0.1, life: 0, max: 1, flick: 0 });

  // ---- shockwave rings
  const RN = 6;
  const rGeo = new THREE.RingGeometry(0.82, 1, 40, 1); rGeo.rotateX(-Math.PI / 2);
  const rings = new THREE.InstancedMesh(rGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec3 vC; varying vec2 vUv; void main(){ vC = instanceColor; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }',
  }), RN);
  rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RN * 3), 3);
  rings.frustumCulled = false; rings.renderOrder = 8; rings.count = 0; rings.visible = false;
  scene.add(rings);
  const RG = [];
  for (let i = 0; i < RN; i++) RG.push({ on: false, x: 0, y: 0, z: 0, r: 1, life: 0, max: 1, col: new THREE.Color() });

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), s3 = new THREE.Vector3();
  const PAL = ['#ffd27a', '#ff8a3d', '#ff4fa3', '#fff3c4', '#27e8ff'];
  const FIREWORK = ['#ff2bd1', '#18f0ff', '#ffe14a', '#8dff5a', '#ff6a3d', '#b388ff', '#ffffff'];
  const fx = {
    shake: 0,
    FIREWORK,
    explode(x, y, z, scale = 1) {
      const n = Math.round(110 * scale);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, e = Math.random() * 1.45, sp = (4 + Math.random() * 20) * scale;
        const fire = i < n * 0.45;
        spawn(x, y + 0.3, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * (fire ? 0.7 : 1.1), Math.sin(a) * Math.cos(e) * sp,
          fire ? PAL[i % 2] : PAL[i % PAL.length], fire ? 3.4 * scale : 0.7, fire ? 0.35 + Math.random() * 0.4 : 0.6 + Math.random() * 0.9, fire ? 2 : 16);
      }
      spawn(x, y + 1, z, 0, 2, 0, '#fff3c4', 16 * scale, 0.22, 0);
      // reduced motion: a gentler flash of light, no shake
      light.position.set(x, y + 2.5, z); light.intensity = (reducedMotion ? 90 : 260) * scale;
      if (!reducedMotion) fx.shake = Math.max(fx.shake, 0.6 * scale);
    },
    // a vehicle going up: the burst above plus a rolling fireball, a shockwave ring, debris and a smoke column
    blast(x, y, z, scale = 1) {
      fx.explode(x, y, z, scale);
      for (let i = 0; i < 16 * scale; i++) {
        const a = Math.random() * 6.283, r = Math.random() * 1.6 * scale;
        spawn(x + Math.cos(a) * r, y + 0.6 + Math.random(), z + Math.sin(a) * r, Math.cos(a) * 2, 2.5 + Math.random() * 3.5, Math.sin(a) * 2,
          i % 3 ? '#ff8a3d' : '#ffd27a', (4.5 + Math.random() * 3) * scale, 0.55 + Math.random() * 0.45, -1.5);
      }
      fx.ring(x, 0.25, z, 12 * scale, '#ffd27a', 0.55);
      fx.debris(x, y + 0.8, z, Math.round(18 * scale));
      for (let i = 0; i < 12 * scale; i++) {
        const a = Math.random() * 6.283, r = Math.random() * 1.5;
        smokeSpawn(x + Math.cos(a) * r, y + 1 + Math.random() * 1.5, z + Math.sin(a) * r, Math.cos(a) * 1.4, 2 + Math.random() * 2.5, Math.sin(a) * 1.4,
          0.08 + Math.random() * 0.12, (2.6 + Math.random() * 2) * scale, 2.2 + Math.random() * 1.8, 2.2, 0.75);
      }
    },
    puff(x, y, z, dx, dy, dz) {
      for (let i = 0; i < 10; i++) {
        spawn(x, y, z, dx * (8 + Math.random() * 10) + (Math.random() - 0.5) * 4, dy * 8 + Math.random() * 3, dz * (8 + Math.random() * 10) + (Math.random() - 0.5) * 4,
          PAL[i % 2], 1.6, 0.15 + Math.random() * 0.2, 0);
      }
    },
    // a burst of sparks (a lamp post going down, a laser hit)
    sparks(x, y, z, n = 26, hex = null) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, sp = 3 + Math.random() * 7;
        spawn(x, y, z, Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp, hex && i % 2 ? hex : i % 3 ? '#ffd27a' : '#fff3c4', 0.35, 0.3 + Math.random() * 0.5, 18);
      }
    },
    // a hydrant fountain: call every frame while it runs (k fades it out)
    spray(x, z, k = 1) {
      const n = reducedMotion ? 2 : 4;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, s = Math.random() * 1.1;
        spawn(x + Math.cos(a) * 0.08, 0.75, z + Math.sin(a) * 0.08, Math.cos(a) * s, (7 + Math.random() * 3.5) * k, Math.sin(a) * s, i % 2 ? '#bfe8ff' : '#7fc8ff', 0.45, 1.1 + Math.random() * 0.4, 14);
      }
    },
    // one glowing spark left behind (a firework star's tail, a lit fuse)
    trail(x, y, z, hex) {
      spawn(x, y, z, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, hex, 0.55, 0.3 + Math.random() * 0.25, 2);
    },
    // flames licking up off a burning bonnet (call every frame; k = how big)
    flame(x, y, z, k = 1) {
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * 6.283, r = Math.random() * 0.55 * k;
        spawn(x + Math.cos(a) * r, y, z + Math.sin(a) * r, (Math.random() - 0.5) * 0.8, 2.2 + Math.random() * 2.2, (Math.random() - 0.5) * 0.8,
          i ? '#ff8a3d' : Math.random() < 0.4 ? '#fff3c4' : '#ffd27a', (1.1 + Math.random() * 0.9) * k, 0.3 + Math.random() * 0.3, -2);
      }
    },
    // smoke off a damaged engine: shade 0.95 (white steam) .. 0.08 (black)
    smoke(x, y, z, shade, k = 1, vx = 0, vz = 0) {
      smokeSpawn(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4, vx * 0.3 + (Math.random() - 0.5) * 0.6, 1.4 + Math.random() * 1.1, vz * 0.3 + (Math.random() - 0.5) * 0.6,
        shade, (0.7 + Math.random() * 0.5) * k, 1.4 + Math.random() * 1.2, 2.4, shade > 0.5 ? 0.42 : 0.62);
    },
    // dark chunks that fly out, fall and bounce
    debris(x, y, z, n = 14) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, sp = 4 + Math.random() * 9;
        smokeSpawn(x, y, z, Math.cos(a) * sp, 4 + Math.random() * 8, Math.sin(a) * sp, 0, 0.22 + Math.random() * 0.22, 1.2 + Math.random() * 0.8, 0, 1, 20, i % 4 ? '#2a2430' : '#5a4a50');
      }
    },
    // a firework: a sphere of coloured stars, a bright core and a crackle of white sparks
    burst(x, y, z, n = 70, spd = 9, pal = FIREWORK) {
      const c0 = pal[Math.floor(Math.random() * pal.length)], c1 = pal[Math.floor(Math.random() * pal.length)];
      for (let i = 0; i < n; i++) {
        const u = Math.random() * 2 - 1, a = Math.random() * 6.283, k = Math.sqrt(1 - u * u), sp = spd * (0.75 + Math.random() * 0.35);
        spawn(x, y, z, Math.cos(a) * k * sp, u * sp + 2, Math.sin(a) * k * sp, i % 3 === 0 ? '#ffffff' : i % 2 ? c0 : c1, 0.7 + Math.random() * 0.5, 0.6 + Math.random() * 0.6, 5);
      }
      spawn(x, y, z, 0, 0, 0, '#fff6ec', 6, 0.18, 0);
      light.position.set(x, y + 1, z); light.intensity = Math.max(light.intensity, reducedMotion ? 30 : 90); light.color.set(c0);
      setTimeout(() => light.color.set(0xffb060), 120);
    },
    beam(ax, ay, az, bx, by, bz, hex, w = 0.12, l = 0.1, flick = 0) {
      let b = B.find((k) => !k.on);
      if (!b) { b = B[0]; for (const k of B) if (k.life < b.life) b = k; }
      b.on = true; b.a.set(ax, ay, az); b.b.set(bx, by, bz); b.col.set(hex); b.w = w; b.life = b.max = l; b.flick = reducedMotion ? 0 : flick;
      return b;
    },
    ring(x, y, z, r, hex, l = 0.5) {
      let g = RG.find((k) => !k.on);
      if (!g) g = RG[0];
      Object.assign(g, { on: true, x, y, z, r, life: l, max: l }); g.col.set(hex);
    },
    // how many effect slots are busy (debug)
    stats() { let s = 0, b = 0; for (let i = 0; i < SN; i++) if (sLife[i] > 0) s++; for (const k of B) if (k.on) b++; return { smoke: s, beams: b }; },
    update(dt) {
      const drag = Math.exp(-2.2 * dt);
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) { size[i] = 0; continue; }
        vel[i * 3 + 1] -= grav[i] * dt;
        vel[i * 3] *= drag; vel[i * 3 + 2] *= drag;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.05) { pos[i * 3 + 1] = 0.05; vel[i * 3 + 1] *= -0.35; }
        size[i] = base[i] * Math.sqrt(life[i] / max[i]);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true; geo.attributes.aSize.needsUpdate = true;
      light.intensity *= Math.exp(-9 * dt);
      fx.shake *= Math.exp(-5 * dt);

      // smoke rises, slows, grows and thins out; debris falls and bounces
      if (smokePts.visible) {
        sLive = 0;
        const sd = Math.exp(-1.2 * dt);
        for (let i = 0; i < SN; i++) {
          if (sLife[i] <= 0) continue;
          sLife[i] -= dt;
          if (sLife[i] <= 0) { sSize[i] = 0; sAlpha[i] = 0; continue; }
          sLive++;
          const k = sLife[i] / sMax[i];
          if (sGrav[i]) {
            sVel[i * 3 + 1] -= sGrav[i] * dt;
            if (sPos[i * 3 + 1] < 0.08 && sVel[i * 3 + 1] < 0) { sPos[i * 3 + 1] = 0.08; sVel[i * 3 + 1] *= -0.3; sVel[i * 3] *= 0.5; sVel[i * 3 + 2] *= 0.5; }
          } else { sVel[i * 3] *= sd; sVel[i * 3 + 1] *= Math.exp(-0.5 * dt); sVel[i * 3 + 2] *= sd; }
          sPos[i * 3] += sVel[i * 3] * dt; sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt; sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt;
          sSize[i] = sBase[i] * (1 + sGrow[i] * (1 - k));
          sAlpha[i] = sA0[i] * (sGrav[i] ? Math.min(1, k * 3) : Math.min(1, (1 - k) * 6) * k);
        }
        sGeo.attributes.position.needsUpdate = true; sGeo.attributes.aColor.needsUpdate = true; sGeo.attributes.aSize.needsUpdate = true; sGeo.attributes.aAlpha.needsUpdate = true;
        if (!sLive) smokePts.visible = false;
      }

      // beams: packed into the first instances every frame
      let n = 0;
      for (const b of B) {
        if (!b.on) continue;
        b.life -= dt;
        if (b.life <= 0) { b.on = false; continue; }
        v1.subVectors(b.b, b.a);
        const len = v1.length();
        if (len < 1e-3) continue;
        q.setFromUnitVectors(Z, v2.copy(v1).multiplyScalar(1 / len));
        m4.compose(v2.copy(b.a).addScaledVector(v1, 0.5), q, s3.set(b.w, b.w, len));
        beams.setMatrixAt(n, m4);
        const k = Math.min(1, b.life / b.max * 2.2) * (b.flick ? (Math.random() < b.flick ? 0.15 : 1) : 1);
        beams.setColorAt(n, c.copy(b.col).multiplyScalar(k));
        n++;
      }
      beams.count = n; beams.visible = n > 0;
      if (n) { beams.instanceMatrix.needsUpdate = true; beams.instanceColor.needsUpdate = true; }

      let rn = 0;
      for (const g of RG) {
        if (!g.on) continue;
        g.life -= dt;
        if (g.life <= 0) { g.on = false; continue; }
        const k = 1 - g.life / g.max, r = 0.6 + g.r * Math.sqrt(k);
        m4.compose(v1.set(g.x, g.y, g.z), q.identity(), s3.set(r, 1, r));
        rings.setMatrixAt(rn, m4);
        rings.setColorAt(rn, c.copy(g.col).multiplyScalar((1 - k) * 0.9));
        rn++;
      }
      rings.count = rn; rings.visible = rn > 0;
      if (rn) { rings.instanceMatrix.needsUpdate = true; rings.instanceColor.needsUpdate = true; }
    },
  };
  return fx;
}
