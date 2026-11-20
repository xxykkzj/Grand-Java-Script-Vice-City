// Adaptive resolution: watches the frame time and trades render pixels for smoothness.
// Slow for a couple of seconds -> the pixel ratio steps down (never below `floor` pixels per CSS pixel);
// plenty of headroom for a good while -> it creeps back up. Every drop that is followed soon by another
// one makes the next climb wait longer, so a borderline scene settles instead of flapping.
export function createAdaptive(apply, floor = 0.6) {
  const S = {
    scale: 1, base: 1, avg: 16.7, enabled: true,
    slowT: 0, fastT: 0, cool: 3, hold: 8, sinceRise: 99, drops: 0, rises: 0,
    // effective pixel ratio the renderer should use
    ratio() { return Math.max(Math.min(floor, S.base), S.base * S.scale); },
    minScale() { return Math.min(1, floor / S.base); },
    setBase(b) { S.base = b; },
    reset() { S.cool = 2; S.slowT = S.fastT = 0; },
    set(s) { S.scale = Math.min(1, Math.max(S.minScale(), s)); apply(); },
    // ms: this frame's time. Call once per drawn frame, not while paused or hidden.
    tick(ms) {
      if (!S.enabled) return;
      const dt = ms / 1000;
      ms = Math.min(ms, 1000);
      S.avg += (ms - S.avg) * 0.12;
      S.sinceRise += dt;
      if (S.cool > 0) { S.cool -= dt; S.avg = ms; return; }
      if (S.avg > 24) { S.slowT += dt; S.fastT = 0; }
      else if (S.avg < 19) { S.fastT += dt; S.slowT = 0; }
      else { S.slowT = 0; S.fastT = 0; }
      if (S.slowT > 2 && S.scale > S.minScale() + 0.001) {
        if (S.sinceRise < 20) S.hold = Math.min(64, S.hold * 2);
        S.drops++;
        S.slowT = 0; S.cool = 1.2;
        S.set(S.scale * 0.85);
      } else if (S.fastT > S.hold && S.scale < 0.999) {
        S.fastT = 0; S.rises++; S.sinceRise = 0; S.cool = 1;
        S.set(Math.min(1, S.scale * 1.1));
      }
    },
  };
  return S;
}
