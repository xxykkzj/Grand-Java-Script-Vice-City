// Sky dome (gradient, striped synthwave sun, stars, moon) and the animated ocean.
import * as THREE from 'three';
import { timeU, fogU, FOG_PARS } from '../core/util.js';
import { HX, HZ, KEY } from './layout.js';

export function createSky(scene) {
  const C = () => ({ value: new THREE.Color() });
  const uniforms = {
    uTop: C(), uMid: C(), uHor: C(), uSunA: C(), uSunB: C(), uGlow: C(),
    uSunDir: { value: new THREE.Vector3(1, 0.1, 0.2).normalize() },
    uMoonDir: { value: new THREE.Vector3(0.55, 0.5, -0.67).normalize() },
    uSunSize: { value: 0.16 }, uStripe: { value: 1 }, uStars: { value: 0 }, uFlash: { value: 0 }, uCloud: { value: 0 }, uVeil: { value: 0 }, uBow: { value: 0 },
    uTime: timeU, uFogColor: fogU.uFogColor,
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
      uniform float uSunSize, uStripe, uStars, uFlash, uTime, uCloud, uVeil, uBow;
      uniform vec3 uFogColor;
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
        // the sea haze: right at and below the horizon the sky is the fog colour, so the fogged-out
        // ocean melts into it and there is never a visible edge to the water
        col = mix(col, uFogColor, smoothstep(0.045, -0.012, h));
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
        // a rainbow after the rain: centred on the anti-solar point (so only the part above the horizon shows, and
        // none at all when the sun is higher than ~42 degrees), the primary bow at 40.5-42.5 degrees with red outside,
        // a faint secondary at 50-53.5 degrees with the colours reversed, the sky a touch brighter inside the
        // primary and darker between the two (Alexander's band). Drawn in the sky, so everything else covers it.
        if (uBow > 0.003 && h > -0.01) {
          float th = degrees(acos(clamp(dot(d, -uSunDir), -1.0, 1.0)));
          float p1 = clamp((th - 40.4) / 2.2, 0.0, 1.0), w1 = smoothstep(40.0, 40.7, th) * smoothstep(42.9, 42.2, th);
          float p2 = clamp((th - 50.2) / 3.4, 0.0, 1.0), w2 = smoothstep(49.8, 50.6, th) * smoothstep(54.0, 53.2, th);
          vec3 c1 = clamp(abs(fract(0.78 * (1.0 - p1) + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
          vec3 c2 = clamp(abs(fract(0.78 * p2 + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
          float fadeH = smoothstep(-0.01, 0.06, h);
          col += (c1 * w1 * 0.2 + c2 * w2 * 0.075) * uBow * fadeH;
          col += vec3(0.05) * uBow * fadeH * smoothstep(41.0, 30.0, th) * smoothstep(5.0, 25.0, th);
          col *= 1.0 - 0.05 * uBow * fadeH * smoothstep(42.6, 43.6, th) * smoothstep(50.2, 49.2, th);
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
    uKey: { value: new THREE.Vector4((KEY.x0 + KEY.x1) / 2, 0, (KEY.x1 - KEY.x0) / 2, (KEY.z1 - KEY.z0) / 2) },
    uFoam: { value: 1 },
    uTime: timeU, ...fogU,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, fog: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uDeep, uShallow, uSky, uSunCol, uSunDir;
      uniform vec2 uIsle; uniform vec4 uKey;
      const float HZ_ = ${HZ.toFixed(1)}, HX_ = ${HX.toFixed(1)};
      uniform float uTime, uFoam;
      ${FOG_PARS}
      varying vec3 vW;
      float hh(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
      float vnz(vec2 q){ vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }
      // foam skirt and an expanding ripple round the posts under a pier: posts stand in two rows, 12.5 m apart
      float postFoam(vec2 p, float cx, float z0, float n, float rad, float t){
        vec2 a = p - vec2(cx, 0.0);
        if (abs(a.x) > 9.0 || p.y < z0 - 8.0 || p.y > z0 + n * 12.5 + 4.0) return 0.0;
        float k = clamp(floor((p.y - z0) / 12.5 + 0.5), 0.0, n - 1.0);
        float r = length(vec2(abs(a.x) - 5.85, p.y - (z0 + k * 12.5)));
        float skirt = 1.0 - smoothstep(rad + 0.1, rad + 0.8 + 0.25 * sin(t * 2.3 + k * 1.7), r);
        float f = fract(t * 0.3 + k * 0.37);
        float ring = (1.0 - smoothstep(0.0, 0.18, abs(r - (rad + 0.3 + f * 1.8)))) * (1.0 - f);
        return clamp(skirt * 0.9 + ring * 0.7, 0.0, 1.0) * (0.7 + 0.3 * vnz(p * 4.0 + t));
      }
      void main(){
        vec2 p = vW.xz;
        float t = uTime;
        float n = sin(p.x * 0.21 + t * 1.3) * sin(p.y * 0.17 - t * 1.1) + sin((p.x + p.y) * 0.07 + t * 0.6);
        float n2 = sin(p.x * 0.9 + t * 2.1 + n) * sin(p.y * 1.1 - t * 1.7);
        vec3 N = normalize(vec3(cos(p.x * 0.33 + t * 1.2 + n) * 0.10 + n2 * 0.05, 1.0, sin(p.y * 0.37 - t * 1.4 + n) * 0.10));
        vec3 V = normalize(cameraPosition - vW);
        vec2 q = abs(p) - uIsle;
        float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
        vec2 qk = abs(p - uKey.xy) - uKey.zw;
        float distK = length(max(qk, 0.0)) + min(max(qk.x, qk.y), 0.0);
        // seen from below (the camera is under the surface): a bright Snell's window of sky straight above,
        // the wavy surface rippling across it, and the murk of total internal reflection beyond its rim
        if (cameraPosition.y < vW.y) {
          vec3 Vd = normalize(vW - cameraPosition);
          float cs = dot(Vd, normalize(vec3(-N.x * 1.6, 1.0, -N.z * 1.6)));
          float win = smoothstep(0.62, 0.74, cs);
          float rim = smoothstep(0.58, 0.64, cs) * (1.0 - smoothstep(0.64, 0.74, cs));
          vec3 Rf = vec3(Vd.x * 1.33 - N.x * 0.4, max(cs, 0.0), Vd.z * 1.33 - N.z * 0.4);
          vec3 sky = uSky * 1.1 + uSunCol * (pow(max(dot(normalize(Rf), uSunDir), 0.0), 40.0) * 1.2 + 0.1);
          float rip = 0.5 + 0.5 * sin(p.x * 1.7 + t * 1.6 + n * 2.0) * sin(p.y * 1.5 - t * 1.3);
          vec3 under = mix(uFogColor * 0.75, sky * (0.8 + 0.35 * rip), win) + uSky * rim * 0.3;
          float fogU2 = smoothstep(uFogNear, uFogFar, length(cameraPosition - vW));
          gl_FragColor = vec4(mix(under, uFogColor, fogU2 * (1.0 - win * 0.55)), 1.0);
          #include <colorspace_fragment>
          return;
        }
        vec3 col = mix(uDeep, uShallow, 0.25 + 0.2 * n);
        col = mix(uShallow * 1.25, col, smoothstep(0.0, 70.0, dist));
        float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
        col = mix(col, uSky, fres * 0.65);
        vec3 R = reflect(-V, N);
        col += uSunCol * (pow(max(dot(R, uSunDir), 0.0), 90.0) * 1.4 + pow(max(dot(R, uSunDir), 0.0), 12.0) * 0.18);
        // surf rolling up the sand
        float foam;
        if (uFoam > 0.5) {
          // High: swells that arrive at the shore with a sharp crest and a ragged lace behind it, a wash that runs
          // up the waterline and back, and foam round the pier posts. The beach (south of the old town) starts
          // its waterline 5 m out where the sand slips under; the seawalls start at the wall.
          float wb = smoothstep(HZ_ - 40.0, HZ_, p.y) * (1.0 - smoothstep(HX_ + 2.0, HX_ + 12.0, abs(p.x)));
          float sd = min(dist - 5.0 * wb, distK);
          foam = 0.0;
          if (sd < 40.0) {
            float lace = vnz(p * 1.15 + vec2(t * 0.25, -t * 0.18)), lace2 = vnz(p * 3.1 + vec2(-t * 0.4, t * 0.3));
            float cyc = fract(sd / 14.0 + t * 0.07 + n * 0.03);
            float crest = smoothstep(0.0, 0.05, cyc) * (1.0 - smoothstep(0.05, 0.3, cyc));
            float amp = mix(0.4, 1.0, 1.0 - smoothstep(3.0, 22.0, sd)) * (1.0 - smoothstep(14.0, 38.0, sd));
            foam = crest * amp * smoothstep(0.36, 0.62, lace * 0.7 + lace2 * 0.3 + crest * 0.45);
            float swash = 1.6 + 1.6 * (0.5 + 0.5 * sin(t * 0.9 + p.x * 0.03 + n));
            float wash = (1.0 - smoothstep(0.0, swash, sd)) * (0.55 + 0.45 * smoothstep(0.35, 0.7, lace2));
            float edge = (1.0 - smoothstep(0.0, 0.4, abs(sd - swash))) * smoothstep(0.3, 0.6, lace) * 0.8;
            foam = max(foam, max(wash * 0.9, edge));
          }
          foam = max(foam, max(postFoam(p, 40.0, 156.0, 8.0, 0.32, t), postFoam(p, -790.0, 156.0, 7.0, 0.3, t)));
          // lit by what is above it: bright by day, a dim moonlit grey at night
          float lit = clamp(dot(uShallow, vec3(0.333)) * 1.6 + 0.12, 0.1, 1.0);
          col = mix(col, mix(uSky, vec3(1.0), 0.6) * lit, clamp(foam, 0.0, 1.0) * 0.85);
        } else {
          foam = smoothstep(0.55, 1.0, sin(dist * 0.8 - t * 1.6 + n * 1.5) * 0.5 + 0.5) * smoothstep(16.0, 0.0, dist);
          foam += smoothstep(1.6, 0.0, dist);
          col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.55);
        }
        float fogF = smoothstep(uFogNear, uFogFar, length(cameraPosition - vW));
        col = mix(col, uFogColor, fogF);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  // big enough to reach the camera's far plane in every direction; it follows the camera (see update)
  const geo = new THREE.PlaneGeometry(6000, 6000);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.6;
  scene.add(mesh);
  return { mesh, uniforms };
}
