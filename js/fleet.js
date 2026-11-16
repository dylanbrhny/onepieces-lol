// The Shipyard: ships you unlock by playing, then pick to sail in. The art is in data/ships_art.js
// (tools/make_ships.py). Progress is kept in this browser (localStorage "<storageKey>:fleet").
//
// app.js calls:  Fleet.init(cfg, { seen, chart })     once, after the chart exists
//                Fleet.record({ type: "answer", tier, points })   after every scored prompt
//                Fleet.record({ type: "voyage", mode })            when a daily voyage or Endless run ends
// Ships past the player's spoiler filter show as a black silhouette named "???".
(function (root) {
  "use strict";
  const ART = root.SHIP_ART || { palette: {}, ships: {} };
  const SP = root.SPRITES;
  if (SP && SP.palette) for (const [k, v] of Object.entries(ART.palette)) if (!SP.palette[k]) SP.palette[k] = v;

  // stat: what counts. nmi = nautical miles sailed in all modes; voyages = daily voyages finished;
  // kings / emperors = Pirate King answers / Emperor-or-better answers; sunk = Endless runs that sank;
  // days = different days played. ep / ch = first episode / chapter (spoiler filter).
  const SHIPS = [
    { id: "going-merry",     name: "Going Merry",     stat: "nmi",      need: 3000,   ep: 17,   ch: 41,   how: "Sail 3,000 nmi" },
    { id: "marine-warship",  name: "Marine Warship",  stat: "voyages",  need: 1,      ep: 1,    ch: 1,    how: "Finish a daily voyage" },
    { id: "coffin-boat",     name: "Coffin Boat",     stat: "kings",    need: 1,      ep: 23,   ch: 49,   how: "Find a Pirate King answer" },
    { id: "sexy-foxy",       name: "Sexy Foxy",       stat: "emperors", need: 10,     ep: 207,  ch: 304,  how: "Find 10 Emperor or Pirate King answers" },
    { id: "thriller-bark",   name: "Thriller Bark",   stat: "days",     need: 5,      ep: 338,  ch: 443,  how: "Play on 5 different days" },
    { id: "flying-dutchman", name: "Flying Dutchman", stat: "sunk",     need: 1,      ep: 525,  ch: 606,  how: "Sink in an Endless Voyage" },
    { id: "thousand-sunny",  name: "Thousand Sunny",  stat: "nmi",      need: 25000,  ep: 321,  ch: 436,  how: "Sail 25,000 nmi" },
    { id: "saber-of-xebec",  name: "Saber of Xebec",  stat: "nmi",      need: 100000, ep: 1156, ch: 1126, how: "Sail 100,000 nmi" }
  ].filter(s => ART.ships[s.id]);

  let cfg = null, seen = () => true, chart = null, state = null;
  const KEY = () => `${cfg.storageKey}:fleet`;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY()) || "null"); } catch (e) { return null; } };
  const save = () => { try { localStorage.setItem(KEY(), JSON.stringify(state)); } catch (e) { /* private mode */ } };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const fmt = n => Number(n).toLocaleString("en-US");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // First run: credit what this browser already played (saved daily voyages and the Endless best).
  function fromHistory() {
    const st = { nmi: 0, voyages: 0, kings: 0, emperors: 0, sunk: 0, days: [], unlocked: [], selected: "" };
    const days = new Set(), pre = `${cfg.storageKey}:`;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(pre + "day:")) continue;
        const rec = JSON.parse(localStorage.getItem(k) || "null");
        if (!rec || typeof rec.total !== "number") continue;
        st.nmi += rec.total * cfg.nmiPerPoint; st.voyages++;
        if (rec.dateKey) days.add(rec.dateKey);
        for (const r of rec.results || []) {
          if (r.tierId === "king") st.kings++;
          if (r.tierId === "king" || r.tierId === "emperor") st.emperors++;
        }
      }
      const best = JSON.parse(localStorage.getItem(pre + "endlessBest") || "0") || 0;
      if (best > 0) { st.nmi += best * cfg.nmiPerPoint; st.sunk = 1; }
    } catch (e) { /* storage blocked */ }
    st.days = [...days];
    return st;
  }

  const have = s => s.stat === "days" ? state.days.length : (state[s.stat] || 0);
  const isOpen = s => state.unlocked.includes(s.id);
  const visible = s => seen(s.ep, s.ch);

  // unlock every ship whose goal is met; returns the newly unlocked ones
  function check() {
    const fresh = [];
    for (const s of SHIPS) if (!isOpen(s) && have(s) >= s.need) { state.unlocked.push(s.id); fresh.push(s); }
    return fresh;
  }

  function record(e) {
    if (!state) return [];
    const d = today();
    if (!state.days.includes(d)) state.days.push(d);
    if (e.type === "answer") {
      state.nmi += (e.points || 0) * cfg.nmiPerPoint;
      if (e.tier === "king") state.kings++;
      if (e.tier === "king" || e.tier === "emperor") state.emperors++;
    } else if (e.type === "voyage") {
      if (e.mode === "rarefind") state.voyages++;
      if (e.mode === "endless") state.sunk++;
    }
    const fresh = check();
    save();
    if (fresh.length) updateButton();
    fresh.forEach((s, i) => setTimeout(() => toast(s), 900 + i * 2600));
    return fresh;
  }

  // ---------- drawing ----------
  function spriteCanvas(id, silhouette) {
    const rows = ART.ships[id] || [], pal = (SP && SP.palette) || {};
    const c = document.createElement("canvas");
    c.width = Math.max(...rows.map(r => r.length)); c.height = rows.length;
    const x = c.getContext("2d");
    rows.forEach((row, y) => [...row].forEach((ch, i) => {
      if (ch === "." || !pal[ch]) return;
      x.fillStyle = silhouette ? "#2b3570" : pal[ch]; x.fillRect(i, y, 1, 1);
    }));
    c.className = "ship-art"; c.setAttribute("aria-hidden", "true");
    return c;
  }

  function applyToChart() {
    if (!chart || !chart.setCustomShip) return;
    const s = SHIPS.find(x => x.id === state.selected && isOpen(x) && visible(x));
    chart.setCustomShip(s ? ART.ships[s.id] : null);
  }

  // ---------- the Shipyard ----------
  function open() {
    let box = document.getElementById("shipyard");
    if (!box) {
      box = document.createElement("div");
      box.id = "shipyard"; box.className = "wpick shipyard"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-labelledby", "shipyardTitle");
      box.addEventListener("click", ev => { if (ev.target === box) close(); });
      document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !box.hidden) close(); });
      document.body.appendChild(box);
    }
    render(box);
    box.hidden = false;
    const first = box.querySelector(".ship-card:not([disabled])");
    (first || box.querySelector(".shipyard-close")).focus();
  }
  function close() { const box = document.getElementById("shipyard"); if (box) box.hidden = true; const b = document.getElementById("shipyardBtn"); if (b) b.focus(); }

  function render(box) {
    const opened = SHIPS.filter(isOpen).length;
    box.innerHTML = `<div class="wpick-panel shipyard-panel">
      <p class="wpick-kicker">SHIPYARD · ${opened} OF ${SHIPS.length} UNLOCKED</p>
      <h2 class="wpick-title" id="shipyardTitle">Pick your ship</h2>
      <p class="shipyard-stats">${fmt(state.nmi)} nmi sailed · ${state.voyages} ${state.voyages === 1 ? "voyage" : "voyages"} · ${state.kings} Pirate King · ${state.days.length} ${state.days.length === 1 ? "day" : "days"}</p>
      <div class="ship-cards">
        <button type="button" class="ship-card" data-ship="" aria-pressed="${!state.selected}">
          <span class="ship-pic ship-pic-story"></span>
          <span class="ship-name">Story ship</span>
          <span class="ship-how">Your first ship, and the one after it as the story goes on</span>
        </button>
      </div>
      <button type="button" class="btn btn-mini shipyard-close">Back to port</button>
    </div>`;
    const cards = box.querySelector(".ship-cards");
    const story = box.querySelector(".ship-pic-story");
    if (SP && SP.merry) {               // the starter ship's art, for the "story" card
      const c = document.createElement("canvas"), rows = SP.merry.rows.filter(Boolean);
      c.width = Math.max(...rows.map(r => r.length)); c.height = rows.length;
      const x = c.getContext("2d");
      rows.forEach((row, y) => [...row].forEach((ch, i) => { if (ch !== "." && SP.palette[ch]) { x.fillStyle = SP.palette[ch]; x.fillRect(i, y, 1, 1); } }));
      c.className = "ship-art"; story.appendChild(c);
    }
    for (const s of SHIPS) {
      const show = visible(s), got = isOpen(s);
      const b = document.createElement("button");
      b.type = "button"; b.className = "ship-card" + (got ? "" : " locked"); b.dataset.ship = s.id;
      b.disabled = !got || !show;
      b.setAttribute("aria-pressed", String(state.selected === s.id));
      const pct = Math.min(100, Math.round(100 * have(s) / s.need));
      b.innerHTML = `<span class="ship-pic"></span>
        <span class="ship-name">${show ? esc(s.name) : "???"}</span>
        <span class="ship-how">${got ? (state.selected === s.id ? "Sailing" : "Unlocked") : esc(s.how)}</span>
        ${got ? "" : `<span class="ship-bar" aria-label="${pct}% there"><i style="width:${pct}%"></i></span>
        <span class="ship-left">${fmt(Math.min(have(s), s.need))} / ${fmt(s.need)}</span>`}`;
      b.querySelector(".ship-pic").appendChild(spriteCanvas(s.id, !got || !show));
      cards.appendChild(b);
    }
    cards.querySelectorAll(".ship-card").forEach(b => b.addEventListener("click", () => {
      if (b.disabled) return;
      state.selected = b.dataset.ship || ""; save(); applyToChart(); render(box);
      const again = box.querySelector(`.ship-card[data-ship="${b.dataset.ship}"]`); if (again) again.focus();
    }));
    box.querySelector(".shipyard-close").addEventListener("click", close);
  }

  function toast(s) {
    const t = document.createElement("div");
    t.className = "ship-toast"; t.setAttribute("role", "status");
    const name = visible(s) ? s.name : "a new ship";
    t.innerHTML = `<span class="ship-toast-kicker">NEW SHIP UNLOCKED</span><span class="ship-toast-name">${esc(name)}</span><span class="ship-toast-hint">Pick it in the Shipyard</span>`;
    if (visible(s)) t.prepend(spriteCanvas(s.id, false));
    document.body.appendChild(t);
    t.addEventListener("click", () => { t.remove(); open(); });
    setTimeout(() => t.classList.add("out"), 4200);
    setTimeout(() => t.remove(), 4800);
  }

  function init(c, opts = {}) {
    cfg = c; seen = opts.seen || seen; chart = opts.chart || null;
    state = load();
    if (!state) state = fromHistory();
    for (const k of ["nmi", "voyages", "kings", "emperors", "sunk"]) state[k] = Number(state[k]) || 0;
    state.days = Array.isArray(state.days) ? state.days : [];
    state.unlocked = Array.isArray(state.unlocked) ? state.unlocked : [];
    state.selected = typeof state.selected === "string" ? state.selected : "";
    check(); save(); applyToChart();
    const btn = document.getElementById("shipyardBtn");
    if (btn) { btn.hidden = !SHIPS.length; btn.addEventListener("click", open); }
    updateButton();
  }
  function updateButton() {
    const tag = document.querySelector("#shipyardBtn .shipyard-count");
    if (tag && state) tag.textContent = `${SHIPS.filter(isOpen).length}/${SHIPS.length}`;
  }

  root.Fleet = { init, record, open, ships: () => SHIPS.slice(), state: () => state && JSON.parse(JSON.stringify(state)) };
})(typeof window !== "undefined" ? window : globalThis);
