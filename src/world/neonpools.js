// Which glow sprites are real neon (coloured, big, up on a wall or a roof) and so throw a pool of their own
// colour on the street at night. The pools are painted into the lamp-light canvases (world/city.js, keyCity.js),
// so they cost nothing at run time: the ground shader already adds that canvas at night.
const WARM = new Set(['#ffcf8a', '#ffe7b0', '#ffd9a0', '#ff3040', '#ff2a3a', '#f4f8ff', '#bff4ff', '#ffffff', '#7fe0ff']);
export function neonPools(glows) {
  const out = [];
  for (const g of glows) {
    if (g[4] < 5.5 || g[5] > 0.2 || g[1] < 2.5 || WARM.has(String(g[3]).toLowerCase())) continue;
    const c = parseInt(String(g[3]).slice(1), 16);
    out.push({ x: g[0], z: g[2], r: Math.min(15, 3 + g[4] * 0.65), a: 0.4, rgb: `${c >> 16 & 255},${c >> 8 & 255},${c & 255}` });
  }
  return out;
}
