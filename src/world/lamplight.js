// Street-light and neon pools on characters (and cars). The ground shader (city.js groundMaterial) adds the
// lamp map (1 px = 1 m canvases, one per district) to the asphalt at night; this patch makes people and
// vehicles standing in a pool pick up the same light, from the same textures and uniforms, so it costs two
// texture reads per fragment and nothing per character. It fades a little with height (legs catch a bit
// more than heads), is gone above ~5 m (rooftops), rolls off softly like the ground, and is switched off
// indoors (lampU.on, set every frame in main.js). By day uNight is 0, so nothing changes.
import * as THREE from 'three';
import { nightU, glareU } from '../core/util.js';

export const LAMP_GAIN_CHAR = 1.45;
export const lampU = {
  uLampOld: { value: null }, uLampKey: { value: null },
  uLampROld: { value: new THREE.Vector4(0, 0, 1, 1) }, uLampRKey: { value: new THREE.Vector4(0, 0, 1, 1) },
  uLampOn: { value: 1 }, uNight: nightU, uGlare: glareU,
};
// called by city.js / keyCity.js once their lamp maps exist (x0, z0, width, depth of the canvas in metres)
export function setLampMap(which, tex, x0, z0, w, h) {
  lampU[which === 'key' ? 'uLampKey' : 'uLampOld'].value = tex;
  lampU[which === 'key' ? 'uLampRKey' : 'uLampROld'].value.set(x0, z0, w, h);
}

// patch a Lambert material's onBeforeCompile shader (sh): call from inside the material's own hook
export function lampPatch(sh) {
  if (!lampU.uLampOld.value || !lampU.uLampKey.value) return;
  Object.assign(sh.uniforms, lampU);
  sh.vertexShader = 'varying vec3 vLWP;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
    {
      vec4 lw = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        lw = instanceMatrix * lw;
      #endif
      #ifdef USE_BATCHING
        lw = batchingMatrix * lw;
      #endif
      vLWP = (modelMatrix * lw).xyz;
    }`);
  sh.fragmentShader = 'varying vec3 vLWP; uniform sampler2D uLampOld, uLampKey; uniform vec4 uLampROld, uLampRKey; uniform float uLampOn, uNight, uGlare;\n'
    + sh.fragmentShader.replace('#include <opaque_fragment>', `
    {
      float lk = uLampOn * uNight * (1.0 - 0.85 * uGlare);
      if (lk > 0.001) {
        vec2 uo = (vLWP.xz - uLampROld.xy) / uLampROld.zw, uk = (vLWP.xz - uLampRKey.xy) / uLampRKey.zw;
        float io = step(0.0, uo.x) * step(uo.x, 1.0) * step(0.0, uo.y) * step(uo.y, 1.0);
        float ik = step(0.0, uk.x) * step(uk.x, 1.0) * step(0.0, uk.y) * step(uk.y, 1.0);
        vec3 lampL = texture2D(uLampOld, clamp(uo, 0.0, 1.0)).rgb * io * (1.0 - ik) + texture2D(uLampKey, clamp(uk, 0.0, 1.0)).rgb * ik;
        float hk = mix(1.0, 0.78, clamp(vLWP.y / 1.8, 0.0, 1.0)) * (1.0 - smoothstep(3.0, 5.5, vLWP.y));
        vec3 before = outgoingLight;
        float b0 = dot(before, vec3(0.299, 0.587, 0.114));
        outgoingLight += diffuseColor.rgb * lampL * lk * hk * (1.0 - 0.55 * clamp(b0, 0.0, 1.0)) * ${LAMP_GAIN_CHAR.toFixed(2)};
        float pk = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b)), p0 = max(before.r, max(before.g, before.b));
        if (pk > 0.55 && pk > p0) outgoingLight *= max(0.55 + 0.33 * (1.0 - exp(-(pk - 0.55) * 1.8)), p0) / pk;
      }
    }
    #include <opaque_fragment>`);
}
