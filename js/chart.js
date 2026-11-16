// The voyage scene: a side-view pixel-art sea. The ship sails right as you score.
// Everything is drawn into a small buffer, then scaled up with no smoothing, so it reads as pixel art.
// Position is in nautical miles (nmi). API: setMode, setShip, sailTo, lastStop, onIsland, onStop.
(function () {
  "use strict";
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SP = window.SPRITES;

  // ---- colors ----
  const P = {
    sand: "#e8c98a", sandDark: "#c9a35e", grass: "#4caf50", grassDark: "#2e7d32", rock: "#7a6a5a", rockDark: "#544638",
    wood: "#7a4426", white: "#f4ecd8", grey: "#9aa3ad", greyDark: "#5f6873", red: "#c4553a", redDark: "#8e3424",
    pink: "#e88bb0", pinkDark: "#b8607f", gold: "#ffd36b", goldDark: "#d49a2a", purple: "#5a3d7a", purpleDark: "#352348",
    navy: "#2a4a8a", window: "#ffe08a", ice: "#cfefff", fire: "#ff7a3a", black: "#141018", blue: "#4fa3e0", cyan: "#9ff0ff"
  };
  // Sky changes as you sail: day in the East Blue, dusk in Paradise, storm-night in the New World, gold at the end.
  const REGIONS = [
    { nmi: 0,    sky: ["#3a7bd5", "#5b9be0", "#86b9ec", "#bfe0f7"], sea: ["#3d8fd6", "#2a72b8", "#1d5591", "#143d6b"], foam: "#d9f1ff", hill: "#6e9fd1", cloud: "#ffffff", body: "sun",  stars: 0,   storm: 0 },
    { nmi: 1250, sky: ["#2c2160", "#5a3482", "#b0517a", "#f39a62"], sea: ["#2f5f8f", "#244b74", "#1a3858", "#11263f"], foam: "#ffd2b0", hill: "#6b3f73", cloud: "#f7c3b3", body: "sun",  stars: 0.25, storm: 0 },
    { nmi: 4100, sky: ["#070a20", "#10153a", "#1c1d4a", "#2a2a5c"], sea: ["#1b2f55", "#142443", "#0e1a32", "#0a1224"], foam: "#8fb3ff", hill: "#1a1c3c", cloud: "#4a4f7a", body: "moon", stars: 1,   storm: 1 },
    { nmi: 6650, sky: ["#2b1d4f", "#7a3b6b", "#e07a4a", "#ffd36b"], sea: ["#3a6a9a", "#2b5279", "#1f3b5a", "#152841"], foam: "#fff0b8", hill: "#8a4a5a", cloud: "#ffe0a8", body: "sun",  stars: 0.15, storm: 0 }
  ];

  const hexToRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgbToHex = c => "#" + c.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => v + (B[i] - v) * t)); };
  function regionAt(nmi) {
    let i = 0;
    while (i < REGIONS.length - 1 && nmi >= REGIONS[i + 1].nmi) i++;
    const cur = REGIONS[i], next = REGIONS[i + 1];
    if (!next) return cur;
    const fade = 320, t = Math.max(0, Math.min(1, (nmi - (next.nmi - fade)) / fade));
    if (t === 0) return cur;
    return {
      sky: cur.sky.map((c, k) => mix(c, next.sky[k], t)), sea: cur.sea.map((c, k) => mix(c, next.sea[k], t)),
      foam: mix(cur.foam, next.foam, t), hill: mix(cur.hill, next.hill, t), cloud: mix(cur.cloud, next.cloud, t),
      body: t < 0.5 ? cur.body : next.body, stars: cur.stars + (next.stars - cur.stars) * t, storm: t > 0.5 ? next.storm : cur.storm
    };
  }
  function seeded(seed) { let s = seed || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  // sprite rows -> offscreen canvas (or the PNG override when it loads)
  function makeSprite(rows) {
    const w = Math.max(...rows.map(r => r.length)), h = rows.length;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d");
    rows.forEach((row, y) => [...row].forEach((ch, i) => { if (ch !== "." && SP.palette[ch]) { x.fillStyle = SP.palette[ch]; x.fillRect(i, y, 1, 1); } }));
    return c;
  }
  function spriteWithOverride(def) {
    const holder = { img: makeSprite(def.rows) };
    if (def.file) {
      const im = new Image();
      im.onload = () => {
        if (!def.height && !def.cutout) { holder.img = im; return; }
        try { holder.img = pixelArtFrom(im, def); } catch (e) { /* opened from a file: keep the drawn sprite */ }
      };
      im.src = def.file;
    }
    return holder;
  }

  // Turn a picture into a pixel sprite: cut away the background from the edges in (white, and optionally
  // the red lettering of a sound effect), crop, shrink to `height` pixels, harden the edges, add an outline.
  function pixelArtFrom(im, def) {
    const W = im.naturalWidth, H = im.naturalHeight;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, W, H), a = d.data;                // throws on file:// (handled by caller)
    if (def.cutout) {
      const isBg = i => a[i + 3] < 20 || (a[i] > 222 && a[i + 1] > 222 && a[i + 2] > 222) ||
        (def.removeRed && a[i] > 140 && a[i + 1] < 95 && a[i + 2] < 95);
      const seen = new Uint8Array(W * H), stack = [];
      for (let xx = 0; xx < W; xx++) stack.push(xx, (H - 1) * W + xx);
      for (let yy = 0; yy < H; yy++) stack.push(yy * W, yy * W + W - 1);
      while (stack.length) {
        const p = stack.pop();
        if (seen[p]) continue; seen[p] = 1;
        if (!isBg(p * 4)) continue;
        a[p * 4 + 3] = 0;
        const px = p % W, py = (p / W) | 0;
        if (px > 0) stack.push(p - 1); if (px < W - 1) stack.push(p + 1);
        if (py > 0) stack.push(p - W); if (py < H - 1) stack.push(p + W);
      }
      x.putImageData(d, 0, 0);
    }
    // crop to what's left
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (a[(yy * W + xx) * 4 + 3] > 40) {
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
    }
    if (x1 < x0) return makeSprite(def.rows);
    const th = def.height || (y1 - y0 + 1), tw = Math.max(1, Math.round((x1 - x0 + 1) * th / (y1 - y0 + 1)));
    const out = document.createElement("canvas"); out.width = tw + 2; out.height = th + 2;
    const o = out.getContext("2d"); o.imageSmoothingEnabled = true; o.imageSmoothingQuality = "high";
    o.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 1, 1, tw, th);
    const od = o.getImageData(0, 0, out.width, out.height), b = od.data, ow = out.width, oh = out.height;
    for (let i = 3; i < b.length; i += 4) b[i] = b[i] > 110 ? 255 : 0;           // hard pixel edges
    const solid = i => b[i * 4 + 3] === 255;
    const edge = [];
    for (let yy = 0; yy < oh; yy++) for (let xx = 0; xx < ow; xx++) {
      const i = yy * ow + xx;
      if (solid(i)) continue;
      if ((xx > 0 && solid(i - 1)) || (xx < ow - 1 && solid(i + 1)) || (yy > 0 && solid(i - ow)) || (yy < oh - 1 && solid(i + ow))) edge.push(i);
    }
    for (const i of edge) { b[i * 4] = 26; b[i * 4 + 1] = 16; b[i * 4 + 2] = 32; b[i * 4 + 3] = 255; }
    o.putImageData(od, 0, 0);
    return out;
  }

  class SeaChart {
    constructor(canvas, cfg) {
      this.cv = canvas; this.ctx = canvas.getContext("2d");
      this.buf = document.createElement("canvas"); this.b = this.buf.getContext("2d");
      this.cfg = cfg; this.route = cfg.route;
      this.pxPerNmi = 0.55;
      this.ship = 0; this.mode = "title"; this.anim = null; this.t = 0;
      this.base = this.baseTarget = 0.86;
      this.onIsland = null; this.onStop = null; this._stop = null;
      this.flash = 0;
      this.sprites = { ship: spriteWithOverride(SP.ship), king: spriteWithOverride(SP.seaKing), gull: SP.gull.frames.map(makeSprite),
        merry: SP.merry ? spriteWithOverride(SP.merry) : null, sunny: SP.sunny ? spriteWithOverride(SP.sunny) : null };
      // box map: one box per arc, each showing its place (pixelated picture, or a drawn island)
      this.view = 0; this.sceneCache = {}; this.dt = 0;
      this.sunnyAt = this.route.sunnyAt ?? null;   // nmi where the Merry's last voyage happens (null = never, spoiler filter)
      this.onSunny = false; this.burn = null; this.onShipChange = null;
      if (this.route.boxes) this.route.stops.forEach(st => {
        if (!st.scene) return;
        const im = new Image();
        im.onload = () => { st._img = im; for (const k of Object.keys(this.sceneCache)) if (!k.startsWith("p:")) delete this.sceneCache[k]; };
        im.src = st.scene;
      });
      const r = seeded(11);
      this.stars = Array.from({ length: 140 }, () => ({ x: r(), y: r(), p: r() * 6, big: r() > 0.9 }));
      this.clouds = Array.from({ length: 16 }, (_, i) => ({ x: i * 160 + r() * 90, y: 0.12 + r() * 0.42, w: 18 + Math.floor(r() * 26) }));
      this.kings = [];
      for (let n = this.redLineNmi(0) + 150; n < this.route.length + 3000; n += 380 + r() * 420) this.kings.push({ nmi: n, p: r() * 6 });
      this.gulls = Array.from({ length: 3 }, () => ({ x: r(), y: 0.15 + r() * 0.3, v: 4 + r() * 5, p: r() * 3 }));
      this.resize();
      if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(canvas);
      else window.addEventListener("resize", () => this.resize());
      this.last = performance.now();
      this.ready = true;
      requestAnimationFrame(t => this.frame(t));
    }

    redLineNmi(i) { const rl = this.route.stops.filter(s => s.redLine); return rl[i] ? rl[i].nmi : this.route.length; }
    worldX(nmi) { return 50 + nmi * this.pxPerNmi; }

    resize() {
      const rect = this.cv.getBoundingClientRect();
      this.w = Math.max(1, rect.width); this.h = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.px = Math.max(2, Math.min(5, Math.round(this.h / 125), Math.floor(this.w / 90)));
      this.bw = Math.ceil(this.w / this.px); this.bh = Math.ceil(this.h / this.px);
      this.buf.width = this.bw; this.buf.height = this.bh;
      if (this.ready) { try { this.draw(); } catch (e) { /* next frame tries again */ } }
    }

    // At port the sea sits low so the menu covers sky; at sea the horizon sits mid-scene.
    setMode(m) { this.mode = m; this.baseTarget = m === "title" ? 0.86 : 0.66; }
    setShip(nmi) {
      this.anim = null; this.ship = nmi; this.burn = null;
      this.onSunny = this.sunnyAt != null && nmi >= this.sunnyAt;
      if (this.route.boxes) this.view = this.boxIndex(nmi);
    }
    // power: how good the answer was (0 rookie .. 4 top tier). 2 = a fast surge with speed lines;
    // 3+ = BURST: the ship charges, blasts off from the stern, flies and lands with a splash.
    sailTo(nmi, done, opts = {}) {
      const from = this.ship, dist = Math.abs(nmi - from), power = opts.power || 0;   // can sail back too (Wanted)
      if (reduceMotion || dist === 0) { this.passStops(from, nmi); this.ship = nmi; done && done(); return; }
      const now = performance.now();
      if (power >= 4) {
        const charge = opts.chargeMs == null ? 550 : opts.chargeMs;
        this.anim = { from, to: nmi, start: now + charge, dur: 1150, done, burst: power, chargeStart: now };
        this.onBurstPhase && this.onBurstPhase("charge", power);
        return;
      }
      this.anim = { from, to: nmi, start: now, dur: power >= 2 ? Math.min(1500, 600 + dist * 1.2) : Math.min(3000, 800 + dist * 2.2), done, surge: power === 2 || power === 3 };
    }
    passStops(a, b) { if (this.onIsland) for (const s of this.route.stops) if (s.nmi > a && s.nmi <= b) this.onIsland(s); }
    lastStop(nmi = this.ship) { let last = this.route.stops[0]; for (const s of this.route.stops) if (s.nmi <= nmi) last = s; return last; }

    frame(now) {
      requestAnimationFrame(t => this.frame(t));          // schedule first, so one bad frame can't stop the loop
      const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
      this.last = now; this.t += dt; this.dt = dt;
      // the Merry's last voyage: stop at the swap point, burn, then carry on aboard the Sunny
      if (this.burn) {
        if (now - this.burn.start > (reduceMotion ? 300 : 3400)) {
          const next = this.burn.next;
          this.burn = null; this.onSunny = true;
          this.onShipChange && this.onShipChange("sunny");
          if (next) this.sailTo(next.to, next.done);
        }
      } else if (this.anim && !this.anim.burst && this.sunnyAt != null && !this.onSunny && this.mode !== "title"
                 && this.anim.from < this.sunnyAt && this.anim.to >= this.sunnyAt && this.ship >= this.sunnyAt - 1) {
        this.burn = { start: now, next: { to: this.anim.to, done: this.anim.done } };
        this.anim = null; this.ship = this.sunnyAt;
        this.onShipChange && this.onShipChange("burning");
      }
      if (this.anim) {
        const a = this.anim, k = Math.max(0, Math.min(1, (now - a.start) / a.dur));
        if (a.burst && !a.launched && now >= a.start) { a.launched = true; this.onBurstPhase && this.onBurstPhase("launch", a.burst); }
        const e = a.burst ? 1 - Math.pow(1 - k, 3) : (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
        a.k = k;
        const prev = this.ship;
        this.ship = a.from + (a.to - a.from) * e;
        this.passStops(prev, this.ship);
        if (k >= 1) {
          this.anim = null; this.ship = a.to;
          if (a.burst) {
            this.splash = { start: now, power: a.burst };
            this.onBurstPhase && this.onBurstPhase("land", a.burst);
            // flew past the first ship's last voyage: the farewell plays after landing
            if (this.sunnyAt != null && !this.onSunny && this.mode !== "title" && a.from < this.sunnyAt && a.to >= this.sunnyAt) {
              this.burn = { start: now + 400, next: null };
              this.onShipChange && this.onShipChange("burning");
            }
          }
          a.done && a.done();
        }
      } else if (this.mode === "title" && !reduceMotion) {
        this.ship += dt * 70;
        if (this.ship > this.route.length + 300) this.ship = 0;
        this.onSunny = this.sunnyAt != null && this.ship >= this.sunnyAt;
      }
      this.base += (this.baseTarget - this.base) * Math.min(1, dt * 5);
      const st = this.lastStop();
      if (st !== this._stop) { this._stop = st; this.onStop && this.onStop(st, this.ship); }
      try { this.draw(); } catch (e) { if (!this._warned) { this._warned = true; console.error(e); } }
    }

    // ---------------- drawing ----------------
    R(x, y, w, h, c) { this.b.fillStyle = c; this.b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

    draw() {
      if (this.route.boxes) return this.drawBoxes();
      const { b, bw, bh } = this;
      const pal = regionAt(this.ship);
      const hy = Math.round(bh * this.base);
      this.hy = hy;
      this.cam = this.worldX(this.ship) - Math.round(bw * (bw < 160 ? 0.28 : 0.32));
      b.clearRect(0, 0, bw, bh);

      // sky in flat bands
      const bands = 8;
      for (let i = 0; i < bands; i++) {
        const t = i / (bands - 1), seg = Math.min(2, Math.floor(t * 3)), lt = t * 3 - seg;
        this.R(0, Math.floor(hy * i / bands), bw, Math.ceil(hy / bands) + 1, mix(pal.sky[seg], pal.sky[seg + 1], lt));
      }
      // stars
      if (pal.stars > 0) for (const s of this.stars) {
        if (s.y > 0.85 || s.p / 6 > pal.stars) continue;
        const x = ((s.x * bw * 2 - this.cam * 0.05) % bw + bw) % bw, y = s.y * hy * 0.9;
        const tw = Math.sin(this.t * 2 + s.p) > -0.3;
        if (tw) this.R(x, y, 1, 1, "#fff8d8");
        if (s.big && tw) { this.R(x - 1, y, 3, 1, "rgba(255,248,216,.5)"); this.R(x, y - 1, 1, 3, "rgba(255,248,216,.5)"); }
      }
      // sun or moon
      const cx = Math.round(bw * 0.8), cy = Math.round(hy * 0.3), rad = Math.max(5, Math.round(bh * 0.06));
      this.disc(cx, cy, rad, pal.body === "moon" ? "#d8dbe8" : "#fff3b0");
      if (pal.body === "moon") { this.R(cx - 2, cy - 1, 2, 2, "#b5b9cc"); this.R(cx + 2, cy + 2, 2, 2, "#b5b9cc"); }
      else this.disc(cx, cy, rad - 2, "#ffe27a");
      // storm flashes in the New World
      if (pal.storm && !reduceMotion) {
        if (this.flash <= 0 && Math.random() < 0.004) this.flash = 0.18;
        if (this.flash > 0) {
          this.flash -= 1 / 60;
          b.globalAlpha = 0.35; this.R(0, 0, bw, hy, "#cfd8ff"); b.globalAlpha = 1;
          const lx = Math.round(bw * 0.6); let y = 0, x = lx;
          while (y < hy * 0.7) { this.R(x, y, 1, 3, "#ffffff"); y += 3; x += Math.random() < 0.5 ? -1 : 1; }
        }
      }
      // clouds (slow parallax)
      for (const c of this.clouds) {
        const span = 16 * 160, x = ((c.x - this.cam * 0.15 - this.t * 2) % span + span) % span - 40;
        if (x > bw + 10) continue;
        this.cloud(x, c.y * hy, c.w, pal.cloud);
      }
      // far islands silhouette (mid parallax)
      for (let x = 0; x < bw; x++) {
        const wx = x + this.cam * 0.35;
        const n = Math.sin(wx / 23) + Math.sin(wx / 9.7) * 0.5 + Math.sin(wx / 61) * 0.8;
        if (n > 0.6) this.R(x, hy - Math.round((n - 0.6) * 5), 1, Math.round((n - 0.6) * 5), pal.hill);
      }
      // sea bands
      const seaH = bh - hy;
      for (let i = 0; i < 4; i++) this.R(0, hy + Math.floor(seaH * [0, 0.12, 0.35, 0.65][i]), bw, seaH, pal.sea[i]);
      // red lines and islands sit on the horizon
      for (const s of this.route.stops) {
        const x = Math.round(this.worldX(s.nmi) - this.cam);
        if (x < -90 || x > bw + 90) continue;
        if (s.redLine) this.redLine(x, hy, s.style); else this.island(x, hy, s.style || "grass", s);
      }
      // waves: moving highlight dashes
      const off = Math.floor(this.cam + this.t * 6);
      for (let x = 0; x < bw; x++) {
        if (((x + off) % 14 + 14) % 14 < 4) this.R(x, hy, 1, 1, pal.foam);
        if (((x + off * 0.7 + 7) % 23 + 23) % 23 < 3) this.R(x, hy + 3, 1, 1, pal.foam + "aa");
      }
      const sr = seeded(Math.floor(this.cam / 40) + 3);
      for (let i = 0; i < Math.floor(bw / 6); i++) {
        const x = Math.floor(sr() * bw), y = hy + 5 + Math.floor(sr() * (seaH - 6));
        if (Math.sin(this.t * 3 + i) > 0.2) this.R(x, y, 2, 1, pal.foam + "55");
      }
      // sea kings in the Grand Line
      for (const k of this.kings) {
        const x = Math.round(this.worldX(k.nmi) - this.cam);
        if (x < -30 || x > bw + 30) continue;
        const rise = Math.max(0, Math.sin(this.t * 0.7 + k.p));
        const img = this.sprites.king.img, kh = img.height;
        const y = hy + kh - Math.round(rise * kh * 0.95);
        b.save(); b.beginPath(); b.rect(0, 0, bw, hy + 2); b.clip();
        b.drawImage(img, x, y);
        b.restore();
        if (rise > 0.1) { this.R(x - 1, hy, img.width + 2, 1, pal.foam); }
      }
      // gulls
      for (const g of this.gulls) {
        const x = ((g.x * bw + this.t * g.v) % (bw + 20)) - 10, y = g.y * hy + Math.sin(this.t * 2 + g.p) * 2;
        b.drawImage(this.sprites.gull[Math.abs(Math.floor(this.t * 4 + g.p)) % 2], Math.round(x), Math.round(y));
      }
      this.drawShip(hy);

      // blit to screen, crisp
      const { ctx } = this;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.drawImage(this.buf, 0, 0, this.bw * this.px, this.bh * this.px);
      this.labels(hy);
    }

    // which ship: the second after the first ship's last voyage, unless the dev bar forces one
    usingSecond() { return this.forceShip ? this.forceShip === "second" : this.onSunny; }
    // the ship sprite in use right now (for the cutscene)
    currentShipImg() { return ((this.usingSecond() && this.sprites.sunny) ? this.sprites.sunny : (this.sprites.merry || this.sprites.ship)).img; }

    // ---------------- box map ----------------
    boxLen() { return this.route.length / Math.max(1, this.route.stops.length - 1); }
    boxIndex(nmi) { return Math.max(0, Math.min(this.route.stops.length - 1, Math.floor(nmi / this.boxLen() + 1e-6))); }

    // the place picture as big soft blocks: shrink it to a small mosaic (averaging the colours),
    // then blow it back up with no smoothing. No dither, so it reads as a blurry version of the picture.
    sceneCanvas(k, w, h) {
      const st = this.route.stops[k];
      if (!st) return null;
      // painted scenes (js/scenes.js) are made once per place at 96 px tall, width rounded to the box
      // shape, and only scaled when drawn, so resizing or sliding never repaints them
      if ((this.cfg.sceneSource || "painted") === "painted" && window.SceneArt) {
        const pw = Math.max(64, Math.round(96 * w / Math.max(1, h) / 16) * 16), pkey = `p:${k}:${pw}`;
        if (!this.sceneCache[pkey]) this.sceneCache[pkey] = window.SceneArt.paint(st, pw, 96);
        return this.sceneCache[pkey];
      }
      const key = `${k}:${w}x${h}`;
      if (this.sceneCache[key]) return this.sceneCache[key];
      const img = st._img;
      if (!img) return null;
      const block = this.cfg.sceneBlockPx || 9;                 // size of one block on screen, in CSS pixels
      const sw = Math.max(24, Math.round(this.w / block)), sh = Math.max(12, Math.round(sw * h / w));
      const small = document.createElement("canvas"); small.width = sw; small.height = sh;
      const sx = small.getContext("2d");
      sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = "high";
      const s = Math.max(sw / img.width, sh / img.height), dw = img.width * s, dh = img.height * s;
      sx.drawImage(img, (sw - dw) / 2, (sh - dh) * 0.4, dw, dh);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d");
      x.imageSmoothingEnabled = false;
      x.drawImage(small, 0, 0, w, h);
      return (this.sceneCache[key] = c);
    }

    drawBoxes() {
      const { b, bw, bh } = this;
      const stops = this.route.stops, n = stops.length, L = this.boxLen();
      const hy = Math.round(bh * this.base);
      this.hy = hy;
      const cur = this.boxIndex(this.ship);
      // slide one box at a time
      this.view += (cur - this.view) * Math.min(1, (this.dt || 0.016) * (this.mode === "title" ? 3 : 5));
      if (Math.abs(cur - this.view) < 0.002) this.view = cur;
      b.clearRect(0, 0, bw, bh);
      const first = Math.floor(this.view);
      if (!this._warm) {
        this._warm = true;
        setTimeout(() => {
          this._warm = false;
          for (const k of [cur + 1, cur - 1, cur + 2]) if (k >= 0 && k < n) { const before = Object.keys(this.sceneCache).length; this.sceneCanvas(k, bw, hy + 2); if (Object.keys(this.sceneCache).length > before) break; }
        }, 30);
      }
      for (let k = first; k <= first + 1 && k < n; k++) {
        if (k < 0) continue;
        const x0 = Math.round((k - this.view) * bw);
        this.drawBox(k, x0, hy);
      }
      // sea strip the ship sails on
      const pal = regionAt(stops[cur] && stops[cur].first_ep ? this.ship : this.ship);
      const seaTop = hy;
      for (let i = 0; i < 4; i++) this.R(0, seaTop + Math.floor((bh - seaTop) * [0, 0.15, 0.4, 0.7][i]), bw, bh, pal.sea[i]);
      const off = Math.floor(this.t * 6 + this.view * bw);
      for (let x = 0; x < bw; x++) {
        if (((x + off) % 14 + 14) % 14 < 4) this.R(x, seaTop, 1, 1, pal.foam);
        if (((x + off * 0.7 + 7) % 23 + 23) % 23 < 3) this.R(x, seaTop + 3, 1, 1, pal.foam + "aa");
      }
      // ship: moves across its box as distance builds up
      const frac = Math.max(0, Math.min(1, (this.ship - cur * L) / L));
      // keep the whole ship on screen: half its width plus a margin from the edge
      const half = ((this.usingSecond() && this.sprites.sunny) ? this.sprites.sunny : (this.sprites.merry || this.sprites.ship)).img.width / 2 + 6;
      const sx = (cur - this.view) * bw + Math.max(half, Math.min(bw - half - 30, bw * (0.12 + 0.6 * frac)));
      this.drawBoxShip(sx, seaTop);
      // gulls
      for (const g of this.gulls) {
        const gx = ((g.x * bw + this.t * g.v) % (bw + 20)) - 10, gy = g.y * hy * 0.7 + Math.sin(this.t * 2 + g.p) * 2;
        b.drawImage(this.sprites.gull[Math.abs(Math.floor(this.t * 4 + g.p)) % 2], Math.round(gx), Math.round(gy));
      }
      const { ctx } = this;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.drawImage(this.buf, 0, 0, this.bw * this.px, this.bh * this.px);
      this.boxLabels(first, cur);
      const ba = this.anim;
      if (ba && ba.burst) {
        const now = performance.now(), charging = now < ba.start;
        const k = charging ? 0.55 + 0.1 * Math.sin(now / 90) : Math.min(1, 0.6 + (now - ba.start) / 300);
        const word = charging ? (ba.start - ba.chargeStart > 1000 ? "CHARGING..." : "") : (ba.burst >= 4 ? "MAX BURST!" : "BURST!");
        const size = Math.round((this.px >= 4 ? 40 : 24) * (0.6 + 0.4 * k));
        ctx.font = `${size}px "Press Start 2P", "Courier New", monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const tx = this.w / 2, ty = this.h * 0.3;
        if (word) { ctx.fillStyle = "#141018"; ctx.fillText(word, tx + 4, ty + 4); }
        if (word) { ctx.fillStyle = charging ? "#f4ecd8" : ba.burst >= 4 ? "#ffd84a" : "#6fe3ff"; ctx.fillText(word, tx, ty); }
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      }
    }

    drawBox(k, x0, hy) {
      const { b, bw, bh } = this, st = this.route.stops[k];
      const painted = (this.cfg.sceneSource || "painted") === "painted" && window.SceneArt;
      const scene = (st.finale && !painted) ? null : this.sceneCanvas(k, bw, hy + 2);
      if (scene) { b.imageSmoothingEnabled = false; b.drawImage(scene, x0, 0, bw, hy + 2); }
      else {
        // no picture: sky + a drawn island (also the "???" box)
        const pal = regionAt(st.finale ? this.route.length : (k / Math.max(1, this.route.stops.length - 1)) * this.route.length);
        for (let i = 0; i < 8; i++) {
          const t = i / 7, seg = Math.min(2, Math.floor(t * 3)), lt = t * 3 - seg;
          this.R(x0, Math.floor(hy * i / 8), bw, Math.ceil(hy / 8) + 1, mix(pal.sky[seg], pal.sky[seg + 1], lt));
        }
        b.save(); b.beginPath(); b.rect(x0, 0, bw, bh); b.clip();
        this.island(x0 + Math.round(bw * 0.62), hy, st.style || "grass", st);
        b.restore();
      }
      // box edge: a dark frame post with rivets, so the map reads as a row of boxes
      if (x0 > -4 && x0 < bw) {
        this.R(x0 - 2, 0, 4, bh, "#141018");
        for (let y = 6; y < bh; y += 12) this.R(x0 - 1, y, 2, 2, "#5f6873");
      }
    }

    drawBoxShip(cx, seaTop) {
      const b = this.b;
      const burning = !!this.burn;
      const sp = (this.usingSecond() && this.sprites.sunny) ? this.sprites.sunny : (this.sprites.merry || this.sprites.ship);
      const img = sp.img;
      const x = Math.round(cx - img.width / 2);
      const bob = burning ? 0 : Math.round(Math.sin(this.t * 2.6));
      const a = this.anim, now = performance.now();
      const charging = a && a.burst && now < a.start, flying = a && a.burst && now >= a.start;
      const lift = flying ? Math.round(Math.sin(Math.min(1, a.k || 0) * Math.PI) * (a.burst >= 4 ? 24 : 17)) : 0;
      const shake = charging ? (Math.floor(now / 40) % 2 ? 1 : -1) : 0;
      const y = seaTop - img.height + 5 + bob - lift;
      this.drawBurstFx(Math.round(cx - img.width / 2) + shake, y, img, seaTop, a, now, charging, flying);
      const moving = !!this.anim || this.mode === "title";
      for (let i = 0; i < (moving ? 6 : 3); i++) this.R(x - 3 - i * 4 - Math.round((this.t * 12) % 4), seaTop + 1 + (i % 2), 3, 1, "#ffffffaa");
      if (!burning) { b.drawImage(img, x + shake, y); this.shipBox = { x, y, w: img.width, h: img.height }; return; }
      // the Merry's last voyage: flames climb, she darkens and sinks into embers
      const k = Math.min(1, (performance.now() - this.burn.start) / 3000);
      b.save();
      b.globalAlpha = 1 - Math.max(0, (k - 0.7) / 0.3);
      b.drawImage(img, x, y + Math.round(k * k * 10));
      // charred copy of the ship's own pixels (not a box around it)
      if (!this._charred || this._charredSrc !== img) {
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        const cx2 = c.getContext("2d"); cx2.drawImage(img, 0, 0);
        cx2.globalCompositeOperation = "source-atop"; cx2.fillStyle = "#2a0d05"; cx2.fillRect(0, 0, c.width, c.height);
        this._charred = c; this._charredSrc = img;
      }
      b.globalAlpha = Math.min(1, k * 1.6) * (1 - Math.max(0, (k - 0.7) / 0.3));
      b.drawImage(this._charred, x, y + Math.round(k * k * 10));
      b.restore();
      const r = seeded(Math.floor(this.t * 12));
      for (let i = 0; i < 40 * Math.min(1, k * 2); i++) {
        const fx = x + Math.floor(r() * img.width), fh = 2 + Math.floor(r() * 8 * (0.4 + k));
        const fy = y + img.height - Math.floor(r() * img.height * (0.3 + k));
        this.R(fx, fy - fh, 1 + Math.floor(r() * 2), fh, r() > 0.5 ? "#ff7a3a" : (r() > 0.5 ? "#ffd36b" : "#c4553a"));
      }
      for (let i = 0; i < 8; i++) this.R(x + Math.floor(r() * img.width), y - Math.floor(r() * 20), 1, 1, "#ffd36b");
    }

    drawBurstFx(x, y, img, seaTop, a, now, charging, flying) {
      const R = (xx, yy, w, h, c) => this.R(xx, yy, w, h, c), bw = this.bw;
      const gold = a && a.burst >= 4;
      if (charging) {                                   // air gathering at the stern
        const k = Math.min(1, (now - a.chargeStart) / Math.max(1, a.start - a.chargeStart));
        for (let i = 0; i < 4; i++) this.disc(x - 2 - i * 3, y + img.height - 10 - i, Math.max(1, Math.round((1 + k * 3) * (1 - i * 0.2))), i % 2 ? "#ffffff" : "#d8f6ff");
      }
      if (flying || (a && a.surge)) {                   // speed lines across the scene
        const n = flying ? (gold ? 26 : 18) : 8, r = seeded(Math.floor(now / 60));
        for (let i = 0; i < n; i++) {
          const yy = Math.floor(r() * seaTop * 0.95), len = 6 + Math.floor(r() * (flying ? 26 : 12));
          R(Math.floor(r() * bw), yy, len, 1, gold && i % 3 === 0 ? "#ffd36b" : "rgba(255,255,255,0.8)");
        }
      }
      if (flying) {
        // the blast: a ring of air left behind at the stern, and a jet
        const k = a.k || 0, rr = Math.round(4 + k * 18);
        for (let t = 0; t < 32; t++) { const ang = t / 32 * 6.283; R(x - 6 - Math.round(k * 20) + Math.round(Math.cos(ang) * rr * 0.5), y + img.height / 2 + Math.round(Math.sin(ang) * rr), 1, 1, "#ffffff"); }
        for (let i = 0; i < 10; i++) R(x - 4 - i * 3, y + img.height - 12 + ((i * 7) % 5) - 2, 3, 2, i % 2 ? "#ffffff" : "#bfe6ff");
        if (gold) for (let i = 0; i < 12; i++) R(x - Math.floor(Math.random() * 40), y + Math.floor(Math.random() * img.height), 1, 1, "#ffd36b");
        // shadow on the water while airborne
        R(x + 4, seaTop + 1, img.width - 8, 1, "rgba(0,0,40,0.35)");
      }
      if (this.splash) {                                 // landing splash
        const k = (now - this.splash.start) / 700;
        if (k > 1) this.splash = null;
        else for (let i = 0; i < 16; i++) {
          const sx = x + img.width / 2 + (i - 8) * 3, h = Math.round(Math.sin(k * Math.PI) * (6 + (i % 4) * 3));
          R(sx, seaTop - h, 2, h, i % 2 ? "#ffffff" : "#bfe6ff");
        }
      }
    }

    boxLabels(first, cur) {
      const { ctx, px, bw } = this, stops = this.route.stops;
      const size = px >= 4 ? 16 : 8;
      // place name plaque in the top-left corner of each visible box
      // Phones: the track gets its own full-width row under the score boxes and only shows the few islands
      // around the ship, scrolling along as you sail (the whole route squeezed into ~100px was unreadable).
      const narrow = this.w < 720, title = this.mode === "title";
      const n = stops.length, L = this.route.length;
      let x0, tw, ty, th;
      if (narrow) {
        const now = performance.now();
        if (!this._hudAt || now - this._hudAt > 500) {          // where the score boxes end (safe areas included)
          this._hudAt = now;
          const hud = document.getElementById("hud"), r = hud && !hud.hidden ? hud.getBoundingClientRect() : null;
          this._hudBottom = r && r.height ? r.bottom : 0;
        }
        x0 = 10; tw = this.w - 20; th = 18;
        ty = title ? Math.round(this.h - 28) : Math.round((this._hudBottom || 56) + 22);   // room for the ship marker above it
      } else {
        const margin = Math.max(130, Math.round(this.w * 0.14));
        x0 = margin; tw = Math.max(60, this.w - 2 * margin); th = 16;
        ty = title ? Math.round(this.h - 26) : 58;
      }
      ctx.textBaseline = "top"; ctx.textAlign = "left";
      if (!(narrow && (title || this.h < 300))) for (let k = first; k <= first + 1 && k < stops.length; k++) {   // on phones the menu covers it
        if (k < 0) continue;
        const bx = Math.round((k - this.view) * bw * px);
        if (bx > this.w || bx < -this.w) continue;
        const label = stops[k].name.toUpperCase();
        const fs = narrow ? 10 : size;
        ctx.font = `${fs}px "Press Start 2P", "Courier New", monospace`;
        const wpx = ctx.measureText(label).width;
        const lx = Math.max(narrow ? 16 : 10, bx + 12), ly = title ? Math.round(this.h * 0.62) : narrow ? ty + th + 12 : 84;
        ctx.fillStyle = "rgba(10,10,30,0.82)"; ctx.fillRect(lx - 6, ly - 6, wpx + 12, fs + 12);
        ctx.fillStyle = k <= cur ? "#f1c04a" : "#f4ecd8"; ctx.fillText(label, lx, ly);
      }
      // the whole voyage as one track split into a section per island; the ship slides along it.
      // Sections are tinted by sea: East Blue, Paradise (from Reverse Mountain), New World (from Fish-Man Island).
      let posX;
      if (narrow) {
        const span = this.boxLen() * 4.5, half = span / 2;
        const target = Math.max(half - this.boxLen() * 0.4, Math.min(L + this.boxLen() * 0.4 - half, this.ship));
        this._trackC = this._trackC == null || this.mode === "title" ? target : this._trackC + (target - this._trackC) * Math.min(1, (this.dt || 0.016) * 6);
        const c = this._trackC;
        posX = nmi => x0 + tw / 2 + (nmi - c) * tw / span;
      } else posX = nmi => x0 + tw * Math.max(0, Math.min(1, nmi / L));
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 3, ty - 18, tw + 6, th + 24); ctx.clip();
      const sea = st => (!st.first_ep || st.finale) ? "#c4553a" : st.first_ep >= 517 ? "#9a6ad8" : st.first_ep >= 62 ? "#38b2a8" : "#3f86d4";
      ctx.fillStyle = "rgba(5,8,24,0.85)"; ctx.fillRect(x0 - 3, ty - 3, tw + 6, th + 6);
      // each section is a tiny slice of that place's painted scene: dimmed until you get there
      const shipPx = posX(this.ship);
      this.trackThumbs = this.trackThumbs || {};
      for (let k = 0; k < n - 1; k++) {
        const a = Math.round(posX(stops[k].nmi)), b = Math.round(posX(stops[k + 1].nmi)), w = Math.max(1, b - a);
        if (b < x0 - 4 || a > x0 + tw + 4) continue;                       // off the visible window (phones)
        let thumb = this.trackThumbs[k];
        if (!thumb && window.SceneArt) thumb = this.trackThumbs[k] = window.SceneArt.paint(stops[k], 96, 96);
        if (thumb) {
          ctx.imageSmoothingEnabled = false;
          // the band around the horizon, where each island's landmark sits
          const sy = Math.round(thumb.height * 0.38), sh = Math.round(thumb.height * 0.48);
          const sw = Math.min(thumb.width, Math.round(sh * w / th));
          ctx.drawImage(thumb, Math.round((thumb.width - sw) * 0.6), sy, sw, sh, a, ty, w, th);
        } else { ctx.fillStyle = sea(stops[k]); ctx.fillRect(a, ty, w, th); }
        const reached = posX(stops[k + 1].nmi) <= shipPx, here = posX(stops[k].nmi) <= shipPx && !reached;
        if (!reached) {                                                    // fog over places not reached yet
          ctx.fillStyle = here ? "rgba(5,8,24,0.25)" : "rgba(5,8,24,0.62)";
          ctx.fillRect(here ? Math.max(a, Math.round(shipPx)) : a, ty, here ? Math.max(0, b - Math.round(shipPx)) : w, th);
        }
        ctx.fillStyle = sea(stops[k]); ctx.fillRect(a, ty + th - 2, w, 2);   // thin sea-colour underline: East Blue / Paradise / New World
      }
      // section dividers (islands): small notches, gold once reached
      for (let k = 0; k < n; k++) {
        const x = Math.round(posX(stops[k].nmi));
        ctx.fillStyle = stops[k].nmi <= this.ship ? "#f1c04a" : "rgba(244,236,216,0.7)";
        ctx.fillRect(x - 1, ty - 3, 2, th + 6);
      }
      // the finale mark
      const fx = Math.round(posX(L));
      ctx.fillStyle = "#c4553a"; ctx.fillRect(fx + 3, ty, 6, 2); ctx.fillRect(fx + 3, ty + th - 2, 6, 2); ctx.fillRect(fx + 5, ty, 2, th);
      // the ship marker: a tiny pixel boat riding on the track
      const sxm = Math.round(shipPx), bob = Math.floor(this.t * 3) % 2;
      ctx.fillStyle = "#141018"; ctx.fillRect(sxm - 7, ty - 7 - bob, 14, 5);
      ctx.fillStyle = "#8a4b2a"; ctx.fillRect(sxm - 6, ty - 6 - bob, 12, 3);
      ctx.fillStyle = "#f4ecd8"; ctx.fillRect(sxm - 3, ty - 14 - bob, 6, 7);
      ctx.fillStyle = "#141018"; ctx.fillRect(sxm - 1, ty - 15 - bob, 1, 9);
      ctx.restore();
      if (narrow) {                                                         // fade at the cut edges: the route carries on
        const fade = (fx, dir) => {
          const g = ctx.createLinearGradient(fx, 0, fx + dir * 26, 0);
          g.addColorStop(0, "rgba(5,8,24,0.95)"); g.addColorStop(1, "rgba(5,8,24,0)");
          ctx.fillStyle = g; ctx.fillRect(dir > 0 ? fx : fx - 26, ty, 26, th);
        };
        if (posX(0) < x0) fade(x0, 1);
        if (posX(L) > x0 + tw) fade(x0 + tw, -1);
      }
    }

    disc(cx, cy, r, c) {
      for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); this.R(cx - w, cy + y, w * 2 + 1, 1, c); }
    }
    cloud(x, y, w, c) {
      const h = Math.max(3, Math.round(w / 5));
      this.R(x, y, w, h, c);
      this.R(x + w * 0.15, y - h * 0.6, w * 0.45, h * 0.7, c);
      this.R(x + w * 0.45, y - h, w * 0.35, h, c);
      this.b.globalAlpha = 0.18; this.R(x, y + h - 1, w, 1, "#000"); this.b.globalAlpha = 1;
    }
    // stepped hill: wide at the waterline, narrow at the top
    mound(cx, base, w, h, top, side, topRows = 2) {
      for (let r = 0; r < h; r++) {
        const ww = Math.max(2, Math.round(w * Math.sqrt(1 - Math.pow(r / h, 2))));
        this.R(cx - ww / 2, base - r - 1, ww, 1, r >= h - topRows ? top : side);
      }
      return base - h;
    }
    palm(x, base, h) {
      for (let i = 0; i < h; i++) this.R(x + Math.round(Math.sin(i / h * 1.3) * 2), base - i - 1, 1, 1, P.wood);
      const tx = x + Math.round(Math.sin(1.3) * 2), ty = base - h - 1;
      this.R(tx - 4, ty, 9, 1, P.grassDark); this.R(tx - 5, ty + 1, 2, 1, P.grassDark); this.R(tx + 4, ty + 1, 2, 1, P.grassDark);
      this.R(tx - 2, ty - 1, 5, 1, P.grass); this.R(tx, ty - 2, 1, 1, P.grass);
    }
    house(x, base, w, h, wall, roof) {
      this.R(x, base - h, w, h, wall);
      for (let i = 0; i < Math.ceil(w / 2) + 1; i++) this.R(x - 1 + i, base - h - 1 - i, w + 2 - i * 2, 1, roof);
      this.R(x + Math.floor(w / 2), base - 3, 1, 3, P.black);
    }
    windows(x, y, w, h, color, step = 3) {
      for (let yy = y + 1; yy < y + h - 1; yy += step) for (let xx = x + 1; xx < x + w - 1; xx += step) this.R(xx, yy, 1, 1, color);
    }

    island(cx, hy, style, stop) {
      const t = this.t, base = hy + 1;
      let top;
      switch (style) {
        case "village": {
          top = this.mound(cx, base, 56, 9, P.grass, P.sand, 3);
          this.house(cx - 16, top + 1, 7, 5, P.white, P.red);
          this.house(cx - 6, top + 1, 6, 4, P.sand, P.redDark);
          this.R(cx + 9, top - 12, 3, 13, P.white);
          const a = t * 2;
          for (let i = 0; i < 4; i++) { const ang = a + i * Math.PI / 2; for (let l = 1; l < 7; l++) this.R(cx + 10 + Math.round(Math.cos(ang) * l), top - 12 + Math.round(Math.sin(ang) * l), 1, 1, P.wood); }
          this.palm(cx + 20, top + 3, 9);
          top -= 18; break;
        }
        case "navy": {
          top = this.mound(cx, base, 50, 8, P.grass, P.rock, 2);
          this.R(cx - 6, top - 20, 12, 21, P.white); this.windows(cx - 6, top - 20, 12, 21, P.navy);
          this.R(cx - 8, top - 22, 16, 2, P.navy);
          this.R(cx, top - 30, 1, 8, P.greyDark); this.R(cx + 1, top - 30, 6, 3, P.white); this.R(cx + 2, top - 29, 3, 1, P.blue);
          this.R(cx - 18, top, 8, 1, P.greyDark);
          top -= 31; break;
        }
        case "town": {
          top = this.mound(cx, base, 60, 6, P.grey, P.rock, 1);
          [[-22, 8, 9], [-13, 10, 13], [-2, 9, 10], [8, 11, 15], [-2, 0, 0]].forEach(([dx, w, h]) => { if (w) { this.R(cx + dx, top - h, w, h, P.sand); this.windows(cx + dx, top - h, w, h, P.wood); this.R(cx + dx, top - h - 1, w, 1, P.redDark); } });
          this.R(cx + 20, top - 18, 2, 18, P.wood); this.R(cx + 17, top - 18, 8, 2, P.wood); this.R(cx + 19, top - 8, 4, 1, P.wood);
          top -= 19; break;
        }
        case "cactus": {
          top = this.mound(cx, base, 62, 7, P.sandDark, P.sand, 2);
          [[-18, 22], [-6, 30], [8, 24], [18, 16]].forEach(([dx, h]) => {
            this.R(cx + dx, top - h, 5, h + 1, "#5f8a4a"); this.R(cx + dx + 1, top - h, 1, h, "#7fb064");
            this.R(cx + dx - 3, top - h * 0.6, 3, 2, "#5f8a4a"); this.R(cx + dx - 3, top - h * 0.6 - 4, 2, 4, "#5f8a4a");
            this.windows(cx + dx, top - h + 4, 5, h - 6, P.window, 4);
          });
          top -= 31; break;
        }
        case "desert": {
          top = this.mound(cx, base, 76, 8, P.sand, P.sandDark, 3);
          this.mound(cx - 22, top + 2, 26, 5, P.sand, P.sand);
          this.R(cx - 4, top - 12, 22, 12, P.sandDark); this.windows(cx - 4, top - 12, 22, 12, P.wood, 4);
          this.disc(cx + 7, top - 14, 5, P.sand); this.R(cx + 7, top - 22, 1, 3, P.gold);
          this.R(cx - 8, top - 16, 3, 16, P.sandDark); this.disc(cx - 7, top - 17, 2, P.sand);
          this.palm(cx + 26, top + 3, 8);
          top -= 23; break;
        }
        case "bigtree": {
          top = this.mound(cx, base, 50, 7, P.grass, P.rock, 2);
          this.R(cx - 3, top - 26, 7, 27, P.wood); this.R(cx - 1, top - 26, 2, 27, "#9a5a32");
          for (let i = 0; i < 6; i++) this.disc(cx - 12 + i * 5, top - 28 - (i % 2) * 4, 7, i % 2 ? P.grass : P.grassDark);
          this.R(cx + 14, top - 6, 7, 6, P.wood); this.R(cx + 13, top - 7, 9, 1, P.redDark);
          top -= 40; break;
        }
        case "city": {
          top = this.mound(cx, base, 64, 5, P.grey, P.rock, 1);
          [[-26, 12, 8], [-14, 12, 14], [-2, 12, 22], [10, 12, 14], [-2, 12, 0]].forEach(([dx, w, h]) => { if (h) { this.R(cx + dx, top - h, w, h, P.white); this.windows(cx + dx, top - h, w, h, P.blue); this.R(cx + dx, top - h - 1, w, 1, P.redDark); } });
          this.R(cx + 3, top - 34, 2, 12, P.grey);
          for (let i = 0; i < 5; i++) { const ph = (t * 1.5 + i * 0.2) % 1; this.R(cx + 4 + Math.round(Math.cos(i * 1.2) * ph * 8), top - 34 + Math.round(ph * ph * 10 - ph * 6), 1, 1, P.cyan); }
          this.R(cx - 28, top, 2, 2, P.wood);
          top -= 36; break;
        }
        case "spooky": {
          top = this.mound(cx, base, 70, 12, P.purpleDark, P.purple, 3);
          this.R(cx - 8, top - 16, 20, 16, P.purpleDark); this.windows(cx - 8, top - 16, 20, 16, Math.sin(t * 3) > 0 ? P.window : "#b8a040", 4);
          this.R(cx - 10, top - 17, 24, 1, P.black); this.R(cx + 9, top - 24, 3, 8, P.purpleDark);
          this.R(cx - 22, top - 14, 1, 14, P.black); this.R(cx - 25, top - 12, 3, 1, P.black); this.R(cx - 21, top - 10, 4, 1, P.black);
          for (let i = 0; i < 3; i++) { const bx = cx - 20 + ((t * 9 + i * 13) % 40), by = top - 26 - Math.round(Math.sin(t * 4 + i) * 3); this.R(bx, by, 3, 1, P.black); this.R(bx + 1, by + 1, 1, 1, P.black); }
          top -= 25; break;
        }
        case "bubble": {
          top = this.mound(cx, base, 56, 6, P.grassDark, P.wood, 2);
          for (let i = -2; i <= 2; i++) { this.R(cx + i * 8, top - 20, 3, 21, P.wood); this.disc(cx + i * 8 + 1, top - 22, 5, P.grass); }
          for (let i = 0; i < 6; i++) {
            const ph = (t * 0.25 + i / 6) % 1, bx = cx - 20 + i * 8 + Math.round(Math.sin(t + i) * 2), by = top - 6 - Math.round(ph * 36);
            const r = 2 + (i % 3);
            this.b.globalAlpha = 1 - ph; this.ring(bx, by, r, P.cyan); this.R(bx - 1, by - 1, 1, 1, "#ffffff"); this.b.globalAlpha = 1;
          }
          top -= 40; break;
        }
        case "firefrost": {
          top = this.mound(cx, base, 64, 10, P.redDark, P.red, 3);
          this.b.save(); this.b.beginPath(); this.b.rect(cx, 0, 60, base + 1); this.b.clip();
          this.mound(cx, base, 64, 10, P.white, P.ice, 3);
          this.R(cx + 6, top - 8, 3, 8, P.ice); this.R(cx + 14, top - 5, 2, 5, P.white);
          this.b.restore();
          for (let i = 0; i < 6; i++) { const fh = 3 + Math.round(Math.abs(Math.sin(t * 6 + i)) * 5); this.R(cx - 26 + i * 4, top + 3 - fh, 2, fh, i % 2 ? P.fire : P.gold); }
          this.R(cx - 2, top - 10, 4, 10, P.greyDark);
          top -= 12; break;
        }
        case "dressrosa": {
          top = this.mound(cx, base, 64, 7, P.grass, P.sandDark, 2);
          this.R(cx - 24, top - 8, 46, 8, P.pink); this.windows(cx - 24, top - 8, 46, 8, P.pinkDark, 4);
          this.R(cx - 8, top - 18, 16, 10, P.sand); this.R(cx - 9, top - 19, 18, 2, P.redDark); this.windows(cx - 8, top - 18, 16, 10, P.pinkDark, 3);
          this.R(cx + 14, top - 22, 4, 14, P.white); this.disc(cx + 16, top - 23, 3, P.pink);
          top -= 26; break;
        }
        case "cake": {
          const layers = [[60, "#7a4a2a"], [48, "#f4c6d6"], [36, "#ffffff"], [24, "#e88bb0"], [14, "#fff3c4"]];
          let y = base;
          layers.forEach(([w, c], i) => { this.R(cx - w / 2, y - 6, w, 6, c); this.R(cx - w / 2, y - 6, w, 1, "#ffffff"); if (i % 2) for (let x = 0; x < w; x += 4) this.R(cx - w / 2 + x, y - 2, 2, 1, P.red); y -= 6; });
          this.R(cx - 1, y - 5, 2, 5, P.white); this.R(cx - 1, y - 7 - Math.round(Math.abs(Math.sin(t * 8))), 2, 2, P.fire);
          top = y - 8; break;
        }
        case "wano": {
          top = this.mound(cx, base, 66, 26, P.white, P.rockDark, 4);
          this.mound(cx - 14, base, 30, 12, P.grassDark, P.rock, 3);
          this.R(cx + 12, base - 13, 2, 12, P.red); this.R(cx + 22, base - 13, 2, 12, P.red);
          this.R(cx + 9, base - 14, 18, 2, P.red); this.R(cx + 11, base - 11, 14, 1, P.redDark);
          this.disc(cx - 22, base - 14, 5, P.pink); this.R(cx - 23, base - 10, 2, 9, P.wood);
          top -= 2; break;
        }
        case "tech": {
          top = this.mound(cx, base, 58, 5, P.grey, P.greyDark, 1);
          for (let r = 0; r < 22; r++) { const w = Math.round(14 * Math.sqrt(1 - Math.pow((r - 4) / 18, 2))) || 2; this.R(cx - w, top - r, w * 2, 1, r % 6 === 0 ? P.cyan : P.white); }
          this.R(cx - 1, top - 26, 2, 4, P.greyDark); this.R(cx - 1, top - 27, 2, 1, Math.sin(t * 5) > 0 ? P.red : P.greyDark);
          this.R(cx + 18, top - 9, 4, 9, P.white); this.R(cx - 22, top - 6, 5, 6, P.white); this.windows(cx + 18, top - 9, 4, 9, P.cyan, 3);
          top -= 28; break;
        }
        case "final": {
          top = this.mound(cx, base, 62, 12, P.gold, P.goldDark, 3);
          this.palm(cx - 18, top + 3, 12); this.palm(cx + 20, top + 2, 10);
          const glow = 0.5 + 0.5 * Math.sin(t * 2.5);
          this.b.globalAlpha = 0.3 + glow * 0.4; this.disc(cx, top - 6, 9, "#fff3b0"); this.b.globalAlpha = 1;
          for (let i = -4; i <= 4; i++) { this.R(cx + i, top - 6 + i, 2, 2, P.red); this.R(cx + i, top - 6 - i, 2, 2, P.red); }
          for (let i = 0; i < 5; i++) if (Math.sin(t * 4 + i * 2) > 0.6) this.R(cx - 24 + i * 12, top - 14 - (i % 3) * 4, 1, 1, "#ffffff");
          top -= 18; break;
        }
        default: {
          top = this.mound(cx, base, 48, 8, P.grass, P.sand, 3);
          this.palm(cx - 6, top + 3, 10); this.palm(cx + 8, top + 2, 8);
          top -= 14;
        }
      }
      stop._top = top;
    }
    ring(cx, cy, r, c) { for (let a = 0; a < 24; a++) this.R(cx + Math.round(Math.cos(a / 24 * 6.283) * r), cy + Math.round(Math.sin(a / 24 * 6.283) * r), 1, 1, c); }

    redLine(cx, hy, style) {
      const w = 64, x0 = cx - w / 2, r = seeded(Math.round(cx + this.cam));
      for (let x = 0; x < w; x++) {
        const edge = x < 3 || x > w - 4;
        this.R(x0 + x, 0, 1, hy + 2, edge ? P.redDark : P.red);
      }
      for (let y = 2; y < hy; y += 5) for (let x = (y / 5) % 2 ? 0 : 4; x < w; x += 8) this.R(x0 + x, y, 4, 1, P.redDark);
      for (let x = 0; x < w; x += 3) this.R(x0 + x, 0, 3, 2 + Math.round(r() * 3), P.grassDark);
      if (style === "reverse") {
        // water runs UP the mountain
        this.R(cx - 5, 0, 10, hy + 2, P.blue);
        for (let i = 0; i < 12; i++) { const y = ((hy - ((this.t * 40 + i * 13) % (hy + 10))) | 0); this.R(cx - 4 + (i % 3) * 3, y, 2, 3, P.cyan); }
      } else if (style === "fishman") {
        // the island sits 10,000 m down, under the Red Line
        const dy = hy + Math.round((this.bh - hy) * 0.55), rad = Math.min(20, Math.round((this.bh - hy) * 0.4));
        this.b.globalAlpha = 0.35; this.disc(cx, dy, rad, P.cyan); this.b.globalAlpha = 1;
        this.ring(cx, dy, rad, P.cyan);
        this.R(cx - 6, dy + 2, 3, 6, P.pink); this.R(cx - 1, dy - 3, 4, 11, P.white); this.R(cx + 5, dy + 1, 3, 7, P.pink);
      }
    }

    drawShip(hy) {
      const img = this.sprites.ship.img;
      const x = Math.round(this.worldX(this.ship) - this.cam - img.width / 2);
      const bob = Math.round(Math.sin(this.t * 2.6) * 1);
      const y = hy - img.height + 4 + bob;
      const moving = !!this.anim || this.mode === "title";
      // wake
      for (let i = 0; i < (moving ? 6 : 3); i++) {
        const wx = x - 3 - i * 4 - Math.round((this.t * 12) % 4);
        this.R(wx, hy + 1 + (i % 2), 3, 1, "#ffffffaa");
      }
      if (moving) this.R(x + img.width - 2, hy + 1, 3, 1, "#ffffffcc");
      this.b.drawImage(img, x, y);
      this.shipBox = { x, y, w: img.width, h: img.height };
    }

    labels(hy) {
      const { ctx, px } = this;
      const size = px >= 4 ? 16 : 8;
      ctx.font = `${size}px "Press Start 2P", "Courier New", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      for (const s of this.route.stops) {
        const bx = this.worldX(s.nmi) - this.cam;
        if (bx < -80 || bx > this.bw + 80) continue;
        const top = s.redLine ? Math.max(14, hy * 0.35) : (s._top || hy - 20);
        const sx = Math.round(bx * px), sy = Math.round((top - 3) * px);
        const reached = s.nmi <= this.ship + 0.01;
        const label = s.name.toUpperCase();
        const wpx = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(10,10,30,0.75)";
        ctx.fillRect(sx - wpx / 2 - 6, sy - size - 8, wpx + 12, size + 10);
        ctx.fillStyle = reached ? "#f1c04a" : "#f4ecd8";
        ctx.fillText(label, sx, sy - 2);
        ctx.font = `${Math.max(8, size / 2)}px "Press Start 2P", monospace`;
        ctx.fillStyle = "rgba(244,236,216,0.7)";
        ctx.textBaseline = "top";
        ctx.fillText(`${s.nmi.toLocaleString()} NMI`, sx, sy + 2);
        ctx.textBaseline = "bottom";
        ctx.font = `${size}px "Press Start 2P", "Courier New", monospace`;
      }
      ctx.textAlign = "left";
    }
  }

  window.SeaChart = SeaChart;
})();
