// Sky dome (gradient, striped synthwave sun, stars, moon) and the animated ocean.
import * as THREE from 'three';
import { timeU, fogU, FOG_PARS } from '../core/util.js';
import { HX, HZ } from './layout.js';

export function createSky(scene) {
  const C = () => ({ value: new THREE.Color() });
  const uniforms = {
    uTop: C(), uMid: C(), uHor: C(), uSunA: C(), uSunB: C(), uGlow: C(),
    uSunDir: { value: new THREE.Vector3(1, 0.1, 0.2).normalize() },
    uMoonDir: { value: new THREE.Vector3(0.55, 0.5, -0.67).normalize() },
    uSunSize: { value: 0.16 }, uStripe: { value: 1 }, uStars: { value: 0 }, uFlash: { value: 0 }, uCloud: { value: 0 }, uVeil: { value: 0 },
    uTime: timeU,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uMid, uHor, uSunA, uSunB, uGlow, uSunDir, uMoonDir;
      uniform float uSunSize, uStripe, uStars, uFlash, uTime, uCloud, uVeil;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
      varying vec3 vDir;
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y, t = clamp(h, 0.0, 1.0);
        vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.2, t));
        col = mix(col, uTop, smoothstep(0.1, 0.65, t));
        col = mix(col, uHor * 0.55, smoothstep(0.0, -0.25, h));
        // faint horizontal haze lines near the horizon: the "grid" feel
        float band = smoothstep(0.96, 1.0, sin(h * 110.0) * 0.5 + 0.5) * (1.0 - smoothstep(0.0, 0.3, t));
        col += uGlow * band * 0.07 * uStripe;
        // stars
        vec3 g = floor(d * 520.0);
        float st = step(0.9986, hash(g)) * smoothstep(0.02, 0.25, h);
        st *= 0.6 + 0.4 * sin(uTime * 2.0 + hash(g + 1.0) * 40.0);
        col += vec3(st) * uStars;
        // sun: glow, then a disc sliced into bands that widen towards the bottom
        float sd = dot(d, uSunDir);
        col += uGlow * (pow(max(sd, 0.0), 6.0) * 0.3 + pow(max(sd, 0.0), 48.0) * 0.35) * (1.0 - uVeil * 0.7);
        float ang = acos(clamp(sd, -1.0, 1.0));
        float disc = 1.0 - smoothstep(uSunSize - 0.004, uSunSize, ang);
        float sy = (d.y - uSunDir.y) / uSunSize;
        float gap = clamp((0.3 - sy) * 0.42, 0.0, 0.62);
        float cut = mix(1.0, step(gap, fract(sy * 5.5)), uStripe);
        vec3 sc = mix(uSunB, uSunA, clamp(sy * 0.5 + 0.5, 0.0, 1.0));
        col = mix(col, sc, disc * cut * (1.0 - uVeil));
        // crescent moon
        float moon = smoothstep(0.9984, 0.9988, dot(d, uMoonDir));
        float bite = smoothstep(0.9982, 0.9987, dot(d, normalize(uMoonDir + vec3(0.02, 0.012, 0.0))));
        col += vec3(0.9, 0.93, 1.0) * moon * (1.0 - bite) * uStars;
        // drifting cloud deck: three octaves of value noise projected onto a flat ceiling
        if (uCloud > 0.02 && h > -0.02) {
          vec2 cp = d.xz / (h + 0.14) * 1.3 + uTime * vec2(0.014, 0.005);
          float cl = vn(cp) * 0.55 + vn(cp * 2.3 + 7.0) * 0.3 + vn(cp * 5.1) * 0.15;
          float th = mix(0.8, 0.12, uCloud);
          float cv = smoothstep(th, th + 0.3, cl) * smoothstep(-0.02, 0.1, h);
          vec3 cc = mix(uHor, uMid, 0.4) * (0.7 + 0.45 * cl) + uGlow * 0.25 * pow(max(sd, 0.0), 3.0);
          col = mix(col, cc, cv * 0.93);
        }
        col += vec3(0.7, 0.78, 1.0) * uFlash;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  scene.add(mesh);
  return { mesh, uniforms };
}

export function createOcean(scene) {
  const C = () => ({ value: new THREE.Color() });
  const uniforms = {
    uDeep: C(), uShallow: C(), uSky: C(), uSunCol: C(),
    uSunDir: { value: new THREE.Vector3(1, 0.1, 0.2).normalize() },
    uIsle: { value: new THREE.Vector2(HX, HZ) },
    uTime: timeU, ...fogU,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uDeep, uShallow, uSky, uSunCol, uSunDir;
      uniform vec2 uIsle;
      uniform float uTime;
      ${FOG_PARS}
      varying vec3 vW;
      void main(){
        vec2 p = vW.xz;
        float t = uTime;
        float n = sin(p.x * 0.21 + t * 1.3) * sin(p.y * 0.17 - t * 1.1) + sin((p.x + p.y) * 0.07 + t * 0.6);
        float n2 = sin(p.x * 0.9 + t * 2.1 + n) * sin(p.y * 1.1 - t * 1.7);
        vec3 N = normalize(vec3(cos(p.x * 0.33 + t * 1.2 + n) * 0.10 + n2 * 0.05, 1.0, sin(p.y * 0.37 - t * 1.4 + n) * 0.10));
        vec3 V = normalize(cameraPosition - vW);
        vec2 q = abs(p) - uIsle;
        float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
        vec3 col = mix(uDeep, uShallow, 0.25 + 0.2 * n);
        col = mix(uShallow * 1.25, col, smoothstep(0.0, 70.0, dist));
        float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
        col = mix(col, uSky, fres * 0.65);
        vec3 R = reflect(-V, N);
        col += uSunCol * (pow(max(dot(R, uSunDir), 0.0), 90.0) * 1.4 + pow(max(dot(R, uSunDir), 0.0), 12.0) * 0.18);
        // surf rolling up the sand
        float foam = smoothstep(0.55, 1.0, sin(dist * 0.8 - t * 1.6 + n * 1.5) * 0.5 + 0.5) * smoothstep(16.0, 0.0, dist);
        foam += smoothstep(1.6, 0.0, dist);
        col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.55);
        float fogF = smoothstep(uFogNear, uFogFar, length(cameraPosition - vW));
        col = mix(col, uFogColor, fogF);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const geo = new THREE.PlaneGeometry(4000, 4000);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.6;
  scene.add(mesh);
  return { mesh, uniforms };
}
