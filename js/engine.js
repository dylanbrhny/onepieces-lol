// Game rules with no drawing in them: data prep, name matching, questions, scoring.
(function (root) {
  "use strict";

  // Cached: building the prompts compares the same few thousand strings millions of times.
  const NORM_CACHE = new Map();
  function norm(s) {
    const raw = String(s == null ? "" : s);
    let v = NORM_CACHE.get(raw);
    if (v === undefined) {
      v = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
      if (NORM_CACHE.size > 200000) NORM_CACHE.clear();
      NORM_CACHE.set(raw, v);
    }
    return v;
  }

  function asList(v) {
    if (Array.isArray(v)) return v.filter(x => x !== "" && x != null);
    if (v == null || v === "") return [];
    return String(v).split("|").map(s => s.trim()).filter(Boolean);
  }

  function isEmpty(v) { return v == null || v === "" || (Array.isArray(v) && v.length === 0); }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, cur] = [cur, prev];
    }
    return prev[n];
  }

  // ---------- data ----------
  function prepare(rows, cfg) {
    const listF = new Set(cfg.listFields), numF = new Set(cfg.numberFields);
    const chars = rows.map(r => {
      const c = {};
      for (const k of Object.keys(r)) {
        if (listF.has(k)) c[k] = asList(r[k]);
        else if (numF.has(k)) c[k] = (r[k] === "" || r[k] == null || isNaN(+r[k])) ? null : +r[k];
        else c[k] = r[k] == null ? "" : String(r[k]).trim();
      }
      return c;
    });
    // fame: manual fame > appearances (log scaled) > 50
    const maxApp = Math.max(1, ...chars.map(c => c.appearances || 0));
    for (const c of chars) {
      if (c.fame != null) c._fame = c.fame;
      else if (c.appearances) c._fame = 100 * Math.log(1 + c.appearances) / Math.log(1 + maxApp);
      else c._fame = 50;
    }
    for (const c of chars) derive(c);
    const byId = new Map(chars.map(c => [c.id, c]));
    const index = buildNameIndex(chars);
    return { chars, byId, index };
  }

  // ---------- facts the game works out itself (nobody types these) ----------
  // A column you fill in yourself always wins over the worked-out value.
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  // [month, last day of the sign, sign]
  const ZODIAC = [[1, 19, "Capricorn"], [2, 18, "Aquarius"], [3, 20, "Pisces"], [4, 19, "Aries"], [5, 20, "Taurus"], [6, 20, "Gemini"],
    [7, 22, "Cancer"], [8, 22, "Leo"], [9, 22, "Virgo"], [10, 22, "Libra"], [11, 21, "Scorpio"], [12, 21, "Sagittarius"], [12, 31, "Capricorn"]];
  function derive(c) {
    const set = (k, v) => { if (isEmpty(c[k]) && !isEmpty(v)) c[k] = v; };
    const name = String(c.name || "");
    const words = name.split(/\s+/).filter(w => w && !/^d\.?$/i.test(w) && !/^mr\.?$/i.test(w) && /[a-z0-9]/i.test(w));
    set("name_initials", [...new Set(words.map(w => w.replace(/^[^a-z0-9]+/i, "")[0].toUpperCase()).filter(ch => /[A-Z]/.test(ch)))]);
    const letters = norm(name).replace(/[^a-z]/g, "");
    set("name_letters", [...new Set(letters.toUpperCase())].filter(ch => "JKQVWXYZ".includes(ch)));
    if (c.name_words == null || c.name_words === "") c.name_words = words.length;
    if ([name, ...asList(c.aliases)].some(n => /(^|\s)D\.(\s|$)/.test(n))) set("will_of_d", "yes");
    if (/\d/.test(name)) set("name_has_number", "yes");
    if (/([a-z])\1/.test(letters)) set("name_double_letter", "yes");
    if (c.name_length == null || c.name_length === "") c.name_length = letters.length;   // letters only, spaces/dots skipped
    const m = /^(\d{1,2})-(\d{1,2})$/.exec(String(c.birthday || "").trim());
    if (m) {
      const mo = +m[1], day = +m[2];
      if (mo >= 1 && mo <= 12) {
        set("birth_month", MONTHS[mo - 1]);
        set("zodiac", ZODIAC.find(([zm, zd]) => mo < zm || (mo === zm && day <= zd))[2]);
      }
    }
  }

  // Every way to type a character's name -> list of ids.
  // Full name, aliases, and any single name word (3+ letters) that only one character has.
  function buildNameIndex(chars) {
    const index = new Map();
    const add = (key, id) => {
      if (!key) return;
      if (!index.has(key)) index.set(key, new Set());
      index.get(key).add(id);
    };
    const tokenOwners = new Map();
    for (const c of chars) {
      const names = [c.name, ...asList(c.aliases)];
      for (const n of names) {
        const k = norm(n);
        add(k, c.id);
        add(k.replace(/\b(d|the|of)\b/g, " ").replace(/\s+/g, " ").trim(), c.id);
        for (const tok of k.split(" ")) {
          if (tok.length < 3 || tok === "the") continue;
          if (!tokenOwners.has(tok)) tokenOwners.set(tok, new Set());
          tokenOwners.get(tok).add(c.id);
        }
      }
    }
    // Single words: unique ones match outright, a few sharing one ("monkey") ask which you meant.
    // Generic words ("sword", "pirates", "fruit") and words shared by many names never count alone,
    // or typing "Sword" for a named weapon would offer a list of every weapon with Sword in its name.
    for (const [tok, owners] of tokenOwners) {
      if (index.has(tok) || GENERIC_WORDS.has(tok) || owners.size > 4) continue;
      owners.forEach(id => add(tok, id));
    }
    return index;
  }
  const GENERIC_WORDS = new Set(("sword swords blade blades katana gun guns pistol rifle cannon cannons spear staff " +
    "whip bow axe hammer knife dagger club weapon weapons ship ships boat pirates pirate crew crews fleet " +
    "fruit fruits island islands kingdom village town city country mountain sea ocean family army navy " +
    "marine marines company group alliance guild captain king queen prince princess god man men woman " +
    "giant giants model and mr miss").split(" "));

  // -> { status: "match", id } | { status: "ambiguous", ids } | { status: "unknown" }
  function resolveGuess(input, data) {
    const k = norm(input);
    if (!k || GENERIC_WORDS.has(k)) return { status: "unknown" };
    const exact = data.index.get(k) || data.index.get(k.replace(/\b(d|the|of)\b/g, " ").replace(/\s+/g, " ").trim());
    if (exact) {
      if (exact.size === 1) return { status: "match", id: [...exact][0] };
      // typed someone's real full name (not just an alias another character also uses): that person
      const own = [...exact].filter(id => norm(data.byId.get(id).name) === k);
      if (own.length === 1) return { status: "match", id: own[0] };
      return { status: "ambiguous", ids: [...exact] };
    }
    const allowed = k.length <= 4 ? 0 : k.length <= 8 ? 1 : 2;
    let best = Infinity, hits = new Set();
    if (allowed) for (const [key, ids] of data.index) {
      if (Math.abs(key.length - k.length) > allowed) continue;
      const d = levenshtein(k, key);
      if (d > allowed) continue;
      if (d < best) { best = d; hits = new Set(ids); }
      else if (d === best) ids.forEach(id => hits.add(id));
    }
    if (!hits.size) {
      // sounds the same once spelling quirks are flattened (kidd/kid, luffi/luffy, zolo/zoro stays separate)
      const sk = soundKey(k), sound = new Set();
      // only auto-accept when it's also at most 1 letter off; anything further is left to "Did you mean"
      for (const [key, ids] of data.index) if (soundKey(key) === sk && levenshtein(k, key) <= 1) ids.forEach(id => sound.add(id));
      if (sound.size === 1) return { status: "match", id: [...sound][0] };
      return { status: "unknown" };
    }
    return hits.size === 1 ? { status: "match", id: [...hits][0] } : { status: "ambiguous", ids: [...hits] };
  }

  // resolveGuess, but the prompt breaks ties: when a name could mean several things (an alias that is
  // also someone else's name, "Inu Inu no Mi" for every Inu Inu model, a shared first name) and only one
  // of them is a right answer, that's the one; when several are, only the right ones are offered.
  function resolveFor(input, data, q) {
    const r = resolveGuess(input, data);
    if (!q || r.status === "unknown") return r;
    const right = id => (q.answers || []).includes(id);
    if (r.status === "match" && right(r.id)) return r;
    const k = norm(input);
    const keyIds = [...(data.index.get(k) || data.index.get(k.replace(/\b(d|the|of)\b/g, " ").replace(/\s+/g, " ").trim()) || [])];
    const ids = r.status === "ambiguous" ? [...new Set([...keyIds, ...r.ids])] : keyIds;
    const fitting = ids.filter(right).sort((a, b) => (data.byId.get(b)._fame || 0) - (data.byId.get(a)._fame || 0));
    if (fitting.length === 1) return { status: "match", id: fitting[0] };
    if (fitting.length > 1) return { status: "ambiguous", ids: fitting };
    return r;
  }

  // Flatten spelling that sounds alike: doubled letters, ph/f, ck/k, c/k/s, z/s, y/i.
  function soundKey(s) {
    return norm(s)
      .replace(/ph/g, "f").replace(/ck/g, "k").replace(/q/g, "k")
      .replace(/c(?=[aou]|$|\s)/g, "k").replace(/c/g, "s").replace(/z/g, "s")
      .replace(/y/g, "i").replace(/ee/g, "i").replace(/oo/g, "u")
      .replace(/([a-z])\1+/g, "$1");
  }

  // "Did you mean...?" for a guess that didn't match. Ranks every name, alias and unique name word by
  // closeness: start of the name > inside the name > edit distance (on spelling or on sound).
  // -> [id, ...] best first, at most `limit`, ties go to the more famous character.
  function suggestNames(input, data, limit = 3) {
    const k = norm(input);
    if (k.length < 2 || GENERIC_WORDS.has(k)) return [];
    const sk = soundKey(k), best = new Map();
    for (const [key, ids] of data.index) {
      let score = Infinity;
      if (k.length >= 3 && key.startsWith(k)) score = 0.1;
      else if (k.length >= 4 && key.includes(k)) score = 0.2;
      else {
        const len = Math.max(k.length, key.length), skey = soundKey(key);
        if (Math.abs(key.length - k.length) > len * 0.5) continue;
        if (skey[0] !== sk[0]) continue; // typos almost never change the first sound
        // strict: a suggestion must be a real near-miss of a name, not a few shared letters
        if (k.length < 5) continue;
        const d = levenshtein(k, key) / len;
        const sd = levenshtein(sk, skey) / Math.max(sk.length, skey.length, 1);
        score = Math.min(d, sd);
      }
      if (score > 0.25) continue;
      for (const id of ids) if (!best.has(id) || score < best.get(id)) best.set(id, score);
    }
    return [...best].sort((a, b) => a[1] - b[1] || data.byId.get(b[0])._fame - data.byId.get(a[0])._fame)
      .slice(0, limit).map(([id]) => id);
  }

  // ---------- conditions ----------
  function testCond(c, [field, op, val]) {
    const v = c[field];
    const items = Array.isArray(v) ? v : (isEmpty(v) ? [] : [v]);
    switch (op) {
      case "is": return items.some(x => norm(x) === norm(val));
      case "isNot": return !items.some(x => norm(x) === norm(val)) && items.length > 0;
      case "contains": return items.some(x => norm(x).includes(norm(val)));
      case "filled": return !isEmpty(v);
      case "empty": return isEmpty(v);
      case "gt": return typeof v === "number" && v > val;
      case "gte": return typeof v === "number" && v >= val;
      case "lt": return typeof v === "number" && v < val;
      case "lte": return typeof v === "number" && v <= val;
      case "between": return typeof v === "number" && v >= val[0] && v <= val[1];
      case "countGte": return items.length >= val;
      case "in": { const set = val._set || Object.defineProperty(val, "_set", { value: new Set(val) })._set; return items.some(x => set.has(x)); }
      default: throw new Error("Unknown operator " + op);
    }
  }
  function fits(c, q) {
    if (q.where && !q.where.every(cond => testCond(c, cond))) return false;
    if (q.anyOf && !q.anyOf.some(group => group.every(cond => testCond(c, cond)))) return false;
    return true;
  }
  function failedCondition(c, q) {
    if (q.where) for (const cond of q.where) if (!testCond(c, cond)) return cond;
    if (q.anyOf) return q.anyOf[0][0];
    return null;
  }

  // ---------- questions ----------
  function article(word) { return /^[aeiou]/i.test(word) ? "an" : "a"; }

  function buildQuestions(data, templates, manual, cfg) {
    const out = [];
    for (const t of templates) {
      const values = new Map();
      for (const c of data.chars) for (const v of asList(c[t.field])) {
        const k = norm(v);
        if (!values.has(k)) values.set(k, v);
      }
      // A template with "catalog" takes each prompt from a lookup table (data/tags.csv -> window.TAG_CATALOG)
      // instead of a pattern; values missing from the table are skipped.
      const catalog = t.catalog ? (root[t.catalog] || {}) : null;
      for (const [k, v] of values) {
        if ((t.skip || []).some(s => norm(s) === k)) continue;
        let text = t.text, group = t.group || t.field;
        if (catalog) {
          const entry = catalog[k.replace(/ /g, "_")] || catalog[v];
          if (!entry || !entry.prompt) continue;
          text = entry.prompt; group = entry.group ? `${t.field}:${entry.group}` : group;
        }
        out.push({
          id: `${t.field}:${k.replace(/ /g, "-")}`,
          group,
          // displayNames (config) shows other names too, e.g. "Four Emperors (Yonko)"
          text: text.replace("{a}", article(v)).replace("{value}", (cfg.displayNames && cfg.displayNames[v]) || v).replace("{lower}", String(v).toLowerCase()),
          where: [[t.field, "is", v]],
          ...(t.easyAt ? { easyAt: t.easyAt } : {})
        });
      }
    }
    for (const q of manual) out.push({ ...q, group: q.group || q.id });
    // de-dupe by text, attach answers, keep the playable ones
    const seen = new Set(), playable = [], tooSmall = [];
    for (const q of out) {
      if (seen.has(q.text)) continue;
      seen.add(q.text);
      q.answers = data.chars.filter(c => fits(c, q)).map(c => c.id);
      (q.answers.length >= (q.minAnswers || cfg.minAnswers) ? playable : tooSmall).push(q);
    }
    // Combinations ("Name a Marine who smokes") arrive with answers already worked out; only playable ones are kept.
    // cfg.noCombos: tables other than characters have no subject x clause combinations
    const combos = cfg.noCombos ? { list: [], candidates: [] } : comboQuestions(data, root.QUESTION_COMBOS, cfg);
    for (const q of combos.list) if (!seen.has(q.text)) { seen.add(q.text); playable.push(q); }
    // How hard a prompt is: lots of right answers = easy; few answers, two conditions or
    // name/letter puzzles = hard. A prompt can set difficulty: "easy" | "medium" | "hard" itself.
    for (const q of playable) if (!q.difficulty) q.difficulty = rateDifficulty(q, data);
    // tiers are worked out the first time a prompt is actually used
    for (const q of playable) {
      let cache = null;
      Object.defineProperty(q, "tierById", { get() { return cache || (cache = tierAnswers(q.answers, data, cfg, q)); }, configurable: true });
    }
    return { playable, tooSmall, comboCandidates: combos.candidates };
  }

  const NAME_FIELDS = /^name_|^will_of_d$/;
  function rateDifficulty(q, data) {
    const n = q.answers.length;
    const conds = [...(q.where || []), ...((q.anyOf || [])[0] || [])];
    const wordy = conds.some(([f]) => NAME_FIELDS.test(f)) || /letter|initial/i.test(q.text);
    let level = n >= 40 ? 0 : n >= 15 ? 1 : 2;
    // identity prompts ("Name a member of the Straw Hat Pirates") are easy once enough WELL-KNOWN
    // (difficulty "easy") characters can answer, even if the group is small. Counting every answer
    // would make any crew with 6 obscure members easy on the medium and hard settings.
    if (q.easyAt && data) {
      const known = q.answers.filter(id => ((data.byId.get(id) || {}).difficulty || "hard") === "easy").length;
      if (known >= q.easyAt) level = 0;
    }
    if (q.combo || conds.length >= 2) level += 1;
    if (wordy) level += 1;
    return ["easy", "medium", "hard"][Math.min(2, level)];
  }

  // subject x clause -> "Name a Marine who smokes". See QUESTION_COMBOS in js/questions.js.
  function comboQuestions(data, spec, cfg, opts = {}) {
    if (!spec || !spec.subjects || !spec.clauses) return { list: [], candidates: 0 };
    const catalog = root.TAG_CATALOG || {};
    const fill = (text, v) => text.replace("{a}", article(String(v))).replace("{value}", v).replace("{lower}", String(v).toLowerCase());
    function expand(part) {
      const res = [];
      const add = (text, where, key, group) => {
        const ids = new Set();
        for (const c of data.chars) if (where.every(cd => testCond(c, cd))) ids.add(c.id);
        if (ids.size) res.push({ text, where, key, group, field: part.field || key, ids });
      };
      if (part.where) { add(part.text, part.where, part.id || part.text, part.group || part.id || part.text); return res; }
      const values = new Map();
      for (const c of data.chars) for (const v of asList(c[part.field])) { const k = norm(v); if (!values.has(k)) values.set(k, v); }
      for (const [k, v] of values) {
        if ((part.skip || []).some(s => norm(s) === k)) continue;
        let text;
        if (part.fromTags) {
          const e = catalog[k.replace(/ /g, "_")] || catalog[v];
          const m = e && e.prompt && /^Name an? character (.+)$/i.exec(e.prompt);
          if (!m) continue;
          text = m[1];
        } else if (part.labels) {
          text = part.labels[v];
          if (!text) continue;
        } else text = fill(part.text, v);
        add(text, [[part.field, "is", v]], `${part.field}:${k.replace(/ /g, "-")}`, part.group || part.field);
      }
      return res;
    }
    const subjects = spec.subjects.flatMap(expand), clauses = spec.clauses.flatMap(expand);
    const min = spec.minAnswers || cfg.minAnswers, list = [];
    for (const s of subjects) for (const c of clauses) {
      if (s.field === c.field) continue;
      const [small, big] = s.ids.size < c.ids.size ? [s.ids, c.ids] : [c.ids, s.ids];
      const answers = [];
      for (const id of small) if (big.has(id)) answers.push(id);
      if (answers.length === s.ids.size) continue;            // the clause adds nothing
      if (answers.length < min && !opts.includeSmall) continue; // too few (kept when listing everything)
      list.push({
        id: `combo:${s.key}+${c.key}`, group: `combo:${c.group}`, combo: true,
        text: `Name ${s.text} ${c.text}`, where: [...s.where, ...c.where], answers
      });
    }
    return { list, candidates: subjects.length * clauses.length };
  }

  // Rank valid answers by fame. rarity = share of answers more famous than you.
  // Krillion-style tiers by how many PLAYERS would say an answer (not by position on the list).
  // Each answer gets a share of players: from wiki fame at first (famous answers soak up most players),
  // blended with real answer counts once a prompt has been played (window.ANSWER_STATS).
  // Answers are sorted most-said first and the tiers cut that pile by cumulative share:
  // the obvious few that most players give are Rookie; only the rare tail reaches Emperor / Pirate King.
  function answerShares(ids, data, cfg, q) {
    const mode = (cfg.modeTiers || {})[cfg.mode] || {};
    const tau = mode.popularityTemp ?? cfg.popularityTemp ?? 12;  // lower = famous answers hog more players
    const fame = id => data.byId.get(id)._fame || 0;
    const top = Math.max(...ids.map(fame));
    // answers from outside this difficulty's pool (a medium-level crew on Easy) are ones this crowd rarely
    // knows: they get a small slice of players, so they sit at the rare end
    const levels = cfg.poolLevels, offW = cfg.offPoolWeight ?? 0.1;
    const off = id => levels && !levels.includes(data.byId.get(id).difficulty || "hard");
    let model = ids.map(id => Math.exp((fame(id) - top) / tau) * (off(id) ? offW : 1));
    const sum = model.reduce((a, b) => a + b, 0) || 1;
    model = model.map(v => v / sum);
    // real counts from players on THIS difficulty once there are enough of them, else from everyone
    const all = (q && root.ANSWER_STATS && root.ANSWER_STATS[q.id]) || null;
    const own = all && all.modes && all.modes[cfg.mode];
    const stats = own && own.plays >= (cfg.statsMinPlays ?? 50) ? own : all;
    const plays = stats ? stats.plays || 0 : 0;
    const w = plays >= (cfg.statsMinPlays ?? 50) ? Math.min(cfg.statsMaxWeight ?? 0.5, plays / (cfg.statsFullPlays ?? 400)) : 0;
    const share = new Map();
    if (w > 0) {
      const counts = stats.counts || {};
      const said = ids.reduce((a, id) => a + (counts[id] || 0), 0) || 1;
      ids.forEach((id, i) => share.set(id, (1 - w) * model[i] + w * ((counts[id] || 0) / said)));
    } else ids.forEach((id, i) => share.set(id, model[i]));
    return share;
  }

  function tierAnswers(ids, data, cfg, q) {
    const n = ids.length, map = {};
    if (!n) return map;
    const tiers = cfg.tiers, last = tiers.length - 1;
    const share = answerShares(ids, data, cfg, q);
    const order = [...ids].sort((a, b) => share.get(b) - share.get(a) || data.byId.get(b)._fame - data.byId.get(a)._fame);
    // Pirate King: only on prompts with enough answers, at most a handful, and only the true tail
    const kingOk = n >= (cfg.kingMinAnswers ?? 8);
    let before = 0, kings = 0;
    order.forEach((id, idx) => {
      let ti = 0;
      for (let t = 0; t < tiers.length; t++) if (before >= (tiers[t].from ?? 0)) ti = t;
      if (idx === 0) ti = 0;                                       // the most-said answer is always Rookie
      // a famous answer is never a deep cut: cap the tier by how well known it is, relative to the
      // levels in play (cfg.poolLevels, set from the difficulty). The least-known level in the pool can
      // reach Pirate King, the next one up Emperor, anything more famous tops out at Warlord.
      const known = data.byId.get(id).difficulty || "medium";
      const caps = ((cfg.modeTiers || {})[cfg.mode] || {}).caps;
      let cap = last;                                                    // obscure: up to Pirate King
      if (caps) {                                                        // this mode's caps (config modeTiers)
        const t = caps[known] ? tiers.findIndex(x => x.id === caps[known]) : -1;
        if (t >= 0) cap = t;
      } else {                                                           // no mode set: cap by the levels in play
        const levels = cfg.poolLevels || ["easy", "medium", "hard"], hardest = levels[levels.length - 1];
        if (known === "easy" && hardest !== "easy") cap = last - 2;      // famous: never above Warlord
        else if (known === "medium" && hardest === "hard") cap = last - 1; // well known: up to Emperor
      }
      if (ti > cap) ti = cap;
      // a right answer from outside the difficulty's pool is never an everyday one: Warlord at least
      const lv = data.byId.get(id).difficulty || "hard", floor = tiers.findIndex(x => x.id === (cfg.offPoolFloor || "warlord"));
      if (idx > 0 && cfg.poolLevels && !cfg.poolLevels.includes(lv) && floor >= 0 && ti < floor) ti = Math.min(floor, cap);
      if (ti === last) {
        const pinned = q && q.gem === id;
        if (!kingOk || (kings >= (cfg.kingMax ?? 5) && !pinned)) ti = last - 1;
        else kings++;
      }
      if (q && q.gem === id && kingOk) ti = last;
      map[id] = { rarity: before, share: share.get(id), tier: tiers[ti] };
      before += share.get(id);
    });
    return map;
  }

  function scoreGuess(q, guessId, data, cfg) {
    const c = data.byId.get(guessId);
    if (q.tierById[guessId]) {
      const { tier, rarity } = q.tierById[guessId];
      return { ok: true, id: guessId, tier, rarity, points: tier.points };
    }
    return { ok: false, id: guessId, tier: cfg.missTier, points: 0, failed: failedCondition(c, q) };
  }

  // Answers sorted rarest first.
  function rarestAnswers(q, data) {
    return [...q.answers].sort((a, b) => data.byId.get(a)._fame - data.byId.get(b)._fame);
  }

  // ---------- daily picking ----------
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rand) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  // Pick n questions, never two from the same group if it can be helped,
  // and at most opts.maxCombos combination prompts so a day isn't all "Name a X who Y".
  // Two prompts "ask the same thing" when most right answers of the smaller one also answer the bigger one:
  // "fought Luffy" vs "fought Monkey D. Luffy" (two data sources), "Swordsman" vs "fights with a sword",
  // or "a Pirate who fought Luffy" next to "fought Luffy". One voyage never gets both.
  // (A small prompt inside a huge catch-all like "never ate a Devil Fruit" is a different question: skipped.)
  function sameQuestion(a, b, min = 0.75) {
    if (a === b) return true;
    if ((a.kind || "character") !== (b.kind || "character") || !a.answers || !b.answers) return false;
    const [x, y] = a.answers.length <= b.answers.length ? [a, b] : [b, a];
    if (!x.answers.length || x.answers.length < y.answers.length * 0.25) return false;
    const ys = y._ansSet || (y._ansSet = new Set(y.answers));
    let hit = 0;
    for (const id of x.answers) if (ys.has(id)) hit++;
    return hit / x.answers.length >= min;
  }
  // a prompt's topic: its group, with groups that ask about the same thing merged
  // (debut arc, "appeared in the first N episodes" and "...N chapters" are all "when did they show up")
  const TOPIC_OF = { "debut-ep": "debut", "debut-ch": "debut" };
  const topicOf = q => TOPIC_OF[q.group] || q.group;
  // The daily: walk each difficulty's prompts in one fixed order (by a hash of the prompt id), one step
  // per slot per day, carrying the place from day 1 to today. Nothing repeats until a whole level has been
  // used, everyone gets the same 7, and adding prompts only slots them into the order.
  // plan = ["easy", "easy", ..., "medium"], dayNo = days since launch (1 = launch day).
  function cyclePick(pool, plan, dayNo, salt, opts = {}) {
    const levels = ["easy", "medium", "hard"];
    const key = q => hashString(`${salt}:${q.id || q.text}`);
    const lists = {};
    for (const lvl of levels) lists[lvl] = pool.filter(q => (q.difficulty || "hard") === lvl).sort((a, b) => key(a) - key(b) || String(a.id || a.text).localeCompare(String(b.id || b.text)));
    const maxCombos = opts.maxCombos == null ? Infinity : opts.maxCombos;
    const cursor = { easy: 0, medium: 0, hard: 0 };
    const near = want => [want, ...levels.filter(l => l !== want).sort((a, b) => Math.abs(levels.indexOf(a) - levels.indexOf(want)) - Math.abs(levels.indexOf(b) - levels.indexOf(want)))];
    let picked = [];
    for (let day = 1; day <= Math.max(1, dayNo); day++) {
      picked = [];
      const topics = new Set();
      const ok = q => !picked.includes(q) && (!q.combo || picked.filter(x => x.combo).length < maxCombos) && !picked.some(p => sameQuestion(p, q));
      for (const want of plan) {
        let q = null;
        for (const lvl of near(want)) {
          const list = lists[lvl];
          if (!list.length) continue;
          let fallback = -1;
          for (let s = 0; s < list.length; s++) {
            const cand = list[(cursor[lvl] + s) % list.length];
            if (!ok(cand)) continue;
            if (!topics.has(topicOf(cand))) { q = cand; cursor[lvl] += s + 1; break; }
            if (fallback < 0) fallback = s;
          }
          if (!q && fallback >= 0) { q = list[(cursor[lvl] + fallback) % list.length]; cursor[lvl] += fallback + 1; }
          if (q) break;
        }
        if (!q) break;
        picked.push(q); topics.add(topicOf(q));
      }
    }
    return picked;
  }

  function pickQuestions(pool, n, rand, opts = {}) {
    // opts.plan = ["easy", "easy", "medium", ...]: one difficulty per slot, in order (easy first).
    if (opts.plan) {
      const shuffled = shuffle(pool, rand), picked = [], groups = new Set();
      const maxCombos = opts.maxCombos == null ? Infinity : opts.maxCombos;
      const ok = q => !picked.includes(q) && (!q.combo || picked.filter(x => x.combo).length < maxCombos) && !picked.some(p => sameQuestion(p, q));
      const order = ["easy", "medium", "hard"];
      for (const want of opts.plan.slice(0, n)) {
        // the wanted level first, then the nearest other level; a new topic beats a repeated one
        const levels = [want, ...order.filter(l => l !== want).sort((a, b) => Math.abs(order.indexOf(a) - order.indexOf(want)) - Math.abs(order.indexOf(b) - order.indexOf(want)))];
        let q = null;
        for (const lvl of levels) {
          q = shuffled.find(x => x.difficulty === lvl && ok(x) && !groups.has(topicOf(x))) || shuffled.find(x => x.difficulty === lvl && ok(x));
          if (q) break;
        }
        if (!q) break;
        picked.push(q); groups.add(topicOf(q));
      }
      return picked;
    }
    const shuffled = shuffle(pool, rand), picked = [], groups = new Set();
    const maxCombos = opts.maxCombos == null ? Infinity : opts.maxCombos;
    const combosIn = () => picked.filter(q => q.combo).length;
    const ok = q => (!q.combo || combosIn() < maxCombos) && !picked.some(p => sameQuestion(p, q));
    for (const q of shuffled) { if (picked.length >= n) break; if (!groups.has(topicOf(q)) && ok(q)) { picked.push(q); groups.add(topicOf(q)); } }
    for (const q of shuffled) { if (picked.length >= n) break; if (!picked.includes(q) && ok(q)) picked.push(q); }
    for (const q of shuffled) { if (picked.length >= n) break; if (!picked.includes(q) && !picked.some(p => sameQuestion(p, q))) picked.push(q); }
    for (const q of shuffled) { if (picked.length >= n) break; if (!picked.includes(q)) picked.push(q); }
    return picked;
  }
  function localDateKey(d) {
    const z = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  function dayNumber(launchDate, d) {
    const [y, m, dd] = launchDate.split("-").map(Number);
    const start = Date.UTC(y, m - 1, dd);
    const now = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((now - start) / 86400000) + 1;
  }

  // ---------- Wanted (guess the character) ----------
  // Search-as-you-type over name + aliases. Best first: exact name or alias, then any name, alias or
  // name word that starts with the text, then text anywhere in a name, then typos (via resolveGuess).
  // Within each group the more famous character comes first, so "lu" finds Luffy before Lulis.
  // Why a name came up, in a few words: their fruit, their epithet, or another name they go by.
  function aliasWhy(c, alias) {
    const a = norm(alias);
    if (asList(c.devil_fruit_names).some(f => norm(f) === a) || /\bno mi\b|\bfruit\b/.test(a)) return `Fruit: ${alias}`;
    if (c.epithet && norm(c.epithet).includes(a)) return `“${c.epithet}”`;
    return `Also called ${alias}`;
  }
  function searchCharacters(query, data, limit = 8) {
    const q = norm(query);
    if (!q) return [];
    const hits = new Map(); // id -> { rank, via }
    const put = (id, rank, via) => { const h = hits.get(id); if (!h || rank < h.rank) hits.set(id, { rank, via }); };
    for (const c of data.chars) {
      const names = [c.name, ...asList(c.aliases)];
      names.forEach((n, i) => {
        const k = norm(n);
        if (!k) return;
        const via = i === 0 || norm(c.name).includes(k) ? "" : aliasWhy(c, n); // explain an alias only when it adds something
        if (k === q) put(c.id, 0, via);
        else if (k.startsWith(q) || k.split(" ").some(w => w.startsWith(q))) put(c.id, 1, via);
        else if (q.length >= 3 && k.includes(q)) put(c.id, 2, via);
      });
    }
    // nothing matched at all: allow one typo, and say what it was close to
    if (!hits.size && q.length >= 5) {
      for (const c of data.chars) for (const n of [c.name, ...asList(c.aliases)]) {
        const k = norm(n);
        if (Math.abs(k.length - q.length) <= 1 && levenshtein(q, k) <= 1) put(c.id, 3, `Close to “${n}”`);
      }
    }
    return [...hits].sort((a, b) => a[1].rank - b[1].rank || data.byId.get(b[0])._fame - data.byId.get(a[0])._fame)
      .slice(0, limit).map(([id, h]) => ({ id, via: h.via }));
  }
  // Other words players use for a trait (keys are the normalised value). "fishman" also finds merfolk,
  // since fans lump them together; "yonko" finds the Four Emperors.
  const TRAIT_ALSO = {
    "merfolk": ["mermaid", "mermaids", "merman", "mermen", "fishman", "fishmen", "fish man", "fish men"],
    "fish man": ["merman", "mermen"],
    "four emperors": ["yonko", "emperor", "emperors"],
    "seven warlords of the sea": ["warlord", "warlords", "shichibukai"],
    "marines": ["navy"], "marine": ["navy"],
    "revolutionary army": ["revolutionaries", "revs"],
    "worst generation": ["supernova", "supernovas"],
    "cyborg": ["robot"]
  };
  // Search by trait for Wanted: "fishman", "marine", "zoan", "red hair" -> everyone with that trait.
  // fields = [[field, label], ...]. Plurals and missing spaces/hyphens are forgiven (fishmen = Fish-Man).
  function searchTraits(query, data, fields, opts = {}) {
    const raw = norm(query), q = raw.replace(/ /g, "");
    if (q.length < 3) return [];
    if (!data._traitIndex) {
      const idx = new Map();                              // field|normValue -> { field, label, value, ids }
      for (const c of data.chars) for (const [field, label] of fields) for (const v of asList(c[field])) {
        const k = norm(v);
        if (!k || k === "unknown" || k === "none") continue;
        const key = label + "|" + k;            // same label = one group (crew in two columns)
        if (!idx.has(key)) {
          const alt = opts.displayNames && opts.displayNames[v] ? norm(opts.displayNames[v]) : "";
          const also = (TRAIT_ALSO[k] || []).map(x => x.replace(/ /g, ""));
          idx.set(key, { field, label, value: v, ids: new Set(), keys: [k.replace(/ /g, ""), alt.replace(/ /g, ""), ...also].filter(Boolean), words: (k + " " + alt).split(" ").filter(Boolean), phrases: [k, alt].filter(Boolean) });
        }
        idx.get(key).ids.add(c.id);
      }
      data._traitIndex = [...idx.values()];
    }
    const variants = w => [...new Set([w, w.replace(/men$/, "man"), w.replace(/ies$/, "y"), w.replace(/es$/, ""), w.replace(/s$/, "")])].filter(Boolean);
    const tries = variants(q).filter(t => t.length >= 3);
    // "beast pir" -> every typed word starts a word of the name, in order ("Beasts Pirates")
    const qWords = raw.split(" ").filter(Boolean);
    const wordsMatch = phrase => {
      const pw = phrase.split(" "); let at = 0;
      for (const w of qWords) {
        const vs = variants(w);
        while (at < pw.length && !vs.some(v => pw[at].startsWith(v))) at++;
        if (at++ >= pw.length) return false;
      }
      return true;
    };
    const out = [];
    for (const t of data._traitIndex) {
      let rank = 9;
      // "red hair", "blonde haired" -> the hair colour itself
      const hairQ = /.hair(ed)?$/.test(q) ? q.replace(/hair(ed)?$/, "").replace(/e$/, "") : "";
      if (hairQ && /hair/i.test(t.field) && t.keys.some(k => k === hairQ || k.replace(/e$/, "") === hairQ)) rank = 0;
      for (const x of tries) {
        if (t.keys.includes(x)) rank = Math.min(rank, 0);
        else if (t.keys.some(k => k.startsWith(x))) rank = Math.min(rank, 1);
        else if (raw.length >= 3 && t.words.some(w => w.startsWith(x))) rank = Math.min(rank, 2);
      }
      if (rank > 1 && qWords.length > 1 && t.phrases.some(wordsMatch)) rank = 1;
      if (rank < 9 && t.ids.size >= (opts.minMembers || 2)) out.push({ ...t, rank, fit: q.length / Math.max(...t.keys.map(k => k.length)) });
    }
    const fame = id => data.byId.get(id)._fame || 0;
    return out.sort((a, b) => a.rank - b.rank || b.fit - a.fit || b.ids.size - a.ids.size)
      .map(t => ({ field: t.field, label: t.label, value: t.value, ids: [...t.ids].sort((a, b) => fame(b) - fame(a)) }));
  }
  function wantedPool(data, wcfg) {
    const all = data.chars.filter(c => c.id && c.name && !/^(no|n|false|0)$/i.test(String(c.canon || "").trim()));
    const rated = all.filter(c => c.fame != null || c.appearances);
    const famous = (rated.length ? rated : all).filter(c => c._fame >= (wcfg.minFame || 0));
    // the hidden character must have every column on file, so no clue ever reads "not on file"
    // (columns with an "empty" label, like Fruit: None, count as on file)
    const onFile = c => (wcfg.columns || []).every(col => col.empty != null ||
      asList(c[col.field]).some(v => !isEmpty(v) && norm(v) !== "unknown"));
    const complete = wcfg.completeOnly === false ? famous : famous.filter(onFile);
    return (complete.length ? complete : famous.length ? famous : all).map(c => c.id).sort();
  }
  // The day's character: a fixed seeded shuffle of the pool, one step per day, so nobody repeats
  // until everyone in the pool has had a turn.
  function wantedDaily(pool, seedKey, dayNo) {
    if (!pool.length) return null;
    const order = shuffle(pool, rng(hashString(seedKey)));
    return order[(((dayNo - 1) % order.length) + order.length) % order.length];
  }

  // Compare one trait of a guess with the answer.
  // -> { state: "same" | "near" | "diff" | "unknown", text, arrow: "up" | "down" | "" }
  // "arrow" points to where the ANSWER is: up = the answer is higher / later.
  function compareTrait(col, guess, answer) {
    const raw = c => c[col.field];
    const items = c => asList(raw(c));
    const shown = c => {
      const v = raw(c);
      if (isEmpty(v)) return col.empty || "?";
      if (col.compare === "number") return formatNumber(v, col);
      return asList(v).map(x => (col.short && col.short[x]) || x).join(", ");
    };
    const out = { state: "diff", text: shown(guess), arrow: "" };
    if (col.compare === "number") {
      const num = c => (typeof raw(c) === "number" ? raw(c) : (col.emptyAs != null ? col.emptyAs : null));
      const g = num(guess), a = num(answer);
      if (g == null || a == null) { out.state = "unknown"; return out; }
      if (g === a) { out.state = "same"; return out; }
      out.arrow = a > g ? "up" : "down";
      if (col.near != null && Math.abs(a - g) <= col.near) out.state = "near";
      return out;
    }
    // "Unknown" on file counts as blank, so two unknowns don't show as a match.
    const known = c => items(c).map(norm).filter(x => x && x !== "unknown");
    const gi = known(guess), ai = known(answer);
    const gEmpty = !gi.length, aEmpty = !ai.length;
    if (gEmpty || aEmpty) {
      if (col.empty) out.state = gEmpty && aEmpty ? "same" : "diff";
      else out.state = "unknown";
    } else {
      const shared = gi.filter(x => ai.includes(x)).length;
      const sameSet = shared === new Set(gi).size && new Set(gi).size === new Set(ai).size;
      if (sameSet) out.state = "same";
      else if (shared && col.compare !== "same") out.state = "near";
      // nearWords: share a word = yellow (Zoan vs Mythical Zoan)
      else if (col.nearWords && gi.some(x => ai.some(y => x.split(" ").some(w => w.length > 2 && y.split(" ").includes(w))))) out.state = "near";
    }
    if (out.state !== "same" && col.arrowFrom) {
      for (const f of [].concat(col.arrowFrom)) {
        const g = guess[f], a = answer[f];
        if (typeof g === "number" && typeof a === "number") { if (a !== g) out.arrow = a > g ? "up" : "down"; break; }
      }
    }
    return out;
  }
  function compareCharacters(guess, answer, columns) { return columns.map(col => compareTrait(col, guess, answer)); }

  function formatNumber(v, col) {
    if (col.format === "berry") {
      const units = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
      for (const [n, u] of units) if (v >= n) return "฿" + (+(v / n).toFixed(v >= n * 100 ? 0 : v >= n * 10 ? 1 : 2)) + u;
      return "฿" + v;
    }
    return v.toLocaleString("en-US") + (col.unit || "");
  }

  const api = { searchTraits, rateDifficulty, norm, asList, levenshtein, prepare, resolveGuess, resolveFor, soundKey, suggestNames, testCond, fits, buildQuestions, tierAnswers,
    scoreGuess, rarestAnswers, hashString, rng, shuffle, pickQuestions, cyclePick, sameQuestion, topicOf, localDateKey, dayNumber,
    searchCharacters, wantedPool, wantedDaily, compareTrait, compareCharacters, formatNumber, comboQuestions };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== "undefined" ? window : globalThis);
