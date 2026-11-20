// Cheap half-resolution bloom, drawn after the scene (so the scene itself, its antialiasing and its colours
// are untouched and nothing changes when it is off):
//   1. the finished frame is copied into a texture (a blit, not a draw call)
//   2. pass 1: bright pixels only (soft threshold), averaged down to half resolution
//   3. pass 2: horizontal blur down to quarter resolution
//   4. pass 3: vertical blur, added straight onto the frame
// Three full-screen passes = three draw calls, only while it is on. Neon signs, lamps, headlights and lasers
// glow; the strength and threshold follow the night uniform, so by day it is a faint sheen on the sun and chrome.
import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const PRE = 'precision highp float; varying vec2 vUv; uniform sampler2D tex; uniform vec2 uPx;';
const FRAG_BRIGHT = /* glsl */`${PRE}
  uniform float uThr;
  void main(){
    vec3 c = texture2D(tex, vUv + uPx * vec2(-0.5, -0.5)).rgb + texture2D(tex, vUv + uPx * vec2(0.5, -0.5)).rgb
           + texture2D(tex, vUv + uPx * vec2(-0.5, 0.5)).rgb + texture2D(tex, vUv + uPx * vec2(0.5, 0.5)).rgb;
    c *= 0.25;
    float m = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(uThr, uThr + 0.32, m), 1.0);
  }`;
const BLUR = (dir, out) => /* glsl */`${PRE}
  uniform float uSpread, uGain;
  void main(){
    vec2 d = ${dir} * uPx * uSpread;
    vec3 c = texture2D(tex, vUv).rgb * 0.2270270270
      + (texture2D(tex, vUv + d * 1.3846153846).rgb + texture2D(tex, vUv - d * 1.3846153846).rgb) * 0.3162162162
      + (texture2D(tex, vUv + d * 3.2307692308).rgb + texture2D(tex, vUv - d * 3.2307692308).rgb) * 0.0702702703;
    gl_FragColor = vec4(c * ${out}, 1.0);
  }`;

export function createBloom(renderer) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const U = { uThr: { value: 0.62 }, uGain: { value: 0.8 } };
  const mk = (frag, extra, additive) => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false, fog: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NoBlending, transparent: !!additive,
    uniforms: { tex: { value: null }, uPx: { value: new THREE.Vector2() }, uSpread: { value: 1 }, ...extra },
  });
  const mBright = mk(FRAG_BRIGHT, { uThr: U.uThr }), mH = mk(BLUR('vec2(1.0, 0.0)', '1.0'), { uGain: U.uGain }), mV = mk(BLUR('vec2(0.0, 1.0)', 'uGain'), { uGain: U.uGain }, true);
  const mesh = new THREE.Mesh(geo, mBright);
  mesh.frustumCulled = false;
  const scn = new THREE.Scene();
  scn.add(mesh);
  let src = null, A = null, B = null, W = 0, H = 0;
  const size = new THREE.Vector2();
  const free = () => { if (src) src.dispose(); if (A) A.dispose(); if (B) B.dispose(); src = A = B = null; W = H = 0; };
  const rt = (w, h) => new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  function ensure() {
    renderer.getDrawingBufferSize(size);
    const w = Math.floor(size.x), h = Math.floor(size.y);
    if (src && w === W && h === H) return;
    free();
    W = w; H = h;
    src = new THREE.FramebufferTexture(w, h);
    src.minFilter = src.magFilter = THREE.LinearFilter;
    A = rt(w >> 1, h >> 1); B = rt(w >> 2, h >> 2);
  }
  const api = {
    on: false,
    stats: { passes: 0 },
    // call right after renderer.render(scene, camera); night: 0..1
    render(night, glare = 0) {
      if (!api.on) return;
      ensure();
      const spread = Math.min(1.7, Math.max(0.8, H / 800)) * 1.5;
      // at sunset the sky, sea and fog behind the shore are bright but it is not night yet: raise the threshold and
      // drop the gain so the horizon does not bleed a halo over the beach-side models
      U.uThr.value = 0.9 - 0.22 * night + 0.32 * glare;
      U.uGain.value = (0.1 + 0.55 * night) * (1 - 0.85 * glare);
      const ac = renderer.autoClear;
      renderer.autoClear = false;
      renderer.copyFramebufferToTexture(src);
      mBright.uniforms.tex.value = src; mBright.uniforms.uPx.value.set(1 / W, 1 / H);
      mesh.material = mBright; renderer.setRenderTarget(A); renderer.render(scn, cam);
      mH.uniforms.tex.value = A.texture; mH.uniforms.uPx.value.set(1 / A.width, 1 / A.height); mH.uniforms.uSpread.value = spread;
      mesh.material = mH; renderer.setRenderTarget(B); renderer.render(scn, cam);
      mV.uniforms.tex.value = B.texture; mV.uniforms.uPx.value.set(1 / B.width, 1 / B.height); mV.uniforms.uSpread.value = spread;
      mesh.material = mV; renderer.setRenderTarget(null); renderer.render(scn, cam);
      renderer.autoClear = ac;
      api.stats.passes++;
    },
    set(v) { api.on = !!v; if (!api.on) free(); },
    dispose: free,
  };
  return api;
}
