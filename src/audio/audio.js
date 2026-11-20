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

export function createAudio() {
  let ctx = null, master, music, mfilt, sfx, noise, arpBus, space, timer = 0, nextT = 0, song = 0;
  // music state: on (the player's switch), keep (street music stays on, no auto-off), fired (the auto-off happened)
  let pref = null;
  try { pref = localStorage.getItem(MUSIC_KEY); } catch (e) { pref = null; }
  const mus = { on: pref !== 'off', keep: pref === 'on', fired: false, until: AUTO_OFF, slow: false };
  const players = [];                 // themes playing now (two while crossfading)
  const savePref = (v) => { try { localStorage.setItem(MUSIC_KEY, v); } catch (e) { /* private mode */ } };
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
    engineGain() { return eng ? +eng.g.gain.value.toFixed(3) : 0; },
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
      // engine: loud only while the revs are changing (pulling away, braking, shifting); at a steady cruise the
      // ear tunes it out, so it settles to a soft hum after a few seconds and sits under the music. Pitch climbs
      // through four gears instead of one endless drone.
      const edt = Math.min(0.1, Math.max(0, t - (eng.lastT || t))); eng.lastT = t;
      const rev = s.engineRev || 0, prevS = eng.sRev || 0;
      eng.sRev = prevS + (rev - prevS) * Math.min(1, edt / 0.8);           // smoothed revs: ignore small wobbles
      const dRev = edt > 0 ? Math.abs(eng.sRev - prevS) / edt : 0;
      eng.calm = eng.calm == null ? 0 : dRev > 0.1 ? Math.max(0, eng.calm - edt * 3) : Math.min(1, eng.calm + edt / 4);
      const musicUp = mus.on && players.some((p) => !p.out) ? 1 : 0;
      const eGain = s.engine > 0 ? (0.035 + rev * 0.06) * (1 - 0.65 * eng.calm) * (1 - 0.35 * musicUp) : 0;
      eng.g.gain.setTargetAtTime(eGain, t, 0.12);
      const gears = s.heavy ? 2 : 4, gx = Math.min(rev, 0.999) * gears, frac = gx - Math.floor(gx);
      const wob = 1 + 0.012 * Math.sin(t * 2.3) + 0.008 * Math.sin(t * 5.1);
      const f = ((s.heavy ? 34 : 50) + (0.35 + 0.65 * frac) * (s.heavy ? 40 : 95) + Math.floor(gx) * (s.heavy ? 6 : 10)) * wob;
      eng.o1.frequency.setTargetAtTime(f, t, 0.07); eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.07);
      eng.f.frequency.setTargetAtTime((220 + rev * 900) * (1 - 0.3 * eng.calm), t, 0.1);
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
