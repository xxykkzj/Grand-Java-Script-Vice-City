// All sound is synthesised with Web Audio: a looping synthwave track (bass arpeggio,
// pad, pluck arp, drum machine) plus engine, rotor, skates, rain and explosions.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const BPM = 104, STEP = 60 / BPM / 4;
// Am - F - C - G, root as a MIDI note and whether the third is minor
const CHORDS = [{ root: 45, third: 3 }, { root: 41, third: 4 }, { root: 48, third: 4 }, { root: 43, third: 4 }];
const BASS = [0, null, 12, 0, null, 12, 0, 7, 0, null, 12, 0, 7, 12, 0, 12];

export function createAudio() {
  let ctx = null, master, music, mfilt, sfx, noise, arpBus, timer = 0, nextT = 0, stepI = 0;
  let eng, rotor, skate, rain, siren, heyT = 0;
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
      master.connect(comp); comp.connect(ctx.destination);
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
    setMuted(m) { A.muted = m; if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.03); },
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
      siren.gain.setTargetAtTime((s.siren || 0) * 0.07, t, 0.15);
      // room: 0 street, 1 a shop or the bar (radio in the corner), 2 Club Prism (loud)
      music.gain.setTargetAtTime(s.room === 2 ? (s.duck ? 0.5 : 1.05) : s.duck ? 0.3 : s.room === 1 ? 0.42 : 0.55, t, 0.3);
      mfilt.frequency.setTargetAtTime(s.room === 1 ? 1500 : 16000, t, 0.25);
    },
    club: false,
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
    horn(vol = 1) { if (vol <= 0) return; tone('square', 392, 392, 0.32, 0.05 * vol); tone('square', 494, 494, 0.32, 0.05 * vol); },
    cash() { tone('square', 1320, 1320, 0.05, 0.05); tone('square', 1760, 1760, 0.09, 0.05, 0.05); },
    pickup() { tone('triangle', 660, 660, 0.08, 0.14); tone('triangle', 990, 990, 0.08, 0.14, 0.07); tone('triangle', 1320, 1320, 0.2, 0.14, 0.14); },
    win() { [0, 4, 7, 12, 16].forEach((n, i) => tone('square', mtof(69 + n), mtof(69 + n), 0.22, 0.07, i * 0.09)); },
    lose() { [7, 4, 0, -5].forEach((n, i) => tone('sawtooth', mtof(57 + n), mtof(56 + n), 0.3, 0.08, i * 0.16)); },
    star() { tone('square', 880, 440, 0.16, 0.08); tone('square', 880, 440, 0.16, 0.08, 0.18); },
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
  function schedule(step, t) {
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
    // inside Club Prism the DJ adds claps and an off-beat open hat
    if (A.club) { if (s === 4 || s === 12) hit(0.3, 0.2, 'bandpass', 1900, 0, t, music); if (s % 4 === 2) hit(0.16, 0.22, 'highpass', 9000, 0, t, music); if (s % 8 === 6) note('square', ch.root + 24, t, 0.1, 0.05, 3000, arpBus); }
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
      nextT += STEP; stepI = (stepI + 1) % 64;
    }
  }
  return A;
}
