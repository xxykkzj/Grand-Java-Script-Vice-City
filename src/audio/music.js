// The Blue Pelican Lounge's record player: streams the recorded tracks listed in assets/music/manifest.json
// (see assets/music/README.md for the licences that are allowed and how to add tracks). Nothing is bundled
// into dist/index.html: the files are fetched next to the game when it is served over http(s).
//
// It plays through the game's audio graph (audio.recordBus(), behind the master gain), so the volume follows
// the game and M mutes it. Entering the lounge fades it in, leaving fades it out and pauses it; a track that
// ends moves on to the next one, and skip() does that by hand (the jukebox and the stage).
// No tracks, a missing manifest or a file:// page (fetch is blocked there): the lounge keeps the game's own
// synthesised music and says so in a small note.
const LICENCE_OK = /(public[\s-]*domain|\bcc0\b|^cc[\s-]*by(?![\s-]*(nc|nd|sa)))/i;
const MANIFEST = '../assets/music/manifest.json';

export function createMusic(audio) {
  const S = {
    status: 'idle',            // idle | loading | ready | none | offline | error
    note: '', tracks: [], i: 0, level: 0, playing: false, skips: 0, started: 0, failed: 0,
  };
  let el = null, node = null, gain = null, want = 0, loadP = null, base = null;

  function load() {
    if (loadP) return loadP;
    S.status = 'loading';
    let url;
    try { url = new URL(MANIFEST, location.href); } catch (e) { url = null; }
    if (!url || !/^https?:$/.test(url.protocol)) {
      S.status = 'offline'; S.note = 'Recorded music only plays when the game is served over http(s). The house synth is sitting in.';
      return (loadP = Promise.resolve(S));
    }
    base = url;
    loadP = fetch(url, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((j) => {
        const list = Array.isArray(j) ? j : Array.isArray(j && j.tracks) ? j.tracks : [];
        S.tracks = list.filter((t) => {
          const ok = t && typeof t.file === 'string' && t.file && typeof t.title === 'string' && LICENCE_OK.test(String(t.licence || '').trim());
          if (t && !ok) console.warn('music: skipped a track without a file, title or an allowed licence', t);
          return ok;
        });
        if (S.tracks.length) { S.status = 'ready'; S.note = ''; S.i = Math.floor(Math.random() * S.tracks.length); }
        else { S.status = 'none'; S.note = 'No records in the crate yet (assets/music is empty), so the house synth is playing.'; }
        return S;
      })
      .catch(() => { S.status = 'offline'; S.note = "Couldn't reach the record crate (assets/music), so the house synth is playing."; return S; });
    return loadP;
  }

  const current = () => (S.status === 'ready' ? S.tracks[S.i % S.tracks.length] : null);
  function wire() {
    if (!el) {
      el = new Audio();
      el.preload = 'auto';
      el.addEventListener('ended', () => next(true));
      el.addEventListener('error', () => {
        S.failed++;
        // every track failed once in a row: give up and fall back to the synth
        if (S.failed >= S.tracks.length) { S.status = 'error'; S.note = "The records wouldn't play here, so the house synth is playing."; stop(); if (api.onChange) api.onChange(); return; }
        next(true);
      });
      el.addEventListener('playing', () => { S.failed = 0; });
    }
    const bus = audio.recordBus();
    if (bus && !node) {
      try { node = bus.ctx.createMediaElementSource(el); gain = bus.ctx.createGain(); gain.gain.value = 0; node.connect(gain); gain.connect(bus.out); } catch (e) { node = null; }
    }
  }
  function begin() {
    const t = current();
    if (!t) return;
    wire();
    el.src = new URL(t.file, base).href;
    S.started++;
    const p = el.play();
    S.playing = true;
    if (p && p.catch) p.catch(() => { /* autoplay refused or a bad file: the error handler moves on */ });
    if (api.onChange) api.onChange();
  }
  function stop() { if (el) { el.pause(); } S.playing = false; }
  function next(auto) {
    if (S.status !== 'ready') return false;
    S.i = (S.i + 1) % S.tracks.length;
    if (!auto) S.skips++;
    if (want > 0) begin();
    return true;
  }

  const api = {
    state: S, load, current,
    onChange: null,
    get usingRecords() { return S.status === 'ready' && S.playing; },
    // the jukebox / the stage: the next record (false when there are none and the synth is playing)
    skip() { return next(false); },
    // every frame: inside = the courier is in the lounge
    update(dt, inside, paused) {
      want = inside ? 1 : 0;
      if (inside && S.status === 'idle') load();
      if (S.status === 'ready' && want && !S.playing && !paused) begin();
      if (S.playing && el) {
        if (paused && !el.paused) el.pause();
        else if (!paused && el.paused && want) { const p = el.play(); if (p && p.catch) p.catch(() => {}); }
      }
      // fade: about a second in, 1.5 s out
      S.level += (want - S.level) * Math.min(1, dt * (want ? 2.6 : 1.8));
      if (!want && S.level < 0.01) { S.level = 0; if (S.playing) stop(); }
      if (gain) gain.gain.value = S.level;
      else if (el) { el.volume = Math.max(0, Math.min(1, S.level * 0.9)); el.muted = audio.muted; }
    },
    // how much the records are carrying the room (the synth is ducked by this much)
    get rec() { return S.playing && S.status === 'ready' ? S.level : 0; },
  };
  return api;
}
