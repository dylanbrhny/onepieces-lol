// Chiptune sound made in code (Web Audio), so there are no files to ship.
// Music: three original tunes (port jig, sea march, wanted calypso). To use your own track, set GAME_CONFIG.audio.music to a file path.
(function () {
  "use strict";
  const C = window.GAME_CONFIG, A = C.audio || {};
  const key = k => `${C.storageKey}:${k}`;
  const load = (k, d) => { try { const v = localStorage.getItem(key(k)); return v == null ? d : v === "1"; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(key(k), v ? "1" : "0"); } catch (e) { /* ignore */ } };

  let ctx = null, sfxBus = null, musicBus = null, musicVolNode = null, sfxVolNode = null;
  // player volume sliders: 0..1 each, 0.7 = the original loudness (gain = v / 0.7)
  const VOL_DEFAULT = 0.7;
  const loadVol = k => { try { const v = parseFloat(localStorage.getItem(key("vol-" + k))); return isFinite(v) ? Math.min(1, Math.max(0, v)) : VOL_DEFAULT; } catch (e) { return VOL_DEFAULT; } };
  const vol = { music: loadVol("music"), sfx: loadVol("sfx") };
  const volScale = k => vol[k] / VOL_DEFAULT;
  const musicElVolume = () => Math.min(1, (A.musicVolume ?? 0.5) * volScale("music"));
  const clipElVolume = () => Math.min(1, (A.sfxVolume ?? 0.6) * 1.4 * volScale("sfx"));
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
      // sfxBus -> sfxVolNode -> speakers; musicBus (ducking) -> [compressor] -> musicVolNode -> speakers
      sfxVolNode = ctx.createGain(); sfxVolNode.gain.value = volScale("sfx"); sfxVolNode.connect(ctx.destination);
      musicVolNode = ctx.createGain(); musicVolNode.gain.value = volScale("music"); musicVolNode.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.22 * (A.sfxVolume ?? 0.6) / 0.6; sfxBus.connect(sfxVolNode);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.09 * (A.musicVolume ?? 0.5) / 0.5; musicBus.connect(musicVolNode);
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
        src.buffer = buf; src.connect(g); g.connect(sfxVolNode);
        src.start(0, Math.min(bc.from || 0, buf.duration - 0.05), len);
        duckMusic(len);
        return Math.round(len * 1000);
      }
      loadClip(name);                                        // not decoded yet: fall back to a plain audio element
      const el = clipEls[name] || (clipEls[name] = Object.assign(new Audio(bc.file), { preload: "auto" }));
      if (el._failed) return 0;
      try {
        el.pause();
        const go = () => { try { el.currentTime = bc.from || 0; } catch (e) { /* not seekable yet */ } const p = el.play(); if (p && p.catch) p.catch(() => {}); };
        el.volume = clipElVolume();
        if (el.readyState >= 1) go(); else el.addEventListener("loadedmetadata", go, { once: true });
        clearTimeout(clipStops[name]);
        clipStops[name] = setTimeout(() => el.pause(), len * 1000);
        duckMusic(len);
      } catch (e) { return 0; }
      return Math.round(len * 1000);
    },
    preloadVoice() { for (const name of ["burstClip", "gustClip"]) loadClip(name); },
    get sfxOn() { return sfxOn; }, get musicOn() { return musicOn; },
    toggleSfx() { sfxOn = !sfxOn; save("sfx", sfxOn); if (sfxOn) this.click(); return sfxOn; },
    toggleMusic() { musicOn = !musicOn; save("music-v2", musicOn); musicOn ? startMusic() : stopMusic(); return musicOn; }
  };

  // ---------- music: three original tunes, one per scene ----------
  // Port: a sea-shanty jig. At sea: an adventurous brass march. Wanted poster: a calypso with a fanfare.
  // All melodies are written for this game. Songs are note strings: "D5:2 F#5:1 -:3" = note:steps, "-" = rest.
  // Chords: one token per bar; "G.A" = G for the first half of the bar, A for the second.
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midiOf = t => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(t); return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); };
  function parseLine(str) {                       // -> { at: Map(step -> [midi, len]), len }
    const at = new Map(); let pos = 0;
    for (const tok of str.trim().split(/[\s|]+/).filter(Boolean)) {
      const [n, l] = tok.split(":"), len = +l || 1;
      if (n !== "-") at.set(pos, [midiOf(n), len]);
      pos += len;
    }
    return { at, len: pos };
  }
  const QUAL = { "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], sus: [0, 5, 7] };
  const chordOf = name => { const m = /^([A-G][#b]?)(m|7|sus)?$/.exec(name); return { root: PC[m[1][0]] + (m[1][1] === "#" ? 1 : m[1][1] === "b" ? -1 : 0), tones: QUAL[m[2] || ""] }; };
  const parseChords = str => str.trim().split(/\s+/).map(tok => tok.split(".").map(chordOf));

  const SONGS = {
    port: {   // "Harbor Jig": 6/8 sea shanty in D major with a mixolydian C
      step: 0.172, perBar: 6, level: 1.6,
      chords: "D G A A D C A D Bm A G D Bm C G.A D",
      lead: "D5:2 F#5:1 A5:2 F#5:1 | G5:2 B5:1 A5:2 F#5:1 | E5:1 F#5:1 G5:1 A5:2 D5:1 | E5:2 C#5:1 A4:3 | D5:2 F#5:1 A5:2 D6:1 | C6:2 A5:1 G5:2 E5:1 | F#5:1 G5:1 A5:1 G5:2 E5:1 | D5:5 -:1 |" +
            "B5:2 A5:1 B5:2 D6:1 | C#6:2 B5:1 A5:3 | G5:2 F#5:1 G5:2 B5:1 | A5:2 G5:1 F#5:3 | B5:2 A5:1 B5:2 D6:1 | E6:2 D6:1 C6:2 A5:1 | B5:1 A5:1 G5:1 F#5:2 E5:1 | D5:3 A4:1 B4:1 C#5:1",
      style: "jig"
    },
    sea: {    // "Set Sail": brass march in A minor
      step: 0.1136, perBar: 16, level: 1.45,
      chords: "Am F C G Am F G E F G Em Am F G C E",
      lead: "A4:3 A4:1 C5:2 E5:2 A5:6 G5:2 | F5:3 E5:1 C5:2 A4:2 C5:8 | E5:3 D5:1 C5:2 E5:2 G5:6 F5:2 | D5:3 C5:1 B4:2 G4:2 D5:8 | A4:3 A4:1 C5:2 E5:2 A5:4 B5:2 C6:2 | C6:3 B5:1 A5:2 F5:2 A5:8 | B5:3 A5:1 G5:2 D5:2 G5:4 F5:2 D5:2 | E5:12 G#5:2 B5:2 |" +
            "A5:4 F5:2 A5:2 C6:6 A5:2 | B5:4 G5:2 B5:2 D6:6 B5:2 | G5:3 E5:1 G5:2 B5:2 E6:4 D6:4 | C6:3 B5:1 A5:2 E5:2 A5:8 | F5:2 A5:2 C6:2 F5:2 E6:4 C6:4 | D5:2 G5:2 B5:2 D6:2 C6:4 B5:4 | C6:6 B5:2 A5:4 G5:4 | G#5:4 B5:4 E6:4 -:4",
      style: "march"
    },
    wanted: { // "Wanted": brass fanfare, then a calypso in G major
      step: 0.129, perBar: 16, level: 1.7,
      introChords: "G G",
      intro: "G4:2 G4:1 G4:1 D5:4 G5:6 B5:2 | D6:16",
      chords: "G C D G Em C D G",
      lead: "D5:2 G5:2 B5:3 A5:1 G5:2 B5:2 D6:4 | E6:3 D6:1 C6:2 E6:2 G5:8 | F#5:2 A5:2 D6:3 C6:1 B5:2 A5:2 F#5:4 | G5:3 A5:1 B5:4 G5:8 | B5:2 E6:2 G6:3 F#6:1 E6:2 D6:2 B5:4 | C6:3 B5:1 A5:2 G5:2 E5:8 | F#5:2 A5:2 C6:2 B5:2 A5:3 G5:1 F#5:4 | G5:12 -:4",
      style: "calypso"
    }
  };
  for (const s of Object.values(SONGS)) {
    s.leadP = parseLine(s.lead); s.chordP = parseChords(s.chords); s.loopSteps = s.chordP.length * s.perBar;
    if (s.intro) { s.introP = parseLine(s.intro); s.introChordP = parseChords(s.introChords); s.introSteps = s.introChordP.length * s.perBar; }
  }
  const SCENE_SONG = { title: "port", port: "port", play: "sea", sea: "sea", result: "wanted", wanted: "port", debug: "port" };

  // ---------- instruments (all scheduled at time t into the current song's gain) ----------
  let noiseBuf = null, pulse25 = null, pulse12 = null, musicOut = null, musicBase = 0;
  function pulseWave(duty) {
    const n = 64, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return ctx.createPeriodicWave(re, im);
  }
  function setupMusic() {
    if (musicOut) return;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    pulse25 = pulseWave(0.25); pulse12 = pulseWave(0.125);
    // musicBus -> compressor -> speakers, with a little echo for space
    musicBase = musicBus.gain.value;
    musicBus.disconnect();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    musicBus.connect(comp); comp.connect(musicVolNode);
    musicOut = ctx.createGain();                                  // songs -> musicOut -> musicBus (+ echo)
    const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = 0.22; fb.gain.value = 0.28; wet.gain.value = 0.18;
    musicOut.connect(musicBus); musicOut.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(musicBus);
  }
  function env(g, t, vol, atk, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.setValueAtTime(vol, t + Math.max(atk, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function osc(type, f, t, end, out, detune = 0) {
    const o = ctx.createOscillator();
    if (type === "p25") o.setPeriodicWave(pulse25); else if (type === "p12") o.setPeriodicWave(pulse12); else o.type = type;
    o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune;
    o.connect(out); o.start(t); o.stop(end + 0.05);
    return o;
  }
  const INST = {
    accordion(out, f, t, dur, v) {
      const g = ctx.createGain(); env(g, t, v * 0.32, 0.015, dur, 0.06); g.connect(out);
      osc("p25", f, t, t + dur, g, -7); osc("p25", f, t, t + dur, g, 7);
    },
    whistle(out, f, t, dur, v) {
      const g = ctx.createGain(); env(g, t, v * 0.5, 0.03, dur, 0.08); g.connect(out);
      const a = osc("triangle", f, t, t + dur, g);
      const h = ctx.createGain(); h.gain.value = 0.12; h.connect(g); osc("sine", f * 2, t, t + dur, h);
      if (dur > 0.2) {
        const lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.frequency.value = 5.5; depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(f * 0.006, t + 0.12 + 0.1);
        lfo.connect(depth); depth.connect(a.frequency); lfo.start(t + 0.12); lfo.stop(t + dur + 0.05);
      }
    },
    brass(out, f, t, dur, v) {
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 2;
      lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.05); lp.frequency.linearRampToValueAtTime(1600, t + 0.2);
      const g = ctx.createGain(); env(g, t, v * 0.3, 0.03, dur, 0.06);
      lp.connect(g); g.connect(out);
      osc("sawtooth", f, t, t + dur, lp, -4); osc("sawtooth", f, t, t + dur, lp, 4);
    },
    steel(out, f, t, dur, v) {
      const d = Math.max(0.5, Math.min(dur, 1.2));
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.55, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d); g.connect(out);
      osc("sine", f, t, t + d, g);
      const h = ctx.createGain(); h.gain.setValueAtTime(0.4, t); h.gain.exponentialRampToValueAtTime(0.01, t + 0.25); h.connect(g); osc("sine", f * 2 * 1.003, t, t + d, h);
    },
    bass(out, f, t, dur, v) { const g = ctx.createGain(); env(g, t, v * 0.7, 0.01, dur, 0.05); g.connect(out); osc("triangle", f, t, t + dur, g); },
    pad(out, f, t, dur, v) {
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
      const g = ctx.createGain(); env(g, t, v * 0.08, Math.min(0.3, dur / 3), dur, 0.25); lp.connect(g); g.connect(out);
      osc("sawtooth", f, t, t + dur, lp, -9); osc("sawtooth", f, t, t + dur, lp, 9);
    },
    pluck(out, f, t, dur, v) {
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.16, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); g.connect(out);
      osc("p12", f, t, t + 0.12, g);
    }
  };
  function noiseHit(out, t, dur, v, type, freq, q = 1) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  function drop(out, t, f0, f1, dur, v, type = "sine") {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  const DRUM = {
    kick: (o, t, v = 1) => drop(o, t, 150, 45, 0.18, 0.9 * v),
    snare: (o, t, v = 1) => { noiseHit(o, t, 0.13, 0.35 * v, "highpass", 1500); drop(o, t, 180, 150, 0.06, 0.25 * v, "triangle"); },
    hat: (o, t, v = 1) => noiseHit(o, t, 0.035, 0.12 * v, "highpass", 7000),
    tamb: (o, t, v = 1) => { noiseHit(o, t, 0.07, 0.16 * v, "bandpass", 9000, 1.5); noiseHit(o, t + 0.03, 0.06, 0.1 * v, "bandpass", 9000, 1.5); },
    bodhran: (o, t, v = 1, hi = 0) => drop(o, t, 110 + hi, 70 + hi * 0.6, 0.14, 0.7 * v),
    block: (o, t, v = 1) => drop(o, t, 800, 760, 0.05, 0.25 * v)
  };

  // ---------- the scheduler: plays the current song a little ahead of time ----------
  let cur = null;          // { song, gain, step, next } ; step < 0 = still in the intro
  const fq = m => N(m);
  function chordAt(chords, bar, half) { const c = chords[bar % chords.length]; return c[Math.min(c.length - 1, half)]; }
  function playStep(song, gain, s, t, pass, inIntro) {
    const per = song.perBar, bar = Math.floor(s / per), inBar = s % per, half = inBar >= per / 2 ? 1 : 0;
    const ch = chordAt(inIntro ? song.introChordP : song.chordP, bar, half);
    const root = ch.root, dur = song.step;
    const leadNote = (inIntro ? song.introP : song.leadP).at.get(s);
    const lastBar = !inIntro && (bar % 8 === 7);
    if (song.style === "jig") {
      if (leadNote) {
        const [m, len] = leadNote, d = len * dur * 0.95;
        if (pass % 2 === 0) INST.accordion(gain, fq(m), t, d, 1);
        else { INST.whistle(gain, fq(m), t, d, 1); INST.accordion(gain, fq(m - 12), t, d, 0.45); }
      }
      const b = 38 + ((root - 2 + 12) % 12);                        // D2 .. C#3
      if (inBar === 0) INST.bass(gain, fq(b), t, dur * 2.6, 1);
      if (inBar === 3) INST.bass(gain, fq(b + 7), t, dur * 2.6, 0.9);
      if (inBar !== 0 && inBar !== 3) for (const iv of ch.tones) INST.pluck(gain, fq(60 + ((root + iv) % 12)), t, dur, inBar === 1 || inBar === 4 ? 0.8 : 0.6);
      if (inBar === 0) DRUM.bodhran(gain, t, 1);
      if (inBar === 3) DRUM.bodhran(gain, t, 0.7, 40);
      if (inBar === 2 || inBar === 5) { DRUM.bodhran(gain, t, 0.3, 70); DRUM.tamb(gain, t, 0.9); }
    } else if (song.style === "march") {
      if (leadNote) {
        const [m, len] = leadNote, d = len * dur * 0.92;
        INST.brass(gain, fq(m), t, d, 1);
        if (pass % 2 === 1) INST.whistle(gain, fq(m + 12), t, d, 0.35);
      }
      if (inBar % 2 === 0) { const off = [0, 0, 12, 0, 7, 0, 12, 7][inBar / 2]; INST.bass(gain, fq(40 + ((root - 4 + 12) % 12) + off), t, dur * 1.8, 0.9); }
      if (inBar === 0) for (const iv of ch.tones) INST.pad(gain, fq(57 + ((root + iv + 3) % 12)), t, dur * per, 1);
      if (inBar === 0 || inBar === 8) DRUM.kick(gain, t, 0.9);
      if (lastBar && inBar >= 8) DRUM.snare(gain, t, 0.35 + (inBar - 8) * 0.07);
      else if (inBar === 4 || inBar === 12) DRUM.snare(gain, t, 0.8);
      if (inBar % 2 === 0) DRUM.hat(gain, t, inBar % 4 === 0 ? 1 : 0.6);
    } else {   // calypso (and the fanfare intro)
      if (leadNote) {
        const [m, len] = leadNote, d = len * dur * 0.95;
        if (inIntro) { INST.brass(gain, fq(m), t, d, 1.1); INST.brass(gain, fq(m - 12), t, d, 0.6); }
        else INST.steel(gain, fq(m), t, d, 1);
      }
      if (inIntro) {
        if (inBar === 0) { DRUM.kick(gain, t, 1); for (const iv of ch.tones) INST.pad(gain, fq(55 + ((root + iv + 5) % 12)), t, dur * per, 1.4); }
        if (bar === 1 && inBar % 2 === 0) DRUM.snare(gain, t, 0.2 + inBar * 0.04);
        return;
      }
      const b = 43 + ((root - 7 + 12) % 12);                          // G2 .. F#3
      if (inBar === 0) INST.bass(gain, fq(b), t, dur * 5.5, 1);
      if (inBar === 6) INST.bass(gain, fq(b + 12), t, dur * 5.5, 0.85);
      if (inBar === 12) INST.bass(gain, fq(b + 7), t, dur * 3.5, 0.9);
      if (inBar === 2 || inBar === 6 || inBar === 10 || inBar === 14) for (const iv of ch.tones) INST.pluck(gain, fq(55 + ((root + iv + 5) % 12)), t, dur, 0.75);
      if ([0, 3, 6, 10, 12].includes(inBar)) DRUM.block(gain, t, 1);
      if (inBar % 2 === 0) DRUM.hat(gain, t, inBar % 4 === 2 ? 0.9 : 0.45);
      if (inBar === 0 || inBar === 6 || inBar === 8) DRUM.kick(gain, t, inBar === 6 ? 0.6 : 0.85);
    }
  }
  function schedule() {
    if (!cur) return;
    while (cur.next < ctx.currentTime + 0.2) {
      const song = cur.song;
      if (cur.step < 0) {                                       // intro
        const s = song.introSteps + cur.step;
        playStep(song, cur.gain, s, cur.next, 0, true);
      } else {
        playStep(song, cur.gain, cur.step % song.loopSteps, cur.next, Math.floor(cur.step / song.loopSteps), false);
      }
      cur.next += song.step; cur.step++;
    }
  }
  let sceneName = "port";
  function startSong(name, fade) {
    const song = SONGS[name] || SONGS.port;
    if (cur && cur.song === song) return;
    if (cur) {                                                  // fade the old song out, then let it go
      const old = cur.gain, t = ctx.currentTime;
      old.gain.cancelScheduledValues(t); old.gain.setValueAtTime(old.gain.value, t); old.gain.linearRampToValueAtTime(0.0001, t + 0.4);
      setTimeout(() => old.disconnect(), 900);
    }
    const g = ctx.createGain(), t0 = ctx.currentTime + 0.08;
    g.gain.setValueAtTime(fade ? 0.0001 : song.level, t0);
    if (fade) g.gain.linearRampToValueAtTime(song.level, t0 + 0.3);
    g.connect(musicOut);
    cur = { song, gain: g, step: song.introSteps ? -song.introSteps : 0, next: t0 };
  }
  function startMusic() {
    if (!musicOn) return;
    if (A.music) {
      if (!musicEl) { musicEl = new Audio(A.music); musicEl.loop = true; musicEl.volume = musicElVolume(); musicEl.onerror = () => { musicEl = null; A.music = ""; startMusic(); }; }
      musicEl.play().catch(() => {});
      return;
    }
    if (!ensure() || musicTimer) return;
    setupMusic();
    startSong(SCENE_SONG[sceneName] || "port", false);
    musicTimer = setInterval(schedule, 50);
    schedule();
  }
  function stopMusic() {
    if (musicEl) musicEl.pause();
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (cur) { const g = cur.gain; g.gain.cancelScheduledValues(0); g.gain.value = 0; setTimeout(() => g.disconnect(), 300); cur = null; }
  }
  // which screen is showing: title/port, play/sea, result/wanted (see SCENE_SONG)
  Sound.setScene = function (name) {
    sceneName = name;
    if (!musicOn || A.music || !ctx || !musicTimer) return;
    startSong(SCENE_SONG[name] || "port", true);
  };
  // quieter music while a voice clip plays
  function duckMusic(sec) {
    if (!ctx || !musicBus) return;
    const t = ctx.currentTime, base = musicBase || musicBus.gain.value;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(base * 0.25, t + 0.15);
    musicBus.gain.setValueAtTime(base * 0.25, t + sec);
    musicBus.gain.linearRampToValueAtTime(base, t + sec + 0.5);
    if (musicEl) { musicEl.volume = musicElVolume() * 0.25; musicEl._ducked = true; setTimeout(() => { musicEl._ducked = false; musicEl.volume = musicElVolume(); }, sec * 1000); }
  }
  // volume sliders: kind = "music" | "sfx", v = 0..1 (0.7 = default loudness), saved per player
  Sound.volume = kind => vol[kind] ?? VOL_DEFAULT;
  Sound.setVolume = function (kind, v) {
    if (kind !== "music" && kind !== "sfx") return;
    vol[kind] = Math.min(1, Math.max(0, Number(v) || 0));
    try { localStorage.setItem(key("vol-" + kind), String(vol[kind])); } catch (e) { /* ignore */ }
    const node = kind === "music" ? musicVolNode : sfxVolNode;
    if (node && ctx) { const t = ctx.currentTime; node.gain.cancelScheduledValues(t); node.gain.setValueAtTime(node.gain.value, t); node.gain.linearRampToValueAtTime(volScale(kind), t + 0.05); }
    if (kind === "music" && musicEl) musicEl.volume = musicElVolume() * (musicEl._ducked ? 0.25 : 1);
    if (kind === "sfx") for (const el of Object.values(clipEls)) el.volume = clipElVolume();
  };
  Sound._music = { SONGS, get scene() { return cur && Object.keys(SONGS).find(k => SONGS[k] === cur.song); }, get bus() { return musicBus; } };
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopMusic(); else if (musicOn && ctx) startMusic(); });

  window.Sound = Sound;
})();
