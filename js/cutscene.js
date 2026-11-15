// Pirate King cutscenes: full-screen pixel-art close-ups, drawn at 320x180 and scaled up blocky.
//   kind "burst" (second ship): armoured hatches open on a stern rocket, energy spirals in while the
//                               voice clip plays, then flash, freeze, shockwave, a wall of spray and the
//                               ship streaks away: "COUP DE BURST!"
//   kind "gust"  (first ship):  an original crewmate on the stern swells into a giant balloon while the
//                               clip plays, then blows the air out behind in one huge gust: "BIG GUST!"
// Unskippable. The title is always sized to fit the screen.
(function () {
  "use strict";
  const W = 320, H = 180;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  function play({ kind = "burst", ship, chargeMs = 1800, introMs = 450, blastMs: blastOpt = null, onCharge, onBlast, onDone }) {
    const wrap = document.createElement("div");
    wrap.className = "cutscene";
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", kind === "gust" ? "Big Gust: the ship is blown forward" : "Coup de Burst: the ship blasts off");
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    wrap.appendChild(cv); document.body.appendChild(wrap);
    const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
    const R = (px, py, w, h, c) => { x.fillStyle = c; x.fillRect(Math.round(px), Math.round(py), Math.round(w), Math.round(h)); };
    const disc = (cx, cy, r, c) => { r = Math.round(r); for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); R(cx - w, cy + y, w * 2 + 1, 1, c); } };
    const ring = (cx, cy, r, c, th = 1, sy = 0.6) => { for (let a = 0; a < 140; a++) { const ang = a / 140 * 6.283; R(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * sy, th, th, c); } };
    const rnd = (a, b) => a + Math.random() * (b - a);

    const intro = reduceMotion ? 0 : introMs, outro = 380;
    const blastMs = reduceMotion ? 400 : (blastOpt || 1700), hitstop = reduceMotion || kind === "gust" ? 0 : 140;
    const t0 = performance.now(), chargeAt = t0 + intro, blastAt = chargeAt + chargeMs, endAt = blastAt + hitstop + blastMs;
    let charged = false, blasted = false, done = false;
    const seaY = 118, scale = kind === "gust" ? 1.7 : 2.4;   // smaller ship in the gust so the whole balloon fits above it
    const sw = Math.round(ship.width * scale), sh = Math.round(ship.height * scale);
    const day = kind === "gust";
    const clouds = Array.from({ length: 9 }, () => ({ x: rnd(0, W), y: rnd(10, 70), w: rnd(30, 70), v: rnd(4, 12) }));
    const parts = Array.from({ length: 120 }, () => ({ a: rnd(0, 6.283), d: rnd(30, 140), s: rnd(0.5, 1.4), c: Math.random() }));
    const drops = Array.from({ length: 90 }, () => ({ vx: rnd(-120, -10), vy: rnd(-160, -40), r: rnd(1, 2.5) }));
    const lines = Array.from({ length: 60 }, () => ({ y: rnd(0, seaY + 30), x: rnd(0, W), l: rnd(12, 60) }));

    // sky and sea that get more intense as the charge builds (k 0..1)
    function backdrop(now, k, speed) {
      const top = day ? [64, 140, 220] : [24 + 30 * k, 18, 60 + 20 * k], mid = day ? [130, 190, 240] : [180, 70 + 10 * k, 90], bot = day ? [220, 240, 250] : [255, 170 + 40 * (1 - k), 90];
      for (let y = 0; y < seaY; y++) {
        const t = y / seaY, a = t < 0.6 ? top : mid, b = t < 0.6 ? mid : bot, f = t < 0.6 ? t / 0.6 : (t - 0.6) / 0.4;
        for (let xx = 0; xx < W; xx += 4) {
          const th = (B4[(y & 3) * 4 + ((xx >> 2) & 3)] + 0.5) / 16, f2 = Math.max(0, Math.min(1, f + (th - 0.5) * 0.12));
          R(xx, y, 4, 1, `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f2)).join(",")})`);
        }
      }
      const sx = W * 0.78, sy = day ? 34 : seaY - 18;                              // sun with glare
      disc(sx, sy, day ? 14 : 22, day ? "rgba(255,255,220,0.35)" : "rgba(255,220,150,0.35)");
      disc(sx, sy, day ? 9 : 15, day ? "#fffbe0" : "#ffe7a0");
      for (const c of clouds) {                                                       // parallax clouds
        const cx = ((c.x - (now - t0) / 1000 * c.v * speed) % (W + 80) + W + 80) % (W + 80) - 40;
        const col = day ? "#ffffff" : `rgb(${Math.round(250 - 40 * k)},${Math.round(170 - 30 * k)},${Math.round(150 - 20 * k)})`;
        disc(cx, c.y, c.w / 6, col); disc(cx + c.w / 5, c.y - 3, c.w / 5, col); disc(cx + c.w / 2.4, c.y, c.w / 6, col);
        R(cx - c.w / 6, c.y + 2, c.w * 0.75, 2, day ? "#d8e8f6" : "rgba(120,60,80,0.5)");
      }
      for (let y = seaY; y < H; y++) { const t = (y - seaY) / (H - seaY); R(0, y, W, 1, day ? `rgb(${Math.round(30 - 10 * t)},${Math.round(120 - 40 * t)},${Math.round(190 - 50 * t)})` : `rgb(${Math.round(40 - 20 * t)},${Math.round(60 - 30 * t)},${Math.round(110 - 40 * t)})`); }
      const off = (now - t0) / 1000 * 40 * speed;
      for (let i = 0; i < 70; i++) {                                                  // rolling crests
        const y = seaY + 2 + ((i * 13) % (H - seaY - 3)), depth = (y - seaY) / (H - seaY);
        const xx = ((i * 53 - off * (0.4 + depth)) % (W + 40) + W + 40) % (W + 40) - 20;
        R(xx, y, 6 + depth * 10, 1, depth < 0.3 ? "#e8f6ff" : "rgba(200,235,255,0.6)");
      }
      for (let y = seaY + 1; y < H; y += 2) if (Math.random() < 0.7) R(sx - 6 + rnd(-4, 4) * (1 + (y - seaY) / 20), y, rnd(2, 8), 1, day ? "#fffbe0" : "#ffd88a");   // sun glitter
      R(0, seaY, W, 1, day ? "#cfeeff" : "#ffcf9a");
    }

    // an original crewmate (blue bandana, navy-striped shirt, brown shorts). `puff` 0..1 swells him into a
    // big round balloon: shaded sphere, shirt stretched over the top, shorts squeezed at the bottom, tiny
    // head, arms and legs poking out, wobbling as he blows.
    function crewmate(cx, base, puff, exhale, now) {
      if (puff < 0.06) {                                                         // normal size
        R(cx - 4, base - 12, 9, 8, "#2a4d8f"); for (let y = base - 11; y < base - 4; y += 2) R(cx - 4, y, 9, 1, "#f4f0e6");
        R(cx - 3, base - 4, 3, 4, "#6b4a2a"); R(cx + 1, base - 4, 3, 4, "#6b4a2a");
        const hy = base - 18;
        disc(cx, hy, 5, "#f2c9a0"); R(cx - 5, hy - 5, 11, 3, "#2f86d6"); R(cx + 5, hy - 4, 3, 2, "#2f86d6");
        R(cx - 3, hy - 1, 2, 2, "#1a1020"); R(cx + 2, hy - 1, 2, 2, "#1a1020"); R(cx - 2, hy + 3, 4, 1, "#7a2a2a");
        return { mouthX: cx - 7, mouthY: hy + 2 };
      }
      const r = 6 + puff * Math.min(40, Math.max(14, (base - 22) / 2 - 6));
      const wob = exhale ? Math.sin(now / 45) * 0.06 * puff : Math.sin(now / 90) * 0.03;
      const rx = r * (1 + wob), ry = r * (1 - wob);
      const cy = base - ry;
      // the sphere, pixel by pixel: skin, shading, shirt band on top, shorts at the bottom
      for (let yy = -Math.ceil(ry); yy <= Math.ceil(ry); yy++) {
        for (let xx = -Math.ceil(rx); xx <= Math.ceil(rx); xx++) {
          const u = xx / rx, v = yy / ry, d = u * u + v * v;
          if (d > 1) continue;
          const px = cx + xx, py = cy + yy;
          if (d > 0.9) { R(px, py, 1, 1, "#3a2416"); continue; }                // outline
          const light = -u * 0.5 - v * 0.6 + (1 - d) * 0.5;                     // lit from the top-left
          let col;
          if (v < -0.45) {                                                        // stretched shirt over the top
            const stripe = Math.floor((v + 1) * ry / 2.2) % 2 === 0;
            col = stripe ? (light > 0.2 ? "#3a64b0" : "#2a4d8f") : (light > 0.2 ? "#ffffff" : "#e8e2d4");
          } else if (v > 0.78) {                                                  // shorts squeezed at the bottom
            col = light > 0 ? "#7a5632" : "#5f4026";
          } else {                                                                // skin
            const th = (B4[((py & 3) * 4) + (px & 3)] + 0.5) / 16;
            col = light > 0.45 ? "#ffe2c4" : light > (0.05 + th * 0.12) ? "#f2c9a0" : light > -0.35 ? "#d9a87c" : "#b8835a";
          }
          R(px, py, 1, 1, col);
        }
      }
      for (let i = 0; i < 4; i++) {                                              // stretch lines on the belly
        const lx = cx - rx * 0.3 + i * rx * 0.22, ly = cy + ry * (0.05 + (i % 2) * 0.18);
        R(lx, ly, Math.max(2, rx * 0.12), 1, "#c99470");
      }
      disc(cx - rx * 0.38, cy - ry * 0.2, Math.max(1, r * 0.12), "#fff2e0");      // shine
      // little legs under, little arms out the sides at the top
      R(cx - rx * 0.3, base - 1, 3, 3, "#f2c9a0"); R(cx + rx * 0.2, base - 1, 3, 3, "#f2c9a0");
      const ay = cy - ry * 0.7;
      R(cx - rx * 0.85 - 6, ay - 2, 7, 3, "#f2c9a0"); R(cx + rx * 0.85, ay - 2, 7, 3, "#f2c9a0");
      // tiny head on top, bandana, eyes squeezed with effort
      const hx = cx - rx * 0.15, hy = cy - ry - 3;
      disc(hx, hy, 5, "#f2c9a0"); R(hx - 5, hy - 5, 11, 3, "#2f86d6"); R(hx + 5, hy - 4, 3, 2, "#2f86d6");
      R(hx - 3, hy - 1, 2, 1, "#1a1020"); R(hx + 2, hy - 1, 2, 1, "#1a1020");
      if (exhale) { disc(hx - 6, hy + 2, 2, "#1a1020"); }                            // mouth open, blowing back
      else { disc(hx - 3, hy + 2, 2, "#f6c8a0"); disc(hx + 3, hy + 2, 2, "#f6c8a0"); R(hx - 1, hy + 3, 2, 1, "#7a2a2a"); }   // cheeks puffed
      return { mouthX: hx - 8, mouthY: hy + 2 };
    }

    // big title that always fits: shrink until it fits 90% of the width
    function title(text, k, colors, ty = 36) {
      let size = 30;
      const font = s => `${Math.round(s)}px "Press Start 2P", "Courier New", monospace`;
      x.font = font(size);
      while (x.measureText(text).width > W * 0.9 && size > 8) { size -= 1; x.font = font(size); }
      x.font = font(size * (1 + (1 - k) * 0.5));
      if (x.measureText(text).width > W * 0.96) x.font = font(size);
      x.textAlign = "center"; x.textBaseline = "middle";
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2], [3, 4]]) { x.fillStyle = "#140c18"; x.fillText(text, W / 2 + dx, ty + dy); }
      const g = x.createLinearGradient(0, ty - size / 2, 0, ty + size / 2);
      g.addColorStop(0, colors[0]); g.addColorStop(0.55, colors[1]); g.addColorStop(1, colors[2]);
      x.fillStyle = g; x.fillText(text, W / 2, ty);
      x.textAlign = "left"; x.textBaseline = "alphabetic";
    }

    function frame(now) {
      if (done) return;
      const ck = Math.max(0, Math.min(1, (now - chargeAt) / chargeMs));
      const inHit = now >= blastAt && now < blastAt + hitstop;
      const flying = now >= blastAt + hitstop;
      const bt = Math.max(0, now - blastAt - hitstop), bk = Math.min(1, bt / blastMs);
      const shakeAmp = now < blastAt ? (now > chargeAt ? ck * 3 : 0) : (inHit ? 0 : Math.max(0, 5 * (1 - bk * 1.4)));
      x.save(); x.translate(Math.round(rnd(-1, 1) * shakeAmp), Math.round(rnd(-1, 1) * shakeAmp * 0.6));
      backdrop(now, kind === "burst" ? ck : 0, flying ? 6 : 1);

      const base = Math.max(W * 0.48, sw / 2 + 50);
      let sx = base, lift = 0;
      if (flying) {
        if (kind === "burst") { sx = base + Math.pow(bk, 1.8) * (W + sw); lift = Math.sin(Math.min(1, bk * 1.2) * Math.PI / 2) * 40; }
        else { sx = base + Math.pow(bk, 1.5) * (W - base + sw / 2 + 10); lift = Math.sin(bk * Math.PI) * 4; }   // leaves the screen just as the clip ends
      }
      const bob = now < blastAt ? Math.sin(now / 300) * 1.5 : 0;
      const shipX = sx - sw / 2, shipY = seaY - sh + 10 - lift + bob;
      const sternX = shipX + sw * 0.08, sternY = shipY + sh * 0.62;

      if (kind === "burst") {
        const open = Math.min(1, ck * 4), nx = sternX - 30, ny = sternY - 10;
        if (flying) {
          for (const l of lines) R(((l.x - bt * 1.4) % W + W) % W, l.y, l.l, 1, "rgba(255,255,255,0.8)");
          for (let i = 0; i < 40; i++) R(shipX - i * 7 - rnd(0, 4), sternY - 4 + rnd(-6, 6) * (i / 40 + 0.3), 8, 3, i % 3 ? "rgba(255,255,255,0.75)" : "#ffd36b");
          const lx = base - sw / 2 - 30;
          ring(lx, seaY - 6, 10 + bk * 220, "#ffffff", 2); ring(lx, seaY - 6, 6 + bk * 160, "rgba(190,240,255,0.9)", 2); ring(lx, seaY - 6, 4 + bk * 100, "rgba(255,255,255,0.6)", 1);
          const wallH = Math.sin(Math.min(1, bk * 1.6) * Math.PI) * 90;
          for (let i = 0; i < 26; i++) R(lx - 40 + i * 4, seaY - wallH * (0.5 + 0.5 * Math.sin(i * 1.7)), 4, wallH, i % 2 ? "rgba(235,248,255,0.9)" : "rgba(190,230,250,0.85)");
          for (const d of drops) { const tt = bt / 1000; R(lx + d.vx * tt, seaY - 10 + d.vy * tt + 160 * tt * tt, d.r, d.r, "#e8f6ff"); }
          for (let i = 3; i >= 1; i--) { x.globalAlpha = 0.18 * (4 - i); x.drawImage(ship, Math.round(shipX - i * 14), Math.round(shipY + i * 3), sw, sh); }
          x.globalAlpha = 1;
        }
        x.drawImage(ship, Math.round(shipX), Math.round(shipY), sw, sh);
        R(nx, ny, 32, 20, "#b98a2a"); R(nx, ny, 32, 3, "#f1c04a"); R(nx, ny + 17, 32, 3, "#6a4a14"); for (let i = 2; i < 32; i += 6) R(nx + i, ny + 9, 1, 1, "#ffe08a");
        R(nx + 28, ny + 4, 8, 12, "#5f6873"); R(nx - 4, ny - 2, 6, 24, "#8a6a1c");
        R(nx - 6, ny - 2 - open * 10, 6, 12, "#4a4a56"); R(nx - 6, ny + 12 + open * 10, 6, 12, "#4a4a56");
        if (now >= chargeAt && now < blastAt) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 60), core = 4 + ck * 16 + pulse * 3;
          disc(nx - 4, ny + 10, core + 6, "rgba(120,240,255,0.25)");
          disc(nx - 4, ny + 10, core, ck > 0.7 ? "#ffffff" : "#bff8ff"); disc(nx - 4, ny + 10, core * 0.55, "#7af0ff");
          for (const p of parts) {
            const ph = ((now - chargeAt) / 1100 * p.s) % 1, d = p.d * (1 - ph), a = p.a + ph * 3;
            R(nx - 4 + Math.cos(a) * d, ny + 10 + Math.sin(a) * d * 0.55, 2, 1, p.c > 0.5 ? "#7af0ff" : "#ffffff");
          }
          if (Math.random() < 0.5 + ck * 0.4) {
            let ax = nx - 4, ay = ny + 10; const ang = rnd(0, 6.283);
            for (let i = 0; i < 9; i++) { ax += Math.cos(ang) * 4 + rnd(-3, 3); ay += Math.sin(ang) * 3 + rnd(-3, 3); R(ax, ay, 1, 1, "#e8ffff"); }
          }
          ring(nx - 4, seaY + 2, 8 + ck * 50, "rgba(255,255,255,0.5)", 1, 0.25);
          R(W / 2 - 60, H - 24, 120, 6, "#140c18"); R(W / 2 - 59, H - 23, 118 * ck, 4, ck > 0.85 ? "#ffffff" : "#7af0ff");
        }
        if (flying) title("COUP DE BURST!", Math.min(1, bt / 180), ["#fff6c0", "#ffc83a", "#e2621e"]);
      } else {
        // inhale: swell to full size during the charge; exhale: deflate over the whole blast while blowing
        const puff = now < blastAt ? Math.min(1, ck * 1.15) : Math.max(0, 1 - Math.pow(bk, 1.1));   // deflates evenly across the clip
        const exhale = flying && bk < 0.97;
        if (exhale) for (const l of lines) R(((l.x - bt * 0.5) % W + W) % W, l.y, l.l * 0.7, 1, "rgba(255,255,255,0.7)");
        x.drawImage(ship, Math.round(shipX), Math.round(shipY), sw, sh);
        const m = crewmate(Math.round(sternX + 16), Math.round(shipY + sh * 0.5), puff, exhale, now);
        if (exhale) {                                                // the gust: a jet of air out behind the ship
          const power = Math.max(0.3, puff);
          for (let i = 0; i < 70 * power; i++) { const t = Math.random(), len = 20 + t * 220, spread = t * 40 * power; R(m.mouthX - len, m.mouthY + rnd(-spread, spread) + t * 10, rnd(6, 18), 1, i % 4 ? "rgba(255,255,255,0.85)" : "#cfeeff"); }
          R(m.mouthX - 26, m.mouthY - 1, 26, 3, "rgba(255,255,255,0.9)");
          ring(m.mouthX - 30 - (bt % 600) * 0.3, m.mouthY + 4, 8 + (bt % 600) * 0.05, "rgba(255,255,255,0.7)", 2, 1);
          for (let i = 0; i < 24 * power; i++) R(m.mouthX - rnd(20, 180), seaY - rnd(0, 14), 3, rnd(3, 10), "#e8f6ff");
        }
        if (now >= chargeAt && now < blastAt && chargeMs > 400) { R(W / 2 - 60, H - 24, 120, 6, "#140c18"); R(W / 2 - 59, H - 23, 118 * ck, 4, "#ffd36b"); }
        if (flying) title("BIG GUST!", Math.min(1, bt / 180), ["#ffffff", "#9fe6ff", "#2f86d6"], H - 34);
      }
      x.restore();
      if (inHit) R(0, 0, W, H, "rgba(255,255,255,0.92)");
      else if (flying && bt < 120) R(0, 0, W, H, `rgba(255,255,255,${0.7 * (1 - bt / 120)})`);
      const bar = Math.round(Math.min(1, (now - t0) / 300) * 16);
      R(0, 0, W, bar, "#000"); R(0, H - bar, W, bar, "#000");
      if (now > endAt) wrap.style.opacity = String(Math.max(0, 1 - (now - endAt) / outro));
      if (!charged && now >= chargeAt) { charged = true; onCharge && onCharge(); }
      if (!blasted && flying) { blasted = true; onBlast && onBlast(); }
      if (now >= endAt + outro) { done = true; wrap.remove(); onDone && onDone(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  window.Cutscene = { play };
})();
