// Original pixel-art scenes, one per stop on the voyage map. Painted in code at a low resolution
// (96 pixels tall, width to fit the box), then scaled up with no smoothing by the map.
// Each scene is an original landscape built around what the place is known for (a desert kingdom,
// a canal city, a cherry-blossom castle town...); none of them copies a picture.
//
// Add or change a scene: write a function in SCENES below, keyed by the stop's name in lowercase
// with dashes (see data/route.js). Unknown names fall back to their "style".
(function () {
  "use strict";
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = a => "#" + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const A = hex(a), C = hex(b); return toHex(A.map((v, i) => v + (C[i] - v) * t)); };
  const shade = (c, k) => (k < 0 ? mix(c, "#000000", -k) : mix(c, "#ffffff", k));
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  // skies (top to horizon)
  const SKY = {
    day:    ["#3f86d4", "#5fa2e2", "#8cc2ee", "#c8e6f6"],
    clear:  ["#2f7fe0", "#4f9ff0", "#86c6f7", "#d8f0fb"],
    dusk:   ["#251d55", "#5a347f", "#c45d78", "#f5a35a"],
    night:  ["#060a1e", "#0f1640", "#1d2560", "#323b7a"],
    snow:   ["#7f9cc0", "#a8bfd8", "#d3e1ee", "#eef4f8"],
    desert: ["#5f9fd6", "#9cc8e4", "#efd9aa", "#f7c27e"],
    gold:   ["#2b1f5c", "#93467c", "#ec8250", "#ffd56e"],
    fog:    ["#2c2740", "#463d5e", "#6b5f82", "#8e83a2"],
    candy:  ["#ff9ccf", "#ffb8dc", "#ffd6ea", "#fff0f6"],
    sea:    ["#06304f", "#0b4f7c", "#1576a6", "#2fa5cb"],
    storm:  ["#2a3346", "#3d4a63", "#5d6b84", "#8c99ad"]
  };

  class Painter {
    constructor(W, H, seed) {
      this.W = W; this.H = H;
      this.c = document.createElement("canvas"); this.c.width = W; this.c.height = H;
      this.x = this.c.getContext("2d");
      this.r = rng(seed);
      this.hz = Math.round(H * 0.8);          // horizon: where land meets the scene's own water
    }
    R(x, y, w, h, c) { if (w <= 0 || h <= 0) return; this.x.fillStyle = c; this.x.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
    P(x, y, c) { this.R(x, y, 1, 1, c); }
    rand(a, b) { return a + this.r() * (b - a); }

    // gradient through colour stops, ordered dither between steps (the classic pixel-art sky)
    grad(stops, y0, y1, x0 = 0, x1 = this.W) {
      const n = stops.length - 1, span = Math.max(1, y1 - y0 - 1);
      for (let y = y0; y < y1; y++) {
        const t = (y - y0) / span * n, i = Math.min(n - 1, Math.floor(t)), f = t - i;
        const a = stops[i], b = stops[i + 1];
        if (f < 1 / 16) { this.R(x0, y, x1 - x0, 1, a); continue; }
        if (f > 15 / 16) { this.R(x0, y, x1 - x0, 1, b); continue; }
        for (let x = x0; x < x1; x++) this.P(x, y, f > (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 ? b : a);
      }
    }
    sky(key) { this.grad(SKY[key] || SKY.day, 0, this.hz + 1); this.skyKey = key; }
    disc(cx, cy, r, c) { for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); this.R(cx - w, cy + y, w * 2 + 1, 1, c); } }
    ring(cx, cy, r, c) { for (let a = 0; a < 48; a++) this.P(cx + Math.round(Math.cos(a / 48 * 6.283) * r), cy + Math.round(Math.sin(a / 48 * 6.283) * r), c); }
    sun(x, y, r, c = "#fff4b8") { this.disc(x, y, r + 2, mix(c, SKY[this.skyKey || "day"][1], 0.6)); this.disc(x, y, r, c); this.disc(x - 1, y - 1, Math.max(1, r - 3), shade(c, 0.4)); }
    moon(x, y, r) { this.disc(x, y, r, "#e9ecf6"); this.disc(x + Math.round(r * 0.5), y - 1, Math.max(1, r - 2), SKY.night[1]); }
    stars(n, maxY) { for (let i = 0; i < n; i++) { const x = Math.floor(this.r() * this.W), y = Math.floor(this.r() * maxY); this.P(x, y, this.r() > 0.8 ? "#fff8d8" : "#9fb0e0"); } }
    cloud(cx, cy, w, c = "#ffffff", sh = null) {
      const s = sh || shade(c, -0.18), parts = Math.max(3, Math.round(w / 6));
      for (let i = 0; i < parts; i++) {
        const px = cx - w / 2 + (i + 0.5) * w / parts, r = Math.round(2 + this.r() * (w / 7) * (1 - Math.abs(i / (parts - 1) - 0.5)));
        this.disc(px, cy - r * 0.6, r, c);
      }
      this.R(cx - w / 2, cy, w, 2, c);
      this.R(cx - w / 2 + 1, cy + 1, w - 2, 1, s);
    }
    clouds(n, y0, y1, c, sh) { for (let i = 0; i < n; i++) this.cloud(this.rand(0, this.W), this.rand(y0, y1), this.rand(14, 30), c, sh); }

    // a mountain range: rolling ridge with a lit edge, optional snow caps
    ridge(baseY, amp, col, { rough = 1, snow = null, seed = 0, light = 0.12 } = {}) {
      const ph = [this.r() * 9, this.r() * 9, this.r() * 9];
      for (let x = 0; x < this.W; x++) {
        const n = (Math.sin(x / 23 / rough + ph[0] + seed) * 0.5 + Math.sin(x / 9.1 / rough + ph[1]) * 0.25 + Math.sin(x / 41 + ph[2]) * 0.6 + 1.2) / 2.4;
        const h = Math.round(amp * n), top = baseY - h;
        this.R(x, top, 1, baseY - top + 1, col);
        this.P(x, top, shade(col, light));
        if (snow && h > amp * 0.62) this.R(x, top, 1, Math.max(1, Math.round((h - amp * 0.62) * 0.8)), snow);
      }
    }
    // the scene's own water from the horizon down: sky-tinted at the top, deeper below, glints
    water(top = "#2f87c8", deep = "#11507f", glint = "#cfeaff") {
      this.grad([top, mix(top, deep, 0.5), deep], this.hz, this.H);
      for (let i = 0; i < this.W / 5; i++) {
        const x = Math.floor(this.r() * this.W), y = this.hz + 1 + Math.floor(this.r() * (this.H - this.hz - 1));
        this.R(x, y, 2 + Math.floor(this.r() * 4), 1, mix(glint, top, 0.3 + (y - this.hz) / (this.H - this.hz) * 0.6));
      }
      this.R(0, this.hz, this.W, 1, mix(glint, top, 0.4));
    }
    // land mass: uneven top, lit left, shaded right, speckled texture, beach or cliff at the waterline
    land(cx, baseY, w, h, top, side, { beach = null, rocky = false, flat = 0 } = {}) {
      const ph = this.r() * 9;
      for (let x = Math.round(cx - w / 2); x <= Math.round(cx + w / 2); x++) {
        const u = (x - cx) / (w / 2);
        const prof = flat ? Math.min(1, (1 - Math.abs(u)) * (1 / Math.max(0.05, 1 - flat))) : Math.sqrt(Math.max(0, 1 - u * u));
        const hh = Math.round(h * prof * (0.9 + 0.1 * Math.sin(x / 3.1 + ph)));
        if (hh <= 0) continue;
        const t = baseY - hh;
        const lit = u < -0.2 ? 0.1 : u > 0.35 ? -0.18 : 0;
        this.R(x, t, 1, 2, shade(top, lit + 0.08));
        this.R(x, t + 2, 1, hh - 2, shade(side, lit));
        for (let y = t + 3; y < baseY; y += 3) if (this.r() < 0.35) this.P(x, y, shade(side, lit - 0.12));
        if (rocky && this.r() < 0.25) this.P(x, t + 1 + Math.floor(this.r() * (hh - 1)), shade(side, -0.25));
      }
      if (beach) this.R(cx - w / 2 + 2, baseY - 1, w - 4, 2, beach);
    }
    // trees
    palm(x, base, h) {
      for (let i = 0; i < h; i++) this.P(x + Math.round(Math.sin(i / h * 1.2) * 2), base - i, i % 3 ? "#8a5a32" : "#6f4626");
      const tx = x + Math.round(Math.sin(1.2) * 2), ty = base - h;
      for (const [dx, dy] of [[-5, 1], [-4, 0], [-2, -1], [0, -1], [2, -1], [4, 0], [5, 1], [-6, 2], [6, 2]]) this.P(tx + dx, ty + dy, dy < 1 ? "#3f9a4a" : "#2c7438");
      this.R(tx - 3, ty, 7, 1, "#3f9a4a");
    }
    roundTree(x, base, r, leaf = "#3f9a4a", trunk = "#6f4626") {
      this.R(x, base - r, 1, r, trunk);
      this.disc(x, base - r - 1, r, shade(leaf, -0.15)); this.disc(x - 1, base - r - 2, r - 1, leaf); this.P(x - 2, base - r - 4, shade(leaf, 0.3));
    }
    pine(x, base, h, c = "#2f6b45", snow = null) {
      this.R(x, base - 2, 1, 2, "#5a3a22");
      for (let i = 0; i < h; i++) { const w = Math.round((h - i) * 0.45); this.R(x - w, base - 2 - i, w * 2 + 1, 1, i % 3 === 0 ? shade(c, -0.15) : c); if (snow && i % 3 === 0) this.R(x - w, base - 2 - i, Math.max(1, w), 1, snow); }
    }
    blossom(x, base, r) { this.roundTree(x, base, r, "#f2a7c6", "#5a3a2a"); for (let i = 0; i < r * 2; i++) this.P(x - r + Math.floor(this.r() * r * 2), base - r * 2 + Math.floor(this.r() * r * 2), "#ffd3e4"); }
    // buildings
    house(x, base, w, h, wall, roof, win = "#ffe7a0") {
      this.R(x, base - h, w, h, wall); this.R(x + w - 1, base - h, 1, h, shade(wall, -0.2));
      for (let i = 0; i <= Math.ceil(w / 2); i++) this.R(x - 1 + i, base - h - 1 - i, w + 2 - i * 2, 1, i === 0 ? shade(roof, -0.2) : roof);
      if (w >= 4) this.P(x + 1, base - h + 2, win);
      if (w >= 6) this.P(x + w - 3, base - h + 2, win);
      this.R(x + Math.floor(w / 2), base - 2, 1, 2, shade(wall, -0.45));
    }
    windows(x, y, w, h, c, step = 3) { for (let yy = y + 1; yy < y + h - 1; yy += step) for (let xx = x + 1; xx < x + w - 1; xx += step) this.P(xx, yy, c); }
    tower(x, base, w, h, wall, cap, win) { this.R(x, base - h, w, h, wall); this.R(x + w - 1, base - h, 1, h, shade(wall, -0.2)); this.windows(x, base - h, w, h, win, 3); this.R(x - 1, base - h - 2, w + 2, 2, cap); }
    pagoda(x, base, tiers, w, wall = "#f1ece0", roof = "#2f3b4f", trim = "#d8b04a") {
      let y = base;
      for (let t = 0; t < tiers; t++) {
        const ww = Math.max(4, w - t * 4), hh = 4;
        this.R(x - ww / 2, y - hh, ww, hh, wall); this.windows(x - ww / 2, y - hh, ww, hh, "#5b4a3a", 2);
        y -= hh;
        this.R(x - ww / 2 - 3, y - 1, ww + 6, 2, roof); this.P(x - ww / 2 - 3, y - 2, roof); this.P(x + ww / 2 + 2, y - 2, roof);
        this.R(x - ww / 2 - 2, y - 1, ww + 4, 1, trim === roof ? roof : shade(roof, 0.15));
        y -= 2;
      }
      this.R(x - 1, y - 2, 2, 2, trim);
      return y;
    }
    dome(cx, base, r, c, trim) { this.disc(cx, base, r, c); this.R(cx - r - 1, base, r * 2 + 3, 2, trim); this.P(cx - Math.round(r / 2), base - r + 1, shade(c, 0.35)); this.R(cx, base - r - 3, 1, 3, trim); }
    waterfall(x, y0, y1, w = 3) { for (let y = y0; y < y1; y++) for (let i = 0; i < w; i++) this.P(x + i, y, (y + i * 2 + Math.floor(this.r() * 2)) % 4 === 0 ? "#ffffff" : "#bfe6ff"); this.R(x - 2, y1 - 1, w + 4, 2, "#e8f6ff"); }
    bubbles(n, x0, x1, y0, y1) { for (let i = 0; i < n; i++) { const r = 1 + Math.floor(this.r() * 3); const x = this.rand(x0, x1), y = this.rand(y0, y1); this.ring(x, y, r, "#d8f6ff"); this.P(x - Math.max(1, r - 1), y - Math.max(1, r - 1), "#ffffff"); } }
    birds(n, y0, y1) { for (let i = 0; i < n; i++) { const x = Math.floor(this.rand(4, this.W - 4)), y = Math.floor(this.rand(y0, y1)); this.P(x - 1, y, "#2a2a3a"); this.P(x + 1, y, "#2a2a3a"); this.P(x, y + 1, "#2a2a3a"); } }
    reflect(x, w, c) { for (let y = this.hz + 1; y < this.H; y += 2) if (this.r() < 0.6) this.R(x + this.rand(-2, 2), y, Math.max(1, w * (1 - (y - this.hz) / (this.H - this.hz))), 1, mix(c, "#1a5a8a", 0.55)); }
  }

  const SCENES = {
    "foosha-village"(p) {
      p.sky("day"); p.sun(Math.round(p.W * 0.82), 14, 6); p.clouds(5, 10, 40);
      p.ridge(p.hz - 8, 16, "#7aa7c9", { seed: 1 }); p.ridge(p.hz - 2, 12, "#5f9a6a", { seed: 2, light: 0.15 });
      p.water();
      const cx = Math.round(p.W * 0.62);
      p.land(cx, p.hz + 1, p.W * 0.55, 22, "#62b356", "#4b8a43", { beach: "#ead39a" });
      const g = p.hz - 14;
      [[-34, 7, 6, "#f1e6cf", "#c8553d"], [-24, 6, 5, "#e8d6b5", "#a8442f"], [-14, 8, 6, "#f4ebd8", "#c8553d"], [10, 6, 5, "#efe2c6", "#b24a34"]].forEach(([dx, w, h, wall, roof]) => p.house(cx + dx, g + 6, w, h, wall, roof));
      // windmill on the hill
      p.R(cx + 22, g - 10, 3, 16, "#f3ede0"); p.R(cx + 24, g - 10, 1, 16, "#cfc6b4"); p.R(cx + 21, g - 12, 5, 2, "#a8442f");
      for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) for (let i = 2; i < 9; i++) p.P(cx + 23 + dx * i, g - 9 + dy * i, i % 2 ? "#8a5a32" : "#c9b48a");
      p.palm(cx - 44, p.hz - 1, 12); p.roundTree(cx + 34, p.hz - 6, 4);
      p.R(cx - 60, p.hz - 1, 18, 1, "#7a5230"); for (let i = 0; i < 18; i += 4) p.R(cx - 60 + i, p.hz, 1, 3, "#5a3a22");   // dock
      p.reflect(cx - 20, 30, "#62b356"); p.birds(3, 18, 40);
    },
    "orange-town"(p) {
      p.sky("day"); p.sun(18, 14, 5); p.clouds(4, 8, 36);
      p.water();
      const cx = Math.round(p.W * 0.6), g = p.hz;
      p.land(cx, g + 1, p.W * 0.7, 10, "#b9a27a", "#94805c", { flat: 0.7 });
      for (let i = 0; i < 14; i++) {
        const w = 6 + Math.floor(p.r() * 5), h = 6 + Math.floor(p.r() * 10), x = cx - p.W * 0.3 + i * 8 + p.rand(-1, 1);
        p.house(x, g - 7, w, h, ["#f2e3c4", "#e9cfa1", "#f6ead2"][i % 3], ["#e2862e", "#d36f24", "#c95f21"][i % 3]);
      }
      p.tower(cx - 6, g - 7, 7, 22, "#f2e3c4", "#c95f21", "#5b4a3a");
      p.roundTree(cx - p.W * 0.34, g - 6, 4, "#3f9a4a"); p.roundTree(cx + p.W * 0.33, g - 6, 4, "#3f9a4a");
      p.reflect(cx - 30, 60, "#e2862e");
    },
    "syrup-village"(p) {
      p.sky("day"); p.sun(Math.round(p.W * 0.15), 12, 5); p.clouds(5, 8, 34);
      p.ridge(p.hz - 4, 14, "#7fb08a", { seed: 3 });
      p.water();
      const cx = Math.round(p.W * 0.58);
      p.land(cx, p.hz + 1, p.W * 0.6, 34, "#6abf5c", "#a08a64", { rocky: true });
      // mansion on the cliff top
      const top = p.hz - 30;
      p.R(cx + 6, top - 10, 22, 10, "#f2ece0"); p.windows(cx + 6, top - 10, 22, 10, "#5a7fb0", 3);
      for (let i = 0; i < 12; i++) p.R(cx + 5 + i, top - 11 - i / 2, 24 - i * 2, 1, "#3d6fb0");
      p.house(cx - 30, p.hz - 10, 7, 6, "#efe2c6", "#a8442f"); p.house(cx - 20, p.hz - 8, 6, 5, "#e8d6b5", "#b24a34");
      for (let i = 0; i < 6; i++) p.roundTree(cx - 40 + i * 14, p.hz - 6 - (i % 2) * 3, 3 + (i % 2));
      for (let y = top; y < p.hz; y += 2) p.P(cx - 4 + Math.round((y - top) / 3), y, "#d9c9a0");   // slope path
      p.reflect(cx - 20, 40, "#6abf5c");
    },
    "baratie"(p) {
      p.sky("clear"); p.sun(Math.round(p.W * 0.8), 16, 6); p.clouds(5, 8, 38);
      p.water("#2b84c9", "#0f4a7c");
      const cx = Math.round(p.W * 0.55), g = p.hz + 2;
      // a floating restaurant: wide round hull, two-storey dining hall, chimney smoke
      for (let i = 0; i < 8; i++) p.R(cx - 34 + i, g - 8 + i, 68 - i * 2, 1, i < 2 ? "#c8553d" : "#7a4a2a");
      p.R(cx - 26, g - 20, 52, 12, "#f4ebd8"); p.windows(cx - 26, g - 20, 52, 12, "#ffd37a", 3);
      p.R(cx - 28, g - 22, 56, 2, "#3a6aa0"); p.R(cx - 18, g - 30, 36, 8, "#f4ebd8"); p.windows(cx - 18, g - 30, 36, 8, "#ffd37a", 4);
      p.R(cx - 20, g - 32, 40, 2, "#3a6aa0"); p.R(cx + 10, g - 40, 3, 8, "#5a5a6a");
      for (let i = 0; i < 6; i++) p.disc(cx + 12 + i * 2, g - 42 - i * 3, 1 + (i >> 1), mix("#ffffff", "#8cc2ee", i / 6));
      p.R(cx - 34, g - 9, 68, 1, "#f4ebd8");
      p.reflect(cx - 30, 60, "#f4ebd8");
    },
    "arlong-park"(p) {
      p.sky("day"); p.clouds(4, 8, 32);
      p.ridge(p.hz - 3, 10, "#6fa8a0", { seed: 4 });
      p.water("#2c89c0", "#0f4f7d");
      const cx = Math.round(p.W * 0.6);
      p.land(cx - 30, p.hz + 1, 50, 10, "#5fae55", "#4b8a43");
      for (let i = 0; i < 5; i++) p.roundTree(cx - 48 + i * 8, p.hz - 6, 3, "#3f8a3a"), p.P(cx - 49 + i * 8, p.hz - 11, "#ff9a2a"), p.P(cx - 47 + i * 8, p.hz - 9, "#ff9a2a");   // orange groves
      // a walled sea fortress with a tall tower
      p.R(cx + 4, p.hz - 14, 44, 14, "#d9d2c3"); for (let x = cx + 4; x < cx + 48; x += 4) p.R(x, p.hz - 16, 2, 2, "#d9d2c3");
      p.tower(cx + 22, p.hz - 14, 10, 26, "#e9e2d2", "#3b6f8a", "#2f4f6f");
      p.R(cx + 20, p.hz - 44, 14, 3, "#3b6f8a"); p.R(cx + 26, p.hz - 50, 2, 6, "#5a5a6a");
      p.reflect(cx, 50, "#d9d2c3");
    },
    "loguetown"(p) {
      p.sky("storm"); p.clouds(6, 6, 30, "#b8c2d2", "#8a96aa");
      p.water("#3e6f96", "#173d5c");
      const cx = Math.round(p.W * 0.6), g = p.hz;
      p.land(cx, g + 1, p.W * 0.75, 8, "#9a9a8a", "#7a7a6c", { flat: 0.8 });
      for (let i = 0; i < 18; i++) { const h = 8 + Math.floor(p.r() * 14); p.R(cx - p.W * 0.36 + i * 7, g - 6 - h, 6, h, ["#c8b89a", "#b9a98c", "#d4c6aa"][i % 3]); p.windows(cx - p.W * 0.36 + i * 7, g - 6 - h, 6, h, "#ffe39a", 3); p.R(cx - p.W * 0.36 + i * 7 - 1, g - 7 - h, 8, 1, "#7a4a3a"); }
      // a tall wooden platform in the square
      p.R(cx - 4, g - 40, 2, 34, "#6f4626"); p.R(cx + 4, g - 40, 2, 34, "#6f4626"); p.R(cx - 6, g - 42, 14, 3, "#8a5a32");
      for (let y = g - 36; y < g - 6; y += 6) p.R(cx - 4, y, 10, 1, "#5a3a22");
      // rain
      for (let i = 0; i < p.W; i++) { const x = Math.floor(p.r() * p.W), y = Math.floor(p.r() * p.hz); p.P(x, y, "rgba(210,225,240,0.5)"); }
    },
    "reverse-mountain"(p) {
      p.sky("storm"); p.clouds(5, 4, 20, "#a9b6c8", "#7f8ea4");
      p.water("#2f6f9e", "#123c60");
      // a colossal red mountain wall filling the scene, with a river climbing straight up it
      for (let x = 0; x < p.W; x++) {
        const t = p.hz - 4 - Math.round(52 + Math.sin(x / 11) * 4 + Math.sin(x / 4.3) * 2);
        p.R(x, t, 1, p.hz - t, x % 9 < 1 ? "#8e2f22" : "#b8442e");
        p.P(x, t, "#d96a4e"); if (p.r() < 0.3) p.P(x, t + 2 + Math.floor(p.r() * 40), "#9a3626");
      }
      const cx = Math.round(p.W * 0.55);
      for (let y = 6; y < p.hz; y++) { const w = 8 + Math.round((y / p.hz) * 6); for (let i = 0; i < w; i++) p.P(cx - w / 2 + i, y, (y * 3 + i * 5) % 7 === 0 ? "#ffffff" : (i < 2 || i > w - 3 ? "#5fb0e0" : "#86ccf2")); }
      p.R(cx - 12, p.hz - 2, 24, 3, "#e8f6ff");
      p.reflect(cx - 8, 16, "#86ccf2");
    },
    "whisky-peak"(p) {
      p.sky("night"); p.stars(70, p.hz - 20); p.moon(Math.round(p.W * 0.18), 14, 6);
      p.water("#1d3f6a", "#0a1f3a", "#ffd37a");
      const cx = Math.round(p.W * 0.6);
      p.land(cx, p.hz + 1, p.W * 0.6, 6, "#4a6a3a", "#3a4a2a", { flat: 0.8 });
      // tall cactus-shaped rock spires, their windows lit for a party
      [[-36, 34], [-20, 46], [-4, 38], [12, 50], [28, 30], [42, 40]].forEach(([dx, h], i) => {
        const x = cx + dx, w = 7;
        p.R(x, p.hz - 4 - h, w, h, "#4f6b3e"); p.R(x + w - 2, p.hz - 4 - h, 2, h, "#3d5530"); p.R(x + 1, p.hz - 5 - h, w - 2, 1, "#4f6b3e");
        p.R(x - 3, p.hz - 4 - h * 0.6, 3, 2, "#4f6b3e"); p.R(x - 3, p.hz - 10 - h * 0.6, 2, 6, "#4f6b3e");
        for (let y = p.hz - h; y < p.hz - 6; y += 4) if (p.r() < 0.8) p.P(x + 2 + (y & 1) * 2, y, "#ffd37a");
      });
      for (let i = 0; i < 8; i++) p.P(cx - 40 + i * 11, p.hz - 6, i % 2 ? "#ff8a5a" : "#ffd37a");   // lanterns
      p.reflect(cx - 30, 60, "#ffd37a");
    },
    "little-garden"(p) {
      p.sky("day"); p.clouds(3, 6, 26);
      p.ridge(p.hz - 6, 30, "#4f8a52", { seed: 6, rough: 0.6 });
      // smoking volcano behind the jungle
      const vx = Math.round(p.W * 0.78);
      for (let i = 0; i < 34; i++) p.R(vx - 22 + i * 0.65, p.hz - 6 - i, 44 - i * 1.3, 1, i > 30 ? "#c8442e" : "#6b5a4a");
      for (let i = 0; i < 8; i++) p.disc(vx + i * 2 - 4, p.hz - 44 - i * 4, 3 + (i >> 1), mix("#9a9a9a", "#d0e6f2", i / 8));
      p.water("#2a8ab0", "#0f5070");
      p.land(Math.round(p.W * 0.45), p.hz + 1, p.W * 0.9, 14, "#3f8a3a", "#2c6a2c");
      for (let i = 0; i < 12; i++) p.roundTree(Math.round(p.W * 0.05 + i * p.W * 0.08), p.hz - 8 - Math.floor(p.r() * 6), 4 + Math.floor(p.r() * 3), "#2f7d34");
      // giant ribcage bones half buried
      const bx = Math.round(p.W * 0.4);
      for (let i = 0; i < 5; i++) for (let a = 0; a < 14; a++) p.P(bx + i * 5 + Math.round(Math.sin(a / 14 * 3.1) * 4), p.hz - 4 - a, "#f1ead8");
    },
    "drum-island"(p) {
      p.sky("snow"); p.clouds(4, 6, 24, "#ffffff", "#d0dcea");
      p.ridge(p.hz - 4, 16, "#a9bfd6", { snow: "#ffffff", seed: 7 });
      p.water("#5a8ab4", "#24507a");
      const cx = Math.round(p.W * 0.6);
      // three tall flat-topped peaks, the highest carries a castle
      [[-26, 46, 12], [0, 62, 14], [26, 40, 11]].forEach(([dx, h, w]) => {
        p.R(cx + dx - w / 2, p.hz - h, w, h, "#8a9ab0"); p.R(cx + dx + w / 2 - 3, p.hz - h, 3, h, "#6f7f96");
        p.R(cx + dx - w / 2 - 1, p.hz - h - 2, w + 2, 3, "#ffffff");
        for (let y = p.hz - h + 4; y < p.hz; y += 5) p.R(cx + dx - w / 2, y, w, 1, "#e6eef6");
      });
      const ct = p.hz - 62;
      p.R(cx - 8, ct - 10, 16, 10, "#d8dfe8"); p.windows(cx - 8, ct - 10, 16, 10, "#ffd37a", 4);
      p.R(cx - 10, ct - 12, 4, 6, "#c8d0dc"); p.R(cx + 6, ct - 12, 4, 6, "#c8d0dc"); p.R(cx - 3, ct - 16, 6, 6, "#c8d0dc");
      for (let i = 0; i < 4; i++) p.pine(Math.round(p.W * 0.12) + i * 9, p.hz - 1, 10, "#2f5f4a", "#ffffff");
      for (let i = 0; i < p.W * 1.2; i++) p.P(Math.floor(p.r() * p.W), Math.floor(p.r() * p.H), "#ffffff");   // snowfall
    },
    "arabasta"(p) {
      p.sky("desert"); p.sun(Math.round(p.W * 0.2), 14, 7, "#fff1c0");
      p.ridge(p.hz - 2, 10, "#e6c48a", { seed: 8, rough: 2 });
      p.water("#3a9ac8", "#1a5a80");
      const cx = Math.round(p.W * 0.6);
      p.land(cx, p.hz + 1, p.W * 0.8, 18, "#f0d08f", "#d9b06a", { flat: 0.4 });
      // palace with domes on a stone plateau
      p.R(cx - 26, p.hz - 22, 52, 10, "#cdb48a"); p.R(cx + 18, p.hz - 22, 8, 10, "#b59a70");
      p.R(cx - 18, p.hz - 34, 36, 12, "#f3e6c8"); p.windows(cx - 18, p.hz - 34, 36, 12, "#8a6a3a", 4);
      p.dome(cx, p.hz - 35, 8, "#f6ecd2", "#d8b04a"); p.dome(cx - 14, p.hz - 35, 4, "#f6ecd2", "#d8b04a"); p.dome(cx + 14, p.hz - 35, 4, "#f6ecd2", "#d8b04a");
      p.R(cx - 24, p.hz - 46, 3, 24, "#ece0c2"); p.R(cx + 22, p.hz - 46, 3, 24, "#ece0c2"); p.disc(cx - 23, p.hz - 47, 2, "#d8b04a"); p.disc(cx + 23, p.hz - 47, 2, "#d8b04a");
      p.palm(cx - 40, p.hz - 2, 12); p.palm(cx + 40, p.hz - 3, 10); p.palm(cx - 48, p.hz - 1, 9);
      p.reflect(cx - 30, 60, "#f0d08f");
    },
    "jaya"(p) {
      p.sky("day"); p.sun(Math.round(p.W * 0.12), 12, 5); p.clouds(5, 6, 32);
      p.water("#2c8ac4", "#10507f");
      const cx = Math.round(p.W * 0.45);
      p.land(cx, p.hz + 1, p.W * 0.55, 16, "#5fae55", "#a08a64", { beach: "#ead39a" });
      for (let i = 0; i < 9; i++) p.house(cx - 30 + i * 7, p.hz - 12 + (i % 2), 6, 5 + (i % 3), ["#d9b98a", "#c8a272", "#e8d0a6"][i % 3], ["#7a4a2a", "#5f3a22", "#8a5a32"][i % 3]);
      // a colossal tree on the island's far edge, reaching past the top of the scene
      const tx = Math.round(p.W * 0.82);
      p.R(tx - 6, 18, 12, p.hz - 18, "#6f4a2a"); p.R(tx + 2, 18, 4, p.hz - 18, "#5a3a22");
      for (let i = 0; i < 9; i++) p.disc(tx - 18 + i * 4.5, 10 + (i % 3) * 4, 9, i % 2 ? "#2f7d34" : "#3f9a4a");
      p.palm(cx - 34, p.hz - 2, 11); p.reflect(cx - 20, 40, "#5fae55");
    },
    "skypiea"(p) {
      p.sky("clear"); p.sun(Math.round(p.W * 0.85), 12, 6);
      // a sea of clouds instead of water, islands and houses sitting on it
      p.grad(["#ffffff", "#f0f6ff", "#dce8f8"], p.hz - 6, p.H);
      for (let i = 0; i < p.W / 6; i++) p.disc(Math.floor(p.r() * p.W), p.hz - 4 + Math.floor(p.r() * 4), 3 + Math.floor(p.r() * 4), "#ffffff");
      for (let i = 0; i < p.W / 8; i++) p.R(Math.floor(p.r() * p.W), p.hz + Math.floor(p.r() * (p.H - p.hz)), 5, 1, "#c9daf0");
      p.clouds(6, 8, 40, "#ffffff", "#d6e4f4");
      const cx = Math.round(p.W * 0.58);
      [[-30, 14], [0, 20], [30, 12]].forEach(([dx, h], i) => {
        p.disc(cx + dx, p.hz - h, 10, "#ffffff"); p.R(cx + dx - 10, p.hz - h, 20, 4, "#e8f0fa");
        p.house(cx + dx - 4, p.hz - h - 6, 8, 6, "#fff6e0", "#5a9ad4");
      });
      p.R(cx - 2, p.hz - 52, 4, 30, "#d8b04a"); p.disc(cx, p.hz - 54, 4, "#ffd36b");   // a golden spire
      p.R(Math.round(p.W * 0.1), 20, 30, 1, "#ffb0c0"); p.R(Math.round(p.W * 0.1), 21, 30, 1, "#ffe0a0"); p.R(Math.round(p.W * 0.1), 22, 30, 1, "#b0e0ff");
    },
    "long-ring-long-land"(p) {
      p.sky("day"); p.clouds(5, 6, 30);
      p.water("#2c8ac4", "#10507f");
      // long thin grassy islands stretching across, very tall skinny trees
      for (let i = 0; i < 3; i++) p.land(p.W * (0.2 + i * 0.32), p.hz + 1 - i, p.W * 0.34, 6 + i * 2, "#7cc35c", "#5fa04a", { flat: 0.85 });
      for (let i = 0; i < 10; i++) { const x = Math.round(p.W * 0.06 + i * p.W * 0.095), h = 30 + Math.floor(p.r() * 18); p.R(x, p.hz - 4 - h, 1, h, "#7a5a3a"); p.disc(x, p.hz - 6 - h, 3, "#3f9a4a"); }
      p.birds(4, 10, 30);
    },
    "water-7"(p) {
      p.sky("clear"); p.sun(Math.round(p.W * 0.15), 12, 5); p.clouds(4, 6, 26);
      p.water("#2c8ac4", "#10507f");
      const cx = Math.round(p.W * 0.58);
      // a city stacked in rising tiers around a giant fountain, canals between
      [[60, 8, "#f4ecdc"], [46, 18, "#efe4d0"], [32, 28, "#f6efe2"], [18, 38, "#efe6d6"]].forEach(([hw, h, c]) => {
        p.R(cx - hw, p.hz - h, hw * 2, 8, c); p.windows(cx - hw, p.hz - h, hw * 2, 8, "#4a7ab0", 3); p.R(cx - hw, p.hz - h, hw * 2, 1, "#c8553d");
        p.R(cx - hw, p.hz - h + 7, hw * 2, 1, "#5fb0e0");
      });
      p.R(cx - 3, p.hz - 52, 6, 14, "#e6dccb");
      for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + (i / 15 - 0.5) * 2.4; for (let s = 2; s < 16; s++) p.P(cx + Math.round(Math.cos(a) * s), p.hz - 54 + Math.round(Math.sin(a) * s + (s * s) / 18), s % 3 ? "#bfe6ff" : "#ffffff"); }
      p.reflect(cx - 50, 100, "#f4ecdc");
    },
    "enies-lobby"(p) {
      p.sky("day"); p.sun(Math.round(p.W * 0.85), 12, 6, "#ffffff"); p.clouds(4, 6, 26);
      p.water("#2c8ac4", "#10507f");
      const cx = Math.round(p.W * 0.55);
      // an island whose sea pours away over its edges, a great gate and a tall court tower
      p.land(cx, p.hz - 6, p.W * 0.6, 18, "#c9c2b0", "#a69f8c", { flat: 0.6 });
      for (let x = Math.round(cx - p.W * 0.3); x < cx + p.W * 0.3; x += 7) p.waterfall(x, p.hz - 6, p.hz + 2, 2);
      p.R(cx - 40, p.hz - 34, 6, 28, "#e8e4da"); p.R(cx - 26, p.hz - 34, 6, 28, "#e8e4da"); p.R(cx - 42, p.hz - 38, 24, 5, "#d8d2c4");
      p.tower(cx + 8, p.hz - 22, 14, 34, "#f1ede4", "#3a5a8a", "#4a6a9a"); p.R(cx + 4, p.hz - 22, 22, 4, "#e8e4da");
      p.R(cx + 13, p.hz - 64, 4, 8, "#3a5a8a"); p.R(cx + 14, p.hz - 70, 2, 6, "#d8b04a");
    },
    "thriller-bark"(p) {
      p.sky("fog"); p.moon(Math.round(p.W * 0.2), 16, 7); p.stars(30, 30);
      p.water("#2c3a52", "#141c2c", "#8a8aa8");
      const cx = Math.round(p.W * 0.6);
      // an island-sized ship in the fog: hull, a crooked mansion, dead trees, bats
      for (let i = 0; i < 10; i++) p.R(cx - 60 + i * 2, p.hz - 10 + i, 120 - i * 4, 1, i < 2 ? "#5a3f60" : "#3a2a40");
      p.land(cx, p.hz - 10, 100, 16, "#4a3f5a", "#3a3048");
      p.R(cx - 12, p.hz - 46, 26, 22, "#4f4262"); p.windows(cx - 12, p.hz - 46, 26, 22, "#ffd37a", 4);
      for (let i = 0; i < 14; i++) p.R(cx - 13 + i, p.hz - 47 - i / 2, 28 - i * 2, 1, "#2a2236");
      p.R(cx + 8, p.hz - 62, 4, 16, "#4f4262"); p.R(cx + 7, p.hz - 64, 6, 2, "#2a2236");
      for (const tx of [cx - 36, cx + 28]) { p.R(tx, p.hz - 34, 1, 16, "#1a1424"); p.R(tx - 3, p.hz - 30, 3, 1, "#1a1424"); p.R(tx + 1, p.hz - 28, 4, 1, "#1a1424"); }
      for (let i = 0; i < 6; i++) { const x = p.rand(cx - 50, cx + 50), y = p.rand(14, 40); p.R(x - 2, y, 5, 1, "#140f1c"); p.P(x, y + 1, "#140f1c"); }
      p.grad(["rgba(150,140,180,0)", "rgba(150,140,180,0.25)"], p.hz - 14, p.hz + 4);
      for (let i = 0; i < p.W / 2; i++) p.P(Math.floor(p.r() * p.W), p.hz - 12 + Math.floor(p.r() * 14), "rgba(190,180,210,0.35)");
    },
    "sabaody"(p) {
      p.sky("day"); p.clouds(3, 6, 22);
      p.water("#3a9ac8", "#165a86");
      // forest of giant mangroves, their roots arching out of the sea, bubbles drifting up
      for (let i = 0; i < 6; i++) {
        const x = Math.round(p.W * (0.08 + i * 0.17)), h = 50 + Math.floor(p.r() * 20);
        p.R(x - 3, p.hz - h, 7, h, "#7a5a3a"); p.R(x + 2, p.hz - h, 2, h, "#5f4228");
        for (let a = 0; a < 3; a++) for (let s = 0; s < 12; s++) p.P(x + (a - 1) * s, p.hz - 2 + Math.round(-Math.sin(s / 12 * 3.1) * 6), "#6a4a30");
        p.disc(x, p.hz - h - 6, 12, "#3f9a4a"); p.disc(x - 3, p.hz - h - 8, 9, "#55b35a");
      }
      p.bubbles(30, 0, p.W, 6, p.hz - 6);
      p.house(Math.round(p.W * 0.45), p.hz - 2, 10, 8, "#f6ecd8", "#e2862e");
    },
    "amazon-lily"(p) {
      p.sky("clear"); p.sun(Math.round(p.W * 0.15), 12, 6); p.clouds(4, 6, 26);
      p.water("#1f9ab0", "#0e5a6a");
      const cx = Math.round(p.W * 0.6);
      // a jungle island ringed by a great stone wall of rock that rises to a sharp spire
      p.land(cx, p.hz + 1, p.W * 0.7, 20, "#2f8a3a", "#246a2c");
      for (let i = 0; i < 40; i++) p.R(cx - 8 + i * 0.3, p.hz - 20 - i * 1.4, 16 - i * 0.4, 2, i % 6 < 3 ? "#7a7a6a" : "#6a6a5c");
      for (let i = 0; i < 14; i++) p.roundTree(cx - p.W * 0.32 + i * p.W * 0.045, p.hz - 14 - Math.floor(p.r() * 6), 4, i % 2 ? "#2f8a3a" : "#3fa24a");
      p.house(cx + 20, p.hz - 14, 8, 6, "#f1e2c4", "#d8506a");
      p.reflect(cx - 30, 70, "#2f8a3a");
    },
    "impel-down"(p) {
      p.sky("dusk"); p.clouds(5, 6, 30, "#b56a8a", "#7a4a6a");
      p.water("#1f3a5a", "#0a1626", "#e07a8a");
      const cx = Math.round(p.W * 0.6);
      // a lone stone tower rising from a sea full of whirlpools, fins circling
      p.R(cx - 12, p.hz - 56, 24, 56, "#5a5a68"); p.R(cx + 6, p.hz - 56, 6, 56, "#44444f");
      for (let y = p.hz - 54; y < p.hz; y += 6) p.R(cx - 12, y, 24, 1, "#4a4a56");
      p.R(cx - 14, p.hz - 58, 28, 3, "#3a3a46"); p.windows(cx - 12, p.hz - 56, 24, 56, "#ff9a5a", 6);
      for (const wx of [cx - 50, cx + 46]) { p.ring(wx, p.hz + 6, 5, "#5a7aa0"); p.ring(wx, p.hz + 6, 3, "#8aaad0"); }
      for (const fx of [cx - 30, cx + 30, cx + 60]) { p.R(fx, p.hz - 3, 1, 3, "#2a2a3a"); p.R(fx + 1, p.hz - 2, 1, 2, "#2a2a3a"); p.R(fx - 1, p.hz - 1, 1, 1, "#2a2a3a"); }
      p.reflect(cx - 10, 20, "#ff9a5a");
    },
    "marineford"(p) {
      p.sky("day"); p.clouds(5, 6, 28);
      p.water("#2c8ac4", "#10507f");
      const cx = Math.round(p.W * 0.58);
      // a fortress city in a crescent bay: tiered walls, a great hall, flags
      p.land(cx, p.hz + 1, p.W * 0.9, 12, "#bdb6a8", "#9a9384", { flat: 0.7 });
      p.R(cx - 40, p.hz - 26, 80, 14, "#f1eee6"); p.windows(cx - 40, p.hz - 26, 80, 14, "#3a5a8a", 4);
      p.R(cx - 24, p.hz - 40, 48, 14, "#f6f3ec"); p.windows(cx - 24, p.hz - 40, 48, 14, "#3a5a8a", 4);
      p.R(cx - 10, p.hz - 52, 20, 12, "#f6f3ec"); p.R(cx - 12, p.hz - 54, 24, 2, "#3a5a8a");
      for (const fx of [cx - 38, cx - 22, cx + 22, cx + 38]) { p.R(fx, p.hz - 36, 1, 10, "#6a6a6a"); p.R(fx + 1, p.hz - 36, 5, 3, "#f6f3ec"); p.R(fx + 2, p.hz - 35, 3, 1, "#3a5a8a"); }
      p.reflect(cx - 40, 80, "#f1eee6");
    },
    "fish-man-island"(p) {
      // deep under the sea: light shafts, a giant air-bubble dome with a palace, coral, fish
      p.grad(SKY.sea, 0, p.H);
      for (let i = 0; i < 6; i++) { const x = p.rand(0, p.W); for (let y = 0; y < p.H; y++) if ((y + i) % 2 === 0) p.P(x + y * 0.3, y, "rgba(190,240,255,0.18)"); }
      const cx = Math.round(p.W * 0.58), cy = Math.round(p.H * 0.6);
      p.disc(cx, cy, 34, "rgba(180,240,255,0.18)"); p.ring(cx, cy, 34, "#bdefff"); p.ring(cx, cy, 33, "rgba(220,250,255,0.6)");
      p.R(cx - 14, cy - 8, 28, 26, "#f6e6f0"); p.windows(cx - 14, cy - 8, 28, 26, "#ff9ac0", 4);
      p.dome(cx, cy - 9, 7, "#ffd0e4", "#f2b0d0"); p.dome(cx - 12, cy - 9, 3, "#ffd0e4", "#f2b0d0"); p.dome(cx + 12, cy - 9, 3, "#ffd0e4", "#f2b0d0");
      p.grad(["#2a6f86", "#1a4f66"], p.H - 10, p.H);
      for (let i = 0; i < 14; i++) { const x = Math.floor(p.r() * p.W), h = 4 + Math.floor(p.r() * 10); p.R(x, p.H - 10 - h, 2, h, ["#ff7a9a", "#ffb05a", "#c86ad8"][i % 3]); p.R(x - 1, p.H - 10 - h, 4, 2, ["#ff9ab4", "#ffc07a", "#d88ae8"][i % 3]); }
      for (let i = 0; i < 8; i++) { const x = p.rand(4, p.W - 6), y = p.rand(6, p.H * 0.5); p.R(x, y, 3, 1, "#ffd36b"); p.P(x - 1, y, "#ffd36b"); p.P(x + 3, y - 1, "#ffd36b"); p.P(x + 3, y + 1, "#ffd36b"); }
      p.bubbles(16, 0, p.W, 4, p.H - 12);
    },
    "punk-hazard"(p) {
      // one island, two climates: burning on the left, frozen on the right
      const mid = Math.round(p.W * 0.55);
      p.grad(["#4a1a1a", "#8a2a1a", "#d8582a", "#f5a34a"], 0, p.hz + 1, 0, mid);
      p.grad(SKY.snow, 0, p.hz + 1, mid, p.W);
      for (let i = 0; i < 40; i++) p.P(mid + Math.floor(p.r() * (p.W - mid)), Math.floor(p.r() * p.hz), "#ffffff");
      p.water("#3a5a7a", "#16283a");
      p.land(mid, p.hz + 1, p.W * 0.7, 30, "#6a4a3a", "#4a3428", { rocky: true });
      for (let x = mid; x < mid + p.W * 0.35; x++) for (let y = p.hz - 30; y < p.hz + 1; y++) { const c = p.x.getImageData(x, y, 1, 1).data; if (c[3] && c[0] < 140 && c[0] > 40 && c[2] < 90) p.P(x, y, (y + x) % 5 ? "#dbe9f6" : "#b8d0e8"); }
      for (let i = 0; i < 10; i++) { const x = mid - 10 - Math.floor(p.r() * p.W * 0.3), h = 4 + Math.floor(p.r() * 10); p.R(x, p.hz - 16 - h, 2, h, i % 2 ? "#ff7a2a" : "#ffd36b"); }
      for (let i = 0; i < 6; i++) p.disc(mid - 30 + i, p.hz - 40 - i * 4, 3 + (i >> 1), mix("#5a4a4a", "#b0a0a0", i / 6));
      p.R(mid - 3, p.hz - 40, 6, 12, "#9aa3ad"); p.R(mid - 5, p.hz - 42, 10, 2, "#6f7a86");
    },
    "dressrosa"(p) {
      p.sky("clear"); p.sun(Math.round(p.W * 0.85), 12, 6); p.clouds(4, 6, 26);
      p.water("#2c8ac4", "#10507f");
      const cx = Math.round(p.W * 0.55);
      p.land(cx, p.hz + 1, p.W * 0.85, 16, "#7cc35c", "#c8a26a", { flat: 0.5 });
      // a colourful hillside town, a round colosseum, a palace high on a plateau, flowers everywhere
      for (let i = 0; i < 16; i++) p.house(cx - p.W * 0.38 + i * 9, p.hz - 10 + (i % 3), 7, 6 + (i % 4), ["#ffc4d6", "#ffe0a0", "#ffd0b0", "#f6e8ff"][i % 4], ["#e8506a", "#e2862e", "#c84a8a", "#5a8ad4"][i % 4]);
      p.R(cx - 20, p.hz - 22, 30, 12, "#e2c8a0"); for (let x = cx - 20; x < cx + 10; x += 3) p.R(x, p.hz - 20, 1, 8, "#b89a70"); p.R(cx - 21, p.hz - 23, 32, 2, "#c8a878");
      p.R(cx + 26, p.hz - 50, 30, 30, "#b8a27a"); p.R(cx + 28, p.hz - 62, 26, 12, "#fff0f4"); p.windows(cx + 28, p.hz - 62, 26, 12, "#e8506a", 3);
      p.dome(cx + 41, p.hz - 63, 5, "#ffd0e0", "#e8506a");
      for (let i = 0; i < 30; i++) p.P(cx - p.W * 0.4 + p.r() * p.W * 0.8, p.hz - 3 + p.r() * 3, ["#ff6a8a", "#ffd36b", "#ffffff"][i % 3]);
      p.reflect(cx - 40, 80, "#ffc4d6");
    },
    "zou"(p) {
      p.sky("fog"); p.clouds(4, 6, 24, "#a8a0bc", "#7a7290");
      p.water("#3a5a7a", "#16283a", "#a8b8d0");
      const cx = Math.round(p.W * 0.58);
      // a gigantic elephant wading through the sea with a whole forest growing on its back
      const body = "#7a7f8a", dark = "#5f6470";
      p.disc(cx, p.hz - 28, 30, body); p.R(cx - 30, p.hz - 28, 60, 28, body);
      for (const lx of [cx - 24, cx - 8, cx + 10, cx + 24]) p.R(lx, p.hz - 10, 9, 12, dark);
      p.disc(cx + 34, p.hz - 34, 13, body); p.disc(cx + 30, p.hz - 32, 10, dark);      // head + ear
      for (let i = 0; i < 26; i++) p.R(cx + 42 + Math.sin(i / 7) * 3, p.hz - 32 + i, 4, 1, body);   // trunk into the sea
      p.P(cx + 38, p.hz - 38, "#1a1424");
      for (let i = 0; i < 9; i++) p.roundTree(cx - 26 + i * 6, p.hz - 56 - Math.floor(p.r() * 4), 4 + (i % 2), i % 2 ? "#3f8a4a" : "#2f7a3a");
      p.house(cx - 6, p.hz - 56, 7, 5, "#efe2c6", "#b24a34");
    },
    "whole-cake-island"(p) {
      p.sky("candy"); p.clouds(6, 6, 30, "#ffffff", "#ffd6ea");
      p.water("#6ac8e8", "#2a88b0", "#ffffff");
      const cx = Math.round(p.W * 0.58);
      // an island of sweets: a giant layered cake castle, candy-cane and lollipop trees
      const tiers = [[48, "#7a4a2a"], [40, "#ffd6e4"], [32, "#ffffff"], [24, "#ff9ac0"], [16, "#fff2c4"]];
      let y = p.hz;
      tiers.forEach(([hw, c], i) => { p.R(cx - hw, y - 9, hw * 2, 9, c); p.R(cx - hw, y - 9, hw * 2, 2, "#ffffff"); for (let x = cx - hw; x < cx + hw; x += 3) p.R(x, y - 7, 2, 1 + ((x / 3) % 2), "#ffffff"); if (i) p.windows(cx - hw, y - 9, hw * 2, 9, "#c84a8a", 6); y -= 9; });
      for (let i = 0; i < 5; i++) { p.R(cx - 8 + i * 4, y - 6, 1, 6, "#ffffff"); p.R(cx - 8 + i * 4, y - 8, 1, 2, "#ffb030"); }
      for (const tx of [cx - 70, cx - 58, cx + 60, cx + 72]) { p.R(tx, p.hz - 18, 1, 18, "#ffffff"); p.disc(tx, p.hz - 20, 4, ["#ff6a9a", "#6ac8ff", "#ffd36b", "#9a6aff"][Math.abs(tx) % 4]); p.ring(tx, p.hz - 20, 2, "#ffffff"); }
      p.reflect(cx - 40, 80, "#ffd6e4");
    },
    "mary-geoise"(p) {
      p.sky("clear"); p.sun(Math.round(p.W * 0.15), 12, 6, "#ffffff");
      // a white holy city on top of the endless red wall, clouds below its rim
      for (let x = 0; x < p.W; x++) { const t = 30 + Math.round(Math.sin(x / 13) * 2); p.R(x, t, 1, p.H - t, x % 11 < 1 ? "#8e2f22" : "#b8442e"); if (p.r() < 0.25) p.P(x, t + 4 + Math.floor(p.r() * 50), "#9a3626"); }
      const cx = Math.round(p.W * 0.58);
      p.R(cx - 44, 18, 88, 12, "#f6f4ee"); p.windows(cx - 44, 18, 88, 12, "#d8b04a", 4);
      p.R(cx - 20, 6, 40, 12, "#ffffff"); p.dome(cx, 6, 8, "#ffffff", "#d8b04a"); p.dome(cx - 30, 18, 4, "#ffffff", "#d8b04a"); p.dome(cx + 30, 18, 4, "#ffffff", "#d8b04a");
      p.clouds(9, p.H * 0.55, p.H * 0.85, "#ffffff", "#e0ecf8");
      p.water("#2c8ac4", "#10507f");
    },
    "wano"(p) {
      p.sky("day"); p.clouds(5, 6, 26);
      p.ridge(p.hz - 18, 24, "#9ab0c6", { seed: 10, rough: 0.7, snow: "#ffffff" });
      p.ridge(p.hz - 6, 18, "#5f8a6a", { seed: 11, rough: 0.5 });
      p.water("#2c8ac4", "#10507f");
      const cx = Math.round(p.W * 0.58);
      // cliffs with waterfalls, a tiered castle on the highest hill, red gates, cherry blossom
      p.land(cx, p.hz + 1, p.W * 0.62, 30, "#4f8a4a", "#6a6a5a", { rocky: true });
      const top = p.pagoda(cx, p.hz - 28, 4, 24, "#f4efe4", "#2f3b4f", "#d8b04a");
      p.waterfall(cx - 26, p.hz - 24, p.hz + 1, 3); p.waterfall(cx + 24, p.hz - 20, p.hz + 1, 2);
      for (const gx of [cx - 46, cx + 40]) { p.R(gx, p.hz - 14, 2, 14, "#d23a2a"); p.R(gx + 8, p.hz - 14, 2, 14, "#d23a2a"); p.R(gx - 2, p.hz - 15, 14, 2, "#d23a2a"); p.R(gx - 1, p.hz - 12, 12, 1, "#a82a1e"); }
      for (let i = 0; i < 5; i++) p.blossom(Math.round(p.W * 0.08 + i * p.W * 0.18) % p.W, p.hz - 2, 5);
      for (let i = 0; i < 40; i++) p.P(Math.floor(p.r() * p.W), Math.floor(p.r() * p.hz), "#ffd3e4");   // drifting petals
      p.reflect(cx - 30, 60, "#4f8a4a");
    },
    "egghead"(p) {
      p.sky("dusk"); p.stars(20, 20); p.clouds(4, 6, 24, "#d08ab0", "#9a5a8a");
      p.water("#2a4a7a", "#101c3a", "#7af0ff");
      const cx = Math.round(p.W * 0.58);
      // a science island: a huge egg-shaped dome, neon-lit labs, a floating platform
      p.land(cx, p.hz + 1, p.W * 0.7, 10, "#cfd6e2", "#9aa3b4", { flat: 0.7 });
      for (let r = 0; r < 34; r++) { const w = Math.round(22 * Math.sqrt(Math.max(0, 1 - Math.pow((r - 10) / 26, 2)))); p.R(cx - w, p.hz - 8 - r, w * 2, 1, r % 7 === 0 ? "#7af0ff" : (r < 6 ? "#e8eef6" : "#f6f8fc")); }
      p.R(cx - 40, p.hz - 18, 14, 10, "#e8eef6"); p.windows(cx - 40, p.hz - 18, 14, 10, "#7af0ff", 3);
      p.R(cx + 28, p.hz - 22, 16, 14, "#e8eef6"); p.windows(cx + 28, p.hz - 22, 16, 14, "#ff7ad8", 3);
      p.R(cx - 14, 14, 28, 3, "#9aa3b4"); p.R(cx - 10, 17, 20, 1, "#7af0ff");      // floating platform
      p.reflect(cx - 20, 40, "#7af0ff");
    },
    "elbaph"(p) {
      p.sky("day"); p.clouds(4, 30, 50, "#ffffff", "#e0ecf8");
      p.water("#2c7ab4", "#0f4370");
      const cx = Math.round(p.W * 0.55);
      // a land of giants under a world-sized tree whose canopy rises above the clouds
      p.land(cx, p.hz + 1, p.W * 0.9, 18, "#5f9a4a", "#7a6a5a", { rocky: true });
      p.R(cx - 14, 0, 28, p.hz - 10, "#7a5a3a"); p.R(cx + 6, 0, 8, p.hz - 10, "#5f4228");
      for (let y = 4; y < p.hz - 12; y += 7) p.R(cx - 14, y, 28, 1, "#6a4a2e");
      for (let i = 0; i < 12; i++) p.disc(cx - 60 + i * 11, 4 + (i % 3) * 3, 10, i % 2 ? "#2f7a3a" : "#3f9a4a");
      p.clouds(5, 22, 34, "#ffffff", "#dde8f4");
      for (const hx of [cx - 50, cx + 30]) { p.R(hx, p.hz - 22, 22, 8, "#8a6a4a"); for (let i = 0; i < 12; i++) p.R(hx - 1 + i, p.hz - 23 - i / 2, 24 - i * 2, 1, "#5a3a22"); }
      p.reflect(cx - 40, 80, "#5f9a4a");
    },
    "final"(p) {
      p.sky("gold"); p.sun(Math.round(p.W * 0.5), p.hz - 6, 14, "#fff1b0");
      p.water("#5a6aa0", "#202a50", "#ffe08a");
      const cx = Math.round(p.W * 0.62);
      p.land(cx, p.hz + 1, p.W * 0.45, 22, "#ffd36b", "#d49a2a", { beach: "#fff0b8" });
      p.palm(cx - 24, p.hz - 6, 14); p.palm(cx + 22, p.hz - 8, 12);
      for (let i = -5; i <= 5; i++) { p.R(cx + i, p.hz - 14 + i, 2, 2, "#c4553a"); p.R(cx + i, p.hz - 14 - i, 2, 2, "#c4553a"); }
      for (let i = 0; i < 24; i++) p.P(Math.floor(p.r() * p.W), Math.floor(p.r() * p.hz), "#fff6d0");
      p.reflect(cx - 30, 60, "#ffd36b");
    }
  };
  // stops without their own scene use their style
  const BY_STYLE = { village: "foosha-village", town: "orange-town", reverse: "reverse-mountain", cactus: "whisky-peak", desert: "arabasta",
    bigtree: "jaya", city: "water-7", spooky: "thriller-bark", bubble: "sabaody", fishman: "fish-man-island", firefrost: "punk-hazard",
    dressrosa: "dressrosa", cake: "whole-cake-island", wano: "wano", tech: "egghead", navy: "marineford", final: "final", grass: "long-ring-long-land" };

  function keyFor(stop) { return stop.finale ? "final" : String(stop.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  // -> canvas W x H (low resolution; the map scales it up with no smoothing)
  function paint(stop, W, H = 96) {
    const key = keyFor(stop), fn = SCENES[key] || SCENES[BY_STYLE[stop.style]] || SCENES["long-ring-long-land"];
    const p = new Painter(Math.max(64, Math.round(W)), H, hash(key));
    fn(p);
    return p.c;
  }

  window.SceneArt = { paint, has: stop => !!(SCENES[keyFor(stop)] || SCENES[BY_STYLE[stop.style]]), keys: Object.keys(SCENES) };
})();
