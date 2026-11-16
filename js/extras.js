// Modes with no score to chase: Blind Ranking, the Tier List maker and Build a Fighter (with 1v1s).
// They open as a full-screen panel over the port. Data comes from window.OnePieces (set up by app.js).
(function () {
  "use strict";
  const OP = () => window.OnePieces || {};
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (a, r = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem("onepieces-x:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("onepieces-x:" + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  const sound = n => { try { const s = OP().sound; if (s && s[n]) s[n](); } catch (e) { /* no sound */ } };
  const initials = name => String(name || "?").split(/\s+/).filter(w => /^[A-Za-z]/.test(w) && w.length > 1).slice(-2).map(w => w[0]).join("") || "?";
  const pic = (item, cls = "") => `<span class="xpic ${cls}">${item && item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy">` : ""}<i>${esc(initials(item && item.name))}</i></span>`;
  const byFame = (a, b) => (b.fame || 0) - (a.fame || 0);
  // a picture that fails to load is removed, leaving the initials under it (no inline handlers: the page's CSP)
  document.addEventListener("error", e => { const t = e.target; if (t && t.tagName === "IMG" && t.closest && t.closest(".xpic")) t.remove(); }, true);

  // ---------------- what you can rank ----------------
  function charItems(filter, limit) {
    const o = OP();
    return (o.chars || []).filter(c => c.image && o.seenBy(c) && filter(c)).sort(byFame).slice(0, limit)
      .map(c => ({ id: c.id, name: c.name, image: c.image, sub: c.epithet ? `“${c.epithet}”` : (c.primary_group || "") }));
  }
  function thingItems(kind, limit) {
    const o = OP();
    return ((o.things || {})[kind] || []).filter(t => o.seenBy(t)).sort(byFame).slice(0, limit)
      .map(t => ({ id: `${kind}:${t.id}`, name: t.name, image: t.image || "", sub: t.fruit_type || t.subtype || t.affiliation || "" }));
  }
  function arcItems() {
    const ep = OP().spoilerEp;
    return (window.ROUTE_STOPS || []).filter(s => !s.finale && (!ep || !s.first_ep || s.first_ep <= ep))
      .map(s => ({ id: `arc:${s.name}`, name: s.arc || s.name, image: s.scene || "", sub: s.first_ep ? `Episodes ${s.first_ep}–${s.last_ep}` : "" }));
  }
  const has = (c, k, v) => (c[k] || []).includes(v);
  const CATS = [
    { id: "famous",   name: "Characters",        get: () => charItems(c => c.difficulty === "easy", 200) },
    { id: "side",     name: "Side characters",   get: () => charItems(c => c.difficulty === "medium", 300) },
    { id: "strawhat", name: "Straw Hats",        get: () => charItems(c => has(c, "organizations", "Straw Hat Pirates") && c.crew_role && !has(c, "tags", "flashback_only"), 10) },
    { id: "villains", name: "Luffy's opponents", get: () => charItems(c => has(c, "tags", "defeated_by_luffy") || has(c, "tags", "fought_luffy"), 60) },
    { id: "fruits",   name: "Devil Fruits",      get: () => thingItems("fruit", 80) },
    { id: "weapons",  name: "Swords & weapons",  get: () => thingItems("weapon", 60) },
    { id: "ships",    name: "Ships",             get: () => thingItems("ship", 60) },
    { id: "crews",    name: "Crews",             get: () => thingItems("crew", 60) },
    { id: "places",   name: "Islands & places",  get: () => thingItems("place", 80) },
    { id: "arcs",     name: "Story arcs",        get: arcItems }
  ];
  const catById = id => CATS.find(c => c.id === id) || CATS[0];

  // ---------------- the panel ----------------
  let panel = null;
  function openPanel(kicker, title) {
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "xm"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-labelledby", "xmTitle");
      panel.innerHTML = `<div class="xm-panel"><header class="xm-head"><div><p class="xm-kicker" id="xmKicker"></p><h2 class="xm-title" id="xmTitle"></h2></div>
        <button type="button" class="btn btn-mini xm-close">Port</button></header><div class="xm-body" id="xmBody"></div></div>`;
      document.body.appendChild(panel);
      panel.querySelector(".xm-close").addEventListener("click", close);
      document.addEventListener("keydown", e => { if (e.key === "Escape" && panel && !panel.hidden) close(); });
    }
    panel.hidden = false;
    document.body.classList.add("xm-open");
    panel.querySelector("#xmKicker").textContent = kicker;
    panel.querySelector("#xmTitle").textContent = title;
    return panel.querySelector("#xmBody");
  }
  function close() { if (panel) panel.hidden = true; document.body.classList.remove("xm-open"); sound("click"); }
  function setHead(kicker, title) { panel.querySelector("#xmKicker").textContent = kicker; panel.querySelector("#xmTitle").textContent = title; }
  const top = () => { const p = panel && panel.querySelector(".xm-panel"); if (p) p.scrollTop = 0; };

  async function shareText(text, btn) {
    try {
      if (navigator.share && /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      if (btn) { const t = btn.textContent; btn.textContent = "Copied!"; setTimeout(() => { btn.textContent = t; }, 1400); }
    } catch (e) {
      if (btn) { const box = document.createElement("textarea"); box.className = "xm-copy"; box.value = text; box.readOnly = true; btn.after(box); box.select(); }
    }
  }
  function catPicker(sel) {
    return `<div class="xm-cats">${CATS.map(c => `<button type="button" class="xm-chip" data-cat="${c.id}" aria-pressed="${c.id === sel}">${esc(c.name)}</button>`).join("")}</div>`;
  }
  function wireChips(body, attr, onPick) {
    body.querySelectorAll(`[data-${attr}]`).forEach(b => b.addEventListener("click", () => {
      sound("click");
      body.querySelectorAll(`[data-${attr}]`).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      onPick(b.dataset[attr]);
    }));
  }

  // ================= BLIND RANKING =================
  // One item at a time; you lock each into a slot without knowing what comes next. Nothing to win.
  let BR = null;
  function blindSetup() {
    const body = openPanel("BLIND RANKING", "Rank them blind");
    let cat = store.get("blindCat", "famous"), n = store.get("blindN", 10);
    body.innerHTML = `<p class="xm-note">Things show up one at a time. Put each one in a spot for good, before you see what's next. No winning, no losing: just your call.</p>
      <h3 class="xm-h">What to rank</h3>${catPicker(cat)}
      <h3 class="xm-h">How many spots</h3><div class="xm-cats"><button type="button" class="xm-chip" data-n="5" aria-pressed="${n === 5}">Top 5</button><button type="button" class="xm-chip" data-n="10" aria-pressed="${n === 10}">Top 10</button></div>
      <button type="button" class="btn btn-straw xm-go">Start ranking</button>`;
    wireChips(body, "cat", v => { cat = v; });
    wireChips(body, "n", v => { n = +v; });
    body.querySelector(".xm-go").addEventListener("click", () => { store.set("blindCat", cat); store.set("blindN", n); blindStart(cat, n); });
  }
  function blindStart(cat, n) {
    sound("click");
    const items = shuffle(catById(cat).get());
    if (items.length < n) n = Math.max(1, items.length);
    BR = { cat, n, deck: items.slice(0, n), i: 0, slots: Array(n).fill(null) };
    blindRender();
  }
  function blindRender() {
    const body = panel.querySelector("#xmBody"), c = catById(BR.cat), done = BR.i >= BR.n, cur = BR.deck[BR.i];
    setHead("BLIND RANKING", c.name);
    body.innerHTML = `${done ? `<p class="xm-done">Your blind top ${BR.n}. No take-backs.</p>` : `
      <div class="xm-now"><span class="xm-count">${BR.i + 1} of ${BR.n}</span>${pic(cur, "xbig")}<span class="xm-now-name">${esc(cur.name)}</span>${cur.sub ? `<span class="xm-now-sub">${esc(cur.sub)}</span>` : ""}
      <span class="xm-now-ask">Where does it go?</span></div>`}
      <ol class="xm-slots">${BR.slots.map((s, k) => `<li><span class="xm-rank">${k + 1}</span>${s
        ? `${pic(s, "xmini")}<span class="xm-slot-name">${esc(s.name)}</span>`
        : done ? `<span class="xm-slot-empty">—</span>` : `<button type="button" class="xm-put" data-k="${k}">Put it here</button>`}</li>`).join("")}</ol>
      <div class="xm-actions">${done ? `<button type="button" class="btn btn-straw" data-a="again">Rank again</button><button type="button" class="btn" data-a="share">Share list</button>` : ""}
        <button type="button" class="btn btn-ghost" data-a="reset">${done ? "Change category" : "Reset"}</button></div>`;
    body.querySelectorAll(".xm-put").forEach(b => b.addEventListener("click", () => {
      BR.slots[+b.dataset.k] = cur; BR.i++; sound("stamp"); blindRender();
    }));
    const act = a => body.querySelector(`[data-a="${a}"]`);
    act("reset").addEventListener("click", () => { sound("click"); if (done) blindSetup(); else blindStart(BR.cat, BR.n); });
    if (done) {
      act("again").addEventListener("click", () => blindStart(BR.cat, BR.n));
      act("share").addEventListener("click", e => shareText(`One Pieces · blind ranking (${c.name})\n` + BR.slots.map((s, k) => `${k + 1}. ${s ? s.name : "—"}`).join("\n") + `\n${location.origin}${location.pathname}`, e.currentTarget));
    }
    top();
  }

  // ================= TIER LIST =================
  const TIERS = [["S", "#ff5a46"], ["A", "#ff9a3c"], ["B", "#f1c04a"], ["C", "#9be35a"], ["D", "#6fe3ff"], ["F", "#a98bff"]];
  let TL = null, tlSel = null;
  function tierSetup() {
    const body = openPanel("TIER LIST", "Make a tier list");
    const saved = store.get("tier", null);
    let cat = store.get("tierCat", "famous"), count = store.get("tierCount", 24), pickBy = store.get("tierPick", "famous");
    body.innerHTML = `${saved && saved.items && saved.items.length ? `<button type="button" class="btn btn-straw xm-go" data-a="resume">Keep editing: ${esc(saved.title)}</button>` : ""}
      <h3 class="xm-h">What to rank</h3>${catPicker(cat)}
      <h3 class="xm-h">How many</h3><div class="xm-cats">${[12, 24, 36].map(v => `<button type="button" class="xm-chip" data-count="${v}" aria-pressed="${v === count}">${v}</button>`).join("")}</div>
      <h3 class="xm-h">Which ones</h3><div class="xm-cats"><button type="button" class="xm-chip" data-pick="famous" aria-pressed="${pickBy === "famous"}">The most famous</button><button type="button" class="xm-chip" data-pick="random" aria-pressed="${pickBy === "random"}">A random mix</button></div>
      <button type="button" class="btn ${saved ? "" : "btn-straw"} xm-go" data-a="new">New tier list</button>`;
    wireChips(body, "cat", v => { cat = v; });
    wireChips(body, "count", v => { count = +v; });
    wireChips(body, "pick", v => { pickBy = v; });
    body.querySelector('[data-a="new"]').addEventListener("click", () => {
      store.set("tierCat", cat); store.set("tierCount", count); store.set("tierPick", pickBy);
      const all = catById(cat).get(), items = (pickBy === "random" ? shuffle(all) : all).slice(0, count);
      TL = { title: `${catById(cat).name} tier list`, items, place: {} };
      sound("click"); tierRender();
    });
    const r = body.querySelector('[data-a="resume"]');
    if (r) r.addEventListener("click", () => { TL = saved; sound("click"); tierRender(); });
  }
  const tierSave = () => store.set("tier", TL);
  function tierRender() {
    const body = panel.querySelector("#xmBody");
    setHead("TIER LIST", TL.title);
    const tile = it => `<button type="button" class="xm-tile${tlSel === it.id ? " sel" : ""}" data-id="${esc(it.id)}" draggable="true" title="${esc(it.name)}">${pic(it, "xtile")}<span>${esc(it.name)}</span></button>`;
    const inRow = t => TL.items.filter(it => (TL.place[it.id] || "") === t);
    body.innerHTML = `<label class="xm-titlein"><span class="sr-only">List title</span><input type="text" maxlength="60" value="${esc(TL.title)}"></label>
      <p class="xm-note">${tlSel ? "Now tap a row to put it there (or the tray to take it back)." : "Tap a picture, then tap a row. On a computer you can drag too."}</p>
      <div class="xm-tiers">${TIERS.map(([t, col]) => `<div class="xm-row" data-row="${t}"><span class="xm-tier" style="--tc:${col}">${t}</span><div class="xm-drop">${inRow(t).map(tile).join("")}</div></div>`).join("")}</div>
      <div class="xm-tray" data-row=""><span class="xm-tray-label">Unranked · ${inRow("").length}</span><div class="xm-drop">${inRow("").map(tile).join("")}</div></div>
      <div class="xm-actions"><button type="button" class="btn btn-straw" data-a="png">Save picture</button><button type="button" class="btn" data-a="reset">Reset</button><button type="button" class="btn btn-ghost" data-a="new">New list</button></div>`;
    body.querySelector(".xm-titlein input").addEventListener("input", e => { TL.title = e.target.value || "My tier list"; setHead("TIER LIST", TL.title); tierSave(); });
    body.querySelectorAll(".xm-tile").forEach(b => {
      b.addEventListener("click", e => { e.stopPropagation(); sound("click"); tlSel = tlSel === b.dataset.id ? null : b.dataset.id; tierRender(); });
      b.addEventListener("dragstart", e => { tlSel = b.dataset.id; e.dataTransfer.setData("text/plain", b.dataset.id); e.dataTransfer.effectAllowed = "move"; });
    });
    body.querySelectorAll("[data-row]").forEach(row => {
      row.addEventListener("click", () => { if (!tlSel) return; tierMove(tlSel, row.dataset.row); });
      row.addEventListener("dragover", e => { e.preventDefault(); row.classList.add("over"); });
      row.addEventListener("dragleave", () => row.classList.remove("over"));
      row.addEventListener("drop", e => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || tlSel; if (id) tierMove(id, row.dataset.row); });
    });
    const act = a => body.querySelector(`[data-a="${a}"]`);
    act("reset").addEventListener("click", () => { TL.place = {}; tlSel = null; tierSave(); sound("click"); tierRender(); });
    act("new").addEventListener("click", () => { tlSel = null; tierSetup(); });
    act("png").addEventListener("click", tierPicture);
  }
  function tierMove(id, row) {
    if (row) TL.place[id] = row; else delete TL.place[id];
    tlSel = null; tierSave(); sound("stamp"); tierRender();
  }
  // the whole list as one picture (same-origin images, so the canvas can be saved)
  async function tierPicture() {
    const T = 92, G = 6, LW = 96, W = 1000, PER = Math.floor((W - LW - G) / (T + G));
    const rows = TIERS.map(([t, col]) => ({ t, col, items: TL.items.filter(it => TL.place[it.id] === t) }));
    const heights = rows.map(r => Math.max(1, Math.ceil(r.items.length / PER)) * (T + G) + G);
    const H = 70 + heights.reduce((a, b) => a + b, 0) + 30;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    x.fillStyle = "#0c1230"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#f4ecd8"; x.font = '24px "Press Start 2P", monospace'; x.textBaseline = "middle"; x.fillText(TL.title.slice(0, 40), 16, 36);
    const load = src => new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    let y = 70;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r], h = heights[r];
      x.fillStyle = row.col; x.fillRect(0, y, LW, h - G);
      x.fillStyle = "#1a1205"; x.font = '40px "Press Start 2P", monospace'; x.textAlign = "center"; x.fillText(row.t, LW / 2, y + (h - G) / 2); x.textAlign = "left";
      x.fillStyle = "#10183d"; x.fillRect(LW, y, W - LW, h - G);
      for (let i = 0; i < row.items.length; i++) {
        const it = row.items[i], tx = LW + G + (i % PER) * (T + G), ty = y + G + Math.floor(i / PER) * (T + G);
        const im = await load(it.image);
        x.fillStyle = "#172255"; x.fillRect(tx, ty, T, T);
        if (im) { const s = Math.max(T / im.width, T / im.height), w = im.width * s, hh = im.height * s; x.save(); x.beginPath(); x.rect(tx, ty, T, T); x.clip(); x.drawImage(im, tx + (T - w) / 2, ty + (T - hh) / 2, w, hh); x.restore(); }
        x.fillStyle = "rgba(5,8,24,0.78)"; x.fillRect(tx, ty + T - 20, T, 20);
        x.fillStyle = "#f4ecd8"; x.font = "15px VT323, monospace"; x.fillText(it.name.length > 13 ? it.name.slice(0, 12) + "…" : it.name, tx + 4, ty + T - 10);
      }
      y += h;
    }
    x.fillStyle = "#a9b1d6"; x.font = "18px VT323, monospace"; x.fillText("made with One Pieces · onepieces.lol", 16, H - 15);
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png"); a.download = (TL.title || "tier-list").replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() + ".png";
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ================= BUILD A FIGHTER =================
  const STATS = [
    { id: "body", name: "Body", w: 0.9 }, { id: "iq", name: "IQ", w: 0.7 }, { id: "biq", name: "Battle IQ", w: 1.0 },
    { id: "hax", name: "Hax", w: 1.1 }, { id: "df", name: "Devil Fruit", w: 1.0 }, { id: "weapon", name: "Weapon", w: 0.9 },
    { id: "haki", name: "Haki", w: 1.2 }, { id: "speed", name: "Speed", w: 1.1 }, { id: "durability", name: "Durability", w: 1.2 }, { id: "strength", name: "Strength", w: 1.2 }
  ];
  // Hand-set ratings (0-10) for the big names, in STATS order: body, iq, biq, hax, df, weapon, haki, speed, durability, strength.
  // Everyone else gets ratings from their bounty, Haki, fruit and traits (see rate()). Fan estimates, not canon.
  const RATED = {
    "monkey-d-luffy": [8, 4, 9, 9, 10, 1, 10, 9, 10, 10], "roronoa-zoro": [8, 3, 9, 4, 0, 10, 9, 8, 9, 9], "sanji": [8, 6, 8, 5, 0, 1, 8, 9, 8, 8],
    "nami": [3, 8, 6, 6, 0, 6, 2, 4, 3, 2], "usopp": [3, 7, 7, 4, 0, 7, 4, 4, 4, 2], "tony-tony-chopper": [5, 9, 6, 5, 7, 2, 1, 5, 6, 6],
    "nico-robin": [4, 10, 8, 7, 8, 1, 5, 5, 4, 5], "franky": [7, 9, 7, 4, 0, 8, 2, 4, 8, 7], "brook": [4, 6, 8, 6, 7, 8, 5, 8, 5, 4], "jinbe": [9, 7, 9, 4, 0, 1, 8, 6, 9, 9],
    "shanks": [8, 8, 10, 8, 0, 10, 10, 9, 9, 9], "edward-newgate": [10, 7, 10, 9, 10, 9, 10, 7, 10, 10], "kaidou": [10, 5, 9, 6, 9, 8, 10, 8, 10, 10],
    "charlotte-linlin": [10, 4, 8, 9, 9, 6, 9, 6, 10, 10], "marshall-d-teach": [9, 8, 8, 10, 10, 4, 8, 6, 8, 9], "dracule-mihawk": [7, 7, 10, 3, 0, 10, 9, 8, 8, 9],
    "gol-d-roger": [8, 6, 10, 9, 0, 10, 10, 9, 9, 10], "monkey-d-garp": [9, 5, 9, 4, 0, 1, 10, 8, 9, 10], "sakazuki": [8, 6, 8, 9, 10, 1, 9, 8, 9, 9],
    "borsalino": [7, 6, 8, 9, 10, 7, 8, 10, 8, 8], "kuzan": [8, 7, 8, 9, 9, 1, 8, 8, 8, 8], "issho": [7, 6, 9, 9, 9, 8, 8, 6, 8, 8], "sengoku": [9, 9, 9, 7, 9, 1, 9, 7, 9, 9],
    "trafalgar-d-water-law": [6, 9, 9, 10, 10, 8, 8, 7, 6, 6], "eustass-kid": [8, 4, 7, 8, 9, 6, 8, 7, 8, 9], "boa-hancock": [6, 6, 8, 9, 9, 1, 9, 8, 7, 8],
    "donquixote-doflamingo": [8, 9, 9, 9, 9, 1, 9, 8, 8, 8], "crocodile": [7, 8, 8, 8, 9, 6, 7, 7, 7, 7], "rob-lucci": [8, 7, 8, 6, 8, 1, 7, 9, 8, 8],
    "charlotte-katakuri": [9, 8, 10, 9, 9, 8, 10, 8, 9, 9], "portgas-d-ace": [7, 5, 8, 8, 9, 1, 8, 8, 7, 8], "enel": [6, 6, 6, 10, 10, 5, 6, 10, 7, 7],
    "vegapunk": [3, 10, 4, 7, 9, 6, 1, 3, 3, 2], "sabo": [7, 7, 9, 8, 9, 6, 8, 8, 7, 8], "yamato": [9, 6, 8, 7, 9, 8, 9, 8, 9, 9], "king": [9, 7, 8, 6, 9, 8, 8, 8, 10, 9],
    "silvers-rayleigh": [7, 8, 10, 5, 0, 9, 10, 9, 8, 9], "smoker": [7, 6, 7, 7, 8, 7, 7, 6, 7, 7], "kouzuki-oden": [8, 6, 9, 4, 0, 10, 10, 8, 9, 10],
    "bartholomew-kuma": [10, 8, 7, 10, 10, 1, 7, 10, 9, 9], "gecko-moria": [9, 7, 6, 9, 9, 4, 6, 4, 7, 8], "buggy": [4, 5, 4, 7, 8, 4, 2, 3, 5, 3],
    "arlong": [7, 4, 6, 2, 0, 7, 1, 6, 7, 7], "koby": [5, 6, 7, 4, 0, 1, 7, 8, 6, 6], "nefertari-vivi": [3, 7, 4, 2, 0, 3, 1, 4, 3, 2],
    "monkey-d-dragon": [9, 9, 10, 9, 9, 1, 9, 9, 9, 9], "shiryu": [7, 6, 8, 9, 9, 9, 7, 8, 7, 8], "jesus-burgess": [9, 3, 6, 3, 7, 1, 6, 6, 8, 9],
    "caesar-clown": [5, 9, 5, 8, 9, 4, 2, 5, 6, 4], "charlotte-cracker": [7, 6, 7, 8, 9, 8, 7, 6, 8, 7], "killer": [7, 6, 8, 3, 0, 8, 7, 8, 7, 7],
    "x-drake": [8, 7, 7, 5, 8, 7, 7, 6, 8, 8], "basil-hawkins": [6, 7, 7, 9, 9, 6, 6, 6, 6, 6], "capone-bege": [6, 8, 7, 8, 8, 6, 5, 5, 7, 6],
    "jewelry-bonney": [5, 5, 6, 10, 10, 1, 4, 6, 6, 6], "benn-beckman": [8, 10, 10, 3, 0, 8, 10, 8, 8, 9], "aramaki": [8, 6, 7, 9, 10, 1, 8, 8, 8, 8],
    "emporio-ivankov": [7, 7, 7, 9, 9, 1, 6, 6, 7, 7], "magellan": [9, 6, 7, 9, 10, 1, 6, 5, 9, 8]
  };
  const clamp = v => Math.max(0, Math.min(10, Math.round(v)));
  const T = (c, ...t) => t.some(x => (c.tags || []).includes(x));
  function rate(c, stat) {
    const r = RATED[c.id];
    if (r) return r[STATS.findIndex(s => s.id === stat)];
    const b = c.bounty_peak || 0, haki = (c.haki || []).length, conq = (c.haki || []).includes("Conqueror's");
    let base = b > 0 ? 2 + (Math.log10(b) - 6) * 1.6 : 1 + Math.max(0, (c.fame || 0) - 50) / 12;
    base = Math.max(1, Math.min(8, base + haki * 0.4 + (conq ? 1 : 0)));
    const types = c.devil_fruit_types || [], fruit = (c.devil_fruits || []).length > 0;
    const fruitScore = !fruit ? 0 : types.includes("Logia") ? 7 : types.includes("Mythical Zoan") ? 7 : types.includes("Ancient Zoan") ? 5 : types.includes("Paramecia") ? 5 : 4;
    const big = T(c, "very_tall", "muscular") || /Giant/.test(String(c.race || ""));
    const armed = (c.weapons || []).length || T(c, "named_sword", "multiple_swords", "gunner", "sniper_skill", "archer", "whip", "giant_weapon") || (c.fighting_style || []).some(s => /Sword|Sniper|Gun|Polearm|Club|Blade|Whip/.test(s));
    switch (stat) {
      case "body": return clamp(base + (big ? 1.5 : 0) - (T(c, "child", "elderly", "very_short") ? 1.5 : 0));
      case "iq": return clamp(4 + (T(c, "scientist", "doctor", "strategist", "archaeologist", "inventor", "navigator", "teacher") ? 3 : 0) + (T(c, "spy", "assassin") ? 1 : 0) - (T(c, "childish") ? 2 : 0) + base * 0.15);
      case "biq": return clamp(base + haki * 0.3 + (T(c, "martial_artist", "assassin", "strategist") ? 1 : 0));
      case "hax": return clamp(fruit ? fruitScore * 0.7 + base * 0.35 + (T(c, "controls_others", "teleport", "copies_others", "invisible", "barriers") ? 1.5 : 0) : 1 + (conq ? 2 : 0));
      case "df": return clamp(fruit ? fruitScore * 0.6 + base * 0.45 : 0);
      case "weapon": return clamp(armed ? 3 + base * 0.6 + (T(c, "named_sword") ? 1.5 : 0) : 1);
      case "haki": return clamp(haki ? haki * 1.6 + base * 0.45 + (conq ? 1 : 0) : 0);
      case "speed": return clamp(base + (T(c, "super_speed") ? 2 : 0) + (T(c, "can_fly", "teleport") ? 1 : 0) - (T(c, "fat", "elderly") ? 1 : 0));
      case "durability": return clamp(base + (T(c, "muscular", "armor", "zombie") ? 1 : 0) + (big ? 1 : 0));
      case "strength": return clamp(base + (T(c, "super_strength") ? 2 : 0) + (big ? 1 : 0) - (T(c, "child") ? 1 : 0));
    }
    return 0;
  }
  const charById = id => (OP().chars || []).find(c => c.id === id);
  function fighterPool(level) {
    const o = OP();
    return (o.chars || []).filter(c => c.image && o.seenBy(c) && (level === "all" ? c.difficulty !== "hard" : c.difficulty === "easy"));
  }
  const RIVAL_A = ["Iron", "Red", "Black", "Grand", "Mad", "Silver", "Storm", "Bloody", "Lucky", "Crimson", "Thunder", "Ghost"];
  const RIVAL_B = ["Fist", "Fang", "Beard", "Jaw", "Wave", "Gale", "Tusk", "Shark", "Blade", "Skull", "Anchor", "Kraken"];
  function randomRival(level) {
    const pool = shuffle(fighterPool(level)), b = {};
    STATS.forEach((s, i) => { b[s.id] = pool[i % pool.length].id; });
    const pick = a => a[Math.floor(Math.random() * a.length)];
    return { name: `Captain ${pick(RIVAL_A)} ${pick(RIVAL_B)}`, build: b };
  }
  // share codes: base64url of {n: name, b: [ids in STATS order]}
  const encode = f => btoa(unescape(encodeURIComponent(JSON.stringify({ n: f.name, b: STATS.map(s => f.build[s.id] || "") })))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  function decode(code) {
    try {
      const j = JSON.parse(decodeURIComponent(escape(atob(code.replace(/-/g, "+").replace(/_/g, "/")))));
      const build = {};
      STATS.forEach((s, i) => { if (j.b && j.b[i] && charById(j.b[i])) build[s.id] = j.b[i]; });
      if (Object.keys(build).length !== STATS.length) return null;
      return { name: String(j.n || "A friend").slice(0, 30), build };
    } catch (e) { return null; }
  }
  const fightLink = f => `${location.origin}${location.pathname}#fight=${encode(f)}`;

  let FB = null;   // the build in progress: { name, mode: "blind"|"pick", level, build, deck, i, challenger, pickStat }
  function fighterSetup(challenger) {
    const body = openPanel("BUILD A FIGHTER", challenger ? `${challenger.name} wants a 1v1` : "Build your fighter");
    let mode = store.get("fMode", "blind"), level = store.get("fLevel", "famous");
    body.innerHTML = `${challenger ? `<p class="xm-done">${esc(challenger.name)} built a fighter and sent it to you. Build yours, then fight.</p>` : ""}
      <p class="xm-note">Fill ten stats with ten characters: you get that character's version of the stat. Body, IQ, Battle IQ, Hax, Devil Fruit, Weapon, Haki, Speed, Durability and Strength. Then take it into a 1v1.</p>
      <label class="xm-titlein"><span class="xm-h">Fighter name</span><input type="text" id="fName" maxlength="30" value="${esc(store.get("fName", "My Fighter"))}"></label>
      <h3 class="xm-h">How you build</h3><div class="xm-cats"><button type="button" class="xm-chip" data-mode="blind" aria-pressed="${mode === "blind"}">Blind draft</button><button type="button" class="xm-chip" data-mode="pick" aria-pressed="${mode === "pick"}">Pick anyone</button></div>
      <p class="xm-note small">Blind draft: characters show up one at a time and you lock each into a stat, no take-backs. Pick anyone: choose who goes in each stat.</p>
      <h3 class="xm-h">Who can show up</h3><div class="xm-cats"><button type="button" class="xm-chip" data-level="famous" aria-pressed="${level === "famous"}">Famous only</button><button type="button" class="xm-chip" data-level="all" aria-pressed="${level === "all"}">Famous + side characters</button></div>
      <button type="button" class="btn btn-straw xm-go">Start building</button>`;
    wireChips(body, "mode", v => { mode = v; });
    wireChips(body, "level", v => { level = v; });
    body.querySelector(".xm-go").addEventListener("click", () => {
      const name = (body.querySelector("#fName").value || "My Fighter").trim().slice(0, 30);
      store.set("fName", name); store.set("fMode", mode); store.set("fLevel", level);
      FB = { name, mode, level, build: {}, deck: shuffle(fighterPool(level)), i: 0, challenger: challenger || null, pickStat: null };
      sound("click"); fighterRender();
    });
  }
  function fighterRender() {
    const body = panel.querySelector("#xmBody"), filled = Object.keys(FB.build).length, done = filled === STATS.length;
    setHead("BUILD A FIGHTER", FB.name);
    const cur = FB.mode === "blind" && !done ? FB.deck[FB.i] : null;
    body.innerHTML = `${cur ? `<div class="xm-now"><span class="xm-count">${filled + 1} of ${STATS.length}</span>${pic(cur, "xbig")}<span class="xm-now-name">${esc(cur.name)}</span>
        <span class="xm-now-ask">Which stat do they give you?</span></div>` : done ? `<p class="xm-done">Fighter ready. Power ${power(FB.build).toFixed(0)}.</p>` :
        `<p class="xm-note">Tap a stat to pick who goes there.</p>`}
      <ul class="xm-stats">${STATS.map(s => { const id = FB.build[s.id], c = id && charById(id);
        return `<li><span class="xm-stat">${s.name}</span>${c ? `${pic(c, "xmini")}<span class="xm-slot-name">${esc(c.name)}</span>${done ? `<b class="xm-val">${rate(c, s.id)}</b>` : ""}`
          : cur ? `<button type="button" class="xm-put" data-s="${s.id}">Put here</button>` : FB.mode === "pick" ? `<button type="button" class="xm-put" data-pick="${s.id}">Pick…</button>` : ""}</li>`; }).join("")}</ul>
      <div id="fPick"></div>
      <div class="xm-actions">${done ? `${FB.challenger ? `<button type="button" class="btn btn-straw" data-a="friend">Fight ${esc(FB.challenger.name)}</button>` : ""}
        <button type="button" class="btn ${FB.challenger ? "" : "btn-straw"}" data-a="random">1v1 a random fighter</button>
        <button type="button" class="btn" data-a="share">Challenge a friend</button>` : ""}
        <button type="button" class="btn btn-ghost" data-a="reset">${done ? "Build another" : "Reset"}</button></div>`;
    body.querySelectorAll("[data-s]").forEach(b => b.addEventListener("click", () => {
      FB.build[b.dataset.s] = cur.id; FB.i++; sound("stamp"); fighterRender();
    }));
    body.querySelectorAll("[data-pick]").forEach(b => b.addEventListener("click", () => { sound("click"); FB.pickStat = b.dataset.pick; pickSearch(); }));
    const act = a => body.querySelector(`[data-a="${a}"]`);
    act("reset").addEventListener("click", () => { sound("click"); if (done) fighterSetup(FB.challenger); else { FB.build = {}; FB.i = 0; FB.deck = shuffle(fighterPool(FB.level)); fighterRender(); } });
    if (done) {
      act("random").addEventListener("click", () => fight({ name: FB.name, build: FB.build }, randomRival(FB.level), false));
      act("share").addEventListener("click", e => shareText(`${FB.name} wants a 1v1 on One Pieces. Build your fighter and fight mine: ${fightLink({ name: FB.name, build: FB.build })}`, e.currentTarget));
      const f = act("friend"); if (f) f.addEventListener("click", () => fight({ name: FB.name, build: FB.build }, FB.challenger, true));
    }
    if (FB.pickStat) pickSearch();
    top();
  }
  function pickSearch() {
    const box = panel.querySelector("#fPick"), stat = STATS.find(s => s.id === FB.pickStat);
    const pool = fighterPool(FB.level).filter(c => !Object.values(FB.build).includes(c.id));
    box.innerHTML = `<div class="xm-search"><label class="xm-h" for="fSearch">Who gives you ${esc(stat.name)}?</label><input id="fSearch" type="text" placeholder="Type a name..." autocomplete="off"><ul class="xm-results"></ul></div>`;
    const input = box.querySelector("input"), list = box.querySelector("ul");
    const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "");
    const draw = () => {
      const q = norm(input.value).trim();
      const hits = (q ? pool.filter(c => norm(c.name).includes(q) || (c.aliases || []).some(a => norm(a).includes(q))) : pool.slice().sort(byFame)).slice(0, 24);
      list.innerHTML = hits.map(c => `<li><button type="button" data-id="${esc(c.id)}">${pic(c, "xmini")}<span>${esc(c.name)}</span></button></li>`).join("") || `<li class="xm-none">No one by that name in this pool.</li>`;
      list.querySelectorAll("[data-id]").forEach(b => b.addEventListener("click", () => {
        FB.build[FB.pickStat] = b.dataset.id; FB.pickStat = null; sound("stamp"); fighterRender();
      }));
    };
    input.addEventListener("input", draw); draw();
    setTimeout(() => input.focus({ preventScroll: false }), 30);
  }
  const power = build => STATS.reduce((sum, s) => { const c = charById(build[s.id]); return sum + (c ? rate(c, s.id) * s.w : 0); }, 0);

  // the 1v1: stat by stat, weighted; same two builds always give the same result
  function fight(me, them, friend) {
    sound("click");
    const body = panel.querySelector("#xmBody");
    setHead("1V1", `${me.name} vs ${them.name}`);
    const rows = STATS.map(s => {
      const a = charById(me.build[s.id]), b = charById(them.build[s.id]);
      const va = a ? rate(a, s.id) : 0, vb = b ? rate(b, s.id) : 0;
      return { s, a, b, va, vb, win: va > vb ? 1 : vb > va ? -1 : 0 };
    });
    const pa = power(me.build), pb = power(them.build), wins = rows.filter(r => r.win > 0).length, losses = rows.filter(r => r.win < 0).length;
    const result = Math.abs(pa - pb) < 0.5 ? (wins === losses ? 0 : wins > losses ? 1 : -1) : pa > pb ? 1 : -1;
    body.innerHTML = `<div class="xm-vs"><span>${esc(me.name)}</span><b>VS</b><span>${esc(them.name)}</span></div>
      <ul class="xm-fight">${rows.map((r, i) => `<li style="--i:${i}" class="${r.win > 0 ? "w" : r.win < 0 ? "l" : "d"}">
        <span class="xm-side">${pic(r.a, "xmini")}<span class="xm-slot-name">${esc(r.a ? r.a.name : "—")}</span><b>${r.va}</b></span>
        <span class="xm-stat">${r.s.name}</span>
        <span class="xm-side r"><b>${r.vb}</b><span class="xm-slot-name">${esc(r.b ? r.b.name : "—")}</span>${pic(r.b, "xmini")}</span></li>`).join("")}</ul>
      <div class="xm-verdict ${result > 0 ? "w" : result < 0 ? "l" : "d"}" style="--i:${rows.length}">${result > 0 ? `${esc(me.name)} wins!` : result < 0 ? `${esc(them.name)} wins!` : "It's a draw!"}
        <small>Power ${pa.toFixed(0)} vs ${pb.toFixed(0)} · stats won ${wins}–${losses}</small></div>
      <div class="xm-actions" style="--i:${rows.length + 1}">
        ${friend ? `<button type="button" class="btn btn-straw" data-a="back">Send ${esc(them.name)} your fighter</button>` : `<button type="button" class="btn btn-straw" data-a="again">Another random rival</button>`}
        <button type="button" class="btn" data-a="share">Share result</button><button type="button" class="btn btn-ghost" data-a="build">Build another</button></div>`;
    setTimeout(() => sound(result > 0 ? "fanfare" : "bad"), rows.length * 260 + 200);
    const act = a => body.querySelector(`[data-a="${a}"]`);
    if (friend) act("back").addEventListener("click", e => shareText(`I took your 1v1 on One Pieces (${result > 0 ? "I won" : result < 0 ? "you won" : "draw"}). Now fight mine: ${fightLink(me)}`, e.currentTarget));
    else act("again").addEventListener("click", () => fight(me, randomRival(FB ? FB.level : "famous"), false));
    act("share").addEventListener("click", e => shareText(`One Pieces 1v1: ${me.name} vs ${them.name}, ${result > 0 ? `${me.name} wins` : result < 0 ? `${them.name} wins` : "draw"} (${pa.toFixed(0)}–${pb.toFixed(0)})\n` +
      rows.map(r => `${r.s.name}: ${r.a ? r.a.name : "—"} ${r.va} vs ${r.vb} ${r.b ? r.b.name : "—"}`).join("\n") + `\nFight me: ${fightLink(me)}`, e.currentTarget));
    act("build").addEventListener("click", () => fighterSetup(null));
    top();
  }

  // ---------------- entry points ----------------
  const MODES = ["blind", "tierlist", "fighter"];
  function open(id) {
    if (id === "blind") return blindSetup();
    if (id === "tierlist") return tierSetup();
    if (id === "fighter") return fighterSetup(null);
  }
  // a friend's link: #fight=<code>
  function fromLink() {
    const m = /^#fight=([\w-]+)$/.exec(location.hash || "");
    if (!m || !OP().chars) return;
    const f = decode(m[1]);
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* file:// */ }
    if (f) fighterSetup(f);
  }
  window.Extras = { modes: MODES, open, rate, STATS };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fromLink); else setTimeout(fromLink, 0);
})();
