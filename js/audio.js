// Chiptune sound made in code (Web Audio), so there are no files to ship.
// Music is an original loop. To use your own track, set GAME_CONFIG.audio.music to a file path.
(function () {
  "use strict";
  const C = window.GAME_CONFIG, A = C.audio || {};
  const key = k => `${C.storageKey}:${k}`;
  const load = (k, d) => { try { const v = localStorage.getItem(key(k)); return v == null ? d : v === "1"; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(key(k), v ? "1" : "0"); } catch (e) { /* ignore */ } };

  let ctx = null, sfxBus = null, musicBus = null;
  let sfxOn = load("sfx", A.sfxDefault ?? true), musicOn = load("music-v2", A.musicDefault ?? true);
  let musicTimer = null, musicEl = null, nextNoteTime = 0, step = 0;
  const clipEls = {}, clipStops = {}, clipBufs = {}, clipLoading = {};
  // fetch + decode a clip once (after the first click, when the audio context exists)
  function loadClip(name) {
    const bc = A[name];
    if (!bc || !bc.file || clipBufs[name] || clipLoading[name] || !ensure()) return;
    clipLoading[name] = true;
    fetch(bc.file).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no)))
      .then(buf => { clipBufs[name] = buf; })
      .catch(() => { clipLoading[name] = false; });       // e.g. opened from a file: the audio element is used instead
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.22 * (A.sfxVolume ?? 0.6) / 0.6; sfxBus.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.09 * (A.musicVolume ?? 0.5) / 0.5; musicBus.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function tone(freq, dur, o = {}) {
    if (!sfxOn && !o.music) return;
    if (!ensure()) return;
    const t = (o.at || ctx.currentTime) + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.linearRampToValueAtTime(Math.max(30, freq + o.slide), t + dur);
    const v = o.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.005);
    g.gain.setValueAtTime(v, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.music ? musicBus : sfxBus);
    osc.start(t); osc.stop(t + dur + 0.03);
  }
  function noise(dur, o = {}) {
    if (!sfxOn || !ensure()) return;
    const t = ctx.currentTime + (o.delay || 0);
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = o.filter || "lowpass"; f.frequency.value = o.freq || 1200;
    g.gain.value = o.vol ?? 0.4;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t);
  }
  const N = n => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz

  const Sound = {
    unlock() { if (ensure() && musicOn) startMusic(); this.preloadVoice(); },
    click() { tone(N(84), 0.05, { vol: 0.15 }); },
    type() { tone(N(96 + Math.floor(Math.random() * 4)), 0.018, { vol: 0.05 }); },
    nope() { tone(N(52), 0.09, { vol: 0.2 }); tone(N(48), 0.12, { vol: 0.2, delay: 0.08 }); },
    // tier 0 (most famous) .. 4 (rarest): more notes, higher, brighter
    good(tierIndex) {
      const scale = [72, 76, 79, 84, 88, 91, 96];
      const n = 2 + tierIndex;
      for (let i = 0; i < n; i++) tone(N(scale[i]), 0.11, { vol: 0.22, delay: i * 0.075 });
      if (tierIndex >= 4) { for (let i = 0; i < 6; i++) tone(N(96 + (i % 2) * 7), 0.06, { vol: 0.1, delay: n * 0.075 + i * 0.05, type: "triangle" }); }
      noise(0.25, { vol: 0.15, freq: 900, delay: 0.02 });
    },
    bad() { tone(N(55), 0.35, { type: "sawtooth", vol: 0.18, slide: -60 }); tone(N(50), 0.4, { type: "square", vol: 0.12, delay: 0.12, slide: -40 }); },
    timeout() { tone(N(60), 0.15, { vol: 0.2 }); tone(N(56), 0.15, { vol: 0.2, delay: 0.16 }); tone(N(52), 0.35, { vol: 0.2, delay: 0.32 }); },
    tick(last) { tone(N(last ? 93 : 88), 0.04, { vol: 0.12, type: "triangle" }); },
    // one Wanted tile flipping over: high = match, middle = partly, low = no
    tile(state, delay = 0) {
      const m = state === "same" ? 84 : state === "near" ? 76 : state === "diff" ? 64 : 70;
      tone(N(m), 0.06, { vol: state === "same" ? 0.18 : 0.12, delay, type: state === "diff" ? "triangle" : "square" });
    },
    stamp() { noise(0.12, { vol: 0.5, freq: 400 }); tone(N(40), 0.12, { vol: 0.25, type: "triangle" }); },
    landfall() { [79, 84, 88].forEach((m, i) => tone(N(m), 0.5 - i * 0.1, { type: "triangle", vol: 0.2, delay: i * 0.09 })); },
    splash() { noise(0.5, { vol: 0.25, freq: 1800, filter: "bandpass" }); },
    fanfare() { [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36], [84, 0.6]].forEach(([m, d]) => { tone(N(m), d === 0.6 ? 0.6 : 0.14, { vol: 0.22, delay: d }); tone(N(m - 12), 0.14, { vol: 0.12, delay: d, type: "triangle" }); }); },

    // the burst: a rising charge, then a boom and a rushing whoosh; the top tier adds a fanfare
    burstCharge(power) {
      if (!sfxOn || !ensure()) return;
      for (let i = 0; i < 6; i++) tone(N(48 + i * 4 + (power >= 4 ? 2 : 0)), 0.09, { vol: 0.16, delay: i * 0.08, type: "square" });
    },
    burstLaunch(power) {
      noise(0.9, { vol: 0.5, freq: 600 });
      tone(N(36), 0.5, { type: "triangle", vol: 0.4, slide: -30 });
      noise(1.1, { vol: 0.22, freq: 2400, filter: "bandpass", delay: 0.05 });
      if (power >= 4) [76, 79, 84, 88, 91].forEach((m, i) => tone(N(m), 0.12, { vol: 0.18, delay: 0.15 + i * 0.07 }));
    },
    burstLand() { noise(0.5, { vol: 0.35, freq: 1500, filter: "bandpass" }); tone(N(43), 0.2, { type: "triangle", vol: 0.25 }); },
    // the burst voice clip (GAME_CONFIG.audio.burstClip): plays from..to, returns its length in ms, 0 if not played
    burstVoice() { return this.playClip("burstClip"); },
    // play a configured clip (GAME_CONFIG.audio[name] = { file, from, to }); returns its length in ms, 0 if not played
    playClip(name) {
      const bc = A[name];
      if (!sfxOn || !bc || !bc.file) return 0;
      const len = Math.max(0.2, (bc.to ?? 0) - (bc.from ?? 0));
      // best: the whole clip decoded into memory, so the exact from..to slice plays (no seeking over the network)
      const buf = clipBufs[name];
      if (buf && ensure()) {
        const src = ctx.createBufferSource(), g = ctx.createGain();
        g.gain.value = Math.min(1.6, (A.sfxVolume ?? 0.6) * 2);
        src.buffer = buf; src.connect(g); g.connect(ctx.destination);
        src.start(0, Math.min(bc.from || 0, buf.duration - 0.05), len);
        return Math.round(len * 1000);
      }
      loadClip(name);                                        // not decoded yet: fall back to a plain audio element
      const el = clipEls[name] || (clipEls[name] = Object.assign(new Audio(bc.file), { preload: "auto" }));
      if (el._failed) return 0;
      try {
        el.pause();
        const go = () => { try { el.currentTime = bc.from || 0; } catch (e) { /* not seekable yet */ } const p = el.play(); if (p && p.catch) p.catch(() => {}); };
        el.volume = Math.min(1, (A.sfxVolume ?? 0.6) * 1.4);
        if (el.readyState >= 1) go(); else el.addEventListener("loadedmetadata", go, { once: true });
        clearTimeout(clipStops[name]);
        clipStops[name] = setTimeout(() => el.pause(), len * 1000);
      } catch (e) { return 0; }
      return Math.round(len * 1000);
    },
    preloadVoice() { for (const name of ["burstClip", "gustClip"]) loadClip(name); },
    get sfxOn() { return sfxOn; }, get musicOn() { return musicOn; },
    toggleSfx() { sfxOn = !sfxOn; save("sfx", sfxOn); if (sfxOn) this.click(); return sfxOn; },
    toggleMusic() { musicOn = !musicOn; save("music-v2", musicOn); musicOn ? startMusic() : stopMusic(); return musicOn; }
  };

  // ---------- music: an original 8-bar loop in D minor (eighth-note grid) ----------
  // [midi note, length in eighths]; 0 = rest
  const LEAD = [
    [74, 2], [74, 1], [76, 1], [77, 2], [81, 2],   [79, 2], [77, 1], [76, 1], [74, 4],
    [72, 2], [72, 1], [74, 1], [76, 2], [79, 2],   [77, 2], [76, 1], [74, 1], [72, 4],
    [74, 2], [74, 1], [76, 1], [77, 2], [81, 2],   [82, 2], [81, 1], [79, 1], [81, 4],
    [79, 2], [77, 1], [76, 1], [77, 2], [76, 1], [72, 1], [74, 6], [0, 2]
  ];
  const BASS_ROOTS = [50, 55, 48, 53, 50, 46, 48, 50]; // D G C F D Bb C D
  const EIGHTH = 60 / 150 / 2;
  const leadAt = []; // expand lead to a per-eighth table of note starts
  { let pos = 0; for (const [n, len] of LEAD) { leadAt[pos] = [n, len]; pos += len; } }
  const LOOP = 64;

  function schedule() {
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const s = step % LOOP, bar = Math.floor(s / 8);
      const lead = leadAt[s];
      if (lead && lead[0]) tone(N(lead[0]), lead[1] * EIGHTH * 0.9, { music: true, at: nextNoteTime, vol: 0.5, type: "square" });
      if (s % 2 === 0) {
        const root = BASS_ROOTS[bar], n = (s % 8 === 4) ? root + 7 : root;
        tone(N(n - 12), EIGHTH * 1.8, { music: true, at: nextNoteTime, vol: 0.7, type: "triangle" });
      }
      if (s % 4 === 2) tone(N(96), 0.02, { music: true, at: nextNoteTime, vol: 0.12, type: "square" });
      nextNoteTime += EIGHTH; step++;
    }
  }
  function startMusic() {
    if (!musicOn) return;
    if (A.music) {
      if (!musicEl) { musicEl = new Audio(A.music); musicEl.loop = true; musicEl.volume = A.musicVolume ?? 0.5; musicEl.onerror = () => { musicEl = null; A.music = ""; startMusic(); }; }
      musicEl.play().catch(() => {});
      return;
    }
    if (!ensure() || musicTimer) return;
    nextNoteTime = ctx.currentTime + 0.1; step = 0;
    musicTimer = setInterval(schedule, 60);
  }
  function stopMusic() {
    if (musicEl) musicEl.pause();
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopMusic(); else if (musicOn && ctx) startMusic(); });

  window.Sound = Sound;
})();
