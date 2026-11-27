// Z-fighting scanner: run inside the game page (playwright evaluate) with a room already entered.
// Finds pairs of triangles that lie in the same plane (within 2 mm), face the same way, overlap,
// and have visibly different colours, i.e. surfaces that will flicker. Returns clusters (0.4 m grid)
// in room-local coordinates, largest overlap first.
window.__zscan = function (root, ox, oy, oz) {
  const T = [], v = new THREE_V(), tmp = [new THREE_V(), new THREE_V(), new THREE_V()];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && m.transparent && m.opacity < 0.6) return;           // glass / glows don't matter
    if (m && (m.polygonOffset || m.depthWrite === false || m.blending === 2)) return;   // decals and additive pools are drawn on purpose
    const g = o.geometry, P = g.attributes.position, C = g.attributes.color, I = g.index;
    if (!P) return;
    const n = I ? I.count : P.count;
    const mats = o.isInstancedMesh ? Array.from({ length: o.count }, (_, k) => { const M = new o.matrixWorld.constructor(); o.getMatrixAt(k, M); return M.premultiply(o.matrixWorld); }) : [o.matrixWorld];
    for (const MW of mats) for (let t = 0; t < n; t += 3) {
      const col = [0, 0, 0];
      for (let j = 0; j < 3; j++) {
        const id = I ? I.getX(t + j) : t + j;
        tmp[j].fromBufferAttribute(P, id).applyMatrix4(MW);
        if (C) { col[0] += C.getX(id) / 3; col[1] += C.getY(id) / 3; col[2] += C.getZ(id) / 3; }
        else if (m && m.color) { col[0] += m.color.r / 3; col[1] += m.color.g / 3; col[2] += m.color.b / 3; }
      }
      const a = tmp[0].clone(), b = tmp[1].clone(), c = tmp[2].clone();
      const nrm = b.clone().sub(a).cross(c.clone().sub(a)); const area = nrm.length() / 2;
      if (area < 1e-4) continue; nrm.normalize();
      T.push({ a, b, c, n: nrm, d: nrm.dot(a), col, area });
    }
  });
  // bucket by plane
  const B = new Map();
  for (let i = 0; i < T.length; i++) {
    const t = T[i], k = [Math.round(t.n.x * 200), Math.round(t.n.y * 200), Math.round(t.n.z * 200), Math.round(t.d * 250)].join(',');
    (B.get(k) || B.set(k, []).get(k)).push(i);
  }
  // a grid of triangles (1 m cells) for the "is this face actually visible" test below
  const G = new Map(), gk = (x, y, z) => Math.floor(x) + ',' + Math.floor(y) + ',' + Math.floor(z);
  T.forEach((t, i) => { const xs = [t.a.x, t.b.x, t.c.x], ys = [t.a.y, t.b.y, t.c.y], zs = [t.a.z, t.b.z, t.c.z];
    for (let x = Math.floor(Math.min(...xs)); x <= Math.floor(Math.max(...xs)); x++) for (let y = Math.floor(Math.min(...ys)); y <= Math.floor(Math.max(...ys)); y++) for (let z = Math.floor(Math.min(...zs)); z <= Math.floor(Math.max(...zs)); z++) { const k = x + ',' + y + ',' + z; (G.get(k) || G.set(k, []).get(k)).push(i); } });
  // ray/triangle (Moller-Trumbore); a face is "buried" if something solid sits within 4 cm in front of it
  const hitTri = (o, d, t, maxT) => { const e1 = t.b.clone().sub(t.a), e2 = t.c.clone().sub(t.a), pv = d.clone().cross(e2), det = e1.dot(pv);
    if (Math.abs(det) < 1e-9) return false; const inv = 1 / det, tv = o.clone().sub(t.a), u = tv.dot(pv) * inv; if (u < 0 || u > 1) return false;
    const qv = tv.cross(e1), w = d.dot(qv) * inv; if (w < 0 || u + w > 1) return false; const s = e2.dot(qv) * inv; return s > 0.002 && s < maxT; };
  const buried = (c, n) => { const o = c.clone().addScaledVector(n, 0.003); const ids = G.get(gk(o.x, o.y, o.z)) || [];
    for (const i of ids) if (hitTri(o, n, T[i], 0.04)) return true; return false; };
  const hits = new Map();
  const proj = (t) => { const n = t.n, ax = Math.abs(n.x) > 0.9 ? 'y' : 'x', ay = Math.abs(n.z) > 0.9 ? 'y' : 'z'; const A = ax === ay ? ['x', 'y'] : [ax, ay]; return [t.a, t.b, t.c].map((p) => [p[A[0]], p[A[1]]]); };
  const sat = (P, Q) => { for (const S of [P, Q]) for (let i = 0; i < 3; i++) { const p = S[i], q = S[(i + 1) % 3], nx = q[1] - p[1], ny = p[0] - q[0];
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const r of P) { const d = r[0] * nx + r[1] * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const r of Q) { const d = r[0] * nx + r[1] * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      const L = Math.hypot(nx, ny) || 1; if (a1 - b0 < 0.004 * L || b1 - a0 < 0.004 * L) return false; } return true; };
  for (const ids of B.values()) {
    if (ids.length < 2 || ids.length > 4000) continue;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const p = T[ids[i]], q = T[ids[j]];
      const dc = Math.abs(p.col[0] - q.col[0]) + Math.abs(p.col[1] - q.col[1]) + Math.abs(p.col[2] - q.col[2]);
      if (dc < 0.12) continue;
      if (!sat(proj(p), proj(q))) continue;
      // sample the middle of the overlap (centroid of the smaller triangle): skip faces nothing can see
      const sm = p.area < q.area ? p : q, cen = sm.a.clone().add(sm.b).add(sm.c).multiplyScalar(1 / 3);
      if (buried(cen, sm.n)) continue;
      // pressed flat against another solid (a box standing on the floor: its bottom touches the floor's top)
      const ok2 = [Math.round(-sm.n.x * 200), Math.round(-sm.n.y * 200), Math.round(-sm.n.z * 200), Math.round(-sm.d * 250)].join(',');
      const opp = B.get(ok2); if (opp && opp.some((k) => sat(proj(sm), proj(T[k])))) continue;
      const cx = (p.a.x + p.b.x + p.c.x) / 3 - ox, cy = (p.a.y + p.b.y + p.c.y) / 3 - oy, cz = (p.a.z + p.b.z + p.c.z) / 3 - oz;
      const key = [Math.round(cx / 0.4), Math.round(cy / 0.4), Math.round(cz / 0.4)].join(',');
      const h = hits.get(key) || hits.set(key, { x: +cx.toFixed(2), y: +cy.toFixed(2), z: +cz.toFixed(2), n: [+p.n.x.toFixed(2), +p.n.y.toFixed(2), +p.n.z.toFixed(2)], pairs: 0, area: 0 }).get(key);
      h.pairs++; h.area += Math.min(p.area, q.area);
    }
  }
  return [...hits.values()].sort((a, b) => b.area - a.area);
};
