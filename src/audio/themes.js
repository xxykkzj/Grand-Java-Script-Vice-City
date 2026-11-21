// The game's music: one short looping theme per indoor place plus the street score, all original and
// written for this game (genre conventions only: progressions, grooves, instrument colours). audio/audio.js
// plays them on a look-ahead scheduler with a small kit of synth voices (K): a theme only says, step by
// step (sixteenth notes), which voices to trigger.
//
// A theme: { bpm, swing (0..1, delays the off-beat eighths towards a triplet feel), wet (echo send), vol,
//   sec: { name: bars }, form: [names] (or pick(p, mood) for the street, which chooses as it goes),
//   play(e, K) }  where e = { t, s (0..15), chord, next, bar, barIn, bars, secKey, formI, loop, p, r, spb, bus, mood, last }.
// Every section has its own chords; melodies are short motifs that change a little each time round
// (a different motif, shifted a step, notes dropped or ornamented) and snap to the chord on the beat.

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const Q = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  m7b5: [0, 3, 6, 10], dim: [0, 3, 6, 9], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], 9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14], add9: [0, 4, 7, 14],
};
export function chord(s) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(s);
  const iv = Q[m[3]];
  if (!m || !iv) throw new Error('bad chord ' + s);
  const pc = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return { root: 48 + pc, iv, name: s };
}
// 'Am | F G | C' -> bars of chords (a bar with two chords splits in half)
export const prog = (str) => str.split('|').map((b) => b.trim().split(/\s+/).map(chord));
const MODES = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10], dor: [0, 2, 3, 5, 7, 9, 10], phr: [0, 1, 3, 5, 7, 8, 10], mix: [0, 2, 4, 5, 7, 9, 10] };
// scale degree -> MIDI note (degree 0 = the key note at `base` + pc)
const scale = (pc, mode, base) => (d) => { const m = MODES[mode], n = m.length, o = Math.floor(d / n); return base + pc + o * 12 + m[d - o * n]; };
const wrap = (n, lo) => { while (n < lo) n += 12; while (n >= lo + 12) n -= 12; return n; };
// close voicing of a chord starting at or above `lo`
export const tones = (c, lo, max = 4) => c.iv.slice(0, max).map((i) => wrap(c.root + i, lo)).sort((a, b) => a - b);
const low = (c, lo = 36) => wrap(c.root, lo);
// nearest chord tone (ties go up)
function snap(m, c) {
  let best = m, bd = 99;
  for (const i of c.iv) { const pc = (c.root + i) % 12, d = ((pc - (m % 12) + 18) % 12) - 6, n = m + d; if (Math.abs(d) < bd || (Math.abs(d) === bd && n > best)) { bd = Math.abs(d); best = n; } }
  return best;
}
// a motif: 'pos:degree:length ...' over two bars (pos 0..31 in sixteenths)
const mot = (s) => s.trim().split(/\s+/).map((w) => w.split(':').map(Number));
// play the theme's melody: a new two-bar line is chosen (and varied) at the top of each phrase
function melody(e, o) {
  const p = e.p, pos = (e.barIn % 2) * 16 + e.s, r = e.r;
  if (pos === 0) {
    const ms = o.motifs, m = ms[(p.phr + (r() < 0.3 ? 1 : 0)) % ms.length];
    p.phr++;
    const sh = r() < 0.3 ? [2, -1, 1][Math.floor(r() * 3)] : 0;
    p.line = [];
    for (const [at, d, len] of m) {
      if (at && r() < (o.drop ?? 0.1)) continue;
      p.line[at] = [d + sh, len];
      if (at > 0 && !p.line[at - 1] && r() < (o.grace ?? 0.08)) p.line[at - 1] = [d + sh + 1, 1];
    }
  }
  const n = p.line && p.line[pos];
  if (!n) return;
  let m = o.sc(n[0]) + (o.oct || 0);
  if (e.s % 4 === 0) m = snap(m, e.chord);
  o.voice(m, e.t, n[1] * e.spb * (o.legato ?? 0.92), o.vol);
}

// ---- the street: sections picked as it goes, by time of day and heat ----------------------------------
const STREET_LEADS = ['bell', 'saw', 'tri', 'square'];
const STREET = {
  bpm: 104, wet: 0.2, vol: 1,
  sec: {
    drive: prog('Am | F | C | G | Am | F | C | G'),
    sunny: prog('C | Em | F | G | Am | Em | F | G'),
    cruise: prog('F | G | Em | Am'),
    neon: prog('Am | Em | F | Dm | Am | Em | F | E'),
    rain: prog('Dm7 | Am7 | Fmaj7 | E7sus4 E7'),
    chase: prog('Am | Am | F | G | Am | Am | Bb | G'),
    lull: prog('Fmaj7 | G | Am | Am'),
  },
  lead: {
    sc: scale(9, 'min', 60),
    motifs: [mot('0:4:4 6:2:2 8:4:2 10:6:6 20:4:2 22:2:2 24:0:6'), mot('0:7:2 2:6:2 4:4:4 12:2:2 14:4:2 16:2:8 28:1:2 30:0:2'),
      mot('4:0:2 6:2:2 8:4:4 14:4:2 16:6:4 22:4:2 24:2:8'), mot('0:9:6 8:7:2 10:6:2 12:4:4 20:2:4 24:4:8'), mot('2:4:2 4:4:2 6:6:4 12:7:4 18:6:2 20:4:2 22:2:4 28:0:4')],
  },
  bpmFor(p, m) { return p.secKey === 'chase' ? 112 : m.night > 0.5 ? 96 : 104; },
  pick(p, m) {
    const night = m.night > 0.5, hot = m.wanted >= 2;
    if (!p.n) return night ? 'neon' : 'drive';
    let pool = hot ? ['chase', 'chase', 'drive', 'neon'] : night ? ['neon', 'rain', 'neon', 'lull', 'cruise', 'drive'] : ['drive', 'sunny', 'cruise', 'drive', 'lull', 'sunny'];
    if (m.wanted === 0) pool = pool.filter((k) => k !== 'chase').concat(['lull', 'cruise']);   // calmer with no heat
    let k = p.secKey;
    for (let i = 0; i < 6 && (k === p.secKey || (k === 'lull' && p.lastLull > p.n - 3)); i++) k = pool[Math.floor(p.r() * pool.length)];
    if (k === 'lull') p.lastLull = p.n;
    return k;
  },
  play(e, K) {
    const { t, s, chord: c, bus, spb, r, secKey: k, p, mood } = e, night = mood.night, calm = mood.wanted === 0 ? 0.8 : 1;
    if (s === 0 && e.barIn === 0) {
      p.v = { arp: r() < 0.75, lead: r() < 0.65, fill: r() < 0.6, ghost: r() < 0.5, hat16: r() < 0.4 };
      p.leadI = ((p.leadI ?? Math.floor(r() * 4)) + (r() < 0.6 ? 1 : 0)) % STREET_LEADS.length;
    }
    const v = p.v || {}, last = e.last && s >= 12 && v.fill && k !== 'lull' && k !== 'rain';
    const dr = calm * (night > 0.5 ? 0.85 : 1);
    // ---- drums, a different groove per section
    if (k === 'drive' || k === 'sunny' || k === 'chase') {
      if (s % 4 === 0 || (k === 'chase' && s === 14)) K.kick(t, 0.85 * dr, bus);
      if ((s === 4 || s === 12) && !last) { if (k === 'sunny') K.clap(t, 0.22 * dr, bus); else K.snare(t, 0.32 * dr, bus); }
      if (v.ghost && s === 7 && r() < 0.5) K.snare(t, 0.07 * dr, bus);
      if (k === 'chase' || v.hat16 ? true : s % 2 === 0) K.hat(t, (s % 4 === 2 ? 0.11 : 0.05) * dr, bus);
      if (k === 'sunny' && s === 14) K.hat(t, 0.06 * dr, bus, true);
    } else if (k === 'cruise') {
      if (s === 0 || s === 10) K.kick(t, 0.75 * dr, bus);
      if (s === 8 && !last) K.snare(t, 0.3 * dr, bus);
      if (s % 2 === 0) K.hat(t, (s % 4 === 2 ? 0.08 : 0.04) * dr, bus);
    } else if (k === 'neon') {
      if (s === 0 || s === 7 || (s === 10 && r() < 0.6)) K.kick(t, 0.7 * dr, bus);
      if (s === 12 && !last) K.snare(t, 0.24 * dr, bus);
      if (s === 4) K.rim(t, 0.12 * dr, bus);
      K.hat(t, (s % 4 === 2 ? 0.05 : 0.022) * dr, bus);
    } else if (k === 'rain') {
      if (e.barIn >= 2 || p.loop % 2) { if (s % 4 === 0) K.ride(t, 0.045 * dr, bus); if (s === 0) K.kick(t, 0.55 * dr, bus); if (s === 8) K.rim(t, 0.1 * dr, bus); }
    } else if (s % 4 === 2 && e.barIn >= 2) K.shaker(t, 0.03, bus);
    if (last) K.snare(t, (0.12 + (s - 12) * 0.05) * dr, bus);
    // ---- bass
    const b = low(c, k === 'chase' ? 33 : 36);
    if (k === 'drive') { const B = [0, null, 12, 0, null, 12, 0, 7, 0, null, 12, 0, 7, 12, 0, 12][s]; if (B !== null) K.bass(b + B, t, spb * 0.95, 0.28, bus, 900, 'sawtooth'); }
    else if (k === 'sunny') { if (s % 2 === 0) K.bass(b + (s % 4 === 2 ? 12 : 0), t, spb * 1.6, 0.26, bus, 1000, 'sawtooth'); }
    else if (k === 'cruise') { const B = { 0: 0, 6: 0, 10: 7, 14: 12 }[s]; if (B !== undefined) K.bass(b + B, t, spb * (s ? 3 : 6), 0.3, bus, 800, 'sawtooth'); }
    else if (k === 'neon') { if (s === 0) K.bass(b, t, spb * 11, 0.34, bus, 520); else if (s === 12) K.bass(b + 7, t, spb * 3.5, 0.24, bus, 520); }
    else if (k === 'rain') { if (s === 0) K.bass(b, t, spb * 15, 0.28, bus, 450); }
    else if (k === 'chase') K.bass(b + (s % 8 === 6 ? 12 : 0), t, spb * 0.8, 0.22, bus, 650 + (s % 4) * 220, 'sawtooth');
    else if (s === 0) K.bass(b, t, spb * 15, 0.22, bus, 380);
    // ---- pad: one chord per bar (or half bar), darker at night
    if (s === 0 || (s === 8 && e.bar.length === 2)) {
      const big = k === 'lull' || k === 'rain';
      K.pad(tones(c, 57, 3), t, spb * (e.bar.length === 2 ? 8.5 : 16.5), big ? 0.034 : 0.026, bus, (big ? 1500 : 1100) - night * 400, 'sawtooth', 7);
    }
    // ---- arpeggio
    if (v.arp && (k === 'drive' || k === 'sunny' || k === 'chase') && (e.loop > 0 || e.barIn >= 2)) {
      const ts = tones(c, 69, 3), A = k === 'sunny' ? [0, 1, 2, 1, 2, 0, 1, 2] : [0, 2, 1, 2, 0, 1, 2, 1];
      if (k !== 'sunny' || s % 2 === 0) K.pluck(ts[A[s % 8]] - (k === 'chase' ? 12 : 0), t, 0.14, 0.045, bus, 0.8, 'square');
    } else if ((k === 'neon' || k === 'lull') && s % 2 === 0 && (k === 'lull' || v.arp)) K.tone('triangle', tones(c, 69, 3)[(s >> 1) % 3], t, spb * 1.6, 0.035, bus, { att: 0.004 });
    // ---- lead (it changes voice from section to section)
    if (v.lead && k !== 'lull' && (e.barIn >= 2 || e.bars <= 4)) {
      const L = STREET_LEADS[p.leadI || 0];
      melody(e, { ...this.lead, oct: k === 'neon' || k === 'rain' ? -12 : 0, vol: L === 'bell' ? 0.07 : 0.05, voice: (m, tt, d, vv) => {
        if (L === 'bell') K.bell(m, tt, d * 1.6, vv, bus);
        else if (L === 'saw') K.horn(m, tt, d, vv * 0.8, bus, 1800 - night * 600);
        else if (L === 'tri') K.tone('triangle', m, tt, d, vv * 1.2, bus, { att: 0.02, sus: true });
        else K.chip('square', m, tt, d, vv * 0.6, bus);
      } });
    }
  },
};

// ---- Club Prism: its own phrase-built track lives in audio.js (it drives the dance floor's beat clock)

export const THEMES = {
  street: STREET,

  // The Velvet Flamingo: laid-back lounge soul. Electric piano, round bass, brushes.
  bar: {
    bpm: 84, wet: 0.2, vol: 1,
    sec: { A: prog('Fm9 | Bb9 | Ebmaj7 | Cm7'), B: prog('Abmaj7 | Gm7 C7 | Fm7 | Bb7sus4 Bb7'), C: prog('Dbmaj7 | Cm7 | Fm9 | Bb7') },
    form: ['A', 'A', 'B', 'A', 'C', 'B'],
    lead: { sc: scale(3, 'maj', 72), motifs: [mot('0:4:3 4:2:2 6:4:4 12:5:2 14:4:2 16:2:6 24:1:2 26:-1:4'), mot('2:0:2 4:2:2 6:4:6 16:6:3 20:4:2 22:2:6'), mot('0:7:4 6:6:2 8:4:4 14:2:2 16:4:8 28:2:4'), mot('4:4:2 6:5:2 8:7:6 18:5:2 20:4:2 22:2:8')] },
    play(e, K) {
      const { t, s, chord: c, bus, spb, r } = e;
      if (s === 0) for (const m of tones(c, 55)) K.ep(m, t, spb * 7, 0.042, bus);
      else if (s === 6 && r() < 0.65) for (const m of tones(c, 55)) K.ep(m, t, spb * 2, 0.026, bus);
      else if (s === 14 && e.next.name !== c.name && r() < 0.35) for (const m of tones(e.next, 55)) K.ep(m, t, spb * 2, 0.024, bus);
      const b = low(c);
      if (s === 0) K.bass(b, t, spb * 6, 0.32, bus, 650);
      else if (s === 7 && r() < 0.6) K.bass(b + 7, t, spb * 2, 0.2, bus, 650);
      else if (s === 10) K.bass(r() < 0.5 ? b + 12 : b, t, spb * 3, 0.22, bus, 650);
      else if (s === 14 && r() < 0.5) K.bass(low(e.next) + (r() < 0.5 ? 1 : -1), t, spb * 2, 0.18, bus, 650);
      if (s % 4 === 0) K.brush(t, 0.05, bus);
      if (s === 4 || s === 12) K.snare(t, 0.1, bus, { brush: true });
      if (s === 0 || (s === 10 && r() < 0.5)) K.kick(t, 0.42, bus);
      if (s % 4 === 2) K.hat(t, 0.018, bus);
      if (e.secKey !== 'A' || e.loop % 2 === 1 || e.formI === 3) melody(e, { ...this.lead, vol: 0.05, voice: (m, tt, d, v) => K.ep(m, tt, d, v, bus, 1) });
    },
  },

  // The Blue Pelican Lounge (when there are no records): a jazz combo. Walking bass, ride, piano comping,
  // a muted horn on the head (AABA).
  lounge: {
    bpm: 138, swing: 1, wet: 0.12, vol: 1,
    sec: { A: prog('Fmaj7 | D7 | Gm7 | C7 | Am7 D7 | Gm7 C7 | F6 Dm7 | Gm7 C7'), B: prog('Cm7 | F7 | Bbmaj7 | Bbmaj7 | Dm7 | G7 | Gm7 | C7') },
    form: ['A', 'A', 'B', 'A'],
    lead: { sc: scale(5, 'maj', 60), motifs: [mot('0:2:2 2:4:2 4:6:6 14:5:2 16:4:4 22:2:2 24:0:6'), mot('2:7:2 4:6:2 6:4:2 8:2:4 14:3:2 16:4:10'), mot('0:4:6 8:5:2 10:4:2 12:2:4 18:0:2 20:1:2 22:2:8'), mot('4:-1:2 6:0:2 8:2:2 10:4:4 16:6:2 18:4:2 20:2:4 26:4:6')] },
    play(e, K) {
      const { t, s, chord: c, bus, spb, r, p } = e, beat = s >> 2, n = e.bar.length;
      if (s % 4 === 0) {
        const first = beat === 0 || (n === 2 && beat === 2), before = beat === 3 || (n === 2 && beat === 1), root = low(c, 34);
        let m = root;
        if (!first && before) m = low(e.next, 34) + (r() < 0.5 ? -1 : 1);
        else if (!first) m = root + [c.iv[1], c.iv[2], c.iv[2] + 2, 12][Math.floor(r() * 4)];
        K.bass(m, t, spb * 3.4, 0.3, bus, 900);
      }
      if (s % 4 === 0) K.ride(t, beat % 2 ? 0.045 : 0.06, bus);
      if (s === 6 || s === 14) K.ride(t, 0.035, bus);
      if (s === 4 || s === 12) K.hat(t, 0.04, bus);
      if (s % 4 === 2 && r() < 0.12) K.snare(t, 0.04, bus, { brush: true });
      if (s === 0 && r() < 0.06) K.kick(t, 0.35, bus);
      if (s === 0) p.comp = [[0, 6], [6, 14], [2, 10], [4, 14], [0, 10], [6]][Math.floor(r() * 6)];
      if (p.comp && p.comp.includes(s)) {
        const iv = c.iv, v = [iv[1], iv[2], iv[3] ?? 12, 14].map((i) => wrap(c.root + i, 53)).sort((a, b) => a - b);
        for (const m of v) K.ep(m, t, spb * (s % 4 ? 1.6 : 2.6), 0.028, bus, 1);
      }
      const horn = e.secKey === 'A' ? !(e.formI === 1 && e.loop % 2 === 1) : e.loop % 2 === 1;
      melody(e, { ...this.lead, vol: horn ? 0.06 : 0.04, voice: horn ? (m, tt, d, v) => K.horn(m, tt, d, v, bus, 950) : (m, tt, d, v) => K.ep(m + 12, tt, d, v, bus, 1) });
    },
  },

  // The Sunset Strip Diner: a jukebox shuffle. Doo-wop changes, then a twelve-bar with a sax riff.
  diner: {
    bpm: 164, swing: 1, wet: 0.1, vol: 0.95,
    sec: { A: prog('C | Am | F | G'), B: prog('C7 | F7 | C7 | C7 | F7 | F7 | C7 | C7 | G7 | F7 | C7 | G7') },
    form: ['A', 'A', 'B', 'A', 'B'],
    lead: { sc: scale(0, 'maj', 72), motifs: [mot('0:4:4 4:5:2 6:4:2 8:2:4 16:0:2 18:2:2 20:4:8'), mot('0:7:6 8:6:2 10:4:2 12:2:2 14:0:2 16:2:12'), mot('4:4:2 6:4:2 8:5:2 10:6:2 12:7:4 20:4:8')] },
    riff: mot('0:3:1 1:4:3 4:7:2 6:9:2 8:10:2 10:9:2 12:7:4'), answer: mot('4:12:2 6:10:2 8:7:2 10:4:2 12:0:4'),
    play(e, K) {
      const { t, s, chord: c, bus, spb, r } = e, B = e.secKey === 'B', beat = s >> 2;
      if (s === 0 || s === 8) K.kick(t, 0.6, bus);
      if (s === 4 || s === 12) { K.snare(t, 0.2, bus); if (B) K.clap(t, 0.08, bus); }
      if (s % 2 === 0) K.hat(t, s % 4 === 2 ? 0.05 : 0.035, bus);
      if (s % 4 === 0) {
        const off = B ? (e.barIn % 2 ? [10, 9, 7, 4] : [0, 4, 7, 9])[beat] : [0, 7, 9, 7][beat];
        K.bass(low(c, 36) + off, t, spb * 2.6, 0.3, bus, 1100);
        K.noise(t, 0.05, 0.03, 'bandpass', 1800, bus, { q: 2 });
      }
      if (!B) {
        if (s % 2 === 0) for (const m of tones(c, 60, 3)) K.ep(m, t, spb * 1.5, 0.014, bus, 1);
        if (s === 0) K.pad(tones(c, 60, 3), t, spb * 16, 0.016, bus, 1400, 'triangle');
        if (e.formI > 0) melody(e, { ...this.lead, vol: 0.05, voice: (m, tt, d, v) => K.horn(m - 12, tt, d, v, bus, 1900) });
      } else {
        if (s === 6 || s === 14) for (const m of tones(c, 60, 4)) K.ep(m, t, spb * 1.2, 0.02, bus, 1);
        const pos = s, line = e.barIn % 2 ? (r() < 0.8 ? this.answer : null) : this.riff;
        if (line && e.barIn < 11) for (const [at, d, len] of line) if (at === pos) K.horn(wrap(c.root, 58) + d, t, len * spb * 0.9, 0.05, bus, 1900);
      }
    },
  },

  // The Seahorse Arcade: chiptune (square lead, triangle bass, noise drums).
  arcade: {
    bpm: 144, wet: 0.08, vol: 0.85,
    sec: { A: prog('Em | C | G | D'), B: prog('Am | Em | C | B7'), C: prog('C | D | Em | Em') },
    form: ['A', 'A', 'B', 'C'],
    lead: { sc: scale(4, 'min', 72), motifs: [mot('0:0:2 2:2:2 4:4:4 8:3:2 10:2:2 12:4:4 16:7:6 24:6:2 26:4:6'), mot('0:4:1 1:5:1 2:7:2 4:4:2 6:2:2 8:0:4 14:2:2 16:4:4 20:2:2 22:1:2 24:-1:8'), mot('0:7:4 4:9:4 8:7:2 10:6:2 12:4:4 16:2:2 18:4:2 20:2:2 22:0:10')] },
    play(e, K) {
      const { t, s, chord: c, bus, spb } = e;
      if (s === 0 || s === 8 || (s === 10 && e.secKey === 'B')) K.kick(t, 0.55, bus, 220, 50, 0.12);
      if (s === 4 || s === 12) K.noise(t, 0.14, 0.09, 'highpass', 1500, bus);
      if (s % 2 === 0) K.noise(t, 0.025, 0.02, 'highpass', 8000, bus);
      if (s % 2 === 0) K.chip('triangle', low(c, 40) + (s % 4 === 2 ? 12 : 0), t, spb * 1.7, 0.22, bus);
      if (e.secKey !== 'A' || e.loop > 0) K.chip('square', tones(c, 64, 3)[s % 3], t, spb * 0.8, 0.018, bus);
      if (e.secKey !== 'C' || e.barIn >= 2) melody(e, { ...this.lead, vol: e.secKey === 'C' ? 0.03 : 0.045, oct: e.secKey === 'B' && e.loop % 2 ? 12 : 0, voice: (m, tt, d, v) => K.chip('square', m, tt, d, v, bus) });
    },
  },
  // Skate Surge, the cabinet game: a quicker, busier little loop while you play
  arcadeGame: {
    bpm: 168, wet: 0.05, vol: 0.85,
    sec: { A: prog('G | Em | C | D'), B: prog('C | D | Bm | Em') },
    form: ['A', 'B'],
    lead: { sc: scale(7, 'maj', 72), motifs: [mot('0:0:1 1:2:1 2:4:2 4:7:2 6:4:2 8:5:4 12:4:2 14:2:2 16:0:1 17:2:1 18:4:2 20:2:2 22:1:2 24:-1:4'), mot('0:4:2 2:4:1 3:5:1 4:7:4 8:9:2 10:7:2 12:4:4 16:5:2 18:4:2 20:2:2 22:4:2 24:0:6')] },
    play(e, K) {
      const { t, s, chord: c, bus, spb } = e;
      if (s % 4 === 0) K.kick(t, 0.5, bus, 230, 50, 0.1);
      if (s === 4 || s === 12) K.noise(t, 0.13, 0.08, 'highpass', 1800, bus);
      K.noise(t, s % 2 ? 0.012 : 0.022, 0.015, 'highpass', 9000, bus);
      if (s % 2 === 0) K.chip('triangle', low(c, 40) + (s % 4 === 2 ? 12 : 0), t, spb * 1.6, 0.22, bus);
      K.chip('square', tones(c, 67, 3)[[0, 1, 2, 1][s % 4]], t, spb * 0.7, 0.014, bus);
      melody(e, { ...this.lead, vol: 0.045, drop: 0.05, voice: (m, tt, d, v) => K.chip('square', m, tt, d, v, bus) });
    },
  },

  // Zigzag Threads: bright boutique synth-pop.
  wear: {
    bpm: 118, wet: 0.22, vol: 0.9,
    sec: { A: prog('Gmaj7 | A | F#m7 | Bm7'), B: prog('Em7 | F#m7 | Gmaj7 | A'), C: prog('Gmaj7 | Gmaj7 | A6 | A') },
    form: ['A', 'B', 'A', 'B', 'C'],
    lead: { sc: scale(2, 'maj', 72), motifs: [mot('0:4:2 2:4:2 4:5:2 6:4:4 12:2:2 14:1:2 16:2:6 24:4:2 26:2:6'), mot('0:7:4 4:6:2 6:4:2 8:6:4 12:4:4 16:2:2 18:4:2 20:5:4 24:4:8'), mot('2:0:2 4:2:2 6:4:2 8:7:6 16:6:2 18:7:2 20:6:2 22:4:10')] },
    play(e, K) {
      const { t, s, chord: c, bus, spb } = e, C = e.secKey === 'C';
      if (C ? s === 0 || (e.barIn >= 2 && s % 4 === 0) : s % 4 === 0) K.kick(t, 0.7, bus);
      if ((s === 4 || s === 12) && !(C && e.barIn < 2)) K.clap(t, 0.16, bus);
      K.hat(t, s % 2 ? 0.018 : 0.035, bus);
      if (e.secKey === 'B' && s % 4 === 2) K.hat(t, 0.04, bus, true);
      if (!C) { if (s % 2 === 0) K.bass(low(c, 38) + (s % 4 === 2 ? 12 : 0), t, spb * 1.7, 0.2, bus, 900, 'sawtooth'); }
      else if (s === 0) K.bass(low(c, 38), t, spb * 15, 0.22, bus, 600, 'sawtooth');
      if (!C && s % 4 === 2) K.pad(tones(c, 62, 4), t, spb * 1.3, 0.014, bus, 2600);
      if (C && s === 0) K.pad(tones(c, 62, 4), t, spb * 16, 0.018, bus, 1700, 'sawtooth', 6);
      if (e.secKey !== 'A' || e.loop > 0) K.pluck(tones(c, 74, 3)[[0, 1, 2, 1][s % 4]], t, spb * 0.8, 0.022, bus, 1, 'square');
      if (!C) melody(e, { ...this.lead, vol: 0.06, oct: e.secKey === 'B' && e.loop % 2 ? 12 : 0, voice: (m, tt, d, v) => K.bell(m, tt, d * 1.3, v, bus) });
    },
  },

  // Pelican Pantry 24: easy-listening store muzak (bossa-ish, vibes and nylon plucks).
  mart: {
    bpm: 96, wet: 0.2, vol: 0.9,
    sec: { A: prog('Fmaj7 | Em7 A7 | Dm7 | Gm7 C7'), B: prog('Bbmaj7 | Am7 | Gm7 | C7sus4 C7') },
    form: ['A', 'A', 'B', 'A'],
    lead: { sc: scale(5, 'maj', 60), motifs: [mot('0:4:6 6:2:2 8:4:2 10:5:4 16:4:4 20:2:4 24:0:8'), mot('2:2:2 4:4:2 6:6:6 16:5:2 18:4:2 20:2:10'), mot('0:7:4 4:6:2 6:4:6 16:2:2 18:4:2 20:5:2 22:4:8')] },
    play(e, K) {
      const { t, s, chord: c, bus, spb, r } = e, b = low(c, 36), bar2 = e.barIn % 2;
      const B = { 0: 0, 6: 7, 8: 0, 14: 7 }[s];
      if (B !== undefined) K.bass(b + B, t, spb * (s === 0 || s === 8 ? 5 : 2), 0.24, bus, 520);
      if ((bar2 ? [4, 10] : [0, 6, 12]).includes(s)) K.rim(t, 0.06, bus);
      K.shaker(t, s % 4 === 0 ? 0.022 : 0.012, bus);
      if ((bar2 ? [2, 8, 12] : [0, 6, 10]).includes(s)) for (const m of tones(c, 55, 4)) K.pluck(m, t, spb * 3, 0.022, bus, 0.25, 'triangle');
      if (e.secKey === 'B' && s === 0) K.pad(tones(c, 60, 3), t, spb * 16, 0.012, bus, 900);
      if (e.secKey === 'A' || e.loop % 2) melody(e, { ...this.lead, vol: 0.055, voice: (m, tt, d, v) => K.bell(m, tt, d * 1.8, v, bus) });
      else if (s % 4 === 0 && r() < 0.3) K.bell(tones(c, 72, 4)[Math.floor(r() * 4)], t, spb * 6, 0.025, bus);
    },
  },

  // Volt & Spark Supply: a tense electro / industrial pulse.
  arms: {
    bpm: 126, wet: 0.14, vol: 0.85,
    sec: { A: prog('Em | Em | F | Em'), B: prog('C | D | F | B'), C: prog('Em | F | Em | F') },
    form: ['A', 'B', 'A', 'C'],
    lead: { sc: scale(4, 'phr', 60), motifs: [mot('0:7:6 8:8:2 10:7:6 24:5:4 28:4:4'), mot('0:4:2 4:4:2 8:5:4 16:4:2 20:3:2 24:1:8'), mot('0:7:2 2:8:2 4:7:4 12:5:4 16:4:12')] },
    play(e, K) {
      const { t, s, chord: c, bus, spb, r, p } = e, C = e.secKey === 'C';
      if (s % 4 === 0 && !(C && e.barIn < 2 && s)) K.kick(t, 0.85, bus, 120, 38, 0.3);
      if ((s === 4 || s === 12) && !(C && e.barIn < 2)) K.snare(t, 0.2, bus);
      if ((s === 7 || s === 15) && r() < 0.6) K.metal(t, 0.07, bus);
      K.hat(t, s % 4 === 2 ? 0.045 : 0.02, bus);
      const i = e.barIn * 16 + s;
      K.bass(low(c, 33) + (s % 4 === 3 ? 12 : 0), t, spb * 0.85, 0.2, bus, 300 + 1300 * (0.5 + 0.5 * Math.sin(i / 32 * Math.PI * 2)), 'sawtooth');
      if (e.secKey === 'B' || (e.secKey === 'A' && e.loop % 2)) melody(e, { ...this.lead, vol: 0.04, voice: (m, tt, d, v) => K.horn(m, tt, d, v, bus, 2400) });
      if (C && s === 0) K.tone('triangle', low(c, 64) + (e.barIn % 2 ? 1 : 0), t, spb * 15, 0.04, bus, { att: 0.3, sus: true });
      if (C && e.last && s === 0 && p) K.riser(t, spb * 16, bus);
    },
  },

  // Moonlite Motor Inn, room 7: a mellow late-night slow tune.
  motel: {
    bpm: 68, swing: 0.5, wet: 0.3, vol: 1,
    sec: { A: prog('Dbmaj7 | Cm7 | Bbm7 | Ebm7 Ab7'), B: prog('Gbmaj7 | Fm7 | Ebm7 | Ab7sus4 Ab7') },
    form: ['A', 'A', 'B', 'A'],
    lead: { sc: scale(1, 'maj', 60), motifs: [mot('0:4:6 8:2:2 10:1:2 12:2:12'), mot('4:4:2 6:5:2 8:4:8 20:2:2 22:0:8'), mot('0:7:4 4:6:4 8:4:16')] },
    play(e, K) {
      const { t, s, chord: c, bus, spb, r } = e;
      if (s === 0 || (s === 8 && e.bar.length === 2)) for (const m of tones(c, 55)) K.ep(m, t, spb * (e.bar.length === 2 ? 8 : 15), 0.036, bus);
      else if (s === 10 && e.bar.length === 1 && r() < 0.4) for (const m of tones(c, 55)) K.ep(m, t, spb * 4, 0.02, bus);
      const b = low(c);
      if (s === 0) K.bass(b, t, spb * 7, 0.3, bus, 520);
      else if (s === 8) K.bass(e.bar.length === 2 ? low(c) : b + (r() < 0.5 ? 7 : 0), t, spb * 5, 0.24, bus, 520);
      else if (s === 14 && r() < 0.3) K.bass(low(e.next) - 1, t, spb * 2, 0.16, bus, 520);
      if (s === 0) K.kick(t, 0.3, bus);
      if (s === 8) K.snare(t, 0.08, bus, { brush: true });
      if (s % 4 === 0) K.brush(t, 0.03, bus);
      if (s === 12 && r() < 0.2) K.rim(t, 0.05, bus);
      if ((e.formI === 1 || e.formI === 2) || e.loop % 2) melody(e, { ...this.lead, vol: 0.05, drop: 0.15, voice: (m, tt, d, v) => K.tone('triangle', m, tt, d, v, bus, { cut: 1800, att: 0.07, sus: true }) });
    },
  },

  // The Solstice Terrace (and the Spire's lobby): a mellow downtempo sunset groove. A warm pad, offbeat
  // electric-piano stabs, a round lazy bass, rim clicks and a shaker, a vibes arpeggio, a soft flute-ish line.
  rooftop: {
    bpm: 86, swing: 0.35, wet: 0.34, vol: 1,
    sec: { A: prog('Ebmaj9 | Gm7 | Abmaj7 | Bb7sus4 Bb7'), B: prog('Cm9 | Abmaj9 | Fm9 | Bb7sus4'), C: prog('Abmaj7 | Gm7 | Fm7 | Ebmaj9') },
    form: ['A', 'A', 'B', 'A', 'C', 'B'],
    lead: { sc: scale(3, 'maj', 72), motifs: [mot('0:4:4 6:2:2 8:1:4 14:2:2 16:4:10 28:6:4'), mot('2:7:2 4:6:2 6:4:6 16:2:4 20:4:2 22:2:8'), mot('0:9:6 8:7:2 10:6:2 12:4:8 24:2:6'), mot('4:2:2 6:4:2 8:5:6 16:4:4 20:2:2 22:1:2 24:0:8')] },
    play(e, K) {
      const { t, s, chord: c, bus, spb, r } = e, night = (e.mood && e.mood.night) || 0;
      if (s === 0 || (s === 8 && e.bar.length === 2)) K.pad(tones(c, 55, 4), t, spb * (e.bar.length === 2 ? 8 : 16), 0.017, bus, 1350 - night * 350, 'triangle');
      if ((s === 2 || s === 10) && r() < 0.75) for (const m of tones(c, 60, 3)) K.ep(m, t, spb * 1.4, 0.021, bus, 0.4);
      const b = low(c);
      if (s === 0) K.bass(b, t, spb * 5, 0.27, bus, 480);
      else if (s === 6 && r() < 0.55) K.bass(b + 7, t, spb * 1.5, 0.15, bus, 480);
      else if (s === 10) K.bass(e.bar.length === 2 ? low(c) : b, t, spb * 3, 0.21, bus, 480);
      else if (s === 14 && r() < 0.4) K.bass(low(e.next) + (r() < 0.5 ? 2 : -1), t, spb * 1.5, 0.14, bus, 480);
      if (s === 0) K.kick(t, 0.3, bus);
      else if (s === 7 && r() < 0.35) K.kick(t, 0.16, bus);
      else if (s === 10) K.kick(t, 0.2, bus);
      if (s === 4 || s === 12) K.rim(t, 0.045, bus);
      if (s % 2 === 0) K.shaker(t, s % 4 === 2 ? 0.014 : 0.008, bus);
      if (s === 14 && r() < 0.3) K.hat(t, 0.012, bus, true);
      if (s % 2 === 0 && (e.secKey !== 'A' || e.loop % 2)) K.bell(tones(c, 72, 4)[(s >> 1) % 4], t, spb * 3, 0.009, bus);
      if (e.secKey !== 'B' || e.loop % 2) melody(e, { ...this.lead, vol: 0.042, drop: 0.2, voice: (m, tt, d, v) => K.tone('triangle', m, tt, d, v, bus, { cut: 2200 - night * 500, att: 0.06, sus: true }) });
    },
  },

  // Seafoam Galleria: airy mall ambience, a soft bell melody over a slow pad.
  mall: {
    bpm: 84, wet: 0.4, vol: 0.95,
    sec: { A: prog('Cmaj9 | D | Bm7 | Em7'), B: prog('Fmaj7 | G | Em7 | Am7') },
    form: ['A', 'B', 'A', 'B'],
    lead: { sc: scale(0, 'maj', 72), motifs: [mot('0:4:6 8:6:4 16:4:8 28:2:4'), mot('4:2:4 8:4:4 12:7:8 24:6:8'), mot('0:9:8 8:7:4 16:4:12')] },
    play(e, K) {
      const { t, s, chord: c, bus, spb, r } = e;
      if (s === 0) { K.pad(tones(c, 57, 4), t, spb * 17, 0.02, bus, 1500, 'triangle'); K.bass(low(c, 36), t, spb * 15, 0.2, bus, 380); }
      if (s % 2 === 0 && r() < 0.12) K.bell(tones(c, 79, 4)[Math.floor(r() * 4)], t, spb * 8, 0.014, bus);
      if (s % 2 === 0) K.shaker(t, 0.01, bus);
      if (e.secKey === 'B' && s === 0) K.kick(t, 0.16, bus);
      if (e.secKey === 'A' || e.loop % 2) melody(e, { ...this.lead, vol: 0.045, drop: 0.15, voice: (m, tt, d, v) => K.bell(m, tt, d * 2, v, bus) });
    },
  },

  // Starboard Bait & Tackle: gentle country / folk. Fingerpicked guitar, harmonica.
  bait: {
    bpm: 100, swing: 0.6, wet: 0.14, vol: 1,
    sec: { A: prog('G | C | G | D'), B: prog('C | G | Em | D'), C: prog('G | C | D | G') },
    form: ['A', 'B', 'A', 'C'],
    lead: { sc: scale(7, 'maj', 60), motifs: [mot('0:4:4 4:2:2 6:4:2 8:5:4 12:4:4 16:2:6 22:0:2 24:2:8'), mot('2:0:2 4:2:2 6:4:6 16:4:2 18:2:2 20:1:2 22:0:10'), mot('0:7:6 8:6:2 10:4:2 12:2:4 16:4:12')] },
    play(e, K) {
      const { t, s, chord: c, bus, spb } = e, b = low(c, 40), up = tones(c, 55, 3);
      if (s === 0) K.pluck(b, t, spb * 7, 0.07, bus, 0.35, 'triangle');
      if (s === 8) K.pluck(b + 7 - (b + 7 > 52 ? 12 : 0), t, spb * 7, 0.06, bus, 0.35, 'triangle');
      if (s === 4 || s === 12) K.pluck(b + 12, t, spb * 3, 0.04, bus, 0.4, 'triangle');
      if (s % 4 === 2) K.pluck(up[(s >> 2) % 3], t, spb * 3, 0.035, bus, 0.55);
      if (s === 0) K.bass(b - 12 < 33 ? b : b - 12, t, spb * 6, 0.14, bus, 400);
      if (s === 0 || s === 8) K.kick(t, 0.22, bus);
      if (s === 4 || s === 12) K.snare(t, 0.07, bus, { brush: true });
      if (s % 2 === 0) K.shaker(t, s % 4 === 2 ? 0.02 : 0.01, bus);
      if (e.secKey !== 'C') melody(e, { ...this.lead, vol: 0.045, voice: (m, tt, d, v) => K.harp(m, tt, d, v, bus) });
      else if (s === 0) for (const m of tones(c, 64, 2)) K.harp(m, t, spb * 14, 0.025, bus);
    },
  },

  // Starlight Pier: a carnival galop on a band-organ sound. Oom-pah bass and chords, a bright piping melody
  // with quick turns, glockenspiel sparkles, a woodblock and a cymbal splash at the end of a phrase.
  pier: {
    bpm: 128, wet: 0.16, vol: 0.85,
    sec: { A: prog('C | G7 | C | G7'), B: prog('F | C | D7 | G7'), C: prog('Am | E7 | Am | G7'), D: prog('C | F | G7 | C') },
    form: ['A', 'B', 'A', 'D', 'C', 'C', 'A', 'D'],
    lead: { sc: scale(0, 'maj', 72), motifs: [mot('0:4:2 2:5:2 4:4:2 6:2:2 8:0:4 12:2:2 14:4:2 16:7:4 20:6:2 22:5:2 24:4:8'), mot('0:7:2 2:9:2 4:7:2 6:4:2 8:5:2 10:4:2 12:2:4 16:4:2 18:2:2 20:1:2 22:2:2 24:0:8'),
      mot('0:2:1 1:3:1 2:4:2 4:7:4 8:6:1 9:5:1 10:4:2 12:2:4 16:0:2 18:2:2 20:4:2 22:7:2 24:9:4 28:7:4')], drop: 0.06, grace: 0.12 },
    play(e, K) {
      const { t, s, chord: c, bus, spb, r } = e, minor = e.secKey === 'C';
      // oom (bass on the beat) - pah (a short organ chord on the off-beat)
      if (s === 0 || s === 8) K.bass(low(c, 36) + (s === 8 ? 7 : 0) - (s === 8 && low(c, 36) + 7 > 47 ? 12 : 0), t, spb * 2.6, 0.22, bus, 650, 'triangle');
      if (s === 4 || s === 12) for (const m of tones(c, 60, 3)) K.tone('square', m, t, spb * 1.4, 0.016, bus, { cut: 1900, att: 0.004 });
      if (s % 4 === 2 && r() < 0.5) K.tone('square', tones(c, 67, 3)[(s >> 2) % 3], t, spb * 0.8, 0.008, bus, { cut: 2600 });
      if (s === 0 || s === 8) K.kick(t, 0.22, bus, 120, 50, 0.16);
      if (s === 4 || s === 12) K.noise(t, 0.05, 0.05, 'bandpass', 3000, bus, { q: 4 });          // woodblock-ish
      if (e.last && s === 12) K.noise(t, 0.05, 0.6, 'highpass', 6500, bus);                       // a splash at the end of the section
      if (s % 2 === 0 && r() < (minor ? 0.08 : 0.16)) K.bell(tones(c, 84, 3)[Math.floor(r() * 3)], t, spb * 3, 0.012, bus);
      // the piping lead: a square through a band-pass with a fast vibrato-ish detune, an octave doubling on the B section
      melody(e, { ...this.lead, vol: 0.04, oct: minor ? -1 : 0, voice: (m, tt, d, v) => { K.tone('square', m, tt, d, v, bus, { cut: 2400, ftype: 'bandpass', q: 0.8, att: 0.01, sus: true, det: 6 }); if (e.secKey === 'B') K.tone('triangle', m + 12, tt, d, v * 0.5, bus, { att: 0.01 }); } });
    },
  },
};
// which theme plays in which place (places and venues by key)
export const THEME_OF = { bar: 'bar', club: 'club', lounge: 'lounge', diner: 'diner', arcade: 'arcade', wear: 'wear', mart: 'mart', arms: 'arms', motel: 'motel', mall: 'mall', bait: 'bait', spire: 'rooftop', terrace: 'rooftop', pier: 'pier' };
