// Screens and flow: port -> at sea (prompts) -> wanted poster.
(function () {
  "use strict";
  const C = window.GAME_CONFIG, E = window.Engine;
  const $ = s => document.querySelector(s);
  const app = $("#app");
  const TIER_EMOJI = { rookie: "⬜", supernova: "🟦", warlord: "🟩", emperor: "🟧", king: "👑", wreck: "☠️", becalmed: "⏳" };
  const S_ = window.Sound || { unlock() {}, click() {}, type() {}, nope() {}, good() {}, bad() {}, timeout() {}, tick() {}, stamp() {}, tile() {}, landfall() {}, splash() {}, fanfare() {}, toggleSfx() {}, toggleMusic() {}, setScene() {}, sfxOn: false, musicOn: false };
  const tierIndex = id => C.tiers.findIndex(t => t.id === id);
  const MODE_ICONS = {
    endless: '<path d="M1 3h2v1h1v1H3v1H1V5H0V4h1zM5 3h2v1h1v1H7v1H5V5h1V4H5zM3 4h2v1H3z"/>',
    wanted: '<path d="M1 0h6v8H1zM2 1v6h4V1zM3 2h2v2H3zM3 5h2v1H3z"/>',
    higher: '<path d="M3 0h2v1h1v1h1v1H5v5H3V3H1V2h1V1h1z"/>',
    timeline: '<path d="M0 3h8v2H0zM1 1h1v6H1zM4 2h1v4H4zM7 1h1v6H7z"/>'
  };

  // ---------- storage (per browser, optional) ----------
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(`${C.storageKey}:${k}`); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(`${C.storageKey}:${k}`, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  // ---------- player settings: difficulty + spoiler filter (saved in this browser) ----------
  // Difficulty is for Endless Voyage (and the Wanted picker): easy = characters everyone knows, medium adds
  // the well-known cast, hard = every named character. The daily 7 ignore it (see DAILY below).
  const DIFF = {
    supereasy: { label: "Super Easy", note: "The most famous names, the simplest prompts and 45 seconds each. A search list opens under the answer box: type part of a name or a trait (fishman, straw hat, zoan) and pick from the pictures.",
              characters: ["easy"], prompts: ["easy"], plan: ["easy", "easy", "easy", "easy", "easy", "easy", "easy"], seconds: 45, search: true },
    easy:   { label: "Easy",   note: "Only the famous names: main characters, big islands, well-known fruits and crews. Plain prompts like “Name a giant”.", characters: ["easy"],
              prompts: ["easy"], plan: ["easy", "easy", "easy", "easy", "easy", "medium", "medium"] },
    medium: { label: "Medium", note: "Adds well-known side characters, places, ships and fruits. Some prompts mix two facts.", characters: ["easy", "medium"],
              prompts: ["easy", "medium"], plan: ["easy", "easy", "medium", "medium", "medium", "medium", "hard"] },
    hard:   { label: "Hard",   note: "Every named character, island, fruit, ship and crew. Most prompts mix facts, like “a giant with under 10 letters”.", characters: ["easy", "medium", "hard"],
              prompts: ["easy", "medium", "hard"], plan: ["medium", "medium", "hard", "hard", "hard", "hard", "hard"] },
    ...(C.difficulties || {})
  };
  const diffId = DIFF[store.get("difficulty", C.defaultDifficulty || "medium")] ? store.get("difficulty", C.defaultDifficulty || "medium") : "medium";
  // The daily 7 are the same for everyone whatever difficulty they picked: plain one-fact prompts built from
  // the famous cast, so anyone can answer. Every right answer still counts and rare ones still score as
  // deep cuts, so a Pirate King answer is always there for people who know the series.
  const DAILY = { label: "Daily", characters: ["easy"], prompts: ["easy"], maxCombos: 0,
                  plan: ["easy", "easy", "easy", "easy", "easy", "easy", "medium"], ...(C.daily || {}) };
  // prompts that ask the same thing as another one under a different name: kept out of the daily so a day
  // can't have both
  const DAILY_SKIP = new Set(["Name a character who fought Luffy", "Name a character whose fighting style is Swordsman", ...(DAILY.skip || [])]);
  // Spoiler filter: "I've watched up to <arc>" leaves out anyone who first appears later.
  const ARCS = (window.ARC_DATA || []).slice().sort((a, b) => a.last_ep - b.last_ep);
  // stored as an episode number ("I'm on episode 310"); older saves stored an arc name
  let spoilerEp = store.get("spoilerEp", null);
  if (spoilerEp == null && store.get("spoilerArc", "")) spoilerEp = (ARCS.find(a => a.arc === store.get("spoilerArc", "")) || {}).last_ep || null;
  spoilerEp = Number(spoilerEp) > 0 ? Math.round(Number(spoilerEp)) : null;
  const spoiler = spoilerEp ? (() => {
    const done = ARCS.filter(a => a.last_ep <= spoilerEp);                 // arcs fully watched
    const inArc = ARCS.find(a => a.first_ep <= spoilerEp && a.last_ep >= spoilerEp);
    return { last_ep: spoilerEp, last_ch: done.length ? Math.max(...done.map(a => a.last_ch)) : 0,
             arc: inArc && inArc.last_ep === spoilerEp ? inArc.arc : "" };
  })() : null;
  function seenBy(c) {
    if (!spoiler) return true;
    if (typeof c.first_episode === "number") return c.first_episode <= spoiler.last_ep;
    if (typeof c.first_chapter === "number") return c.first_chapter <= spoiler.last_ch;
    return false;                            // debut unknown: leave out when filtering, to be safe
  }

  // ---------- data ----------
  const allRows = window.CHARACTER_DATA || [];
  // what each character owns or leads, from the other tables (owns_named_sword, ship_names, ...)
  const CHAR_LINKS = (window.THING_LINKS || {}).character || {};
  for (const c of allRows) for (const [k, v] of Object.entries(CHAR_LINKS[c.id] || {})) if (c[k] == null || c[k] === "") c[k] = v;
  // linked lists (fought_names, ship_names...) must stay lists, not get flattened into text
  const linkLists = new Set(C.listFields);
  for (const v of Object.values(CHAR_LINKS)) for (const [k, x] of Object.entries(v)) if (Array.isArray(x)) linkLists.add(k);
  const kindCfg = list => {
    const lists = new Set(C.listFields), nums = new Set(C.numberFields);
    for (const t of list) for (const [k, v] of Object.entries(t)) { if (Array.isArray(v)) lists.add(k); else if (typeof v === "number") nums.add(k); }
    return { ...C, listFields: [...lists], numberFields: [...nums], noCombos: true };
  };
  const THING_ALL = {};                       // everything per table, to explain a spoiler-hidden name
  for (const [kind, list] of Object.entries(window.THING_DATA || {})) THING_ALL[kind] = list;
  const seenRows = allRows.filter(seenBy);

  // A "world" = the prompts, answer pools and tiers for one difficulty. Two exist: "daily" (DAILY, the
  // same for everyone) and "play" (the player's difficulty, for Endless and the settings panel).
  // Built on first use; useWorld() switches the variables the rest of the app reads.
  function buildWorld(def, mode) {
    C.poolLevels = def.characters;   // tiers cap famous answers relative to the levels in play (see tierAnswers)
    C.mode = mode;                   // whose answers set the tiers (config modeTiers)
    const rows = allRows.filter(c => def.characters.includes(c.difficulty || "hard") && seenBy(c));
    const charCfg = { ...C, listFields: [...linkLists] }, baseCfg = { ...C };
    const data = E.prepare(rows.length ? rows : allRows, charCfg);
    // Every right answer counts on every difficulty. The difficulty only picks the prompts (from its own
    // pool) and how rare each answer is; guesses are checked against everyone the spoiler filter allows,
    // so a less famous right answer on Easy scores as a deep cut instead of being turned away.
    const allData = seenRows.length === rows.length || !seenRows.length ? data : E.prepare(seenRows, charCfg);
    const { playable, tooSmall } = E.buildQuestions(data, window.QUESTION_TEMPLATES || [], window.QUESTIONS || [], C);
    // Other tables: Devil Fruits, places, weapons, ships, crews... (data/things.js). Same filters.
    // Each prompt has a "kind" saying which table its answers come from.
    const KIND_DATA = { character: data };      // the difficulty's pool: prompts are built from this
    const ANSWER_DATA = { character: allData }; // every right answer (spoiler filter only): guesses check this
    for (const [kind, list] of Object.entries(window.THING_DATA || {})) {
      const keep = list.filter(t => def.characters.includes(t.difficulty || "hard") && seenBy(t));
      if (keep.length) KIND_DATA[kind] = E.prepare(keep, kindCfg(keep));
      const seen = list.filter(seenBy);
      if (seen.length) ANSWER_DATA[kind] = seen.length === keep.length ? KIND_DATA[kind] : E.prepare(seen, kindCfg(seen));
    }
    const thingCount = Object.entries(KIND_DATA).reduce((n, [k, kd]) => n + (k === "character" ? 0 : kd.chars.length), 0);
    const dataForW = q => ANSWER_DATA[(q && q.kind) || "character"] || allData;
    {
      // templates with "labels" become one hand-written prompt per label
      const templates = [], manual = [...(window.THING_QUESTIONS || [])];
      for (const t of window.THING_TEMPLATES || []) {
        if (!t.labels) { templates.push(t); continue; }
        for (const [value, label] of Object.entries(t.labels))
          manual.push({ kind: t.kind, id: `${t.group}:${value}`, group: t.group, text: t.text.replace("{label}", label), where: [[t.field, "is", value]] });
      }
      for (const [kind, kd] of Object.entries(KIND_DATA)) {
        const mine = x => (x.kind || "character") === kind;
        const r = E.buildQuestions(kd, templates.filter(mine), manual.filter(mine), kind === "character" ? { ...charCfg, noCombos: true } : kindCfg(kd.chars));
        for (const q of r.playable) { q.kind = kind; q.id = `${kind}:${q.id}`; if (!playable.some(p => p.text === q.text)) playable.push(q); }
      }
    }
    // Re-check each prompt against every right answer, not just the difficulty's pool. Prompt difficulty and
    // which prompts are playable stay as the pool decided; answers from outside the pool sit at the rare
    // end of the tiers (config modeTiers caps still apply).
    for (const q of playable) {
      const kind = q.kind || "character", ad = dataForW(q), pool = KIND_DATA[kind] || data;
      if (ad === pool || (!q.where && !q.anyOf)) continue;
      const extra = ad.chars.filter(c => !pool.byId.has(c.id) && E.fits(c, q)).map(c => c.id);
      if (!extra.length) continue;
      q.answers = [...q.answers, ...extra];
      let cache = null;
      Object.defineProperty(q, "tierById", { get() { return cache || (cache = E.tierAnswers(q.answers, ad, kind === "character" ? charCfg : baseCfg, q)); }, configurable: true });
    }
    return { def, mode, charCfg, data, allData, playable, tooSmall, KIND_DATA, ANSWER_DATA, thingCount };
  }
  const worlds = {};
  let worldKey = null, diff, data, allData, playable, tooSmall, KIND_DATA, ANSWER_DATA, thingCount, charCfg;
  let fullData = null;   // everyone, built only when needed to explain a filtered-out name
  function useWorld(key) {
    if (key === worldKey) return;
    const w = worlds[key] || (worlds[key] = key === "daily" ? buildWorld(DAILY, "easy")
      : buildWorld(DIFF[diffId], diffId === "supereasy" ? "easy" : diffId));
    worldKey = key;
    ({ def: diff, data, allData, playable, tooSmall, KIND_DATA, ANSWER_DATA, thingCount, charCfg } = w);
    C.poolLevels = w.def.characters; C.mode = w.mode; fullData = null;
  }
  useWorld("play");
  const dataFor = q => ANSWER_DATA[(q && q.kind) || "character"] || allData;
  const nameIn = (q, id) => (dataFor(q).byId.get(id) || {}).name || id;
  const today = new Date();
  const dateKey = E.localDateKey(today);
  const dayNo = E.dayNumber(C.launchDate, today);
  // one daily voyage for everyone (only the spoiler filter gives a different one)
  const settingKey = "daily" + (spoiler ? ":" + spoiler.last_ep : "");
  // C.dailyResets { "YYYY-MM-DD": n }: bump n to let everyone replay that day's daily (saved results live in
  // each player's browser, so a new key is the only way to clear them). Streaks are kept.
  const dailyReset = (C.dailyResets || {})[dateKey];
  const dayKey = `day:${dateKey}:${settingKey}` + (dailyReset ? `:r${dailyReset}` : "");
  // The daily 7: mostly character prompts, plus `thingsPerDay` (default 2) from the other tables
  // (Devil Fruits, places, crews...), all ordered easy -> hard.
  const isThing = q => q.kind && q.kind !== "character";
  let dailyCache = null;
  const dailyQs = () => {
    if (dailyCache) return dailyCache;
    const back = worldKey;
    useWorld("daily");
    const seed = `${C.storageKey}:${dateKey}:${settingKey}`, n = C.promptsPerDay, plan = DAILY.plan.slice(0, n);
    const things = playable.filter(isThing), chars = playable.filter(q => !isThing(q) && !DAILY_SKIP.has(q.text));
    const k = Math.min(things.length ? (C.thingsPerDay ?? 2) : 0, n);
    const slots = k ? [...Array(k)].map((_, i) => Math.min(n - 1, Math.floor((i + 1) * n / (k + 1)))) : [];
    const thingPlan = slots.map(i => plan[i]), charPlan = plan.filter((_, i) => !slots.includes(i));
    const tq = E.pickQuestions(things, k, E.rng(E.hashString(seed + ":things")), { plan: thingPlan });
    const cq = E.pickQuestions(chars, n - tq.length, E.rng(E.hashString(seed)), { maxCombos: DAILY.maxCombos ?? (window.QUESTION_COMBOS || {}).perDay ?? 3, plan: charPlan });
    const out = [];
    for (let i = 0, a = 0, b = 0; i < n; i++) {
      const q = slots.includes(i) && tq[a] ? tq[a++] : cq[b++] || tq[a++];
      if (q) out.push(q);
    }
    useWorld(back);
    return (dailyCache = out);
  };

  // ---------- the voyage map: one box per arc (data/route.js), cut off by the spoiler filter ----------
  if (window.ROUTE_STOPS && window.ROUTE_STOPS.length) {
    const MERRY_LAST_EP = C.merryLastEpisode || 312;     // the Going Merry's farewell
    const shown = window.ROUTE_STOPS.filter(st => st.finale || !spoiler || !st.first_ep || st.first_ep <= spoiler.last_ep);
    const L = C.route.length || 7000;
    // Each arc's stretch of the route is as long as the arc ran (episodes), so Wano and Dressrosa are long
    // hauls and the early East Blue stops go by fast. A small floor keeps the shortest arcs visible.
    const minEps = C.route.minArcEpisodes ?? 8;
    const weight = st => st.finale ? 0 : Math.max(minEps, st.first_ep && st.last_ep ? st.last_ep - st.first_ep + 1 : 20);
    const weights = shown.map(weight), legs = weights.slice(0, -1), total = legs.reduce((a, b) => a + b, 0) || 1;
    let run = 0;
    const stops = shown.map((st, i) => { const nmi = i === shown.length - 1 ? L : Math.round(run * L / total); run += weights[i]; return { ...st, nmi }; });
    // the Sunny takes over at the first box after the Merry's last episode, unless the filter stops before it
    const sunnyStop = (!spoiler || spoiler.last_ep >= MERRY_LAST_EP) ? stops.find(st => st.first_ep && st.first_ep > MERRY_LAST_EP) : null;
    C.route = { ...C.route, length: L, boxes: true, stops, sunnyAt: sunnyStop ? sunnyStop.nmi : null };
  }
  // ---------- live answer counts from the Google Sheet (C.statsEndpoint) ----------
  // Used to nudge each prompt's order (see tierAnswers in js/engine.js). Kept for the day and
  // refreshed at most every 30 minutes, so the game never waits on Google to start.
  (function loadLiveStats() {
    if (!C.statsEndpoint) return;
    const cached = store.get("liveStats", null);
    const merge = d => { window.ANSWER_STATS = { ...(window.ANSWER_STATS || {}), ...d }; };
    if (cached && cached.day === dateKey && cached.data) merge(cached.data);
    if (cached && cached.day === dateKey && Date.now() - (cached.at || 0) < 30 * 60 * 1000) return;
    fetch(C.statsEndpoint + (C.statsEndpoint.includes("?") ? "&" : "?") + "stats=1")
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d === "object") { merge(d); store.set("liveStats", { day: dateKey, at: Date.now(), data: d }); } })
      .catch(() => { /* offline: wiki order only */ });
  })();

  const chart = new window.SeaChart($("#sea"), C);
  let burstVoiceOn = false;
  window.LogPoseDebug = { chart };   // for testing in the browser console
  chart.onBurstPhase = (phase, power) => {
    // the cutscene already played the charge and launch sounds; the map only adds the landing
    if (phase === "land" && S_.burstLand) S_.burstLand();
  };
  chart.onShipChange = what => {
    const el = $("#landfall");
    el.hidden = false;
    el.innerHTML = what === "burning" ? "<small>FAREWELL</small>OLD FRIEND" : "<small>ALL ABOARD</small>A NEW SHIP";
    el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
    clearTimeout(landfallTimer);
    landfallTimer = setTimeout(() => { el.hidden = true; }, 2400);
    if (what === "sunny") S_.fanfare(); else S_.timeout();
  };
  chart.onIsland = stop => { if (app.dataset.screen === "play" || app.dataset.screen === "wanted") landfall(stop); };
  chart.onStop = stop => paintRoute(stop);

  // ---------- route list (right side) ----------
  const routeEl = $("#route");
  if (C.route.boxes) routeEl.hidden = true;   // the box strip along the bottom of the scene is the map
  routeEl.innerHTML = "<ul>" + [...C.route.stops].reverse().map(s => `<li data-nmi="${s.nmi}">${esc(s.name.toUpperCase())}</li>`).join("") + "</ul>";
  function paintRoute(stop) {
    for (const li of routeEl.querySelectorAll("li")) {
      const n = +li.dataset.nmi;
      li.classList.toggle("passed", n < stop.nmi || (n === 0 && stop.nmi > 0));
      li.classList.toggle("here", n === stop.nmi);
    }
  }

  // ---------- sound toggles + unlock on first touch ----------
  const musicBtn = $("#musicBtn"), sfxBtn = $("#sfxBtn");
  const paintSys = () => { musicBtn.setAttribute("aria-pressed", String(!!S_.musicOn)); sfxBtn.setAttribute("aria-pressed", String(!!S_.sfxOn)); };
  musicBtn.addEventListener("click", () => { S_.toggleMusic(); paintSys(); });
  sfxBtn.addEventListener("click", () => { S_.toggleSfx(); paintSys(); });
  // volume panel: two sliders (0-100). 70 = the normal level. Moving a slider up turns that sound on.
  {
    const pop = $("#volPop"), btn = $("#volBtn");
    const rows = [["music", $("#volMusic"), $("#volMusicVal")], ["sfx", $("#volSfx"), $("#volSfxVal")]];
    const paintVol = () => rows.forEach(([kind, input, val]) => {
      const on = kind === "music" ? S_.musicOn : S_.sfxOn;
      const v = on ? Math.round(((S_.volume && S_.volume(kind)) ?? 0.7) * 100) : 0;
      input.value = v; val.textContent = v; input.style.setProperty("--fill", v + "%");
    });
    const setOpen = open => { pop.hidden = !open; btn.setAttribute("aria-expanded", String(open)); if (open) paintVol(); };
    btn.addEventListener("click", e => { e.stopPropagation(); setOpen(pop.hidden); });
    document.addEventListener("click", e => { if (!pop.hidden && !e.target.closest(".sys")) setOpen(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) { setOpen(false); btn.focus(); } });
    for (const [kind, input, val] of rows) {
      input.addEventListener("input", () => {
        const v = Number(input.value);
        val.textContent = v; input.style.setProperty("--fill", v + "%");
        const on = kind === "music" ? S_.musicOn : S_.sfxOn;
        if (v > 0) { if (S_.setVolume) S_.setVolume(kind, v / 100); if (!on) kind === "music" ? S_.toggleMusic() : S_.toggleSfx(); }
        else if (on) kind === "music" ? S_.toggleMusic() : S_.toggleSfx();
        paintSys();
      });
      if (kind === "sfx") input.addEventListener("change", () => { if (S_.sfxOn) S_.click(); });   // a blip to hear the new level
    }
    musicBtn.addEventListener("click", paintVol); sfxBtn.addEventListener("click", paintVol);
  }
  paintSys();
  const unlock = () => { S_.unlock(); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  document.addEventListener("click", e => { if (e.target.closest(".btn, .mode, .hint button")) S_.click(); });

  const fmt = n => Math.round(n).toLocaleString("en-US");
  // phones: short bounty in the score box (฿10M, ฿1.2B) so it doesn't squeeze the prompt squares
  const fmtShort = n => {
    if (window.innerWidth >= 720) return fmt(n);
    const u = [[1e9, "B"], [1e6, "M"], [1e3, "K"]].find(([v]) => n >= v);
    if (!u) return fmt(n);
    const x = n / u[0];
    return (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10) + u[1];
  };
  const charName = id => (data.byId.get(id) || {}).name || id;

  // ---------- screens ----------
  const SUNNY_AT = chart.sunnyAt;
  function show(screen) {
    // Wanted moves the ship back and forth as a hot/cold meter, so it keeps the first ship (no burn and swap)
    const wantedish = screen === "wanted" || (screen === "result" && WS && app.dataset.screen === "wanted");
    chart.sunnyAt = wantedish ? null : SUNNY_AT;
    if (wantedish) chart.onSunny = false;
    app.dataset.screen = screen;
    for (const s of ["title", "play", "wanted", "result", "debug"]) $(`#screen-${s}`).hidden = s !== screen;
    $("#hud").hidden = screen !== "play" && screen !== "wanted";
    chart.setMode(screen === "title" ? "title" : "play");
    if (S_.setScene) S_.setScene(screen);   // music: title -> harbor jig, play -> sea march, result -> wanted calypso
    window.scrollTo(0, 0);
  }

  // ---------- PORT ----------
  function renderTitle() {
    $("#logo").textContent = C.name;
    $("#tagline").textContent = C.tagline;
    document.title = C.title || C.name;
    const played = store.get(dayKey, null);
    const streak = currentStreak();
    const wStreak = wantedStreak();
    $("#voyageMeta").innerHTML = `Voyage <b>#${dayNo}</b> · Streak <b>${streak}</b>` +
      (wStreak ? ` · Wanted streak <b>${wStreak}</b>` : "") +
      (store.get("endlessBest", 0) ? ` · Endless best <b>${fmt(store.get("endlessBest", 0))}</b>` : "");

    const wrap = $("#modes");
    wrap.innerHTML = "";
    C.modes.forEach((m, i) => {
      if (i === 0) {
        const main = document.createElement("div");
        main.className = "mode mode-main";
        main.innerHTML = `<button type="button" class="btn btn-straw play-btn">${played ? "SEE TODAY'S POSTER" : `PLAY TODAY'S ${C.promptsPerDay}`}<small>${played ? `${fmt(played.total * C.nmiPerPoint)} NMI · ฿${fmt(played.total * C.bountyPerPoint)}` : "SAME 7 FOR EVERYONE"}</small></button>`;
        main.querySelector("button").addEventListener("click", () => startMode(m.id));
        wrap.appendChild(main);
        const more = document.createElement("p");
        more.className = "more-ways"; more.textContent = "MORE WAYS TO PLAY";
        wrap.appendChild(more);
        return;
      }
      if (m.id === "wanted" && m.ready) {
        // two ways in: today's poster, or unlimited practice
        const w = store.get(wKey, null), wDone = w && w.done;
        const card = document.createElement("div");
        card.className = "mode mode-split";
        card.innerHTML = `<svg class="mode-icon" viewBox="0 0 8 8" aria-hidden="true">${MODE_ICONS.wanted}</svg><span class="mode-name">${m.name}</span><span class="mode-blurb">${m.blurb}</span>` +
          `<span class="mode-tag">${wDone ? (w.won ? `Caught in ${w.guesses.length}` : "Escaped") : (w && w.guesses && w.guesses.length ? `${w.guesses.length} guessed` : "One a day")}</span>` +
          `<span class="mode-btns"><button type="button" class="btn btn-mini btn-straw" data-w="daily">${wDone ? "Poster" : "Daily"}</button><button type="button" class="btn btn-mini" data-w="practice">Practice</button></span>`;
        card.querySelector('[data-w="daily"]').addEventListener("click", () => openWantedPick(false));
        card.querySelector('[data-w="practice"]').addEventListener("click", () => openWantedPick(true));
        if (!wPool.length) card.querySelectorAll("button").forEach(x => { x.disabled = true; });
        wrap.appendChild(card);
        return;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mode";
      b.disabled = !m.ready;
      b.innerHTML = `<svg class="mode-icon" viewBox="0 0 8 8" aria-hidden="true">${MODE_ICONS[m.id] || ""}</svg><span class="mode-name">${m.name}</span><span class="mode-blurb">${m.blurb}</span><span class="mode-tag">${m.ready ? (m.id === "endless" ? `${C.endlessLives} lives` : "Play") : "In the shipyard"}</span>`;
      if (m.ready) b.addEventListener("click", () => startMode(m.id));
      wrap.appendChild(b);
    });

    renderSettings();

    $("#tierLegend").innerHTML = [...C.tiers].reverse().map(t =>
      `<li data-tier="${t.id}"><span class="sw"></span><span class="t-name tc">${t.name}</span><span class="t-pts">${fmt(t.points * C.nmiPerPoint)}</span><span>nmi · ${t.line}</span></li>`).join("") +
      `<li data-tier="becalmed"><span class="sw"></span><span class="t-name tc">${C.timeoutTier.name}</span><span class="t-pts">0</span><span>nmi · Only if time runs out. Wrong answers are turned away so you can try again.</span></li>`;

    const warn = $("#dataWarn");
    if (!data.chars.length) { warn.hidden = false; warn.textContent = "No characters loaded. Fill in data/characters.csv, then run: python3 -I tools/build_data.py"; }
    else if (playable.length < C.promptsPerDay) { warn.hidden = false; warn.textContent = `Only ${playable.length} prompts have ${C.minAnswers}+ answers. Add more characters (open index.html#debug to see what's short).`; }
    else warn.hidden = true;

    chart.setShip(0);
    show("title");
  }

  // Difficulty + spoiler filter controls on the title screen. Changing one rebuilds the game (page reload).
  function renderSettings() {
    useWorld("play");                       // the panel describes the player's difficulty (Endless)
    let box = $("#settings");
    if (!box) {
      box = document.createElement("div");
      box.id = "settings";
      box.className = "settings";
      $("#modes").after(box);
    }
    const arcOpts = ARCS.map(a => `<option value="${a.last_ep}"${spoiler && spoiler.last_ep === a.last_ep ? " selected" : ""}>Up to ${esc(a.arc.replace(/ Arc$/, ""))} (ep ${a.last_ep})</option>`).join("");
    const custom = spoiler && !ARCS.some(a => a.last_ep === spoiler.last_ep);
    box.innerHTML = `
      <div class="set-row">
        <span class="set-label" id="diffLabel">Endless difficulty</span>
        <div class="seg" role="group" aria-labelledby="diffLabel">
          ${Object.entries(DIFF).map(([id, d]) => `<button type="button" class="seg-btn" data-diff="${id}" aria-pressed="${id === diffId}">${esc(d.label)}</button>`).join("")}
        </div>
      </div>
      <p class="set-note">${esc(diff.note)} ${fmt(data.chars.length)} characters and ${fmt(thingCount)} places and things in play. Today's 7 are the same easy-going set for everyone, whatever you pick here; rare answers still sail furthest.</p>
      ${ARCS.length ? `<div class="set-row">
        <label class="set-label" for="spoilerSel">Spoilers</label>
        <select id="spoilerSel" class="set-select"><option value="">Show everything (caught up)</option>${custom ? `<option value="${spoiler.last_ep}" selected>Up to episode ${spoiler.last_ep}</option>` : ""}${arcOpts}</select>
      </div>
      <div class="set-row">
        <label class="set-label" for="spoilerEp">or episode</label>
        <input id="spoilerEp" class="set-select set-ep" type="number" min="1" max="2000" inputmode="numeric" placeholder="e.g. 310" value="${spoiler ? spoiler.last_ep : ""}">
        <button type="button" class="seg-btn" id="spoilerEpGo">Set</button>
      </div>
      <p class="set-note">${spoiler ? `Only characters, places and things that appear by episode ${spoiler.last_ep}. Facts revealed later about them (deaths, new fruits, titles) can still show up.` : "Pick the last arc you've watched to leave out characters and places you haven't reached yet."}</p>` : ""}`;
    box.querySelectorAll("[data-diff]").forEach(b => b.addEventListener("click", () => {
      if (b.dataset.diff === diffId) return;
      box.querySelectorAll("[data-diff]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      store.set("difficulty", b.dataset.diff);
      reloadHere();
    }));
    const sel = box.querySelector("#spoilerSel");
    const setEp = v => { store.set("spoilerEp", v ? Number(v) : null); store.set("spoilerArc", ""); reloadHere(); };
    if (sel) sel.addEventListener("change", () => setEp(sel.value));
    const epIn = box.querySelector("#spoilerEp"), epGo = box.querySelector("#spoilerEpGo");
    if (epGo) epGo.addEventListener("click", () => setEp(epIn.value));
    if (epIn) epIn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); setEp(epIn.value); } });
  }

  // settings changes rebuild the game with a reload; keep the page where it was so it doesn't jump
  function reloadHere() {
    try { sessionStorage.setItem("logpose-scroll", String(window.scrollY)); } catch (e) {}
    requestAnimationFrame(() => setTimeout(() => location.reload(), 0));   // let the pressed button paint first
  }

  function currentStreak() {
    let n = 0;
    const d = new Date(today);
    const playedOn = k => store.get(`played:${k}`, null) || store.get(`day:${k}`, null);
    if (!playedOn(E.localDateKey(d))) d.setDate(d.getDate() - 1);
    while (playedOn(E.localDateKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---------- AT SEA ----------
  let S = null;          // the voyage in progress
  let timer = null;

  function startMode(id) {
    if (id === "wanted") return openWantedPick(false);
    if (!playable.length) return;
    $("#hudNmiLabel").textContent = "Sailed";
    $("#hudBountyLabel").textContent = "Bounty";
    if (id === "rarefind") {
      const qs = dailyQs();
      useWorld("daily");
      const saved = store.get(dayKey, null);
      if (saved) return showResult(saved);
      S = { mode: "rarefind", qs, i: 0, results: [], total: 0 };
    } else if (id === "endless") {
      useWorld("play");
      S = { mode: "endless", qs: [], deck: [], i: 0, results: [], total: 0, lives: C.endlessLives };
    }
    chart.setShip(0);
    buildPips();
    updateHud();
    show("play");
    nextPrompt();
  }

  function endlessQuestion() {
    // about 1 in 4 Endless prompts comes from the other tables (Devil Fruits, places, crews...)
    const fitOf = pool => { const fit = pool.filter(q => diff.prompts.includes(q.difficulty)); return fit.length >= 10 ? fit : pool; };
    const fill = (key, pool) => {
      if (!S[key] || !S[key].length) S[key] = E.shuffle(fitOf(pool), Math.random);
      return S[key];
    };
    const things = playable.filter(isThing), chars = playable.filter(q => !isThing(q));
    const useThings = things.length && Math.random() < (C.thingShareEndless ?? 0.25);
    const pool = useThings ? things : chars.length ? chars : playable;
    const deck = fill(useThings ? "thingDeck" : "deck", pool);
    // Never ask the same thing twice in a row of prompts: skip anything that matches one already asked this
    // run (or, once the run is long, the last 12), and prefer a topic that isn't one of the last two.
    // If this deck has nothing fresh left, look through the whole pool before allowing a repeat.
    const asked = S.qs.filter(Boolean), recent = asked.slice(-2).map(E.topicOf);
    const fresh = (q, window, strict) => !window.some(a => E.sameQuestion(a, q)) && !(strict && recent.includes(E.topicOf(q)));
    for (const window of [asked, asked.slice(-12)]) for (const strict of [true, false]) {
      for (let i = deck.length - 1; i >= 0; i--) if (fresh(deck[i], window, strict)) return deck.splice(i, 1)[0];
      const spare = E.shuffle(fitOf(pool), Math.random).find(q => fresh(q, window, strict));
      if (spare) return spare;
    }
    return deck.pop();
  }

  function buildPips() {
    const p = $("#pips");
    p.innerHTML = "";
    if (S.mode !== "rarefind") return;
    S.qs.forEach(() => { const d = document.createElement("span"); d.className = "pip"; p.appendChild(d); });
  }
  function paintPips() {
    if (S.mode !== "rarefind") return;
    [...$("#pips").children].forEach((d, i) => {
      d.classList.toggle("now", i === S.i && !S.results[i]);
      if (S.results[i]) d.dataset.tier = S.results[i].tierId; else delete d.dataset.tier;
    });
  }
  function updateHud() {
    $("#hudNmi").textContent = `${fmt(S.total * C.nmiPerPoint)} nmi`;
    $("#hudBounty").textContent = `฿${fmtShort(S.total * C.bountyPerPoint)}`;
    $("#lives").textContent = S.mode === "endless" ? "♥".repeat(Math.max(0, S.lives)) + "♡".repeat(C.endlessLives - Math.max(0, S.lives)) : "";
    paintPips();
  }

  function nextPrompt() {
    if (S.mode === "endless") S.qs[S.i] = endlessQuestion();
    const q = S.qs[S.i];
    $("#promptNo").innerHTML = (S.mode === "rarefind" ? `PROMPT ${S.i + 1} OF ${S.qs.length}` : `PROMPT ${S.i + 1}`) +
      (DIFF[q.difficulty] ? ` · <span class="dtag d-${q.difficulty}">${q.difficulty.toUpperCase()}</span>` : "");
    $("#promptText").textContent = q.text;
    // help: an always-visible note in brackets, and a "?" with an explanation
    const h = window.hintFor ? window.hintFor(q) : { note: "", explain: "" };
    $("#promptNote").hidden = !h.note; $("#promptNote").textContent = h.note ? `(${h.note})` : "";
    const hb = $("#hintBtn"), hp = $("#hintPop");
    hb.hidden = !h.explain; hp.hidden = true; hp.textContent = h.explain; hb.setAttribute("aria-expanded", "false");
    // developer shortcut (open the game with ?dev): a button that types in a Pirate King answer
    if (/[?&]dev\b/.test(location.search)) {
      let dev = $("#devKing");
      if (!dev) {
        dev = document.createElement("button");
        dev.type = "button"; dev.id = "devKing"; dev.className = "btn btn-mini dev-king"; dev.textContent = "DEV: KING";
        hb.after(dev);
        dev.addEventListener("click", () => {
          const cq = S && S.qs[S.i];
          if (!cq) return;
          const kings = cq.answers.filter(id => cq.tierById[id] && cq.tierById[id].tier.id === "king");
          const pick = kings[Math.floor(Math.random() * kings.length)] || cq.answers[0];
          if (pick) { $("#guessInput").value = nameIn(cq, pick); $("#guessInput").focus(); }
        });
      }
    }
    $("#reveal").hidden = true;
    $("#guessForm").hidden = false;
    $("#idkRow").hidden = false; resetIdk();
    $("#hint").innerHTML = "";
    closeGuessList();
    const input = $("#guessInput");
    input.value = "";
    input.disabled = false;
    input.placeholder = ((window.THING_KINDS || {})[q.kind] || {}).placeholder || "Type a character...";
    setTimeout(() => input.focus({ preventScroll: true }), 50);
    paintPips();
    startTimer();
  }

  function startTimer() {
    stopTimer();
    const SECS = diff.seconds || C.secondsPerPrompt;
    const total = SECS * 1000, start = performance.now();
    const secs = $("#lpSecs"), lp = $("#logpose"), lpCtx = $("#lpCanvas").getContext("2d");
    let lastSec = SECS;
    const tick = () => {
      const left = Math.max(0, total - (performance.now() - start));
      const sec = Math.ceil(left / 1000);
      if (sec !== lastSec) { lastSec = sec; if (sec <= 5 && sec > 0) S_.tick(sec === 1); }
      secs.textContent = sec;
      lp.classList.toggle("low", left < 8000);
      const wobble = Math.sin(performance.now() / 260) * (left < 8000 ? 0.45 : 0.15);
      drawLogPose(lpCtx, left / total, wobble, left < 8000);
      if (left <= 0) { stopTimer(); finishPrompt(null); return; }
      timer = requestAnimationFrame(tick);
    };
    timer = requestAnimationFrame(tick);
  }
  function stopTimer() { if (timer) cancelAnimationFrame(timer); timer = null; }

  // Pirate King cutscene: "COUP DE BURST!" on the second ship, "BIG GUST!" on the first.
  // Its voice clip starts right away (still inside the click, so the browser allows sound) and the charge
  // lasts exactly as long as the clip.
  function playKingCutscene(after) {
    const second = chart.usingSecond();
    const voiceMs = S_.playClip ? S_.playClip(second ? "burstClip" : "gustClip") : 0;
    burstVoiceOn = voiceMs > 0;
    if (!burstVoiceOn && S_.burstCharge) S_.burstCharge(4);
    // gust: he breathes in for the clip's first moments (gustClip.inhale), then deflates for the rest of it
    const inhaleMs = Math.round(((C.audio || {}).gustClip || {}).inhale * 1000 || 200);
    const timing = second ? { chargeMs: voiceMs || 1800 }
      : voiceMs ? { chargeMs: inhaleMs, blastMs: Math.max(800, voiceMs - inhaleMs) } : { chargeMs: 800, blastMs: 1800 };
    window.Cutscene.play({
      kind: second ? "burst" : "gust", ship: chart.currentShipImg(),
      ...timing, introMs: voiceMs ? 0 : 450,
      onBlast: () => { S_.burstLaunch && S_.burstLaunch(4); },
      onDone: () => after && after()
    });
  }

  // ---------- developer bar (open the game with ?dev) ----------
  if (/[?&]dev\b/.test(location.search)) {
    const bar = document.createElement("div");
    bar.className = "dev-bar";
    bar.innerHTML = `<span>DEV</span>
      <button type="button" class="btn btn-mini" data-ship="first">Ship 1</button>
      <button type="button" class="btn btn-mini" data-ship="second">Ship 2</button>
      <button type="button" class="btn btn-mini" data-ship="">Auto</button>
      <button type="button" class="btn btn-mini" id="devCut">Play cutscene</button>`;
    document.body.appendChild(bar);
    const paint = () => bar.querySelectorAll("[data-ship]").forEach(b => b.setAttribute("aria-pressed", String((chart.forceShip || "") === b.dataset.ship)));
    bar.querySelectorAll("[data-ship]").forEach(b => b.addEventListener("click", () => { chart.forceShip = b.dataset.ship || null; paint(); }));
    bar.querySelector("#devCut").addEventListener("click", () => playKingCutscene());
    paint();
  }
  $("#hintBtn").addEventListener("click", () => {
    const hp = $("#hintPop"), open = hp.hidden;
    hp.hidden = !open; $("#hintBtn").setAttribute("aria-expanded", String(open));
    setTimeout(() => $("#guessInput").focus({ preventScroll: true }), 0);
  });

  // The timer as a tiny pixel-art log pose (26x26, scaled up blocky): a brass rim, 24 time segments
  // that go out one by one, a glass dome, and a needle that wobbles harder when time is short.
  function drawLogPose(x, frac, angle, low) {
    const S = 26, c = 12.5;
    x.clearRect(0, 0, S, S);
    const P = (px, py, col) => { x.fillStyle = col; x.fillRect(px, py, 1, 1); };
    const lit = Math.ceil(frac * 24);
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const dx = px - c, dy = py - c, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 12.6) continue;
      if (d > 11.4) { P(px, py, d > 12.1 ? "#5a3a14" : "#c99422"); continue; }               // brass rim
      if (d > 8.6) {                                                                           // time segments
        let a = Math.atan2(dx, -dy); if (a < 0) a += Math.PI * 2;
        const seg = Math.floor(a / (Math.PI * 2) * 24), gap = (a / (Math.PI * 2) * 24) % 1 < 0.18;
        P(px, py, gap ? "#050818" : seg < lit ? (low ? (lit <= 3 && Math.floor(performance.now() / 250) % 2 ? "#ff8a6a" : "#e0533d") : "#f1c04a") : "#1c2550");
        continue;
      }
      if (d > 7.6) { P(px, py, "#5a3a14"); continue; }                                        // inner rim
      P(px, py, (dx + dy) < -6 ? "#9fd8ee" : (dx + dy) < 2 ? "#5fa8c8" : "#3d7fa0");          // glass, lit from top-left
    }
    // needle: red half points the way, grey half behind
    for (let i = -6; i <= 6; i++) {
      const px = Math.round(c + Math.sin(angle) * i), py = Math.round(c - Math.cos(angle) * i);
      P(px, py, i > 0 ? "#e0533d" : "#d8dfe8");
      if (Math.abs(i) < 4) P(px + (i > 0 ? 0 : 0), py, i > 0 ? "#e0533d" : "#d8dfe8");
    }
    P(Math.round(c), Math.round(c), "#f4ecd8");                                                // pin
    P(8, 7, "#ffffff"); P(9, 6, "#ffffff");                                                    // glint
  }

  $("#guessForm").addEventListener("submit", e => {
    e.preventDefault();
    if (!$("#reveal").hidden || $("#guessInput").disabled) return; // already answered
    if (gActive >= 0 && gResults[gActive] && !gResults[gActive].header) { const id = gResults[gActive].id; closeGuessList(); return tryAnswer(id); }
    closeGuessList();
    const raw = $("#guessInput").value;
    if (!raw.trim()) return;
    const q = S.qs[S.i], kd = dataFor(q);
    const r = E.resolveFor(raw, kd, q);
    if (r.status === "match") return tryAnswer(r.id);
    S_.nope();
    const form = $("#guessForm");
    form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
    const hint = $("#hint");
    const offer = (label, ids) => {
      hint.textContent = label;
      ids.forEach(id => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = nameIn(q, id);
        b.addEventListener("click", () => tryAnswer(id));
        hint.appendChild(b);
      });
    };
    if (r.status === "ambiguous") return offer("Which one? ", r.ids.slice(0, 8));
    const close = E.suggestNames(raw, kd, 3);
    if (close.length) return offer("Did you mean ", close);
    // a real name that is only hidden by the spoiler filter (every difficulty accepts every right answer)
    if (spoiler) {
      const kind = q.kind || "character", list = kind === "character" ? allRows : THING_ALL[kind] || [];
      if (list.length !== kd.chars.length) {
        fullData = fullData || {};
        fullData[kind] = fullData[kind] || E.prepare(list, kind === "character" ? charCfg : kindCfg(list));
        const f = E.resolveGuess(raw, fullData[kind]);
        if (f.status === "match") {
          hint.textContent = `${fullData[kind].byId.get(f.id).name} is hidden by your spoiler filter. Try another answer.`;
          return;
        }
      }
    }
    hint.textContent = `No "${raw.trim()}" in the ship's log. Check the spelling and try again.`;
  });

  // A real character who doesn't fit is turned away (the clock keeps running); only a right answer
  // or running out of time ends the prompt. So the only 0 is no answer at all.
  function tryAnswer(id) {
    const q = S.qs[S.i];
    const res = E.scoreGuess(q, id, dataFor(q), C);
    if (res.ok) return finishPrompt(id);
    S_.nope();
    const form = $("#guessForm");
    form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
    const c = dataFor(q).byId.get(id);
    const why = res.failed ? missReason(c, res.failed) : "";
    $("#hint").textContent = `${nameIn(q, id)} doesn't fit${why ? ` (${why.replace(/^Not on record as: /, "not on record as ")})` : ""}. Pick a different answer.`;
    const input = $("#guessInput");
    input.select();
  }

  // ---------- answer log: feeds data/answer_stats.js so tiers slowly follow what players really say ----------
  // Kept in this browser (last 500) and, if C.statsEndpoint is set, sent there as plain-text JSON
  // (plain text avoids a CORS preflight, so a Google Apps Script web app works as the endpoint).
  function logAnswer(q, res) {
    const rec = { t: new Date().toISOString(), day: dateKey, prompt: q.id, kind: q.kind || "character",
                  answer: res.id || "", ok: !!res.ok, mode: S.mode, difficulty: S.mode === "rarefind" ? "daily" : diffId };
    const log = store.get("answerLog", []);
    log.push(rec);
    store.set("answerLog", log.slice(-500));
    if (C.statsEndpoint) {
      try { fetch(C.statsEndpoint, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(rec), keepalive: true }).catch(() => {}); } catch (e) { /* offline */ }
    }
  }

  // An inline "are you sure?" in place of a button: the button hides, a short question with Yes / No shows
  // where it was. No puts the button back. Used by "I don't know" and Wanted's Reveal.
  function askSure(btn, msg, yesLabel, noLabel, onYes) {
    const old = btn.parentNode.querySelector(".sure");
    if (old) old.remove();
    const box = document.createElement("div");
    box.className = "sure"; box.setAttribute("role", "alertdialog"); box.setAttribute("aria-label", msg);
    box.innerHTML = `<span class="sure-msg">${esc(msg)}</span><span class="sure-btns"><button type="button" class="btn btn-ghost" data-a="yes">${esc(yesLabel)}</button><button type="button" class="btn btn-straw" data-a="no">${esc(noLabel)}</button></span>`;
    btn.hidden = true;
    btn.after(box);
    const close = () => { box.remove(); btn.hidden = false; };
    box.querySelector('[data-a="no"]').addEventListener("click", () => { S_.click(); close(); btn.focus({ preventScroll: true }); });
    box.querySelector('[data-a="yes"]').addEventListener("click", () => { close(); onYes(); });
    box.querySelector('[data-a="no"]').focus({ preventScroll: true });
    return close;
  }
  function resetIdk() { const b = $("#idkBtn"), s = $("#idkRow .sure"); if (s) s.remove(); b.hidden = false; }
  $("#idkBtn").addEventListener("click", () => {
    if (!S || !$("#reveal").hidden) return;
    S_.click();
    const life = S.mode === "endless" ? " and it costs a life" : "";
    askSure($("#idkBtn"), `Are you sure? You'll sail 0 nmi on this one${life}.`, "Yes, skip it", "Keep trying", () => {
      if (!S || !$("#reveal").hidden) return;
      finishPrompt(null, true);
    });
  });

  function finishPrompt(id, skipped = false) {
    closeGuessList();
    resetIdk();
    $("#idkRow").hidden = true;
    stopTimer();
    $("#guessInput").disabled = true;
    const q = S.qs[S.i];
    let res;
    if (id == null) res = { ok: false, id: null, points: 0, skipped,
      tier: skipped ? { ...C.timeoutTier, name: "Passed", line: "You let this one go." } : C.timeoutTier };
    else res = E.scoreGuess(q, id, dataFor(q), C);
    S.results[S.i] = { q: q.text, qid: q.id, kind: q.kind || "character", id: res.id, name: res.id ? nameIn(q, res.id) : "", tierId: res.tier.id, tierName: res.tier.name, points: res.points };
    S.total += res.points;
    logAnswer(q, res);
    if (S.mode === "endless" && id == null) S.lives--;   // only running out of time (or "I don't know") costs a life
    updateHud();
    renderReveal(q, res);
    if (id == null) S_.timeout();
    else if (!res.ok) S_.bad();
    else { S_.good(tierIndex(res.tier.id)); S_.splash(); }
    setTimeout(() => S_.stamp(), 260);
    // how far you sail decides how flashy it is: Warlord surges, Emperor and Pirate King BURST
    const power = res.ok ? tierIndex(res.tier.id) : 0;
    const target = S.total * C.nmiPerPoint;
    if (power >= 4 && window.Cutscene) {
      // Pirate King: the Coup de Burst cutscene. The voice clip starts now (inside the click, so the browser
      // allows sound) and the rocket charges for exactly as long as it plays, then blasts off.
      playKingCutscene(() => chart.sailTo(target, null, { power, chargeMs: 0 }));
    } else {
      // Warlord and Emperor surge with speed lines; lower tiers just sail
      chart.sailTo(target, null, { power });
    }
  }
  $("#guessInput").addEventListener("input", () => { S_.type(); renderGuessList(); });

  // ---- Super Easy: a search list under the answer box, like Wanted's (names with pictures + trait groups).
  // It lists anyone who matches what you typed, right or wrong; a wrong pick is still turned away.
  const gList = $("#guessList"), gInput = $("#guessInput");
  let gResults = [], gActive = -1;
  function closeGuessList() { gList.hidden = true; gList.innerHTML = ""; gResults = []; gActive = -1; gInput.setAttribute("aria-expanded", "false"); }
  function renderGuessList() {
    if (!diff.search || !S || !$("#reveal").hidden) return closeGuessList();
    const q = S.qs[S.i], kd = dataFor(q), raw = gInput.value;
    if (!raw.trim()) return closeGuessList();
    const isChar = !q.kind || q.kind === "character";
    const names = E.searchCharacters(raw, kd, 8);
    const traits = isChar ? E.searchTraits(raw, kd, W_TRAITS, { displayNames: C.displayNames }).slice(0, 3) : [];
    gResults = traits.length ? names.slice(0, 4) : names;
    const shown = new Set(gResults.map(r => r.id));
    for (const t of traits) {
      gResults.push({ header: true, text: `${t.value} · ${t.label}`, count: t.ids.length });
      for (const id of t.ids.slice(0, 80)) if (!shown.has(id)) { shown.add(id); gResults.push({ id, via: groupLineIn(kd, id, t.field) }); }
    }
    if (!gResults.length) return closeGuessList();
    gActive = gResults.findIndex(r => !r.header);
    gList.innerHTML = gResults.map((r, i) => r.header
      ? `<li class="wgroup" role="presentation"><span>${esc(r.text)}</span><b>${r.count}</b></li>`
      : `<li role="option" id="gopt${i}" data-i="${i}" aria-selected="${i === gActive}">
          ${isChar ? `<span class="portrait wmini" data-id="${esc(r.id)}"></span>` : ""}
          <span class="wopt-name">${esc(nameIn(q, r.id))}${r.via ? `<small>${esc(r.via)}</small>` : ""}</span></li>`).join("");
    if (isChar) for (const el of gList.querySelectorAll(".wmini")) setPortrait(el, kd.byId.get(el.dataset.id));
    gList.hidden = false; gInput.setAttribute("aria-expanded", "true");
  }
  function groupLineIn(kd, id, field) {
    const c = kd.byId.get(id) || {};
    const g = E.asList(c.primary_group)[0] || E.asList(c.organizations)[0] || "";
    const r = E.asList(c.race).filter(x => x !== "Human" && x !== "Unknown")[0] || "";
    return /group|organizations/.test(field) ? (r || E.asList(c.affiliation_type)[0] || "") : g;
  }
  function moveGuess(step) {
    if (!gResults.length) return;
    let i = gActive;
    for (let k = 0; k < gResults.length; k++) { i = (i + step + gResults.length) % gResults.length; if (!gResults[i].header) { gActive = i; break; } }
    [...gList.children].forEach((li, j) => li.setAttribute("aria-selected", String(j === gActive)));
    const li = gList.children[gActive];
    if (li.offsetTop < gList.scrollTop) gList.scrollTop = li.offsetTop;
    else if (li.offsetTop + li.offsetHeight > gList.scrollTop + gList.clientHeight) gList.scrollTop = li.offsetTop + li.offsetHeight - gList.clientHeight;
  }
  gInput.addEventListener("keydown", e => {
    if (gList.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); moveGuess(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveGuess(-1); }
    else if (e.key === "Escape") closeGuessList();
  });
  gInput.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== gInput) closeGuessList(); }, 150));
  gList.addEventListener("mousedown", e => e.preventDefault());
  gList.addEventListener("click", e => {
    const li = e.target.closest("li[data-i]");
    const r = li && gResults[+li.dataset.i];
    if (r && !r.header) { S_.click(); closeGuessList(); tryAnswer(r.id); }
  });

  function renderReveal(q, res) {
    $("#guessForm").hidden = true;
    $("#hint").innerHTML = "";
    const rv = $("#reveal");
    rv.hidden = false;
    rv.dataset.tier = res.tier.id;
    const stamp = $("#stamp");
    stamp.className = "stamp tc";
    stamp.textContent = res.tier.name.toUpperCase();
    void stamp.offsetWidth;

    const c = res.id ? dataFor(q).byId.get(res.id) : null;
    setPortrait($("#portrait"), c);
    $("#answerName").textContent = c ? c.name : "No answer";
    let line = res.tier.line;
    if (c && !res.ok && res.failed) line = missReason(c, res.failed);
    $("#answerLine").textContent = line;
    $("#answerPts").innerHTML = res.points
      ? `<span class="tc">+${fmt(res.points * C.nmiPerPoint)} nmi</span> · bounty +฿${fmt(res.points * C.bountyPerPoint)}`
      : `<span class="tc">+0 nmi</span> · ${res.skipped ? "skipped" : "out of time"}, the ship holds position`;

    // No other answers are shown: the same prompt can come back another day.
    $("#others").innerHTML = "";
    $("#others").hidden = true;

    const last = S.mode === "rarefind" ? S.i >= S.qs.length - 1 : S.lives <= 0;
    const btn = $("#nextBtn");
    btn.textContent = last ? (S.mode === "endless" ? "Sunk. See your poster" : "Make port") : "Sail on";
    setTimeout(() => btn.focus({ preventScroll: true }), 60);
  }

  // One short reason a guess didn't fit, about the guessed character only (never a list of right answers).
  function missReason(c, cond) {
    const [field, op, val] = cond;
    const label = C.fieldLabels[field] || field.replace(/_/g, " ");
    const v = c[field];
    const has = Array.isArray(v) ? v.length > 0 : !(v === null || v === undefined || v === "");
    const pretty = s => String(s).replace(/_/g, " ");
    if (field === "tags") return `Not on record as: ${pretty(val)}`;
    if (op === "filled") return `${label}: none on record`;
    if (op === "empty") return `${label}: ${Array.isArray(v) ? v.slice(0, 2).join(", ") : v}`;
    if (!has) return `${label}: not on record`;
    if (Array.isArray(v)) return `${label}: ${v.slice(0, 3).join(", ")}${v.length > 3 ? "…" : ""}`;
    return `${label}: ${typeof v === "number" ? fmt(v) : v}`;
  }

  $("#nextBtn").addEventListener("click", () => {
    const last = S.mode === "rarefind" ? S.i >= S.qs.length - 1 : S.lives <= 0;
    if (last) return finishVoyage();
    S.i++;
    nextPrompt();
  });

  function setPortrait(el, c) {
    el.innerHTML = "";
    const initials = c ? c.name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w) && w.length > 1).slice(-2).map(w => w[0]).join("") : "?";
    if (c && c.image) {
      const img = new Image();
      img.alt = c.name;
      img.onerror = () => { el.innerHTML = ""; el.textContent = initials; };
      img.src = c.image;
      el.appendChild(img);
    } else el.textContent = initials;
  }

  let landfallTimer = null;
  function landfall(stop) {
    const el = $("#landfall");
    el.hidden = false;
    el.innerHTML = `<small>LANDFALL</small>${esc(stop.name.toUpperCase())}`;
    S_.landfall();
    el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
    clearTimeout(landfallTimer);
    landfallTimer = setTimeout(() => { el.hidden = true; }, 2400);
  }

  // ---------- WANTED: guess the hidden character ----------
  const W = C.wanted || { maxGuesses: 10, minFame: 0, sailByGuesses: [], columns: [] };
  const W_EMOJI = { same: "🟩", near: "🟨", diff: "🟥", unknown: "⬛" };
  const ARROW_SVG = {
    up: '<svg class="warr" viewBox="0 0 7 4" aria-label="answer is higher"><path d="M3 0h1v1h1v1h1v1h1v1H0V3h1V2h1V1h1z"/></svg>',
    down: '<svg class="warr" viewBox="0 0 7 4" aria-label="answer is lower"><path d="M0 0h7v1H6v1H5v1H4v1H3V3H2V2H1V1H0z"/></svg>'
  };
  // The poster pool follows the difficulty: Easy = only famous faces (and the search lists only them),
  // Hard = a much wider net. Each difficulty / spoiler setting has its own daily poster.
  // Wanted has its own difficulty (picked on the screen after you click Wanted), separate from the daily voyage's.
  const wDataCache = {};
  const wantedData = id => wDataCache[id] || (wDataCache[id] = id === diffId && worlds.play ? worlds.play.data
    : E.prepare(allRows.filter(c => DIFF[id].characters.includes(c.difficulty || "hard") && seenBy(c)), charCfg));
  const wPoolFor = id => E.wantedPool(wantedData(id), { ...W, minFame: (W.minFameBy || {})[id] ?? W.minFame });
  const wKeyFor = id => { const k = id + (spoiler ? ":" + spoiler.last_ep : ""); return `wanted:${dateKey}${k === "medium" ? "" : ":" + k}`; };
  const W_LEVELS = ["easy", "medium", "hard"];
  let wDiffId = W_LEVELS.includes(store.get("wantedDifficulty", "")) ? store.get("wantedDifficulty", "") : W_LEVELS.includes(diffId) ? diffId : "easy";
  let WD, wPool, wDailyId, wKey;
  function setWantedDiff(id) {
    wDiffId = id; store.set("wantedDifficulty", id);
    WD = wantedData(id); wPool = wPoolFor(id);
    const k = id + (spoiler ? ":" + spoiler.last_ep : "");
    wDailyId = E.wantedDaily(wPool, `${C.storageKey}:wanted${k === "medium" ? "" : ":" + k}`, dayNo);
    wKey = wKeyFor(id);
  }
  setWantedDiff(wDiffId);
  if (window.LogPoseDebug) window.LogPoseDebug.wantedTarget = () => WS && WS.targetId;   // for testing only
  if (window.LogPoseDebug) window.LogPoseDebug.prompts = () => playable.map(q => ({ text: q.text, kind: q.kind || "character", difficulty: q.difficulty, answers: q.answers.length, combo: !!q.combo, group: q.group }));
  // for testing only: the daily 7 for any date ("2026-11-20"), with how many answers reach each tier
  if (window.LogPoseDebug) window.LogPoseDebug.dailyFor = day => {
    const back = worldKey; useWorld("daily");
    const seed = `${C.storageKey}:${day}:${settingKey}`, n = C.promptsPerDay;
    const things = playable.filter(isThing), chars = playable.filter(q => !isThing(q) && !DAILY_SKIP.has(q.text));
    const k = Math.min(things.length ? (C.thingsPerDay ?? 2) : 0, n);
    const slots = k ? [...Array(k)].map((_, i) => Math.min(n - 1, Math.floor((i + 1) * n / (k + 1)))) : [];
    const plan = DAILY.plan.slice(0, n);
    const tq = E.pickQuestions(things, k, E.rng(E.hashString(seed + ":things")), { plan: slots.map(i => plan[i]) });
    const cq = E.pickQuestions(chars, n - tq.length, E.rng(E.hashString(seed)), { maxCombos: DAILY.maxCombos, plan: plan.filter((_, i) => !slots.includes(i)) });
    const out = [...tq, ...cq].map(q => { const t = {}; for (const id of q.answers) { const x = (q.tierById[id] || {}).tier; if (x) t[x.id] = (t[x.id] || 0) + 1; } return { text: q.text, kind: q.kind || "character", difficulty: q.difficulty, combo: !!q.combo, answers: q.answers.length, ids: q.answers, tiers: t }; });
    useWorld(back); return out;
  };
  // for testing only: the first n prompts of a fresh Endless run on the player's difficulty
  if (window.LogPoseDebug) window.LogPoseDebug.endlessSample = n => {
    const save = S, back = worldKey; useWorld("play");
    S = { mode: "endless", qs: [], i: 0 };
    for (let i = 0; i < n; i++) { S.i = i; S.qs[i] = endlessQuestion(); }
    const out = S.qs.map(q => ({ text: q.text, kind: q.kind || "character", group: q.group, ids: q.answers }));
    S = save; useWorld(back); return out;
  };
  if (window.LogPoseDebug) window.LogPoseDebug.current = () => { const q = S && S.qs && S.qs[S.i]; return q ? { text: q.text, kind: q.kind || "character", answers: q.answers.map(id => ({ id, name: nameIn(q, id), tier: (q.tierById[id] || {}).tier ? q.tierById[id].tier.id : "" })) } : null; };   // for testing / trailer capture only
  // search by trait: "fishman", "marine", "zoan", "red hair" lists everyone with it
  const W_TRAITS = W.searchFields || [["race", "Race"], ["primary_group", "Group"], ["organizations", "Group"], ["affiliation_type", "Side"],
    ["devil_fruit_types", "Fruit"], ["haki", "Haki"], ["hair_color", "Hair"], ["origin_sea", "From"], ["debut_arc", "Debut"], ["fighting_style", "Style"]];
  let WS = null;          // the hunt in progress: { practice, targetId, guesses: [ids], done, won, nmi }
  let wActive = -1, wResults = [];

  const wName = id => (WD.byId.get(id) || {}).name || id;
  // How close a guess is: matching traits count 1, partly matching ½, traits we don't know about are left out.
  // The ship sits that far along the route (up to 90%); catching them sails it the rest of the way.
  function wCloseness(id) {
    const res = E.compareCharacters(WD.byId.get(id), WD.byId.get(WS.targetId), W.columns).filter(r => r.state !== "unknown");
    const same = res.filter(r => r.state === "same").length, near = res.filter(r => r.state === "near").length;
    return { same, near, of: res.length, f: res.length ? (same + near / 2) / res.length : 0 };
  }
  const wShipAt = () => {
    if (!WS || !WS.guesses.length) return 0;
    if (WS.won) return C.route.length;
    return Math.round(wCloseness(WS.guesses[WS.guesses.length - 1]).f * 0.9 * C.route.length);
  };
  const wSail = n => n ? (W.sailByGuesses[Math.min(n, W.sailByGuesses.length) - 1] || 0) : 0;
  const wCap = () => W.maxGuesses > 0 ? W.maxGuesses : Infinity;

  // ---- difficulty picker: shown after you click Wanted (Daily or Practice) ----
  const W_PICK = {
    easy:   { head: "Famous faces", body: n => `Today's poster is one of <b>${n.pool}</b> big names, and the search only lists the <b>${n.chars}</b> best-known characters, so finding who you mean is quick.`, best: "New fans and casual watchers" },
    medium: { head: "The usual crew", body: n => `One of <b>${n.pool}</b> posters, from the main cast to well-known side characters. The search covers <b>${n.chars}</b> characters.`, best: "Anyone keeping up with the anime" },
    hard:   { head: "Deep cuts", body: n => `One of <b>${n.pool}</b> posters, including side characters most fans forget. The search covers all <b>${n.chars}</b> named characters.`, best: "Manga readers and wiki divers" }
  };
  function openWantedPick(practice) {
    let pick = document.getElementById("wpick");
    if (!pick) {
      pick = document.createElement("div");
      pick.id = "wpick"; pick.className = "wpick"; pick.setAttribute("role", "dialog"); pick.setAttribute("aria-modal", "true"); pick.setAttribute("aria-labelledby", "wpickTitle");
      document.body.appendChild(pick);
      pick.addEventListener("click", e => { if (e.target === pick) closeWantedPick(); });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && !pick.hidden) closeWantedPick(); });
    }
    const cards = W_LEVELS.map(id => {
      const n = { pool: fmt(wPoolFor(id).length), chars: fmt(wantedData(id).chars.length) }, t = W_PICK[id];
      const w = practice ? null : store.get(wKeyFor(id), null);
      const status = !w ? "" : w.done ? (w.won ? `Caught in ${w.guesses.length}` : "Escaped") : w.guesses && w.guesses.length ? `${w.guesses.length} guessed` : "";
      return `<button type="button" class="wpick-card d-${id}" data-pick="${id}" aria-pressed="${id === wDiffId}">
        <span class="wpick-top"><span class="wpick-name">${DIFF[id].label}</span>${status ? `<span class="wpick-status">${status}</span>` : ""}</span>
        <span class="wpick-head">${t.head}</span>
        <span class="wpick-body">${t.body(n)}</span>
        <span class="wpick-best">Best for: ${t.best}</span></button>`;
    }).join("");
    pick.innerHTML = `<div class="wpick-panel">
      <p class="wpick-kicker">WANTED · ${practice ? "PRACTICE" : `DAILY #${dayNo}`}</p>
      <h2 class="wpick-title" id="wpickTitle">Pick your hunt</h2>
      <div class="wpick-cards">${cards}</div>
      <p class="wpick-note">Catch them in fewer guesses to sail further. ${practice ? "Practice posters are random and unlimited." : "Each difficulty has its own daily poster."} This doesn't change the daily voyage's difficulty.</p>
      <button type="button" class="btn btn-mini wpick-back">Back to port</button></div>`;
    pick.querySelectorAll("[data-pick]").forEach(b => b.addEventListener("click", () => {
      S_.click(); closeWantedPick();
      setWantedDiff(b.dataset.pick);
      startWanted(practice);
    }));
    pick.querySelector(".wpick-back").addEventListener("click", closeWantedPick);
    pick.hidden = false;
    setTimeout(() => (pick.querySelector('[aria-pressed="true"]') || pick.querySelector("[data-pick]")).focus({ preventScroll: true }), 30);
  }
  function closeWantedPick() { const p = document.getElementById("wpick"); if (p) p.hidden = true; }

  function startWanted(practice) {
    if (!wPool.length) return;
    if (!practice) {
      const saved = store.get(wKey, null);
      if (saved && saved.done && WD.byId.has(saved.targetId)) return showResult(wantedRecord(saved));
      WS = saved && WD.byId.has(saved.targetId)
        ? { ...saved, practice: false, guesses: saved.guesses.filter(id => WD.byId.has(id)) }
        : { practice: false, targetId: wDailyId, guesses: [], done: false, won: false, dayNo, dateKey };
    } else {
      const last = WS && WS.practice ? WS.targetId : null;
      const pick = wPool.filter(id => id !== wDailyId && id !== last);
      const from = pick.length ? pick : wPool;
      WS = { practice: true, targetId: from[Math.floor(Math.random() * from.length)], guesses: [], done: false, won: false };
    }
    show("wanted");
    chart.setShip(wShipAt());
    $("#hud").hidden = false;
    $("#wantedHead").innerHTML = (WS.practice ? "WANTED · PRACTICE" : `WANTED #${dayNo}`) + ` · <span class="dtag d-${wDiffId}">${DIFF[wDiffId].label.toUpperCase()}</span>`;
    $("#wantedPrompt").textContent = WS.practice ? "Who is on this poster?" : "Who is on today's poster?";
    $("#wantedHint").textContent = "";
    $("#wantedDone").hidden = true;
    $("#wantedForm").hidden = false;
    { const sb = $("#wantedGiveUp").parentNode.querySelector(".sure"); if (sb) sb.remove(); }
    $("#wantedGiveUp").hidden = !WS.practice;
    $("#wantedBoard").style.setProperty("--cols", W.columns.length);
    const input = $("#wantedInput");
    input.value = ""; input.disabled = false;
    closeList();
    renderBoard(false);
    paintWantedHud();
    setTimeout(() => input.focus({ preventScroll: true }), 50);
  }

  function paintWantedHud() {
    const n = WS.guesses.length, cap = wCap();
    $("#hudNmiLabel").textContent = "Guesses";
    $("#hudNmi").textContent = cap === Infinity ? String(n) : `${n} / ${cap}`;
    const last = n ? wCloseness(WS.guesses[n - 1]) : null;
    $("#hudBountyLabel").textContent = "Closeness";
    const half = v => `${Math.floor(v) || (v % 1 ? "" : 0)}${v % 1 ? "½" : ""}`;
    $("#hudBounty").textContent = WS.won ? "CAUGHT" : last ? `${half(last.same + last.near / 2)} / ${last.of}` : "—";
    $("#wantedLeft").textContent = WS.done ? "" : cap === Infinity ? "" : `${cap - n} LEFT`;
    const p = $("#pips");
    p.innerHTML = "";
    if (cap !== Infinity) for (let i = 0; i < cap; i++) {
      const d = document.createElement("span");
      d.className = "pip";
      if (i < n) d.dataset.tier = WS.won && i === n - 1 ? "warlord" : "wreck";
      else if (i === n && !WS.done) d.classList.add("now");
      p.appendChild(d);
    }
  }

  // One row of tiles: the guess vs the hidden character.
  function rowHtml(id, animate) {
    const g = WD.byId.get(id), target = WD.byId.get(WS.targetId);
    const res = E.compareCharacters(g, target, W.columns);
    const win = id === WS.targetId;
    const tiles = res.map((r, i) => `<div class="wtile${animate ? "" : " still"}" data-state="${r.state}" style="--i:${i}">
        <span class="wlab">${esc(W.columns[i].label)}</span><span class="wval">${esc(r.text)}</span>${r.arrow ? ARROW_SVG[r.arrow] : ""}</div>`).join("");
    return { res, html: `<div class="wrow${win ? " win" : ""}">
      <div class="wwho"><div class="portrait wport" data-id="${esc(id)}"></div><span class="wname">${esc(g.name)}</span></div>
      <div class="wtiles">${tiles}</div></div>` };
  }
  function renderBoard(animateLatest) {
    const board = $("#wantedBoard");
    const ids = [...WS.guesses].reverse(); // newest on top
    board.innerHTML = ids.map((id, i) => rowHtml(id, animateLatest && i === 0).html).join("");
    for (const el of board.querySelectorAll(".wport")) setPortrait(el, WD.byId.get(el.dataset.id));
    $("#wantedKey").hidden = !ids.length;
  }

  function wantedGuess(id) {
    if (!WS || WS.done || !WD.byId.has(id)) return;
    const hint = $("#wantedHint");
    if (WS.guesses.includes(id)) { S_.nope(); hint.textContent = `Already guessed ${wName(id)}.`; return; }
    hint.textContent = "";
    WS.guesses.push(id);
    const n = WS.guesses.length, won = id === WS.targetId, lost = !won && n >= wCap();
    if (won || lost) { WS.done = true; WS.won = won; WS.nmi = wShipAt(); }
    if (!WS.practice) store.set(wKey, WS);

    const input = $("#wantedInput");
    input.value = "";
    closeList();
    renderBoard(true);
    paintWantedHud();
    const res = E.compareCharacters(WD.byId.get(id), WD.byId.get(WS.targetId), W.columns);
    res.forEach((r, i) => S_.tile(r.state, 0.09 * i + 0.12));
    const flipEnd = W.columns.length * 90 + 350;
    if (!WS.done) {
      setTimeout(() => input.focus({ preventScroll: true }), 30);
      setTimeout(() => { if (WS && !WS.done) chart.sailTo(wShipAt()); }, flipEnd);   // closer = further along
      return;
    }

    input.disabled = true;
    $("#wantedForm").hidden = true;
    { const sb = $("#wantedGiveUp").parentNode.querySelector(".sure"); if (sb) sb.remove(); }
    $("#wantedGiveUp").hidden = true;
    setTimeout(() => {
      const reveal = () => { showCaught(); setTimeout(() => S_.stamp(), 260); };
      if (won) { S_.good(4); S_.splash(); chart.sailTo(C.route.length, reveal, { power: 3 }); }   // all the way, then the reveal
      else { S_.bad(); chart.sailTo(WS.nmi); reveal(); }
    }, flipEnd);
  }

  function showCaught() {
    const target = WD.byId.get(WS.targetId), n = WS.guesses.length;
    const box = $("#wantedDone");
    box.hidden = false;
    box.dataset.tier = WS.won ? "king" : "wreck";
    const stamp = $("#wantedStamp");
    stamp.className = "stamp tc";
    stamp.textContent = WS.won ? "CAUGHT!" : WS.gaveUp ? "REVEALED" : "ESCAPED";
    setPortrait($("#wantedPortrait"), target);
    $("#wantedName").textContent = target.name;
    $("#wantedLine").textContent = WS.won
      ? `Caught in ${n} ${n === 1 ? "guess" : "guesses"}. The ship made it to the end of the route.`
      : (WS.gaveUp ? "Revealed. The trail went cold here." : `Got away after ${n} guesses. The trail went cold here.`);
    setTimeout(() => $("#wantedPortBtn").focus({ preventScroll: true }), 60);
  }

  // ---- search box ----
  const wList = $("#wantedList"), wInput = $("#wantedInput");
  function closeList() { wList.hidden = true; wList.innerHTML = ""; wResults = []; wActive = -1; wInput.setAttribute("aria-expanded", "false"); wInput.removeAttribute("aria-activedescendant"); }
  function renderList() {
    const q = wInput.value;
    const names = q.trim() ? E.searchCharacters(q, WD, 8) : [];
    const traits = q.trim() ? E.searchTraits(q, WD, W_TRAITS, { displayNames: C.displayNames }).slice(0, 3) : [];
    // name matches first (fewer when a trait matched), then each trait with everyone in it, most famous first
    wResults = traits.length ? names.slice(0, 4) : names;
    const shown = new Set(wResults.map(r => r.id));
    for (const t of traits) {
      wResults.push({ header: true, text: `${t.value} · ${t.label}`, count: t.ids.length });
      for (const id of t.ids.slice(0, 80)) if (!shown.has(id)) { shown.add(id); wResults.push({ id, via: groupLine(id, t.field), trait: true }); }
    }
    if (!wResults.length) {
      closeList();
      if (q.trim().length >= 3) {
        const close = E.suggestNames ? E.suggestNames(q, WD, 4) : [];
        if (close.length) { wResults = close.map(id => ({ id, via: "", fuzzy: true })); }
        else { $("#wantedHint").textContent = `No "${q.trim()}" in the ship's log.`; return; }
      } else { $("#wantedHint").textContent = ""; return; }
    }
    $("#wantedHint").textContent = "";
    wActive = wResults.findIndex(r => !r.header && !WS.guesses.includes(r.id));
    wList.innerHTML = wResults.map((r, i) => {
      if (r.header) return `<li class="wgroup" role="presentation" data-i="${i}"><span>${esc(r.text)}</span><b>${r.count}</b></li>`;
      const used = WS.guesses.includes(r.id);
      return `<li role="option" id="wopt${i}" data-i="${i}" class="${used ? "used" : ""}" aria-disabled="${used}" aria-selected="${i === wActive}">
        <span class="portrait wmini" data-id="${esc(r.id)}"></span>
        <span class="wopt-name">${esc(wName(r.id))}${r.via ? `<small>${esc(r.via)}</small>` : r.fuzzy ? "<small>did you mean?</small>" : ""}</span>
        ${used ? '<span class="wopt-tag">GUESSED</span>' : ""}</li>`;
    }).join("");
    for (const el of wList.querySelectorAll(".wmini")) setPortrait(el, WD.byId.get(el.dataset.id));
    wList.hidden = false;
    wInput.setAttribute("aria-expanded", "true");
    paintActive();
  }
  // the small line under a name in a trait list: their crew, or their race when searching a crew
  function groupLine(id, field) {
    const c = WD.byId.get(id) || {};
    const g = E.asList(c.primary_group)[0] || E.asList(c.organizations)[0] || "";
    const r = E.asList(c.race).filter(x => x !== "Human" && x !== "Unknown")[0] || "";
    return /group|organizations/.test(field) ? (r || E.asList(c.affiliation_type)[0] || "") : g;
  }
  function paintActive() {
    [...wList.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === wActive)));
    if (wActive < 0) return;
    wInput.setAttribute("aria-activedescendant", `wopt${wActive}`);
    // keep the highlighted row visible by scrolling the list only (never the page)
    const li = wList.children[wActive];
    if (li.offsetTop < wList.scrollTop) wList.scrollTop = li.offsetTop;
    else if (li.offsetTop + li.offsetHeight > wList.scrollTop + wList.clientHeight) wList.scrollTop = li.offsetTop + li.offsetHeight - wList.clientHeight;
  }
  function moveActive(step) {
    if (!wResults.length) return;
    let i = wActive;
    for (let k = 0; k < wResults.length; k++) {
      i = (i + step + wResults.length) % wResults.length;
      if (!wResults[i].header && !WS.guesses.includes(wResults[i].id)) { wActive = i; break; }
    }
    paintActive();
  }
  wInput.addEventListener("input", () => { S_.type(); renderList(); });
  wInput.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (wList.hidden) renderList(); else moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Escape") closeList();
  });
  wInput.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== wInput) closeList(); }, 150));
  wList.addEventListener("mousedown", e => e.preventDefault()); // keep focus in the box
  wList.addEventListener("click", e => {
    const li = e.target.closest("li");
    if (!li) return;
    const r = wResults[+li.dataset.i];
    if (r && !r.header && !WS.guesses.includes(r.id)) { S_.click(); wantedGuess(r.id); }
  });
  $("#wantedForm").addEventListener("submit", e => {
    e.preventDefault();
    if (!WS || WS.done) return;
    if (wActive >= 0 && wResults[wActive] && !wResults[wActive].header) return wantedGuess(wResults[wActive].id);
    const raw = wInput.value;
    if (!raw.trim()) return;
    const r = E.resolveGuess(raw, WD);
    if (r.status === "match") return wantedGuess(r.id);
    S_.nope();
    const form = $("#wantedForm");
    form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
    renderList();
  });

  $("#wantedPortBtn").addEventListener("click", () => showResult(wantedRecord(WS)));
  $("#wantedLeave").addEventListener("click", renderTitle);
  $("#wantedGiveUp").addEventListener("click", () => {
    if (!WS || WS.done) return;
    S_.click();
    askSure($("#wantedGiveUp"), "Are you sure? This shows who it is and ends the hunt.", "Yes, reveal", "Keep guessing", wantedReveal);
  });
  function wantedReveal() {
    if (!WS || WS.done) return;
    WS.done = true; WS.won = false; WS.gaveUp = true; WS.nmi = 0;
    $("#wantedForm").hidden = true; $("#wantedGiveUp").hidden = true; closeList();
    paintWantedHud(); showCaught(); S_.bad();
  }

  function wantedRecord(ws) {
    return { mode: "wanted", practice: !!ws.practice, dayNo: ws.dayNo || dayNo, targetId: ws.targetId,
      guesses: [...ws.guesses], won: !!ws.won, gaveUp: !!ws.gaveUp, nmi: ws.nmi || 0 };
  }

  // Consecutive days caught (today counts once it's done; an unplayed today doesn't break it).
  function wantedStreak() {
    let n = 0;
    const d = new Date(today);
    const rec = () => store.get(`wanted:${E.localDateKey(d)}`, null);
    if (!(rec() && rec().done)) d.setDate(d.getDate() - 1);
    while (rec() && rec().won) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function showWantedResult(rec) {
    const target = WD.byId.get(rec.targetId);
    chart.setShip(rec.nmi);
    show("result");
    if (rec.won) S_.fanfare();
    const n = rec.guesses.length;
    const poster = $("#poster");
    poster.dataset.mode = "wanted";
    setPortrait($("#posterPhoto"), target);
    const bounty = target.bounty_peak;
    poster.dataset.nobounty = bounty ? "" : "1";
    $("#posterBounty").textContent = bounty ? fmt(bounty) : "UNKNOWN";
    $("#posterVoyage").textContent = rec.practice ? "PRACTICE" : `WANTED #${rec.dayNo}`;
    const nameEl = $("#posterName");
    nameEl.value = target.name; nameEl.readOnly = true; nameEl.oninput = null;
    const streak = rec.practice ? "" : ` · streak ${wantedStreak()}`;
    $("#logReach").textContent = rec.won
      ? `Caught in ${n} of ${wCap() === Infinity ? "unlimited" : wCap()} guesses · the ship reached the end of the route${streak}`
      : `${rec.gaveUp ? "Revealed" : "Escaped"} after ${n} ${n === 1 ? "guess" : "guesses"} · the trail went cold near ${chart.lastStop(rec.nmi).name}${streak}`;
    $("#log").hidden = true;
    const mini = $("#resultBoard");
    mini.hidden = false;
    mini.innerHTML = rec.guesses.map((id, i) => {
      const res = E.compareCharacters(WD.byId.get(id), target, W.columns);
      return `<div class="wmrow"><span class="n">${i + 1}</span><span class="wsq">${res.map(r => `<i data-state="${r.state}"></i>`).join("")}</span><span class="a">${esc(wName(id))}</span></div>`;
    }).join("");
    $("#endlessBtn").hidden = true;
    const pb = $("#practiceBtn");
    pb.hidden = false;
    pb.textContent = rec.practice ? "Next poster" : "Practice";
    $("#copyBtn").onclick = () => copyText(wantedShare(rec, target));
    $("#copyFallback").hidden = true;
  }
  function wantedShare(rec, target) {
    const cap = wCap() === Infinity ? "" : `/${wCap()}`;
    const head = rec.practice ? `${C.name} · Wanted practice` : `${C.name} · Wanted #${rec.dayNo}`;
    const line = rec.won ? `Caught in ${rec.guesses.length}${cap}` : `Escaped · X${cap}`;
    const rows = rec.guesses.map(id => E.compareCharacters(WD.byId.get(id), target, W.columns).map(r => W_EMOJI[r.state]).join(""));
    return `${head}\n${line}\n${rows.join("\n")}`;
  }
  $("#practiceBtn").addEventListener("click", () => startWanted(true));

  // ---------- RESULT ----------
  function finishVoyage() {
    const rec = { mode: S.mode, total: S.total, dayNo, dateKey, results: S.results.filter(Boolean) };
    if (S.mode === "rarefind") { store.set(dayKey, rec); store.set(`played:${dateKey}`, true); }
    else if (S.total > store.get("endlessBest", 0)) store.set("endlessBest", S.total);
    showResult(rec);
  }

  // Where your score sits among typical voyages on the same 7 prompts. There's no player data yet, so
  // this simulates 3,000 players who mostly name well-known characters (picked in proportion to fame²,
  // 5% run out of time). Labelled as an estimate on screen.
  function renderCurve(rec) {
    let box = $("#curveBox");
    if (!box) {
      box = document.createElement("div"); box.id = "curveBox"; box.className = "curve";
      box.innerHTML = '<canvas id="curveCv" width="300" height="96" aria-label="How your score compares"></canvas><p class="curve-note" id="curveNote"></p>';
      $("#log").before(box);
    }
    const qs = rec.mode === "rarefind" ? rec.results.map(r => playable.find(q => q.id === r.qid)).filter(q => q && q.answers && q.answers.length) : [];
    if (qs.length < 3) { box.hidden = true; return; }
    box.hidden = false;
    const tables = qs.map(q => {
      const ids = q.answers, w = ids.map(id => Math.pow(Math.max(1, (dataFor(q).byId.get(id) || {})._fame || 1), 2)), tot = w.reduce((a, b) => a + b, 0);
      let acc = 0; return ids.map((id, i) => ({ c: (acc += w[i] / tot), p: q.tierById[id].tier.points }));
    });
    const rnd = E.rng(E.hashString("curve:" + qs.map(q => q.id).join("|")));
    const N = 3000, maxPts = C.tiers[C.tiers.length - 1].points * C.promptsPerDay, bins = new Array(71).fill(0), scores = [];
    for (let v = 0; v < N; v++) {
      let sum = 0;
      for (const t of tables) { if (rnd() < 0.05) continue; const u = rnd(); sum += (t.find(e => e.c >= u) || t[t.length - 1]).p; }
      scores.push(sum); bins[Math.min(70, Math.round(sum / maxPts * 70))]++;
    }
    const smooth = bins.map((_, i) => { let s2 = 0, k = 0; for (let j = -3; j <= 3; j++) if (bins[i + j] != null) { s2 += bins[i + j] * (4 - Math.abs(j)); k += 4 - Math.abs(j); } return s2 / k; });
    const beat = Math.round(scores.filter(x => x < rec.total).length / N * 100);
    const cv = $("#curveCv"), x = cv.getContext("2d"), Wc = cv.width, Hc = cv.height, pad = 14, base = Hc - 18;
    x.clearRect(0, 0, Wc, Hc); x.imageSmoothingEnabled = false;
    const peak = Math.max(...smooth), X = i => pad + (Wc - pad * 2) * i / 70, Y = v => base - (base - 8) * v / peak;
    for (let i = 0; i <= 70; i++) {                                    // stepped area under the curve
      const h = Math.round(base - Y(smooth[i]));
      x.fillStyle = "rgba(111,227,255,0.28)"; x.fillRect(Math.round(X(i)), base - h, Math.ceil((Wc - pad * 2) / 70) + 1, h);
      x.fillStyle = "#6fe3ff"; x.fillRect(Math.round(X(i)), base - h - 1, Math.ceil((Wc - pad * 2) / 70) + 1, 2);
    }
    x.fillStyle = "#3a4580"; x.fillRect(pad, base, Wc - pad * 2, 1);
    x.font = '8px "Press Start 2P", monospace'; x.textAlign = "center"; x.fillStyle = "#a9b1d6";
    for (let t = 0; t <= maxPts; t += maxPts / 7) { const px = Math.round(X(t / maxPts * 70)); x.fillRect(px, base, 1, 3); x.fillText(t ? `${Math.round(t * C.nmiPerPoint / 1000)}k` : "0", px, Hc - 4); }
    const yx = Math.round(X(Math.min(70, rec.total / maxPts * 70)));    // you
    x.fillStyle = "#e0533d"; x.fillRect(yx - 1, 6, 2, base - 6); x.fillRect(yx - 3, base - 3, 6, 6);
    x.fillText("YOU", Math.min(Wc - 16, Math.max(16, yx)), 6 + 6);
    $("#curveNote").textContent = `${fmt(rec.total * C.nmiPerPoint)} nmi. Better than ${beat}% of typical voyages on today's prompts (estimate, until real scores are in).`;
  }

  function showResult(rec) {
    if (rec.mode === "rarefind") dailyQs(), useWorld("daily");
    if (rec.mode === "wanted") return showWantedResult(rec);
    // undo what the Wanted poster changes
    const poster = $("#poster");
    delete poster.dataset.mode; delete poster.dataset.nobounty;
    $("#posterName").readOnly = false;
    $("#log").hidden = false; $("#resultBoard").hidden = true;
    $("#endlessBtn").hidden = false; $("#practiceBtn").hidden = true;
    chart.setShip(rec.total * C.nmiPerPoint);
    show("result");
    S_.fanfare();
    const reached = chart.lastStop(rec.total * C.nmiPerPoint);
    $("#posterBounty").textContent = fmt(rec.total * C.bountyPerPoint);
    $("#posterVoyage").textContent = rec.mode === "rarefind" ? `VOYAGE #${rec.dayNo}` : "ENDLESS VOYAGE";
    const nameEl = $("#posterName");
    nameEl.value = store.get("pirateName", "Nameless Rookie");
    nameEl.oninput = () => store.set("pirateName", nameEl.value);
    $("#logReach").textContent = `${fmt(rec.total * C.nmiPerPoint)} of ${fmt(C.route.length)} nmi · last landfall: ${reached.name}`;

    // poster photo: the rarest right answer's picture, else a jolly roger
    const order = C.tiers.map(t => t.id);
    const best = rec.results.filter(r => r.id && order.includes(r.tierId)).sort((a, b) => order.indexOf(b.tierId) - order.indexOf(a.tierId))[0];
    const photo = $("#posterPhoto");
    const bestChar = best && (best.kind || "character") === "character" && allData.byId.get(best.id);
    if (bestChar && bestChar.image) setPortrait(photo, bestChar);
    else photo.innerHTML = JOLLY_ROGER;

    try { renderCurve(rec); } catch (e) { console.warn("curve", e); const cb = $("#curveBox"); if (cb) cb.hidden = true; }
    $("#log").innerHTML = rec.results.map((r, i) => `
      <li data-tier="${r.tierId}">
        <span class="n">${i + 1}</span>
        <span class="q">${esc(r.q)}</span>
        <span class="a">${r.name ? esc(r.name) : "<em>no answer</em>"}</span>
        <span class="s tc">${r.tierName}<b>+${fmt(r.points * C.nmiPerPoint)}</b></span>
      </li>`).join("");

    $("#copyBtn").onclick = () => copyResult(rec, reached);
    $("#copyFallback").hidden = true;
  }

  function shareText(rec, reached) {
    const head = rec.mode === "rarefind" ? `${C.name} · Voyage #${rec.dayNo}` : `${C.name} · Endless voyage`;
    return `${head}\n${rec.results.map(r => TIER_EMOJI[r.tierId] || "▫️").join("")}\n` +
      `${fmt(rec.total * C.nmiPerPoint)}/${fmt(C.route.length)} nmi · ฿${fmt(rec.total * C.bountyPerPoint)}`;
  }
  function copyResult(rec, reached) { copyText(shareText(rec, reached)); }
  function copyText(text) {
    const btn = $("#copyBtn");
    const fallback = () => { const ta = $("#copyFallback"); ta.hidden = false; ta.value = text; ta.select(); btn.textContent = "Select and copy below"; };
    try {
      navigator.clipboard.writeText(text).then(() => { btn.textContent = "Copied"; setTimeout(() => btn.textContent = "Copy result", 1800); }, fallback);
    } catch (e) { fallback(); }
  }

  $("#endlessBtn").addEventListener("click", () => startMode("endless"));
  $("#portBtn").addEventListener("click", renderTitle);

  // ---------- DATA CHECK (#debug) ----------
  function renderDebug() {
    const tierName = (q, id) => q.tierById[id].tier.name;
    const el = $("#screen-debug");
    const dq = dailyQs();
    const singles = playable.filter(q => !q.combo || dq.includes(q)), combos = playable.filter(q => q.combo && !dq.includes(q));
    const COMBO_SHOWN = 2000;
    el.innerHTML = `<div class="dbg">
      <h1>Data check</h1>
      <p>${data.chars.length} characters loaded. ${playable.length} prompts are playable (${C.minAnswers}+ right answers): ${playable.length - combos.length} single-fact and ${combos.length} combinations. ${tooSmall.length} single-fact prompts are too small for now. Today's seven are marked ★.</p>
      <p><a href="#" style="color:var(--straw)">Back to port</a></p>
      <h2>Playable prompts, answers from most famous to rarest</h2>
      ${singles.map(q => `<div class="dbg-q"><h3>${dq.includes(q) ? "★ " : ""}${esc(q.text)} <small>${q.answers.length} answers · group ${esc(q.group)}</small></h3>
        <div class="dbg-a">${[...q.answers].sort((a, b) => dataFor(q).byId.get(b)._fame - dataFor(q).byId.get(a)._fame)
          .map(id => `<span data-tier="${q.tierById[id].tier.id}"><span class="tc">${esc(nameIn(q, id))}</span> · ${tierName(q, id)} · fame ${Math.round(dataFor(q).byId.get(id)._fame)}</span>`).join("")}</div></div>`).join("")}
      <h2>Combination prompts (${combos.length})</h2>
      <details><summary>Show ${Math.min(COMBO_SHOWN, combos.length)} combinations with their answer counts</summary>
        <div class="dbg-small">${combos.slice(0, COMBO_SHOWN).map(q => `<div>${q.answers.length} · ${esc(q.text)}</div>`).join("")}</div></details>
      <h2>Too small (need more characters)</h2>
      <div class="dbg-small">${tooSmall.sort((a, b) => b.answers.length - a.answers.length).map(q => `<div>${q.answers.length} · ${esc(q.text)}</div>`).join("")}</div>
    </div>`;
    show("debug");
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }

  // pixel jolly roger (16x14)
  const JOLLY_ROGER = (() => {
    const rows = [
      "kk............kk", ".kk..kkkkkk..kk.", "..kkkkkkkkkkkk..", "...kkkkkkkkkk...", "...kk..kk..kk...",
      "...kk..kk..kk...", "...kkkkkkkkkk...", "....kkk..kkk....", ".....kkkkkk.....", ".....k.kk.k.....",
      "..kkkkkkkkkkkk..", ".kk..........kk.", "kk............kk", "k..............k"];
    let r = "";
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "k") r += `<rect x="${x}" y="${y}" width="1" height="1"/>`; }));
    return `<svg viewBox="0 0 16 14" fill="#2a1a10" aria-hidden="true">${r}</svg>`;
  })();

  // keyboard: Enter on the reveal moves on
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && app.dataset.screen === "play" && !$("#reveal").hidden && document.activeElement !== $("#nextBtn")) {
      e.preventDefault(); $("#nextBtn").click();
    }
  });

  function route() { if (location.hash === "#debug") renderDebug(); else renderTitle(); }
  window.addEventListener("hashchange", route);
  route();
  // the game is ready: drop the loading screen; start at the top, or where you were if a setting changed
  let keep = null;
  try { keep = sessionStorage.getItem("logpose-scroll"); sessionStorage.removeItem("logpose-scroll"); } catch (e) {}
  window.scrollTo(0, keep ? Number(keep) || 0 : 0);
  const boot = document.getElementById("boot");
  if (boot) { boot.classList.add("gone"); setTimeout(() => boot.remove(), 160); }
})();
