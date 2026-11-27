// All sound is synthesised with Web Audio: the street score and one theme per indoor place (audio/themes.js,
// crossfaded on the way in and out), Club Prism's phrase-built track, plus engine, rotor, skates, rain and
// explosions. The one exception is the Blue Pelican Lounge, which streams recorded tracks from assets/music
// (audio/music.js) through recordBus() when there are any.
// Music on / off (M): the street music plays for a couple of minutes after the start, then fades out and
// stays off unless the player turns it back on; the player's choice is remembered (localStorage).
import { BPM } from '../core/util.js';
import { THEMES } from './themes.js';
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const STEP = 60 / BPM / 4;
// Am - F - C - G, root as a MIDI note and whether the third is minor
const CHORDS = [{ root: 45, third: 3 }, { root: 41, third: 4 }, { root: 48, third: 4 }, { root: 43, third: 4 }];
const MUSIC_KEY = 'neon-coast-music';
const AUTO_OFF = 150;                 // seconds of street music after the start before it fades out
// Engine characters, one per vehicle type (vehicles/types.js `sound`). Deliberately soft and smooth: two
// oscillators (t1, and t2 at r2 times the pitch) through a low-pass that opens from `cut` by `cutRev` with the
// revs; the pitch glides continuously from `base` up by `span` with the (smoothed) revs: no gear steps, no
// amplitude pulsing (an earlier design stepped through gears and wobbled the level at a fraction of the
// pitch, which chopped and stuttered when you lifted off). Character is only base pitch, timbre (`q`, the
// filter's resonance, and `grit`, a little band of noise mixed under it for the diesels) and loudness (`gain`).
// The sense of speed comes from a quiet tyre-and-wind noise layer that rises with speed. The level rule is the
// same for all: louder while the revs change, settling to a soft hum at a steady cruise, ducked under the music.
export const ENGINES = {
  sedan: { t1: 'sawtooth', t2: 'triangle', r2: 0.5, base: 48, span: 92, cut: 210, cutRev: 700, q: 0.8, grit: 0, gain: 1 },
  taxi: { t1: 'sawtooth', t2: 'triangle', r2: 0.5, base: 46, span: 84, cut: 220, cutRev: 640, q: 0.9, grit: 0, gain: 0.95 },
  hatch: { t1: 'sawtooth', t2: 'triangle', r2: 1, base: 64, span: 120, cut: 320, cutRev: 1000, q: 0.9, grit: 0, gain: 0.8 },
  sports: { t1: 'sawtooth', t2: 'sawtooth', r2: 2, base: 58, span: 170, cut: 360, cutRev: 1500, q: 1.2, grit: 0, gain: 0.8 },
  v8: { t1: 'sawtooth', t2: 'triangle', r2: 0.5, base: 34, span: 62, cut: 170, cutRev: 480, q: 1.6, grit: 0, gain: 1.15 },
  pickup: { t1: 'sawtooth', t2: 'triangle', r2: 0.5, base: 38, span: 64, cut: 190, cutRev: 520, q: 1.1, grit: 0.03, gain: 1.05 },
  suv: { t1: 'sawtooth', t2: 'triangle', r2: 0.5, base: 42, span: 72, cut: 200, cutRev: 560, q: 1, grit: 0.02, gain: 1 },
  van: { t1: 'triangle', t2: 'sawtooth', r2: 0.5, base: 42, span: 66, cut: 230, cutRev: 560, q: 0.9, grit: 0.05, gain: 1 },
  diesel: { t1: 'triangle', t2: 'sawtooth', r2: 0.5, base: 34, span: 50, cut: 240, cutRev: 520, q: 0.9, grit: 0.08, gain: 1 },
  bus: { t1: 'triangle', t2: 'sawtooth', r2: 0.5, base: 30, span: 38, cut: 200, cutRev: 420, q: 0.8, grit: 0.1, gain: 1.05 },
  scooter: { t1: 'triangle', t2: 'square', r2: 2, base: 88, span: 130, cut: 700, cutRev: 1100, q: 0.7, grit: 0, gain: 0.55 },
  comet: { t1: 'sawtooth', t2: 'triangle', r2: 0.5, base: 56, span: 120, cut: 250, cutRev: 1000, q: 1, grit: 0, gain: 0.95 },
  tank: { t1: 'sawtooth', t2: 'triangle', r2: 0.5, base: 32, span: 36, cut: 200, cutRev: 600, q: 0.9, grit: 0.05, gain: 1 },
  // on the water (vehicles/boatmodels.js): the runabout's outboard buzz, the yachts' deep inboards, the jet ski's
  // high two-stroke; the water rushing past and the slap of the waves are their own layers (update: s.boat)
  outboard: { t1: 'sawtooth', t2: 'square', r2: 2, base: 66, span: 150, cut: 360, cutRev: 1300, q: 1.1, grit: 0.02, gain: 0.8 },
  inboard: { t1: 'sawtooth', t2: 'triangle', r2: 0.5, base: 34, span: 54, cut: 170, cutRev: 470, q: 1.5, grit: 0.03, gain: 1.15 },
  jetski: { t1: 'sawtooth', t2: 'square', r2: 2, base: 92, span: 205, cut: 560, cutRev: 1800, q: 0.8, grit: 0.04, gain: 0.62 },
};

export function createAudio() {
  let ctx = null, master, music, mfilt, sfx, noise, arpBus, space, timer = 0, nextT = 0, song = 0;
  // music state: on (the player's switch), keep (street music stays on, no auto-off), fired (the auto-off happened)
  let pref = null;
  try { pref = localStorage.getItem(MUSIC_KEY); } catch (e) { pref = null; }
  const mus = { on: pref !== 'off', keep: pref === 'on', fired: false, until: AUTO_OFF, slow: false };
  const players = [];                 // themes playing now (two while crossfading)
  const savePref = (v) => { try { localStorage.setItem(MUSIC_KEY, v); } catch (e) { /* private mode */ } };
  let hull = null, purr = null, eng, rotor, skate, rain, siren, hum, spray, fire, uw, ufilt, water, waves, heyT = 0, zapT = 0, splashT = 0;
  const A = {
    muted: false, ready: false,
    start() {
      if (ctx) { ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { ctx = null; return; }
      master = ctx.createGain(); master.gain.value = 0.85;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      // everything runs through one low-pass that closes when the camera is under the water (muffled sea)
      ufilt = ctx.createBiquadFilter(); ufilt.type = 'lowpass'; ufilt.frequency.value = 22000; ufilt.Q.value = 0.6;
      master.connect(ufilt); ufilt.connect(comp); comp.connect(ctx.destination);
      music = ctx.createGain(); music.gain.value = 0.55;
      // the music bus runs through a low-pass so shops get a muffled radio and Club Prism gets the full system
      mfilt = ctx.createBiquadFilter(); mfilt.type = 'lowpass'; mfilt.frequency.value = 16000; mfilt.Q.value = 0.4;
      music.connect(mfilt); mfilt.connect(master);
      sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
      // 2 s of white noise shared by drums, rain, skates, rotor, explosions
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // echo for the pluck arp
      arpBus = ctx.createGain(); arpBus.connect(music);
      const dl = ctx.createDelay(1); dl.delayTime.value = STEP * 3;
      const fb = ctx.createGain(); fb.gain.value = 0.36;
      arpBus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(music);
      // a soft echo the themes send to (its time follows the current theme's tempo)
      space = ctx.createDelay(1.5); space.delayTime.value = 0.36;
      { const sf = ctx.createGain(), lp = ctx.createBiquadFilter(); sf.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 2600;
        space.connect(lp); lp.connect(sf); sf.connect(space); lp.connect(music); }

      const loop = (filterType, freq, q = 0.7) => {
        const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(sfx); src.start();
        return { f, g };
      };
      skate = loop('bandpass', 700, 0.8);
      // rain, in layers on its own bus: a soft broadband wash, a low rumble for storms, droplet ticks scheduled
      // at random (update()), all through one low-pass that muffles it in a car or indoors
      rain = { bus: ctx.createGain(), f: ctx.createBiquadFilter(), ticks: 0, tickT: 0, where: 'out', n: 0, last: {} };
      rain.f.type = 'lowpass'; rain.f.frequency.value = 9000; rain.f.Q.value = 0.5; rain.bus.gain.value = 1;
      rain.bus.connect(rain.f); rain.f.connect(sfx);
      { const mkL = (type, freq, q) => { const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true; src.playbackRate.value = 0.5 + Math.random() * 0.1;
          const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0;
          src.connect(f); f.connect(g); g.connect(rain.bus); src.start(); return { f, g }; };
        rain.wash = mkL('bandpass', 1500, 0.35); rain.hiss = mkL('lowpass', 5200, 0.3); rain.rumble = mkL('lowpass', 160, 0.6); rain.drum = mkL('bandpass', 420, 0.8); }
      spray = loop('bandpass', 1900, 0.5);
      // at home (game/homes.js): a shower or a bath running, and the waves round the houseboat's hull
      water = loop('highpass', 2400, 0.4); waves = loop('lowpass', 420, 0.6);
      // a boat under way: the hull's rush through the water (a low band) and the hiss of the spray (a high one)
      hull = { rush: loop('bandpass', 420, 0.6), hiss: loop('highpass', 2800, 0.5) };
      // a burning car: low crackling noise, its level jittered every frame
      fire = loop('bandpass', 700, 0.45);
      // a cat's purr: low noise pulsed ~24 times a second, breathing in and out (s.purr from actors/cat.js)
      { const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; f.Q.value = 1.2;
        const am = ctx.createGain(); am.gain.value = 0.5; const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 24; const dep = ctx.createGain(); dep.gain.value = 0.5;
        lfo.connect(dep); dep.connect(am.gain); lfo.start();
        const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(am); am.connect(g); g.connect(sfx); src.start(); purr = { g, lfo }; }
      // the low rumble of being under the sea
      uw = loop('lowpass', 220, 0.5);
      // vending machines hum at night: a low sine pair
      { const h1 = ctx.createOscillator(), h2 = ctx.createOscillator(), hg = ctx.createGain(); h1.type = 'sine'; h2.type = 'triangle'; h1.frequency.value = 118; h2.frequency.value = 236.6; hg.gain.value = 0;
        h1.connect(hg); h2.connect(hg); hg.connect(sfx); h1.start(); h2.start(); hum = hg; }
      // rotor: noise chopped by an LFO
      rotor = loop('lowpass', 520);
      rotor.g.disconnect();
      const chop = ctx.createGain(); chop.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = 13;
      const depth = ctx.createGain(); depth.gain.value = 0.5;
      lfo.connect(depth); depth.connect(chop.gain); lfo.start();
      rotor.g.connect(chop); chop.connect(sfx); rotor.lfo = lfo;
      // engine: saw + sub square through a low-pass
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'square';
      const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 400;
      const eg = ctx.createGain(); eg.gain.value = 0;
      // the lope: an LFO wobbling the level (burble, putter, knock), and a band of noise for diesel clatter
      const am = ctx.createGain(); am.gain.value = 1;
      const elfo = ctx.createOscillator(); elfo.type = 'sine'; elfo.frequency.value = 10;
      const lfoD = ctx.createGain(); lfoD.gain.value = 0;
      elfo.connect(lfoD); lfoD.connect(am.gain); elfo.start();
      const clat = loop('bandpass', 1700, 1.3); clat.g.disconnect(); clat.g.connect(am);
      o1.connect(ef); o2.connect(ef); ef.connect(am); am.connect(eg); eg.connect(sfx); o1.start(); o2.start();
      eng = { o1, o2, f: ef, g: eg, am, lfo: elfo, lfoD, clat, prof: null, pid: null, road: loop('lowpass', 300, 0.5), log: null };

      // patrol siren: a square wave wailing between two pitches
      const so = ctx.createOscillator(); so.type = 'square'; so.frequency.value = 760;
      const sl = ctx.createOscillator(); sl.type = 'triangle'; sl.frequency.value = 0.55;
      const sd = ctx.createGain(); sd.gain.value = 230;
      const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1100; sf.Q.value = 0.8;
      const sg = ctx.createGain(); sg.gain.value = 0;
      sl.connect(sd); sd.connect(so.frequency); so.connect(sf); sf.connect(sg); sg.connect(sfx); so.start(); sl.start();
      siren = sg;

      nextT = ctx.currentTime + 0.1;
      mus.until = ctx.currentTime + AUTO_OFF;
      timer = setInterval(tick, 50);
      A.ready = true;
      A.setMuted(A.muted);
    },
    // the song position in beats right now (what you hear, latency included), or null without audio
    beatNow() {
      if (!ctx || ctx.state !== 'running') return null;
      const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
      return (song - (nextT - ctx.currentTime + lat) / STEP) / 4;
    },
    setMuted(m) { A.muted = m; if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.03); },
    // a bus for recorded music (audio/music.js): it goes through the master gain, so M mutes it too
    recordBus() {
      if (!ctx) return null;
      if (!A._rec) { A._rec = ctx.createGain(); A._rec.gain.value = 0.9; A._rec.connect(master); }
      return { ctx, out: A._rec };
    },
    toggleMute() { A.setMuted(!A.muted); return A.muted; },
    // ---- music (M). 'street' = the street music came back after the auto-off, 'on' / 'off' = all music
    get musicOn() { return mus.on; },
    get streetOn() { return mus.on && (mus.keep || !mus.fired); },
    onAutoOff: null,
    toggleMusic() {
      if (mus.on && mus.fired && !mus.keep) { mus.keep = true; savePref('on'); return 'street'; }
      mus.on = !mus.on; if (mus.on) mus.keep = true;
      savePref(mus.on ? 'on' : 'off');
      return mus.on ? 'on' : 'off';
    },
    // automated checks: fire the auto-off after `sec` seconds of play; read the state
    skateGain() { return skate ? +skate.g.gain.value.toFixed(3) : 0; },
    engineGain() { return eng ? +eng.g.gain.value.toFixed(3) : 0; },
    // automated checks: log [time, pitch, gain, pitch target, gain target, revs] on every update
    engineLog(on) { if (!eng) return null; const l = eng.log; eng.log = on ? [] : null; return l; },
    // which engine is running and how it is set up right now (automated checks)
    engineState() { return eng ? { profile: eng.pid, t1: eng.o1.type, t2: eng.o2.type, freq: +eng.o1.frequency.value.toFixed(1), cut: Math.round(eng.f.frequency.value), lope: +eng.lfoD.gain.value.toFixed(2), clat: +eng.clat.g.gain.value.toFixed(2), road: +eng.road.g.gain.value.toFixed(3), gain: +eng.g.gain.value.toFixed(3) } : null; },
    musicAuto(sec) { mus.until = (ctx ? ctx.currentTime : 0) + sec; mus.fired = false; },
    musicState() {
      const cur = players.find((p) => !p.out);
      return { on: mus.on, keep: mus.keep, fired: mus.fired, street: A.streetOn, theme: cur ? cur.id : null, section: cur ? cur.secKey : null, playing: players.map((p) => p.id + (p.out ? '(out)' : '')),
        gain: cur ? +cur.g.gain.value.toFixed(3) : 0, pref: (() => { try { return localStorage.getItem(MUSIC_KEY); } catch (e) { return null; } })() };
    },
    mood: { night: 0, wanted: 0 },
    suspend() { if (ctx) ctx.suspend(); },
    resume() { if (ctx) ctx.resume(); },
    // continuous layers, called every frame. Values are 0..1.
    update(s) {
      if (!ctx) return;
      const t = ctx.currentTime;
      // engine: louder only while the revs are changing (pulling away, braking); at a steady cruise the ear
      // tunes it out, so it settles to a soft hum after a few seconds and sits under the music. Everything glides:
      // the revs follow the speed quickly going up and slowly (about a second) coming down, the pitch is a
      // continuous function of them, and the level and filter move with long time constants, so lifting off the
      // throttle is a smooth fall, never a step.
      const edt = Math.min(0.1, Math.max(0, t - (eng.lastT || t))); eng.lastT = t;
      const rev = s.engine > 0 ? Math.min(1, s.engineRev || 0) : 0, prevS = eng.sRev || 0;
      eng.sRev = prevS + (rev - prevS) * Math.min(1, edt / (rev > prevS ? 0.35 : 0.9));
      const dRev = edt > 0 ? Math.abs(eng.sRev - prevS) / edt : 0;
      eng.calm = eng.calm == null ? 0 : dRev > 0.08 ? Math.max(0, eng.calm - edt * 0.8) : Math.min(1, eng.calm + edt / 5);
      const musicUp = mus.on && players.some((p) => !p.out) ? 1 : 0;
      // the engine of whatever is being driven (its profile only changes when you get into something else)
      const pid = s.engineProfile && ENGINES[s.engineProfile] ? s.engineProfile : s.heavy ? 'tank' : 'sedan', E = ENGINES[pid];
      if (eng.pid !== pid) { eng.pid = pid; eng.prof = E; eng.o1.type = E.t1; eng.o2.type = E.t2; eng.f.Q.value = E.q; }
      const sr = eng.sRev, duck = 1 - 0.35 * musicUp;
      const eGain = s.engine > 0 ? (0.03 + sr * 0.045) * E.gain * (1 - 0.55 * eng.calm) * duck : 0;
      eng.g.gain.setTargetAtTime(eGain, t, 0.3);
      const f = E.base + E.span * Math.pow(sr, 0.85);
      eng.o1.frequency.setTargetAtTime(f, t, 0.18); eng.o2.frequency.setTargetAtTime(f * E.r2, t, 0.18);
      eng.f.frequency.setTargetAtTime((E.cut + sr * E.cutRev) * (1 - 0.25 * eng.calm), t, 0.25);
      eng.am.gain.setTargetAtTime(1, t, 0.2); eng.lfoD.gain.setTargetAtTime(0, t, 0.2);
      eng.clat.g.gain.setTargetAtTime(s.engine > 0 ? E.grit * (0.6 + sr * 0.6) : 0, t, 0.3);
      eng.clat.f.frequency.setTargetAtTime(900 + sr * 700, t, 0.3);
      // tyres and wind: a soft band of noise that rises with speed (it carries the sense of motion)
      const sp = s.engine > 0 ? Math.min(1, s.roadSpeed != null ? s.roadSpeed : rev) : 0;
      eng.road.g.gain.setTargetAtTime(sp * sp * 0.05 * duck, t, 0.25);
      eng.road.f.frequency.setTargetAtTime(260 + sp * 900, t, 0.3);
      if (eng.log) eng.log.push([+t.toFixed(3), +eng.o1.frequency.value.toFixed(2), +eng.g.gain.value.toFixed(4), +f.toFixed(2), +eGain.toFixed(4), +rev.toFixed(3)]);
      // skates: a softer, lower wheel roll with a gentle push-and-glide rhythm instead of a steady hiss; like the
      // engine it eases down after a few seconds at a steady speed and sits under the music
      const sk = s.skate || 0, pS = skate.s || 0;
      skate.s = pS + (sk - pS) * Math.min(1, edt / 0.8);
      const dSk = edt > 0 ? Math.abs(skate.s - pS) / edt : 0;
      skate.calm = skate.calm == null ? 0 : dSk > 0.1 ? Math.max(0, skate.calm - edt * 3) : Math.min(1, skate.calm + edt / 4);
      skate.ph = (skate.ph || 0) + edt * (0.9 + sk * 0.9) * Math.PI * 2;           // push cadence speeds up a little
      const stride = 0.72 + 0.28 * Math.max(0, Math.sin(skate.ph)) ** 2;
      const grain = 1 + 0.06 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 13.1);     // uneven pavement
      skate.g.gain.setTargetAtTime(sk > 0 ? sk * 0.07 * stride * grain * (1 - 0.6 * skate.calm) * (1 - 0.35 * musicUp) : 0, t, 0.06);
      skate.f.frequency.setTargetAtTime((420 + sk * 650) * (1 - 0.2 * skate.calm), t, 0.12);
      rotor.g.gain.setTargetAtTime(s.rotor * 0.55, t, 0.15);
      rotor.lfo.frequency.setTargetAtTime(3 + s.rotor * 11, t, 0.2);
      rainLayers(s, t, edt);
      if (purr) { const br = 0.65 + 0.35 * Math.max(0, Math.sin(t * 2.6)); purr.g.gain.setTargetAtTime((s.purr || 0) * 0.16 * br, t, 0.12); purr.lfo.frequency.setTargetAtTime(22 + Math.sin(t * 2.6) * 3, t, 0.2); }
      spray.g.gain.setTargetAtTime((s.spray || 0) * 0.08, t, 0.2);
      water.g.gain.setTargetAtTime((s.water || 0) * (0.05 + 0.012 * Math.sin(t * 9.1)), t, 0.12);
      waves.g.gain.setTargetAtTime((s.waves || 0) * (0.05 + 0.04 * Math.max(0, Math.sin(t * 0.55))), t, 0.4);
      { const b = clampN(s.boat || 0, 0, 1.2), air = s.boatAir ? 0.25 : 1, duckH = 1 - 0.3 * musicUp;
        hull.rush.g.gain.setTargetAtTime(b > 0.01 ? (0.012 + b * 0.07) * air * duckH * (0.85 + 0.15 * Math.sin(t * 2.3)) : 0, t, 0.25);
        hull.rush.f.frequency.setTargetAtTime(260 + b * 700, t, 0.3);
        hull.hiss.g.gain.setTargetAtTime(b * b * 0.04 * air * duckH, t, 0.25); }
      hum.gain.setTargetAtTime((s.hum || 0) * 0.035, t, 0.3);
      siren.gain.setTargetAtTime((s.siren || 0) * 0.07, t, 0.15);
      fire.g.gain.setTargetAtTime((s.fire || 0) * (0.05 + Math.random() * 0.07), t, 0.05);
      fire.f.frequency.setTargetAtTime(500 + Math.random() * 600, t, 0.05);
      ufilt.frequency.setTargetAtTime(s.under ? 650 : 22000, t, s.under ? 0.08 : 0.15);
      uw.g.gain.setTargetAtTime(s.under ? 0.07 : 0, t, 0.2);
      // a sputtering engine coughs: the engine layer dips while the throttle is cut
      if (s.cough) eng.g.gain.setTargetAtTime(0.02, t, 0.08);
      // room: 0 street, 1 a shop or the bar (radio in the corner), 2 Club Prism (loud)
      // Club Prism: s.club scales the system (quiet before the flyers go out, louder at the Dance-Off),
      // s.lounge is 1 in the booth lounge, where the music is softer and duller
      // room 3: the Blue Pelican Lounge. Its recorded tracks (s.rec, 0..1 as they fade in) take over from the
      // synth; with no records the house synth plays there, a little softer and warmer than on the street
      const ck = s.club || 1, lg = s.lounge || 0, rec = s.rec || 0;
      const mg = s.room === 2 ? (s.duck ? 0.5 : 1.05) * ck * (1 - lg * 0.4) : s.duck ? 0.3 : s.room === 1 ? 0.5 : s.room === 3 ? 0.5 : 0.55;
      music.gain.setTargetAtTime(mg * (1 - rec), t, 0.3);
      mfilt.frequency.setTargetAtTime(s.room === 3 ? 7000 : s.room === 2 ? 16000 - lg * 13000 - (1 - Math.min(ck, 1)) * 9000 : 16000, t, 0.25);
      // the theme for where you are: the street music fades out for good after a while (unless kept on)
      A.mood.night = s.night || 0; A.mood.wanted = s.wanted || 0;
      if (mus.on && !mus.keep && !mus.fired && t > mus.until && !s.room && !s.duck) { mus.fired = true; mus.slow = true; if (A.onAutoOff) A.onAutoOff(); }
      let id = s.theme === undefined ? 'street' : s.theme;
      if (!mus.on || (id === 'street' && !A.streetOn)) id = null;
      setTheme(id, !mus.on ? 0.5 : mus.slow && !id ? 6 : 1.2);
      mus.slow = false;
      // Starlight Pier's theme comes and goes with the distance (s.themeK, 0..1 from game/pier.js)
      { const cp = players.find((p) => !p.out); if (cp && cp.id === 'pier') cp.g.gain.setTargetAtTime((cp.th.vol ?? 1) * Math.max(0.0001, s.themeK ?? 1), t, 0.35); }
      if (A._rec) A._rec.gain.setTargetAtTime(s.duck ? 0.5 : 0.9, t, 0.3);
    },
    club: false,
    // ---- the sea: a splash, a stroke, wading steps, bubbles, the shark's tense sting and its chomp (all synthesised)
    // a hull slapping down on a wave (or a jet ski landing): a dull thump and a short wash
    slap(k = 1) { if (!ctx) return; hit(0.24 * k, 0.16, 'lowpass', 600, 160); hit(0.1 * k, 0.3, 'bandpass', 1400, 600); tone('sine', 95, 50, 0.14, 0.12 * k); },
    splash(k = 1) {
      if (!ctx || ctx.currentTime < splashT) return;
      splashT = ctx.currentTime + 0.08;
      hit(0.32 * k, 0.4, 'lowpass', 2400, 350); hit(0.14 * k, 0.2, 'highpass', 3200); tone('sine', 180, 70, 0.22, 0.1 * k);
    },
    stroke(k = 1) { hit(0.05 * k, 0.2, 'bandpass', 800, 2400); },
    wadeStep(k = 1) { hit(0.07 * k, 0.16, 'bandpass', 650, 380); },
    bubble() { const f = 380 + Math.random() * 500; tone('sine', f, f * 2.4, 0.08, 0.05); if (Math.random() < 0.6) tone('sine', f * 1.3, f * 3, 0.07, 0.035, 0.09); },
    // two sawtooth tones a semitone apart creeping upwards, a low pulse under them
    sting(k = 1) {
      tone('sawtooth', 523, 554, 1.5, 0.035 * k); tone('sawtooth', 554, 587, 1.5, 0.03 * k, 0.04); tone('triangle', 1046, 1175, 1.3, 0.02 * k, 0.2);
      tone('sine', 58, 52, 0.18, 0.28 * k); tone('sine', 58, 52, 0.18, 0.28 * k, 0.55); tone('sine', 58, 52, 0.18, 0.3 * k, 0.95);
    },
    chomp() { hit(0.55, 0.14, 'bandpass', 800, 220); tone('square', 200, 60, 0.14, 0.18); tone('sawtooth', 110, 40, 0.3, 0.14, 0.05); hit(0.4, 0.45, 'lowpass', 1800, 300, ctx ? ctx.currentTime + 0.05 : 0); },
    step(k = 1) { hit(0.035 * k, 0.05, 'bandpass', 2400); },
    // the TV at home: a short tone (a test card, a jingle, a cartoon boing) and a studio audience laughing
    tvTone(f, dur = 0.2, vol = 0.02, slide = false) { tone(slide ? 'triangle' : 'sine', f, slide ? f * 1.8 : f, dur, vol); },
    laugh() { for (let i = 0; i < 5; i++) hit(0.05, 0.25 + Math.random() * 0.2, 'bandpass', 700 + Math.random() * 900, 0, ctx ? ctx.currentTime + i * 0.13 : 0); },
    // typewriter blip for subtitles, pitched per character
    talk(pitch = 1) { tone('square', 420 * pitch, 380 * pitch, 0.035, 0.022); },
    jump() { tone('sine', 300, 620, 0.12, 0.08); },
    thud(k = 1) { hit(0.3 * k, 0.12, 'lowpass', 500); tone('sine', 110, 50, 0.12, 0.25 * k); },
    shot() { hit(0.5, 0.18, 'lowpass', 1400); tone('square', 160, 40, 0.16, 0.25); },
    boom() { hit(0.95, 1.1, 'lowpass', 1100, 70); tone('sine', 95, 28, 0.7, 0.8); },
    // thunder: d is how far away the strike was (0 overhead .. 1 far): close ones crack first, far ones only rumble.
    // Muffled with the rain in a car or indoors.
    thunder(d = 0.5) {
      if (!ctx) return;
      const t = ctx.currentTime, k = 1 - d * 0.6, bus = rain ? rain.bus : sfx;
      if (d < 0.45) { hit(0.35 * (1 - d), 0.35, 'highpass', 1800, 600, t, bus); hit(0.3 * (1 - d), 0.6, 'bandpass', 900, 200, t + 0.05, bus); }
      hit(0.45 * k, 2.6 + d * 1.5, 'lowpass', 300 - d * 140, 50, t + 0.08, bus); hit(0.25 * k, 3.2, 'lowpass', 140, 40, t + 0.5 + d * 0.5, bus);
      tone('sine', 52 - d * 10, 28, 1.8 + d, 0.22 * k, 0.1, bus);
      A.thunders = (A.thunders || 0) + 1; A.lastThunder = { at: +t.toFixed(2), d: +d.toFixed(2) };
    },
    // a soft meow (a startled one is shorter and higher): a sawtooth through two vowel-ish band-passes, gliding
    meow(vol = 1, startled = false) {
      if (!ctx || vol <= 0) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), out = ctx.createGain();
      o.type = 'sawtooth'; const d = startled ? 0.28 : 0.6, p = startled ? 1.25 : 1;
      o.frequency.setValueAtTime(420 * p, t); o.frequency.linearRampToValueAtTime(700 * p, t + d * 0.35); o.frequency.linearRampToValueAtTime(380 * p, t + d);
      f1.type = 'bandpass'; f1.Q.value = 6; f1.frequency.setValueAtTime(900, t); f1.frequency.linearRampToValueAtTime(1700, t + d * 0.4); f1.frequency.linearRampToValueAtTime(800, t + d);
      f2.type = 'bandpass'; f2.Q.value = 8; f2.frequency.value = 2900;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(out); out.gain.value = 0.35; out.connect(g); g.connect(sfx); o.start(t); o.stop(t + d + 0.05);
      A.meows = (A.meows || 0) + 1;
    },
    purrLevel() { return purr ? +purr.g.gain.value.toFixed(4) : 0; },
    rainState() { return rain ? { where: rain.where, ticks: rain.n, wash: +rain.wash.g.gain.value.toFixed(4), rumble: +rain.rumble.g.gain.value.toFixed(4), drum: +rain.drum.g.gain.value.toFixed(4), filter: Math.round(rain.f.frequency.value), want: rain.last, thunders: A.thunders || 0, lastThunder: A.lastThunder || null } : null; },
    // a pedestrian's "hey!": two quick vowel-ish chirps, pitched per person
    hey(pitch = 1, vol = 1) {
      if (!ctx || ctx.currentTime < heyT) return;
      heyT = ctx.currentTime + 0.18;
      tone('sawtooth', 330 * pitch, 520 * pitch, 0.09, 0.09 * vol); tone('sawtooth', 560 * pitch, 380 * pitch, 0.2, 0.1 * vol, 0.1);
      tone('triangle', 660 * pitch, 440 * pitch, 0.2, 0.06 * vol, 0.1);
    },
    // beach life, kept quiet: a gull's cry, a sandpiper's peep, the dog's woof
    gull(vol = 1) { if (vol <= 0) return; tone('sawtooth', 1450, 820, 0.22, 0.018 * vol); tone('sawtooth', 1650, 900, 0.26, 0.015 * vol, 0.28); },
    peep(vol = 1) { if (vol <= 0) return; tone('sine', 3200, 2600, 0.05, 0.02 * vol); tone('sine', 3300, 2700, 0.05, 0.018 * vol, 0.08); },
    // a pat: two short, bright, rising yips
    happyBark(vol = 1) { tone('square', 330, 520, 0.07, 0.045 * vol); tone('triangle', 420, 700, 0.08, 0.06 * vol, 0.02); tone('square', 380, 620, 0.07, 0.04 * vol, 0.16); tone('triangle', 480, 820, 0.09, 0.055 * vol, 0.18); },
    woof(vol = 1) { if (vol <= 0) return; tone('square', 240, 130, 0.08, 0.04 * vol); tone('triangle', 300, 150, 0.1, 0.06 * vol, 0.12); },
    horn(vol = 1) { if (vol <= 0) return; tone('square', 392, 392, 0.32, 0.05 * vol); tone('square', 494, 494, 0.32, 0.05 * vol); },
    // dancing on the beat: a bright tick for a hit (brighter when perfect), a dull one for a miss
    beatHit(perfect) { tone('triangle', perfect ? 1760 : 1320, perfect ? 1760 : 1320, 0.06, 0.06); if (perfect) tone('sine', 2640, 2640, 0.08, 0.03, 0.03); },
    beatMiss() { tone('square', 140, 90, 0.12, 0.05); },
    // a lamp post going down, a can dropping out of a vending machine
    clank() { hit(0.45, 0.35, 'bandpass', 2600, 900); tone('square', 620, 180, 0.3, 0.12); tone('triangle', 1240, 900, 0.5, 0.06, 0.05); },
    clunk() { hit(0.25, 0.08, 'lowpass', 700); tone('sine', 180, 90, 0.1, 0.18); tone('triangle', 900, 700, 0.06, 0.04, 0.12); },
    knock(k = 1) { hit(0.12 * k, 0.07, 'bandpass', 900); },
    cash() { tone('square', 1320, 1320, 0.05, 0.05); tone('square', 1760, 1760, 0.09, 0.05, 0.05); },
    pickup() { tone('triangle', 660, 660, 0.08, 0.14); tone('triangle', 990, 990, 0.08, 0.14, 0.07); tone('triangle', 1320, 1320, 0.2, 0.14, 0.14); },
    win() { [0, 4, 7, 12, 16].forEach((n, i) => tone('square', mtof(69 + n), mtof(69 + n), 0.22, 0.07, i * 0.09)); },
    lose() { [7, 4, 0, -5].forEach((n, i) => tone('sawtooth', mtof(57 + n), mtof(56 + n), 0.3, 0.08, i * 0.16)); },
    star() { tone('square', 880, 440, 0.16, 0.08); tone('square', 880, 440, 0.16, 0.08, 0.18); },
    // ---- damage, lasers and the neon blasters (all synthesised)
    sputter() { hit(0.22, 0.14, 'lowpass', 380); tone('square', 70, 45, 0.12, 0.08); hit(0.16, 0.1, 'lowpass', 300, 0, ctx ? ctx.currentTime + 0.16 : 0); },
    crunch(k = 1) { hit(0.35 * k, 0.25, 'bandpass', 1200, 300); tone('square', 140, 60, 0.16, 0.12 * k); },
    bigBoom() { A.boom(); hit(0.6, 1.6, 'lowpass', 600, 50); tone('sine', 60, 22, 1.1, 0.6); tone('square', 110, 40, 0.3, 0.12, 0.05); },
    // the patrol's roof laser: a rising charge hum, then a pulse zap per shot
    charge(vol = 1) { if (vol <= 0) return; tone('sine', 380, 1500, 0.6, 0.035 * vol); tone('triangle', 760, 3000, 0.6, 0.015 * vol); },
    laser(vol = 1) {
      if (!ctx || vol <= 0 || ctx.currentTime < zapT) return;
      zapT = ctx.currentTime + 0.04;
      tone('square', 2200, 380, 0.11, 0.05 * vol); tone('sawtooth', 3300, 900, 0.07, 0.03 * vol); hit(0.05 * vol, 0.05, 'highpass', 5000);
    },
    zapHit(vol = 1) { hit(0.18 * vol, 0.12, 'bandpass', 3200); tone('square', 900, 200, 0.08, 0.05 * vol); },
    pop() { tone('square', 1500, 520, 0.07, 0.07); tone('triangle', 3000, 1200, 0.05, 0.04); hit(0.08, 0.04, 'highpass', 4000); },
    prism() { tone('triangle', 2600, 1700, 0.16, 0.07); tone('sine', 5200, 4100, 0.2, 0.03); tone('square', 1300, 1250, 0.05, 0.03); },
    arc() { for (let i = 0; i < 4; i++) hit(0.14, 0.05, 'bandpass', 2000 + Math.random() * 4000, 0, ctx ? ctx.currentTime + i * 0.045 : 0); tone('sawtooth', 160, 90, 0.25, 0.06); },
    whoosh() { hit(0.16, 0.32, 'bandpass', 900, 4200); tone('sine', 500, 1400, 0.25, 0.03); },
    throw() { hit(0.1, 0.18, 'bandpass', 700, 1800); },
    fuse() { hit(0.04, 0.12, 'highpass', 6500); },
    // a firework bang: a sharp crack, then a crackle of little pops
    bang(k = 1) {
      hit(0.7 * k, 0.5, 'lowpass', 2400, 120); tone('sine', 120, 40, 0.3, 0.35 * k);
      if (ctx) for (let i = 0; i < 9; i++) hit(0.12 * k, 0.04, 'highpass', 3000 + Math.random() * 3000, 0, ctx.currentTime + 0.22 + Math.random() * 0.6);
    },
    // a distant firework shell (world/fireworks.js): a soft low thump rolling over the water, sometimes a crackle tail.
    // k: loudness (by distance, already scaled for where you are); m: muffling (0 outdoors, 0.7 through glass, 1 indoors)
    fwBoom(k = 0.4, m = 0, crackle = false) {
      if (!ctx || !(k > 0.004)) return;
      const t = ctx.currentTime, cut = 520 - m * 330;
      hit(0.55 * k, 1.5 + m * 0.5, 'lowpass', cut, 50, t);
      tone('sine', 64 - m * 10, 30, 1.0, 0.42 * k);
      if (m < 0.9) hit(0.12 * k * (1 - m), 0.25, 'bandpass', 700 - m * 300, 200, t);
      if (crackle && m < 0.9) for (let i = 0; i < 12; i++) hit(0.045 * k * (1 - m * 0.8), 0.04, m > 0.5 ? 'bandpass' : 'highpass', m > 0.5 ? 1400 : 2600 + Math.random() * 2400, 0, t + 0.35 + Math.random() * 1.4);
    },
    // a pan on the hob (the penthouse island): a short hiss of frying
    sizzle() { if (!ctx) return; hit(0.035, 0.28 + Math.random() * 0.2, 'highpass', 3800 + Math.random() * 1500); hit(0.02, 0.12, 'bandpass', 1800 + Math.random() * 800, 0, ctx.currentTime + 0.05); },
    empty() { tone('square', 180, 150, 0.05, 0.05); hit(0.06, 0.03, 'highpass', 3000); },
    swap() { tone('triangle', 900, 1350, 0.06, 0.05); tone('square', 1800, 1800, 0.04, 0.025, 0.05); },
    // the shop alarm: a bell that rings for a couple of seconds
    bell() { if (!ctx) return; for (let i = 0; i < 22; i++) { tone('square', 1480, 1470, 0.05, 0.04, i * 0.11); tone('triangle', 2960, 2940, 0.05, 0.02, i * 0.11); } },
    // the patrol radio: a squelch, two beeps
    radio() { hit(0.12, 0.18, 'bandpass', 1800); tone('square', 1100, 1100, 0.06, 0.04, 0.2); tone('square', 1400, 1400, 0.06, 0.04, 0.29); },
    thanks() { [0, 7, 12].forEach((n, i) => tone('triangle', mtof(76 + n), mtof(76 + n), 0.18, 0.08, i * 0.08)); },
        blip(ok = true) {
      if (ok) { tone('square', 660, 660, 0.07, 0.07); tone('square', 990, 990, 0.12, 0.07, 0.08); tone('square', 1320, 1320, 0.2, 0.06, 0.16); }
      else tone('square', 160, 110, 0.2, 0.1);
    },
  };

  // ---- the rain: s.rain (0..1 outdoors, even while you are indoors), s.storm (0..1), s.rainWhere:
  //   'out' open sky (on foot or on a bike) · 'awning' under an awning / a shelter (drumming on the canopy above)
  //   'car' in a car (muffled roof drumming) · 'indoor' inside (rain at the windows, far off and dull)
  // Everything glides (long time constants) so a change of weather or place is a fade, never a step; it stays
  // well under the music, with no harsh top end (the hiss layer is low-passed).
  const RAIN_W = { out: { wash: 0.05, hiss: 0.014, drum: 0, cut: 7500, tick: 1, tf: [2200, 6000], tv: 0.022 },
    awning: { wash: 0.035, hiss: 0.008, drum: 0.03, cut: 5000, tick: 1.2, tf: [700, 1800], tv: 0.03 },
    car: { wash: 0.03, hiss: 0, drum: 0.05, cut: 900, tick: 1.6, tf: [300, 900], tv: 0.05 },
    indoor: { wash: 0.022, hiss: 0, drum: 0.004, cut: 520, tick: 0.25, tf: [900, 1600], tv: 0.012 } };
  function rainLayers(s, t, dt) {
    const amt = clampN(s.rain || 0, 0, 1), where = RAIN_W[s.rainWhere] ? s.rainWhere : 'out', W = RAIN_W[where], st = clampN(s.storm || 0, 0, 1);
    rain.where = where;
    const duck = A.muted ? 0 : 1;
    rain.wash.g.gain.setTargetAtTime(amt * W.wash * (0.7 + 0.3 * st) * duck, t, 1.2);
    rain.hiss.g.gain.setTargetAtTime(amt * amt * W.hiss * duck, t, 1.2);
    rain.drum.g.gain.setTargetAtTime(amt * W.drum * duck, t, 0.6);
    rain.rumble.g.gain.setTargetAtTime(st * amt * 0.06 * (where === 'indoor' ? 0.5 : 1) * duck, t, 2);
    rain.wash.f.frequency.setTargetAtTime(1100 + amt * 900, t, 1.5);
    rain.f.frequency.setTargetAtTime(W.cut, t, 0.35);
    rain.last = { amt: +amt.toFixed(2), storm: +st.toFixed(2) };
    // droplet ticks: a random patter, denser in heavy rain; on a canopy or a car roof they become duller knocks
    if (amt < 0.03) return;
    rain.tickT -= dt;
    let budget = 6;
    while (rain.tickT <= 0 && budget-- > 0) {
      const rate = (8 + amt * 46) * W.tick;
      rain.tickT += -Math.log(1 - Math.random()) / rate;
      const f = W.tf[0] + Math.random() * (W.tf[1] - W.tf[0]), v = W.tv * (0.3 + Math.random() * 0.7) * (0.5 + amt * 0.5);
      hit(v, 0.012 + Math.random() * (where === 'car' ? 0.05 : 0.025), 'bandpass', f, 0, t + Math.random() * 0.03, rain.bus);
      rain.n++;
    }
    if (rain.tickT < -0.5) rain.tickT = 0;
  }
  const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
  function tone(type, f0, f1, dur, vol, delay = 0, bus = sfx) {
    if (!ctx || !Number.isFinite(f0) || !Number.isFinite(f1) || !Number.isFinite(vol) || !Number.isFinite(dur)) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  function hit(vol, dur, type, freq, sweepTo = 0, t = 0, bus = sfx) {
    if (!ctx || !Number.isFinite(vol) || !Number.isFinite(freq) || !Number.isFinite(dur) || !Number.isFinite(t)) return;
    t = t || ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.9); src.stop(t + dur + 0.02);
  }
  function note(type, midi, t, dur, vol, cutoff, bus, detune = 0, attack = 0.005) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type; o.frequency.value = mtof(midi); o.detune.value = detune;
    f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(cutoff * 0.3, 80), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  // a rising noise sweep for the build
  function riser(t, dur, bus = music) {
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + dur * 0.97); g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f); f.connect(g); g.connect(bus); src.start(t); src.stop(t + dur + 0.05);
  }
  function kick(t, v = 0.95, bus = music, f0 = 160, f1 = 40, dur = 0.28) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.46);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  // ---- the synth kit the themes play (audio/themes.js): a voice is one or two oscillators, made per note
  const K = {
    tone(type, midi, t, dur, vol, bus, o = {}) {
      vol = Math.max(vol, 0.0003);
      const osc = ctx.createOscillator(), g = ctx.createGain(), f = mtof(midi);
      osc.type = type;
      if (o.scoop) { osc.frequency.setValueAtTime(f * Math.pow(2, -o.scoop / 1200), t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.07); } else osc.frequency.setValueAtTime(f, t);
      if (o.det) osc.detune.value = o.det;
      let out = osc;
      if (o.cut) {
        const fl = ctx.createBiquadFilter(); fl.type = o.ftype || 'lowpass'; fl.Q.value = o.q ?? 0.7;
        fl.frequency.setValueAtTime(o.cut, t); if (o.cutEnd) fl.frequency.exponentialRampToValueAtTime(o.cutEnd, t + dur);
        osc.connect(fl); out = fl;
      }
      const a = o.att || 0.005;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a);
      if (o.sus) g.gain.linearRampToValueAtTime(vol * 0.7, t + Math.max(a + 0.01, dur * 0.8));
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.02));
      out.connect(g); g.connect(bus); osc.start(t); osc.stop(t + Math.max(dur, a + 0.02) + 0.05);
    },
    noise(t, vol, dur, type, freq, bus, o = {}) {
      const src = ctx.createBufferSource(); src.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = o.q ?? 0.7;
      if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
      const g = ctx.createGain(), a = o.att || 0.002;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0003), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(bus); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.02);
    },
    kick(t, v, bus, f0 = 150, f1 = 42, dur = 0.24) { kick(t, v, bus, f0, f1, dur); },
    ep(m, t, dur, v, bus, bright = 0) { K.tone('sine', m, t, dur, v, bus); K.tone('sine', m + 24, t, Math.min(dur, 0.18), v * (0.12 + bright * 0.12), bus); },
    pluck(m, t, dur, v, bus, br = 1, type = 'sawtooth') { K.tone(type, m, t, dur, v, bus, { cut: 700 + 2600 * br, cutEnd: Math.max(mtof(m) * 1.3, 160), q: 1.2 }); },
    horn(m, t, dur, v, bus, cut = 1100) { K.tone('sawtooth', m, t, dur, v, bus, { cut, q: 2.2, att: 0.045, scoop: 40, sus: true }); },
    harp(m, t, dur, v, bus) { K.tone('square', m, t, dur, v, bus, { cut: 1500, ftype: 'bandpass', q: 0.9, att: 0.035, scoop: 70, sus: true }); K.tone('sawtooth', m, t, dur, v * 0.45, bus, { cut: 2200, det: 9, att: 0.05, sus: true }); },
    bell(m, t, dur, v, bus) { K.tone('sine', m, t, dur, v, bus, { att: 0.003 }); K.tone('sine', m, t, dur * 0.35, v * 0.3, bus, { det: 1758 }); },
    chip(type, m, t, dur, v, bus) { K.tone(type, m, t, dur, v, bus, { att: 0.002, sus: true }); },
    pad(ms, t, dur, v, bus, cut = 1200, type = 'sawtooth', det = 0) {
      const att = Math.min(0.6, dur * 0.25);
      for (const m of ms) { K.tone(type, m, t, dur, v, bus, { cut, att, sus: true, det: -det }); if (det) K.tone(type, m, t, dur, v, bus, { cut, att, sus: true, det }); }
    },
    bass(m, t, dur, v, bus, cut = 700, type = 'triangle') { K.tone(type, m, t, dur, v, bus, { cut, cutEnd: Math.max(cut * 0.45, 90), att: 0.006 }); },
    snare(t, v, bus, o = {}) {
      if (o.brush) { K.noise(t, v, 0.16, 'bandpass', 2600, bus, { q: 0.5, att: 0.006 }); return; }
      K.noise(t, v, 0.16, 'highpass', 1400, bus); K.tone('triangle', 55, t, 0.08, v * 0.5, bus, { cut: 2000 });
    },
    hat(t, v, bus, open = false) { K.noise(t, v, open ? 0.22 : 0.035, 'highpass', 7500, bus); },
    ride(t, v, bus) { K.noise(t, v, 0.5, 'bandpass', 5600, bus, { q: 2.2 }); K.noise(t, v * 0.6, 0.06, 'highpass', 9000, bus); },
    brush(t, v, bus) { K.noise(t, v, 0.24, 'bandpass', 3200, bus, { q: 0.6, att: 0.05, sweep: 4200 }); },
    clap(t, v, bus) { for (let i = 0; i < 3; i++) K.noise(t + i * 0.011, v * (i === 2 ? 1 : 0.6), i === 2 ? 0.14 : 0.02, 'bandpass', 1300, bus, { q: 1.2 }); },
    rim(t, v, bus) { K.noise(t, v, 0.03, 'bandpass', 2400, bus, { q: 5 }); K.tone('square', 85, t, 0.025, v * 0.25, bus, { cut: 3000 }); },
    shaker(t, v, bus) { K.noise(t, v, 0.06, 'highpass', 5500, bus, { att: 0.012 }); },
    metal(t, v, bus) { K.noise(t, v, 0.2, 'bandpass', 3300, bus, { q: 14 }); K.tone('square', 87, t, 0.06, v * 0.3, bus, { cut: 4000 }); },
    riser(t, dur, bus) { riser(t, dur, bus); },
  };
  // Club Prism's own track: same key and tempo as the old street tune, built in 16-bar phrases
  // (12 bars of groove, a 2-bar breakdown, a 2-bar build, then the drop). It runs on the shared clock
  // (song), which the dance floor and the Dance-Off judge against.
  const CBASS = [null, null, 12, null, null, 0, 12, null, null, null, 12, 0, 7, null, 12, 10];
  function clubStep(step, t, P) {
    const bus = P.g, arp = P.arp;
    const pb = Math.floor(step / 16) % 16, s = step & 15, ch = CHORDS[(step >> 4) % 4];
    const brk = pb === 12 || pb === 13, build = pb >= 14, lift = build ? (pb - 14) * 16 + s : 0;
    if (!brk && s % 4 === 0 && !(pb === 15 && s >= 8)) kick(t, pb === 0 && s === 0 ? 1.1 : 0.95, bus);
    if (!brk && !build && (s === 4 || s === 12)) { hit(0.32, 0.18, 'bandpass', 1700, 0, t, bus); hit(0.2, 0.12, 'highpass', 2600, 0, t + 0.012, bus); }
    if (build) {   // snare roll that speeds up into the drop
      const every = lift < 16 ? 4 : lift < 24 ? 2 : 1;
      if (s % every === 0) hit(0.08 + lift * 0.007, 0.1, 'bandpass', 1500 + lift * 40, 0, t, bus);
      if (lift === 0) riser(t, STEP * 32, bus);
    }
    if (!brk) {
      hit(s % 4 === 2 ? 0.1 : 0.045, 0.03, 'highpass', 8000, 0, t, bus);
      if (s % 4 === 2) hit(0.13, 0.2, 'highpass', 9500, 0, t, bus);
    } else if (s % 4 === 2) hit(0.05, 0.05, 'highpass', 9000, 0, t, bus);
    if (brk) { if (s === 0) note('sine', ch.root - 12, t, STEP * 15, 0.3, 300, bus); }
    else if (CBASS[s] !== null) note('sawtooth', ch.root - 12 + CBASS[s], t, STEP * 0.9, 0.28, build ? 500 + lift * 30 : 1100, bus);
    if (!brk && (s === 3 || s === 10 || (s === 14 && pb % 2))) for (const off of [12, 12 + ch.third, 19]) note('square', ch.root + off, t, 0.16, 0.035, build ? 1200 + lift * 90 : 2600, bus);
    // sixteenth-note arpeggio, up and over the chord (every other phrase it turns round the other way)
    const ARP = (step >> 8) % 2 ? [12, 7, ch.third + 12, 19, 12, 0, 7, ch.third + 12] : [0, 7, 12, ch.third + 12, 19, 12, 7, ch.third + 12];
    if (!brk && (pb >= 2 || s % 2 === 0)) note('square', ch.root + 24 + ARP[s % 8], t, 0.1, build ? 0.02 + lift * 0.001 : 0.028, 3200, arp);
    if (s === 0) for (const off of [0, ch.third, 7, 12]) for (const det of [-8, 8]) note('sawtooth', ch.root + off, t, STEP * 16.5, brk ? 0.05 : 0.018, brk ? 1600 : 900, bus, det, 0.3);
    if (brk && (s === 0 || s === 6 || s === 10)) note('triangle', ch.root + 24 + (s === 6 ? 7 : s === 10 ? ch.third : 12), t, STEP * 4, 0.07, 3000, arp, 0, 0.02);
  }
  // ---- the theme players: one per theme, crossfaded; themes with their own tempo keep their own clock
  function newPlayer(id) {
    const th = THEMES[id] || (id === 'club' ? { sync: true, vol: 1 } : null);
    if (!th) return null;
    const t = ctx.currentTime, g = ctx.createGain();
    g.gain.value = 0.0001; g.gain.setTargetAtTime(th.vol ?? 1, t, 0.3); g.connect(music);
    const p = { id, th, g, wet: null, arp: null, out: false, end: 0, nextT: t + 0.06, s: 0, barIn: 0, sec: null, secKey: '', formI: -1, loop: 0, n: 0, phr: 0, line: null,
      spb: 60 / (th.bpm || BPM) / 4, rs: (Math.random() * 4294967295) >>> 0 };
    p.r = () => (p.rs = (Math.imul(p.rs, 1664525) + 1013904223) >>> 0) / 4294967296;
    if (th.wet) { p.wet = ctx.createGain(); p.wet.gain.value = th.wet; g.connect(p.wet); p.wet.connect(space); space.delayTime.setTargetAtTime(Math.min(1.2, p.spb * 3), t, 0.2); }
    if (th.sync) { p.arp = ctx.createGain(); p.arp.gain.value = 0.0001; p.arp.gain.setTargetAtTime(1, t, 0.3); p.arp.connect(arpBus); }
    return p;
  }
  function setTheme(id, fade) {
    const cur = players.find((p) => !p.out);
    if ((cur ? cur.id : null) === id) return;
    const t = ctx.currentTime;
    if (cur) {
      cur.out = true; cur.end = t + fade * 1.3 + 0.2;
      for (const g of [cur.g, cur.arp]) if (g) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.setTargetAtTime(0, t, fade / 3); }
    }
    if (id) { const p = newPlayer(id); if (p) players.push(p); }
  }
  const E = {};
  function stepPlayer(p, t) {
    const th = p.th;
    if (!p.sec || (p.s === 0 && p.barIn >= p.sec.length)) {
      p.barIn = 0; p.line = null;
      if (th.pick) { p.secKey = th.pick(p, A.mood); p.n++; p.loop = p.n; }
      else { p.formI = (p.formI + 1) % th.form.length; if (p.formI === 0 && p.n) p.loop++; p.secKey = th.form[p.formI]; p.n++; }
      p.sec = th.sec[p.secKey];
      if (th.bpmFor) p.spb = 60 / th.bpmFor(p, A.mood) / 4;
    }
    const bar = p.sec[p.barIn], nb = bar.length, ci = Math.min(nb - 1, Math.floor(p.s * nb / 16));
    E.t = t + (th.swing && p.s % 4 === 2 ? th.swing * p.spb * 0.667 : 0); E.s = p.s; E.bar = bar; E.chord = bar[ci];
    E.next = ci < nb - 1 ? bar[ci + 1] : (p.sec[p.barIn + 1] || p.sec[0])[0];
    E.barIn = p.barIn; E.bars = p.sec.length; E.secKey = p.secKey; E.formI = p.formI; E.loop = p.loop; E.p = p; E.r = p.r;
    E.spb = p.spb; E.bus = p.g; E.mood = A.mood; E.last = p.barIn === p.sec.length - 1;
    th.play(E, K);
    if (++p.s === 16) { p.s = 0; p.barIn++; }
  }
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // the shared clock (beatNow, the club, the dance floor) always runs, music or not
    if (nextT < now - 0.1) nextT = now + 0.05;
    while (nextT < now + 0.25) {
      for (const p of players) if (p.th.sync && (!p.out || nextT < p.end)) clubStep(song, nextT, p);
      nextT += STEP; song++;
    }
    for (const p of players) {
      if (p.th.sync) continue;
      if (p.nextT < now - 0.1) p.nextT = now + 0.05;
      while (p.nextT < now + 0.25 && (!p.out || p.nextT < p.end)) { stepPlayer(p, p.nextT); p.nextT += p.spb; }
    }
    for (let i = players.length - 1; i >= 0; i--) {
      const p = players[i];
      if (p.out && now > p.end + 0.5) { for (const g of [p.g, p.wet, p.arp]) if (g) g.disconnect(); players.splice(i, 1); }
    }
  }
  return A;
}
