// All sound is synthesised with Web Audio: a looping synthwave track (bass arpeggio,
// pad, pluck arp, drum machine) plus engine, rotor, skates, rain and explosions. The one exception is the
// Blue Pelican Lounge, which streams recorded tracks from assets/music (audio/music.js) through recordBus().
import { BPM } from '../core/util.js';
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const STEP = 60 / BPM / 4;
// Am - F - C - G, root as a MIDI note and whether the third is minor
const CHORDS = [{ root: 45, third: 3 }, { root: 41, third: 4 }, { root: 48, third: 4 }, { root: 43, third: 4 }];
const BASS = [0, null, 12, 0, null, 12, 0, 7, 0, null, 12, 0, 7, 12, 0, 12];

export function createAudio() {
  let ctx = null, master, music, mfilt, sfx, noise, arpBus, timer = 0, nextT = 0, stepI = 0, song = 0;
  let eng, rotor, skate, rain, siren, hum, spray, fire, uw, ufilt, heyT = 0, zapT = 0, splashT = 0;
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

      const loop = (filterType, freq, q = 0.7) => {
        const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain(); g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(sfx); src.start();
        return { f, g };
      };
      skate = loop('bandpass', 1500, 0.6);
      rain = loop('highpass', 2600);
      spray = loop('bandpass', 1900, 0.5);
      // a burning car: low crackling noise, its level jittered every frame
      fire = loop('bandpass', 700, 0.45);
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
      o1.connect(ef); o2.connect(ef); ef.connect(eg); eg.connect(sfx); o1.start(); o2.start();
      eng = { o1, o2, f: ef, g: eg };

      // patrol siren: a square wave wailing between two pitches
      const so = ctx.createOscillator(); so.type = 'square'; so.frequency.value = 760;
      const sl = ctx.createOscillator(); sl.type = 'triangle'; sl.frequency.value = 0.55;
      const sd = ctx.createGain(); sd.gain.value = 230;
      const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1100; sf.Q.value = 0.8;
      const sg = ctx.createGain(); sg.gain.value = 0;
      sl.connect(sd); sd.connect(so.frequency); so.connect(sf); sf.connect(sg); sg.connect(sfx); so.start(); sl.start();
      siren = sg;

      nextT = ctx.currentTime + 0.1;
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
    suspend() { if (ctx) ctx.suspend(); },
    resume() { if (ctx) ctx.resume(); },
    // continuous layers, called every frame. Values are 0..1.
    update(s) {
      if (!ctx) return;
      const t = ctx.currentTime;
      eng.g.gain.setTargetAtTime(s.engine > 0 ? 0.1 + s.engineRev * 0.08 : 0, t, 0.08);
      const f = (s.heavy ? 34 : 52) + s.engineRev * (s.heavy ? 50 : 150);
      eng.o1.frequency.setTargetAtTime(f, t, 0.06); eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
      eng.f.frequency.setTargetAtTime(280 + s.engineRev * 1400, t, 0.08);
      skate.g.gain.setTargetAtTime(s.skate * 0.12, t, 0.08);
      skate.f.frequency.setTargetAtTime(900 + s.skate * 1800, t, 0.1);
      rotor.g.gain.setTargetAtTime(s.rotor * 0.55, t, 0.15);
      rotor.lfo.frequency.setTargetAtTime(3 + s.rotor * 11, t, 0.2);
      rain.g.gain.setTargetAtTime(s.rain * 0.09, t, 0.4);
      spray.g.gain.setTargetAtTime((s.spray || 0) * 0.08, t, 0.2);
      hum.gain.setTargetAtTime((s.hum || 0) * 0.035, t, 0.3);
      siren.gain.setTargetAtTime((s.siren || 0) * 0.07, t, 0.15);
      fire.g.gain.setTargetAtTime((s.fire || 0) * (0.05 + Math.random() * 0.07), t, 0.05);
      fire.f.frequency.setTargetAtTime(500 + Math.random() * 600, t, 0.05);
      ufilt.frequency.setTargetAtTime(s.under ? 650 : 22000, t, s.under ? 0.08 : 0.15);
      uw.g.gain.setTargetAtTime(s.under ? 0.07 : 0, t, 0.2);
      // a sputtering engine coughs: the engine layer dips while the throttle is cut
      if (s.cough) eng.g.gain.setTargetAtTime(0.02, t, 0.02);
      // room: 0 street, 1 a shop or the bar (radio in the corner), 2 Club Prism (loud)
      // Club Prism: s.club scales the system (quiet before the flyers go out, louder at the Dance-Off),
      // s.lounge is 1 in the booth lounge, where the music is softer and duller
      // room 3: the Blue Pelican Lounge. Its recorded tracks (s.rec, 0..1 as they fade in) take over from the
      // synth; with no records the house synth plays there, a little softer and warmer than on the street
      const ck = s.club || 1, lg = s.lounge || 0, rec = s.rec || 0;
      const mg = s.room === 2 ? (s.duck ? 0.5 : 1.05) * ck * (1 - lg * 0.4) : s.duck ? 0.3 : s.room === 1 ? 0.42 : s.room === 3 ? 0.46 : 0.55;
      music.gain.setTargetAtTime(mg * (1 - rec), t, 0.3);
      mfilt.frequency.setTargetAtTime(s.room === 1 ? 1500 : s.room === 3 ? 5200 : s.room === 2 ? 16000 - lg * 13000 - (1 - Math.min(ck, 1)) * 9000 : 16000, t, 0.25);
      if (A._rec) A._rec.gain.setTargetAtTime(s.duck ? 0.5 : 0.9, t, 0.3);
    },
    club: false,
    // ---- the sea: a splash, a stroke, wading steps, bubbles, the shark's tense sting and its chomp (all synthesised)
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
    // typewriter blip for subtitles, pitched per character
    talk(pitch = 1) { tone('square', 420 * pitch, 380 * pitch, 0.035, 0.022); },
    jump() { tone('sine', 300, 620, 0.12, 0.08); },
    thud(k = 1) { hit(0.3 * k, 0.12, 'lowpass', 500); tone('sine', 110, 50, 0.12, 0.25 * k); },
    shot() { hit(0.5, 0.18, 'lowpass', 1400); tone('square', 160, 40, 0.16, 0.25); },
    boom() { hit(0.95, 1.1, 'lowpass', 1100, 70); tone('sine', 95, 28, 0.7, 0.8); },
    thunder() { hit(0.5, 2.4, 'lowpass', 260, 60); tone('sine', 55, 30, 1.6, 0.25); },
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

  function tone(type, f0, f1, dur, vol, delay = 0, bus = sfx) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  function hit(vol, dur, type, freq, sweepTo = 0, t = 0, bus = sfx) {
    if (!ctx) return;
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
  function riser(t, dur) {
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + dur * 0.97); g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f); f.connect(g); g.connect(music); src.start(t); src.stop(t + dur + 0.05);
  }
  function kick(t, v = 0.95) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.13);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g); g.connect(music); o.start(t); o.stop(t + 0.3);
  }
  // Club Prism's own track: same key and tempo as the street tune, built in 16-bar phrases
  // (12 bars of groove, a 2-bar breakdown, a 2-bar build, then the drop)
  const CBASS = [null, null, 12, null, null, 0, 12, null, null, null, 12, 0, 7, null, 12, 10];
  function clubStep(step, t) {
    const pb = Math.floor(step / 16) % 16, s = step & 15, ch = CHORDS[(step >> 4) % 4];
    const brk = pb === 12 || pb === 13, build = pb >= 14, lift = build ? (pb - 14) * 16 + s : 0;
    if (!brk && s % 4 === 0 && !(pb === 15 && s >= 8)) kick(t, pb === 0 && s === 0 ? 1.1 : 0.95);
    if (!brk && !build && (s === 4 || s === 12)) { hit(0.32, 0.18, 'bandpass', 1700, 0, t, music); hit(0.2, 0.12, 'highpass', 2600, 0, t + 0.012, music); }
    if (build) {   // snare roll that speeds up into the drop
      const every = lift < 16 ? 4 : lift < 24 ? 2 : 1;
      if (s % every === 0) hit(0.08 + lift * 0.007, 0.1, 'bandpass', 1500 + lift * 40, 0, t, music);
      if (lift === 0) riser(t, STEP * 32);
    }
    if (!brk) {
      hit(s % 4 === 2 ? 0.1 : 0.045, 0.03, 'highpass', 8000, 0, t, music);
      if (s % 4 === 2) hit(0.13, 0.2, 'highpass', 9500, 0, t, music);
    } else if (s % 4 === 2) hit(0.05, 0.05, 'highpass', 9000, 0, t, music);
    // bass: offbeat octave line (a long sub note in the breakdown)
    if (brk) { if (s === 0) note('sine', ch.root - 12, t, STEP * 15, 0.3, 300, music); }
    else if (CBASS[s] !== null) note('sawtooth', ch.root - 12 + CBASS[s], t, STEP * 0.9, 0.28, build ? 500 + lift * 30 : 1100, music);
    // chord stabs on the off-beats
    if (!brk && (s === 3 || s === 10 || (s === 14 && pb % 2))) for (const off of [12, 12 + ch.third, 19]) note('square', ch.root + off, t, 0.16, 0.035, build ? 1200 + lift * 90 : 2600, music);
    // sixteenth-note arpeggio, up and over the chord
    const ARP = [0, 7, 12, ch.third + 12, 19, 12, 7, ch.third + 12];
    if (!brk && (pb >= 2 || s % 2 === 0)) note('square', ch.root + 24 + ARP[s % 8], t, 0.1, build ? 0.02 + lift * 0.001 : 0.028, 3200, arpBus);
    // pad: always there quietly, big in the breakdown
    if (s === 0) for (const off of [0, ch.third, 7, 12]) for (const det of [-8, 8]) note('sawtooth', ch.root + off, t, STEP * 16.5, brk ? 0.05 : 0.018, brk ? 1600 : 900, music, det, 0.3);
    if (brk && (s === 0 || s === 6 || s === 10)) note('triangle', ch.root + 24 + (s === 6 ? 7 : s === 10 ? ch.third : 12), t, STEP * 4, 0.07, 3000, arpBus, 0, 0.02);
  }
  function schedule(step, t) {
    if (A.club) return clubStep(song, t);
    const bar = (step >> 4) % 4, s = step & 15, ch = CHORDS[bar];
    // drums
    if (s % 4 === 0) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g); g.connect(music); o.start(t); o.stop(t + 0.26);
    }
    if (s === 4 || s === 12) { hit(0.38, 0.16, 'highpass', 1400, 0, t, music); note('triangle', 55, t, 0.08, 0.2, 2000, music); }
    if (s % 2 === 0) hit(s % 4 === 2 ? 0.13 : 0.07, s % 4 === 2 ? 0.09 : 0.035, 'highpass', 7500, 0, t, music);
    // bass
    if (BASS[s] !== null) note('sawtooth', ch.root - 12 + BASS[s], t, STEP * 0.95, 0.3, 900, music);
    // pluck arp up and down the chord
    const tones = [0, ch.third, 7, 12, 7, ch.third, 12, 7];
    if (step >= 16) note('square', ch.root + 12 + tones[s % 8], t, 0.14, 0.05, 2600, arpBus);
    // pad, one chord per bar
    if (s === 0) for (const off of [0, ch.third, 7]) for (const det of [-7, 7]) note('sawtooth', ch.root + off, t, STEP * 16.5, 0.028, 1100, music, det, 0.35);
    // a small lead phrase on the second half of the loop
    if (step >= 32 && (s === 0 || s === 6 || s === 10)) note('triangle', ch.root + 24 + (s === 6 ? 7 : s === 10 ? ch.third : 12), t, STEP * 3.5, 0.06, 3000, arpBus, 0, 0.02);
  }
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    if (nextT < ctx.currentTime - 0.1) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.25) {
      schedule(stepI, nextT);
      nextT += STEP; stepI = (stepI + 1) % 64; song++;
    }
  }
  return A;
}
