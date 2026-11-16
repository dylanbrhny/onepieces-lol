// Modes with no score to chase: Blind Ranking, the Tier List maker and Build a Fighter (with 1v1s),
// plus the suggestions / bug report box. They open as a full-screen panel over the port.
// Data comes from window.OnePieces (set up by app.js); track() sends anonymous usage to the answers sheet.
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
  const track = (ev, data) => { try { if (OP().track) OP().track(ev, data); } catch (e) { /* offline */ } };
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
  const catCache = {};
  const catList = id => catCache[id] || (catCache[id] = catById(id).get());

  // ---------------- the panel ----------------
  const ICONS = {
    blind: '<path d="M0 0h2v2H0zM3 0h5v2H3zM0 3h2v2H0zM3 3h5v2H3zM0 6h2v2H0zM3 6h2v2H3z"/>',
    tierlist: '<path d="M0 0h2v2H0zM3 0h5v2H3zM0 3h2v2H0zM3 3h3v2H3zM0 6h2v2H0zM3 6h1v2H3z"/>',
    fighter: '<path d="M1 1h5v1h1v3H6v1H5v2H2V6H1zM2 2v1h1V2zM4 2v1h1V2z"/>',
    feedback: '<path d="M0 0h8v6H3L1 8V6H0zM1 1v4h1v1l1-1h4V1zM2 2h4v1H2zM2 3h3v1H2z"/>'
  };
  let panel = null, backFn = null;
  function openPanel(mode, kicker, title, back) {
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "xm"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-labelledby", "xmTitle");
      panel.innerHTML = `<div class="xm-panel"><header class="xm-head">
          <button type="button" class="xm-back" aria-label="Back" hidden>‹</button>
          <svg class="xm-icon" viewBox="0 0 8 8" aria-hidden="true"></svg>
          <div class="xm-titles"><p class="xm-kicker" id="xmKicker"></p><h2 class="xm-title" id="xmTitle"></h2></div>
          <button type="button" class="xm-close" aria-label="Back to port">✕</button></header>
        <div class="xm-body" id="xmBody"></div></div>`;
      document.body.appendChild(panel);
      panel.querySelector(".xm-close").addEventListener("click", close);
      panel.querySelector(".xm-back").addEventListener("click", () => { sound("click"); if (backFn) backFn(); });
      panel.addEventListener("click", e => { if (e.target === panel) close(); });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && panel && !panel.hidden) close(); });
    }
    panel.hidden = false;
    panel.dataset.mode = mode;
    document.body.classList.add("xm-open");
    setHead(kicker, title, back);
    panel.querySelector(".xm-icon").innerHTML = ICONS[mode] || "";
    return body();
  }
  const body = () => panel.querySelector("#xmBody");
  function close() { if (panel) panel.hidden = true; document.body.classList.remove("xm-open"); sound("click"); }
  function setHead(kicker, title, back) {
    panel.querySelector("#xmKicker").textContent = kicker;
    panel.querySelector("#xmTitle").textContent = title;
    backFn = back || null;
    panel.querySelector(".xm-back").hidden = !back;
  }
  const top = () => { const p = panel && panel.querySelector(".xm-panel"); if (p) p.scrollTop = 0; };
  function toast(msg) {
    let t = panel.querySelector(".xm-toast");
    if (!t) { t = document.createElement("div"); t.className = "xm-toast"; t.setAttribute("role", "status"); panel.querySelector(".xm-panel").appendChild(t); }
    t.textContent = msg; t.classList.remove("on"); void t.offsetWidth; t.classList.add("on");
  }

  async function shareText(text) {
    try {
      if (navigator.share && /Mobi|Android|iPhone|iPad/.test(navigator.userAgent)) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      toast("Copied. Paste it anywhere.");
    } catch (e) {
      const box = document.createElement("textarea"); box.className = "xm-copy"; box.value = text; box.readOnly = true;
      body().appendChild(box); box.select(); toast("Copy the text below.");
    }
  }
  // category cards: a little collage of the first pictures in each
  function catCards(sel) {
    return `<div class="xm-catgrid">${CATS.map(c => {
      const list = catList(c.id), shots = list.filter(x => x.image).slice(0, 3);
      return `<button type="button" class="xm-cat" data-cat="${c.id}" aria-pressed="${c.id === sel}">
        <span class="xm-collage">${shots.map(x => pic(x, "xcol")).join("")}</span>
        <span class="xm-cat-name">${esc(c.name)}</span><span class="xm-cat-n">${list.length}</span></button>`;
    }).join("")}</div>`;
  }
  const seg = (attr, opts, sel) => `<div class="xm-seg" role="group">${opts.map(([v, label]) => `<button type="button" data-${attr}="${v}" aria-pressed="${String(v) === String(sel)}">${esc(label)}</button>`).join("")}</div>`;
  function wire(b, attr, onPick) {
    b.querySelectorAll(`[data-${attr}]`).forEach(x => x.addEventListener("click", () => {
      sound("click");
      b.querySelectorAll(`[data-${attr}]`).forEach(y => y.setAttribute("aria-pressed", String(y === x)));
      onPick(x.dataset[attr]);
    }));
  }
  // the item being placed, as a card that flips in
  const card = (it, extra = "") => `<div class="xm-card" ${extra}><div class="xm-card-in">${pic(it, "xcard")}
      <span class="xm-card-name">${esc(it.name)}</span>${it.sub ? `<span class="xm-card-sub">${esc(it.sub)}</span>` : ""}</div></div>`;

  // ================= BLIND RANKING =================
  // One item at a time; you lock each into a spot without knowing what comes next. Nothing to win.
  let BR = null;
  function blindSetup() {
    const b = openPanel("blind", "BLIND RANKING", "Rank it blind");
    let cat = store.get("blindCat", "famous"), n = store.get("blindN", 10);
    b.innerHTML = `<p class="xm-lede">Cards come one at a time. Lock each one into a spot <b>before you see the next</b>. No take-backs, no winning: just your call.</p>
      <h3 class="xm-h">Pick a deck</h3>${catCards(cat)}
      <h3 class="xm-h">Spots</h3>${seg("n", [[5, "Top 5"], [10, "Top 10"]], n)}
      <button type="button" class="btn btn-straw xm-cta">Deal the first card</button>`;
    wire(b, "cat", v => { cat = v; });
    wire(b, "n", v => { n = +v; });
    b.querySelector(".xm-cta").addEventListener("click", () => { store.set("blindCat", cat); store.set("blindN", n); blindStart(cat, n); });
  }
  function blindStart(cat, n) {
    sound("click");
    const items = shuffle(catList(cat));
    if (items.length < n) n = Math.max(1, items.length);
    BR = { cat, n, deck: items.slice(0, n), i: 0, slots: Array(n).fill(null), last: -1 };
    track("start", { mode: "blind", detail: cat, value: n });
    blindRender();
  }
  const medal = k => (k === 0 ? "gold" : k === 1 ? "silver" : k === 2 ? "bronze" : "");
  function blindRender() {
    const b = body(), c = catById(BR.cat), done = BR.i >= BR.n, cur = BR.deck[BR.i];
    setHead("BLIND RANKING", c.name, blindSetup);
    const pips = `<div class="xm-pips">${BR.deck.map((_, k) => `<i class="${k < BR.i ? "on" : k === BR.i ? "now" : ""}"></i>`).join("")}</div>`;
    if (done) {
      const podium = [1, 0, 2].filter(k => BR.slots[k]).map(k => `<div class="xm-pod ${medal(k)}"><span class="xm-pod-rank">${k + 1}</span>${pic(BR.slots[k], "xpod")}<span class="xm-pod-name">${esc(BR.slots[k].name)}</span><span class="xm-pod-base"></span></div>`).join("");
      b.innerHTML = `<p class="xm-banner">Your blind top ${BR.n}</p><div class="xm-podium">${podium}</div>
        ${BR.n > 3 ? `<ol class="xm-rest" start="4">${BR.slots.slice(3).map((s, k) => `<li><span class="xm-num">${k + 4}</span>${pic(s, "xmini")}<span class="xm-name">${esc(s ? s.name : "—")}</span></li>`).join("")}</ol>` : ""}
        <div class="xm-actions"><button type="button" class="btn btn-straw" data-a="again">Deal again</button><button type="button" class="btn" data-a="share">Share</button><button type="button" class="btn btn-ghost" data-a="deck">New deck</button></div>`;
      const act = a => b.querySelector(`[data-a="${a}"]`);
      act("again").addEventListener("click", () => blindStart(BR.cat, BR.n));
      act("deck").addEventListener("click", () => { sound("click"); blindSetup(); });
      act("share").addEventListener("click", () => shareText(`My blind top ${BR.n} ${c.name} on One Pieces:\n` + BR.slots.map((s, k) => `${k + 1}. ${s ? s.name : "—"}`).join("\n") + `\n${location.origin}${location.pathname}`));
      return top();
    }
    b.innerHTML = `${pips}<div class="xm-stage">${card(cur, `data-k="${BR.i}"`)}<p class="xm-ask">Where does it go?</p></div>
      <ol class="xm-spots">${BR.slots.map((s, k) => `<li class="${medal(k)}${k === BR.last ? " landed" : ""}"><span class="xm-num">${k + 1}</span>${s
        ? `${pic(s, "xmini")}<span class="xm-name">${esc(s.name)}</span>`
        : `<button type="button" class="xm-place" data-k="${k}">Place at #${k + 1}</button>`}</li>`).join("")}</ol>
      <div class="xm-actions"><button type="button" class="btn btn-ghost" data-a="reset">Start over</button></div>`;
    b.querySelectorAll(".xm-place").forEach(x => x.addEventListener("click", () => {
      const k = +x.dataset.k;
      BR.slots[k] = cur; BR.i++; BR.last = k; sound("stamp");
      if (BR.i >= BR.n) track("blind", { mode: BR.cat, value: BR.n, detail: BR.slots.map(s => s && s.id).join(",") });
      blindRender();
    }));
    b.querySelector('[data-a="reset"]').addEventListener("click", () => blindStart(BR.cat, BR.n));
  }

  // ================= TIER LIST =================
  const TIERS = [["S", "#ff4d5e", "#ff8a5b"], ["A", "#ff9a3c", "#ffc15a"], ["B", "#f1c04a", "#ffe27a"], ["C", "#7ad85a", "#b6ee7a"], ["D", "#4fc3f7", "#8fe3ff"], ["F", "#9a7bff", "#c3a9ff"]];
  let TL = null, tlSel = null;
  function tierSetup() {
    const b = openPanel("tierlist", "TIER LIST", "Make a tier list");
    const saved = store.get("tier", null);
    let cat = store.get("tierCat", "famous"), count = store.get("tierCount", 24), pickBy = store.get("tierPick", "famous");
    b.innerHTML = `${saved && saved.items && saved.items.length ? `<button type="button" class="xm-resume" data-a="resume"><span>Keep editing</span><b>${esc(saved.title)}</b><small>${Object.keys(saved.place || {}).length} of ${saved.items.length} ranked</small></button>` : ""}
      <h3 class="xm-h">What to rank</h3>${catCards(cat)}
      <h3 class="xm-h">How many</h3>${seg("count", [[12, "12"], [24, "24"], [36, "36"]], count)}
      <h3 class="xm-h">Which ones</h3>${seg("pick", [["famous", "Most famous"], ["random", "Random mix"]], pickBy)}
      <button type="button" class="btn btn-straw xm-cta" data-a="new">Build the board</button>`;
    wire(b, "cat", v => { cat = v; });
    wire(b, "count", v => { count = +v; });
    wire(b, "pick", v => { pickBy = v; });
    b.querySelector('[data-a="new"]').addEventListener("click", () => {
      store.set("tierCat", cat); store.set("tierCount", count); store.set("tierPick", pickBy);
      const all = catList(cat), items = (pickBy === "random" ? shuffle(all) : all).slice(0, count);
      TL = { title: `${catById(cat).name} tier list`, cat, items, place: {} };
      track("start", { mode: "tierlist", detail: cat, value: items.length });
      sound("click"); tlSel = null; tierRender();
    });
    const r = b.querySelector('[data-a="resume"]');
    if (r) r.addEventListener("click", () => { TL = saved; tlSel = null; sound("click"); tierRender(); });
  }
  const tierSave = () => store.set("tier", TL);
  function tierRender() {
    const b = body();
    setHead("TIER LIST", TL.title, tierSetup);
    const tile = it => `<button type="button" class="xm-tile${tlSel === it.id ? " sel" : ""}" data-id="${esc(it.id)}" draggable="true" title="${esc(it.name)}" aria-pressed="${tlSel === it.id}">${pic(it, "xtile")}<span class="xm-ribbon">${esc(it.name)}</span></button>`;
    const inRow = t => TL.items.filter(it => (TL.place[it.id] || "") === t);
    const left = inRow("").length;
    b.innerHTML = `<div class="xm-tbar"><label class="xm-tname"><span class="sr-only">List title</span><input type="text" maxlength="60" value="${esc(TL.title)}"></label>
        <span class="xm-progress"><b>${TL.items.length - left}</b>/${TL.items.length}</span></div>
      <div class="xm-board">${TIERS.map(([t, c1, c2]) => `<div class="xm-row${tlSel ? " armed" : ""}" data-row="${t}" style="--c1:${c1};--c2:${c2}"><span class="xm-tier">${t}</span><div class="xm-drop">${inRow(t).map(tile).join("")}</div></div>`).join("")}</div>
      <div class="xm-tray${tlSel ? " armed" : ""}" data-row=""><p class="xm-tray-head">${tlSel ? "Now tap a row ↑ (or here to take it back)" : left ? `Unranked · ${left} left · tap one, then a row` : "All ranked! Save the picture below."}</p><div class="xm-drop">${inRow("").map(tile).join("")}</div></div>
      <div class="xm-actions"><button type="button" class="btn btn-straw" data-a="png">Save picture</button><button type="button" class="btn" data-a="reset">Clear board</button><button type="button" class="btn btn-ghost" data-a="new">New list</button></div>`;
    b.querySelector(".xm-tname input").addEventListener("input", e => { TL.title = e.target.value || "My tier list"; setHead("TIER LIST", TL.title, tierSetup); tierSave(); });
    b.querySelectorAll(".xm-tile").forEach(x => {
      x.addEventListener("click", e => { e.stopPropagation(); sound("click"); tlSel = tlSel === x.dataset.id ? null : x.dataset.id; tierRender(); });
      x.addEventListener("dragstart", e => { tlSel = x.dataset.id; e.dataTransfer.setData("text/plain", x.dataset.id); e.dataTransfer.effectAllowed = "move"; });
    });
    b.querySelectorAll("[data-row]").forEach(row => {
      row.addEventListener("click", () => { if (tlSel) tierMove(tlSel, row.dataset.row); });
      row.addEventListener("dragover", e => { e.preventDefault(); row.classList.add("over"); });
      row.addEventListener("dragleave", () => row.classList.remove("over"));
      row.addEventListener("drop", e => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || tlSel; if (id) tierMove(id, row.dataset.row); });
    });
    const act = a => b.querySelector(`[data-a="${a}"]`);
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
    const T = 96, G = 6, LW = 110, W = 1080, PER = Math.floor((W - LW - G) / (T + G));
    const rows = TIERS.map(([t, c1, c2]) => ({ t, c1, c2, items: TL.items.filter(it => TL.place[it.id] === t) }));
    const heights = rows.map(r => Math.max(1, Math.ceil(r.items.length / PER)) * (T + G) + G);
    const H = 92 + heights.reduce((a, c) => a + c, 0) + 44;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#162a66"); bg.addColorStop(1, "#0a0f2a");
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.fillStyle = "#050818"; x.fillText && (x.font = '26px "Press Start 2P", monospace'); x.textBaseline = "middle";
    x.fillText(TL.title.slice(0, 38), 22, 50); x.fillStyle = "#ffd36b"; x.fillText(TL.title.slice(0, 38), 18, 46);
    const load = src => new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    let y = 92;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r], h = heights[r] - G;
      const g = x.createLinearGradient(0, y, LW, y + h); g.addColorStop(0, row.c1); g.addColorStop(1, row.c2);
      x.fillStyle = g; x.fillRect(10, y, LW - 10, h);
      x.font = '44px "Press Start 2P", monospace'; x.textAlign = "center";
      x.fillStyle = "rgba(0,0,0,0.35)"; x.fillText(row.t, 10 + (LW - 10) / 2 + 3, y + h / 2 + 3);
      x.fillStyle = "#1a1205"; x.fillText(row.t, 10 + (LW - 10) / 2, y + h / 2); x.textAlign = "left";
      x.fillStyle = "rgba(255,255,255,0.05)"; x.fillRect(LW, y, W - LW - 10, h);
      for (let i = 0; i < row.items.length; i++) {
        const it = row.items[i], tx = LW + G + (i % PER) * (T + G), ty = y + G / 2 + Math.floor(i / PER) * (T + G);
        const im = await load(it.image);
        x.fillStyle = "#172255"; x.fillRect(tx, ty, T, T);
        if (im) { const s = Math.max(T / im.width, T / im.height), w = im.width * s, hh = im.height * s; x.save(); x.beginPath(); x.rect(tx, ty, T, T); x.clip(); x.drawImage(im, tx + (T - w) / 2, ty + (T - hh) / 4, w, hh); x.restore(); }
        x.fillStyle = "rgba(5,8,24,0.8)"; x.fillRect(tx, ty + T - 22, T, 22);
        x.fillStyle = "#f4ecd8"; x.font = "17px VT323, monospace"; x.fillText(it.name.length > 13 ? it.name.slice(0, 12) + "…" : it.name, tx + 4, ty + T - 11);
        x.strokeStyle = "#050818"; x.lineWidth = 3; x.strokeRect(tx, ty, T, T);
      }
      y += heights[r];
    }
    x.fillStyle = "#a9b1d6"; x.font = "20px VT323, monospace"; x.fillText("Made with One Pieces · onepieces.lol", 18, H - 22);
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png"); a.download = (TL.title || "tier-list").replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() + ".png";
    document.body.appendChild(a); a.click(); a.remove();
    track("tierlist", { mode: TL.cat || "", value: Object.keys(TL.place).length, detail: TIERS.map(([t]) => `${t}:${TL.items.filter(it => TL.place[it.id] === t).map(it => it.id).join("|")}`).join(" ").slice(0, 900) });
    toast("Saved. Check your downloads.");
  }

  // ================= BUILD A FIGHTER =================
  const STATS = [
    { id: "body", name: "Body", w: 0.9 }, { id: "iq", name: "IQ", w: 0.7 }, { id: "biq", name: "Battle IQ", w: 1.0 },
    { id: "hax", name: "Hax", w: 1.1 }, { id: "df", name: "Devil Fruit", w: 1.0 }, { id: "weapon", name: "Weapon", w: 0.9 },
    { id: "haki", name: "Haki", w: 1.2 }, { id: "speed", name: "Speed", w: 1.1 }, { id: "durability", name: "Durability", w: 1.2 }, { id: "strength", name: "Strength", w: 1.2 }
  ];
  const MAXPOWER = STATS.reduce((s, x) => s + x.w * 10, 0);
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
  const power = build => STATS.reduce((sum, s) => { const c = charById(build[s.id]); return sum + (c ? rate(c, s.id) * s.w : 0); }, 0);
  const pct = build => Math.round(power(build) / MAXPOWER * 100);
  const barColor = v => (v >= 9 ? "var(--x-gold)" : v >= 7 ? "var(--d-easy)" : v >= 4 ? "var(--d-medium)" : "var(--d-hard)");

  let FB = null;   // the build in progress: { name, mode: "blind"|"pick", level, build, deck, i, challenger, pickStat }
  function fighterSetup(challenger) {
    const b = openPanel("fighter", "BUILD A FIGHTER", challenger ? `${challenger.name} wants a 1v1` : "Build your fighter");
    let mode = store.get("fMode", "blind"), level = store.get("fLevel", "famous");
    b.innerHTML = `${challenger ? `<div class="xm-challenge"><span>INCOMING CHALLENGE</span><b>${esc(challenger.name)}</b> built a fighter and sent it to you. Build yours, then fight.</div>` : ""}
      <p class="xm-lede">Ten stats, ten characters. Each one gives your fighter <b>their</b> version of that stat. Then take it into a 1v1.</p>
      <div class="xm-statchips">${STATS.map(s => `<span>${s.name}</span>`).join("")}</div>
      <label class="xm-field"><span class="xm-h">Fighter name</span><input type="text" id="fName" maxlength="30" value="${esc(store.get("fName", "My Fighter"))}"></label>
      <h3 class="xm-h">How you build</h3>${seg("mode", [["blind", "Blind draft"], ["pick", "Pick anyone"]], mode)}
      <p class="xm-hint">Blind draft: characters show up one at a time and you lock each into a stat. Pick anyone: you choose who goes where.</p>
      <h3 class="xm-h">Who can show up</h3>${seg("level", [["famous", "Famous only"], ["all", "+ Side characters"]], level)}
      <button type="button" class="btn btn-straw xm-cta">${challenger ? "Build my fighter" : "Start building"}</button>`;
    wire(b, "mode", v => { mode = v; });
    wire(b, "level", v => { level = v; });
    b.querySelector(".xm-cta").addEventListener("click", () => {
      const name = (b.querySelector("#fName").value || "My Fighter").trim().slice(0, 30);
      store.set("fName", name); store.set("fMode", mode); store.set("fLevel", level);
      FB = { name, mode, level, build: {}, deck: shuffle(fighterPool(level)), i: 0, challenger: challenger || null, pickStat: null };
      track("start", { mode: "fighter", detail: `${mode}${challenger ? ":vs-friend" : ""}`, value: 0 });
      sound("click"); fighterRender();
    });
  }
  // the fighter as a trading card: name, power and a bar per stat
  function fighterCard(f, showVals) {
    const p = pct(f.build);
    return `<div class="xm-fcard"><div class="xm-fhead"><span class="xm-fname">${esc(f.name)}</span>${showVals ? `<span class="xm-power"><b>${p}</b><small>POWER</small></span>` : ""}</div>
      <ul class="xm-fstats">${STATS.map(s => { const c = charById(f.build[s.id]), v = c ? rate(c, s.id) : 0;
        return `<li><span class="xm-sname">${s.name}</span>${c ? pic(c, "xmini") : `<span class="xpic xmini empty"><i>?</i></span>`}
          <span class="xm-who">${c ? esc(c.name) : "—"}</span>${showVals ? `<span class="xm-bar"><i style="width:${v * 10}%;background:${barColor(v)}"></i></span><b class="xm-v">${v}</b>` : ""}</li>`; }).join("")}</ul></div>`;
  }
  function fighterRender() {
    const b = body(), filled = Object.keys(FB.build).length, done = filled === STATS.length;
    setHead("BUILD A FIGHTER", FB.name, () => fighterSetup(FB.challenger));
    const cur = FB.mode === "blind" && !done ? FB.deck[FB.i] : null;
    if (done) {
      b.innerHTML = `<p class="xm-banner">Fighter ready</p>${fighterCard(FB, true)}
        <div class="xm-actions xm-big">${FB.challenger ? `<button type="button" class="btn btn-straw" data-a="friend">Fight ${esc(FB.challenger.name)}</button>` : ""}
          <button type="button" class="btn ${FB.challenger ? "" : "btn-straw"}" data-a="random">1v1 a random rival</button>
          <button type="button" class="btn" data-a="share">Challenge a friend</button>
          <button type="button" class="btn btn-ghost" data-a="reset">Build another</button></div>`;
      const act = a => b.querySelector(`[data-a="${a}"]`);
      act("random").addEventListener("click", () => fight({ name: FB.name, build: FB.build }, randomRival(FB.level), false));
      act("share").addEventListener("click", () => shareText(`${FB.name} wants a 1v1 on One Pieces. Build your fighter and fight mine: ${fightLink({ name: FB.name, build: FB.build })}`));
      act("reset").addEventListener("click", () => { sound("click"); fighterSetup(FB.challenger); });
      const f = act("friend"); if (f) f.addEventListener("click", () => fight({ name: FB.name, build: FB.build }, FB.challenger, true));
      return top();
    }
    const pips = `<div class="xm-pips">${STATS.map(s => `<i class="${FB.build[s.id] ? "on" : ""}"></i>`).join("")}</div>`;
    b.innerHTML = `${pips}${cur ? `<div class="xm-stage">${card(cur, `data-k="${FB.i}"`)}<p class="xm-ask">Which stat do they give you?</p></div>` : `<p class="xm-ask solo">Tap a stat to choose who fills it</p>`}
      <div class="xm-statgrid">${STATS.map(s => { const c = charById(FB.build[s.id]);
        return c ? `<div class="xm-sbtn full"><span class="xm-sname">${s.name}</span>${pic(c, "xmini")}<span class="xm-who">${esc(c.name)}</span></div>`
          : `<button type="button" class="xm-sbtn" data-s="${s.id}"><span class="xm-sname">${s.name}</span><span class="xm-plus">${cur ? "Put here" : "Choose"}</span></button>`; }).join("")}</div>
      <div id="fPick"></div>
      <div class="xm-actions"><button type="button" class="btn btn-ghost" data-a="reset">Start over</button></div>`;
    b.querySelectorAll("[data-s]").forEach(x => x.addEventListener("click", () => {
      if (cur) { FB.build[x.dataset.s] = cur.id; FB.i++; sound("stamp"); fighterRender(); }
      else { sound("click"); FB.pickStat = x.dataset.s; b.querySelectorAll("[data-s]").forEach(y => y.classList.toggle("picking", y === x)); pickSearch(); }
    }));
    b.querySelector('[data-a="reset"]').addEventListener("click", () => { sound("click"); FB.build = {}; FB.i = 0; FB.deck = shuffle(fighterPool(FB.level)); FB.pickStat = null; fighterRender(); });
    if (FB.pickStat) pickSearch();
  }
  function pickSearch() {
    const box = body().querySelector("#fPick"), stat = STATS.find(s => s.id === FB.pickStat);
    const pool = fighterPool(FB.level).filter(c => !Object.values(FB.build).includes(c.id));
    box.innerHTML = `<div class="xm-search"><label class="xm-h" for="fSearch">Who gives you ${esc(stat.name)}?</label><input id="fSearch" type="text" placeholder="Type a name..." autocomplete="off"><ul class="xm-results"></ul></div>`;
    const input = box.querySelector("input"), list = box.querySelector("ul");
    const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "");
    const draw = () => {
      const q = norm(input.value).trim();
      const hits = (q ? pool.filter(c => norm(c.name).includes(q) || (c.aliases || []).some(a => norm(a).includes(q))) : pool.slice().sort(byFame)).slice(0, 24);
      list.innerHTML = hits.map(c => `<li><button type="button" data-id="${esc(c.id)}">${pic(c, "xmini")}<span>${esc(c.name)}</span></button></li>`).join("") || `<li class="xm-none">No one by that name here.</li>`;
      list.querySelectorAll("[data-id]").forEach(x => x.addEventListener("click", () => {
        FB.build[FB.pickStat] = x.dataset.id; FB.pickStat = null; sound("stamp"); fighterRender();
      }));
    };
    input.addEventListener("input", draw); draw();
    box.scrollIntoView({ block: "nearest" });
    setTimeout(() => input.focus({ preventScroll: true }), 30);
  }

  // the 1v1: stat by stat, weighted; same two builds always give the same result
  function fight(me, them, friend) {
    sound("click");
    const b = body();
    setHead("1V1", `${me.name} vs ${them.name}`, () => fighterRender());
    const rows = STATS.map(s => {
      const a = charById(me.build[s.id]), c = charById(them.build[s.id]);
      const va = a ? rate(a, s.id) : 0, vb = c ? rate(c, s.id) : 0;
      return { s, a, c, va, vb, win: va > vb ? 1 : vb > va ? -1 : 0 };
    });
    const pa = power(me.build), pb = power(them.build), wins = rows.filter(r => r.win > 0).length, losses = rows.filter(r => r.win < 0).length;
    const result = Math.abs(pa - pb) < 0.5 ? (wins === losses ? 0 : wins > losses ? 1 : -1) : pa > pb ? 1 : -1;
    const STEP = 330;
    b.innerHTML = `<div class="xm-versus"><div class="xm-vside me"><span>${esc(me.name)}</span><b>${pct(me.build)}</b></div><span class="xm-vs">VS</span><div class="xm-vside them"><span>${esc(them.name)}</span><b>${pct(them.build)}</b></div></div>
      <div class="xm-score"><b data-sc="me">0</b><span>stats won</span><b data-sc="them">0</b></div>
      <ul class="xm-clash">${rows.map((r, i) => `<li style="--i:${i}" class="${r.win > 0 ? "w" : r.win < 0 ? "l" : "d"}">
        <span class="xm-cside">${pic(r.a, "xmini")}<span class="xm-who">${esc(r.a ? r.a.name : "—")}</span></span>
        <span class="xm-cmid"><span class="xm-cbar l"><i style="--v:${r.va * 10}%"></i><b>${r.va}</b></span><span class="xm-sname">${r.s.name}</span><span class="xm-cbar r"><b>${r.vb}</b><i style="--v:${r.vb * 10}%"></i></span></span>
        <span class="xm-cside r"><span class="xm-who">${esc(r.c ? r.c.name : "—")}</span>${pic(r.c, "xmini")}</span></li>`).join("")}</ul>
      <div class="xm-verdict ${result > 0 ? "w" : result < 0 ? "l" : "d"}" style="--i:${rows.length}"><span class="xm-stamp">${result > 0 ? "VICTORY" : result < 0 ? "DEFEAT" : "DRAW"}</span>
        <small>${result > 0 ? `${esc(me.name)} wins` : result < 0 ? `${esc(them.name)} wins` : "Dead even"} · power ${pct(me.build)} vs ${pct(them.build)} · stats ${wins}–${losses}</small></div>
      <div class="xm-actions xm-late" style="--i:${rows.length + 1}">
        ${friend ? `<button type="button" class="btn btn-straw" data-a="back">Send ${esc(them.name)} your fighter</button>` : `<button type="button" class="btn btn-straw" data-a="again">Next rival</button>`}
        <button type="button" class="btn" data-a="share">Share result</button><button type="button" class="btn btn-ghost" data-a="build">New fighter</button></div>`;
    // running score as each row lands
    let sm = 0, st = 0;
    rows.forEach((r, i) => setTimeout(() => {
      if (!b.isConnected) return;
      if (r.win > 0) sm++; else if (r.win < 0) st++;
      const m = b.querySelector('[data-sc="me"]'), t = b.querySelector('[data-sc="them"]');
      if (m) m.textContent = sm; if (t) t.textContent = st;
      sound(r.win > 0 ? "click" : "tick");
    }, (i + 1) * STEP));
    setTimeout(() => { sound(result > 0 ? "fanfare" : result < 0 ? "bad" : "stamp"); if (result > 0) confetti(b.querySelector(".xm-verdict")); }, rows.length * STEP + 300);
    track("fight", { mode: friend ? "friend" : "random", value: Math.round(pa), detail: `${result > 0 ? "win" : result < 0 ? "loss" : "draw"}:${STATS.map(s => me.build[s.id]).join(",")}`.slice(0, 900) });
    const act = a => b.querySelector(`[data-a="${a}"]`);
    if (friend) act("back").addEventListener("click", () => shareText(`I took your 1v1 on One Pieces (${result > 0 ? "I won" : result < 0 ? "you won" : "draw"}). Now fight mine: ${fightLink(me)}`));
    else act("again").addEventListener("click", () => fight(me, randomRival(FB ? FB.level : "famous"), false));
    act("share").addEventListener("click", () => shareText(`One Pieces 1v1: ${me.name} vs ${them.name}, ${result > 0 ? `${me.name} wins` : result < 0 ? `${them.name} wins` : "draw"} (${pct(me.build)}–${pct(them.build)})\n` +
      rows.map(r => `${r.s.name}: ${r.a ? r.a.name : "—"} ${r.va} vs ${r.vb} ${r.c ? r.c.name : "—"}`).join("\n") + `\nFight me: ${fightLink(me)}`));
    act("build").addEventListener("click", () => fighterSetup(null));
    top();
  }
  function confetti(el) {
    if (!el || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    const cols = ["#ffd36b", "#ff5a46", "#6fe3ff", "#5fd35a", "#f4ecd8"];
    for (let i = 0; i < 36; i++) {
      const p = document.createElement("i"); p.className = "xm-conf";
      p.style.cssText = `left:${50 + (Math.random() - 0.5) * 30}%;background:${cols[i % cols.length]};--dx:${(Math.random() - 0.5) * 340}px;--dy:${-80 - Math.random() * 160}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 120}ms`;
      el.appendChild(p); setTimeout(() => p.remove(), 1600);
    }
  }

  // ================= SUGGESTIONS & BUG REPORTS =================
  function feedback() {
    const b = openPanel("feedback", "SUGGESTIONS & BUGS", "Tell me anything");
    const today = new Date().toISOString().slice(0, 10), sent = store.get(`fb:${today}`, 0);
    let kind = "idea";
    b.innerHTML = `<div class="xm-letter"><p class="xm-lede">Found a bug, a wrong answer, or have an idea for the game? Send it here. <b>I read every single one, every day.</b></p>
      ${seg("kind", [["idea", "Idea"], ["bug", "Bug"], ["answer", "Wrong answer"], ["other", "Something else"]], kind)}
      <label class="xm-field"><span class="sr-only">Your message</span><textarea id="fbText" maxlength="1000" rows="6" placeholder="What happened, or what would make it better?"></textarea></label>
      <p class="xm-hint">No name or email needed. If it's about a prompt, say which one. ${sent >= 5 ? "<b>That's the limit for today. Thanks for all of them!</b>" : ""}</p>
      <button type="button" class="btn btn-straw xm-cta" ${sent >= 5 ? "disabled" : ""}>Send</button></div>`;
    wire(b, "kind", v => { kind = v; });
    const ta = b.querySelector("#fbText"), btn = b.querySelector(".xm-cta");
    setTimeout(() => ta.focus({ preventScroll: true }), 40);
    btn.addEventListener("click", () => {
      const msg = ta.value.trim();
      if (msg.length < 3) { ta.focus(); toast("Write a few words first."); return; }
      track("feedback", { mode: kind, detail: msg.slice(0, 1000), value: (document.getElementById("app") || {}).dataset ? document.getElementById("app").dataset.screen : "" });
      store.set(`fb:${today}`, sent + 1);
      sound("stamp");
      b.innerHTML = `<div class="xm-letter sent"><p class="xm-banner">Message in a bottle sent!</p><p class="xm-lede">Thank you. I'll read it today.</p>
        <div class="xm-actions"><button type="button" class="btn btn-straw" data-a="more">Send another</button><button type="button" class="btn btn-ghost" data-a="port">Back to port</button></div></div>`;
      b.querySelector('[data-a="more"]').addEventListener("click", feedback);
      b.querySelector('[data-a="port"]').addEventListener("click", close);
    });
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
  window.Extras = { modes: MODES, open, feedback, rate, STATS };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fromLink); else setTimeout(fromLink, 0);
})();
