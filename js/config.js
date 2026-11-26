// Everything you are likely to tune lives here. No build step: edit and reload.
window.GAME_CONFIG = {
  name: "ONE PIECES",                   // logo text
  title: "One Pieces · The daily One Piece voyage",                  // browser tab title
  tagline: "The daily voyage",
  launchDate: "2026-11-15",          // Voyage #1. Daily numbers count up from here.
  storageKey: "logpose-v2",         // change to wipe everyone's saved results (e.g. at launch)

  // Sound. Leave music blank for the built-in chiptune, or point it at your own file
  // (e.g. "assets/audio/music.mp3").
  audio: { music: "", musicVolume: 0.5, sfxVolume: 0.6,
           musicDefault: true,    // music plays from the first click; players can turn it off with the music button
           sfxDefault: false,     // OFF while building. Set to true at launch so new players hear sound effects.
           // a voice line played while a BURST charges (Emperor / Pirate King answers); the charge lasts as
           // long as the clip. Local file only: keep your own recordings out of anything you publish.
           burstClip: { file: "assets/audio/burst-voice.mp3", from: 14.5, to: 20 },
           // the same for the first ship's Pirate King cutscene (the crewmate inflating before the big gust)
           gustClip: { file: "assets/audio/gust-voice.mp3", from: 7.5, to: 12.5, inhale: 0.2 } },   // inhale = seconds of breathing in before the deflate

  // ---- Rare Find (mode 1) ----
  promptsPerDay: 7,
  thingsPerDay: 1,                  // daily prompts about Devil Fruits / ships / places... instead of characters.
                                    // Only ~8 easy ones exist, so 2 a day repeated every 4 days; 1 a day = every ~8.
  dailyResets: { "2026-11-15": 1 },   // bump a date's number to let everyone replay that day's daily
  secondsPerPrompt: 30,
  minAnswers: 5,                      // a question needs at least this many valid characters. Raise to ~12 once your database is big.
  bountyPerPoint: 1000000,            // final bounty = points x this (700 points = 700,000,000 berries)
  nmiPerPoint: 10,                    // nautical miles sailed per point
  endlessLives: 3,

  // Tiers from most obvious to most niche. "rarity" is the share of valid answers
  // that are MORE famous than yours (0 = the most famous answer, 1 = the least).
  // Points x nmiPerPoint = nautical miles sailed. Top tier = 1,000 nmi, so the
  // 7,000 nmi route takes seven top-tier answers. Keep tier names spoiler-free.
  tiers: [
    // Tiers cut the pile of answers PLAYERS give, most-said first ("from" = share of players already
    // covered by more common answers). Like Krillion: most answers people actually say land in
    // Rookie..Warlord, Emperor is a real deep cut, and Pirate King is the rare tail (a handful at most).
    { id: "rookie",    name: "Rookie",      points: 10,  from: 0,    line: "Everyone said that one." },
    { id: "supernova", name: "Supernova",   points: 30,  from: 0.25, line: "A fair pick. Making a name." },
    { id: "warlord",   name: "Warlord",     points: 60,  from: 0.52, line: "Off the beaten route." },
    { id: "emperor",   name: "Emperor",     points: 85,  from: 0.76, line: "A deep cut. Most crews never think of it." },
    { id: "king",      name: "Pirate King", points: 100, from: 0.96, line: "Almost nobody finds this one." }
  ],
  popularityTemp: 12,      // how strongly fame decides who gets said (lower = famous answers hog more players)
  // Each difficulty has its own crowd, so the same answer can be rare on Easy and common on Hard.
  // popularityTemp: casual Easy players pile onto the famous few (low), Hard players know the deep cast
  // and spread out (high). caps: the highest tier an answer of that fame level can reach in this mode
  // (characters, fruits, places... all carry easy / medium / hard). Missing level = no cap (Pirate King).
  offPoolWeight: 0.1,      // a right answer from outside the difficulty's pool gets this share of players...
  offPoolFloor: "warlord", // ...and never scores below this tier
  modeTiers: {
    easy:   { popularityTemp: 8,  caps: {} },
    medium: { popularityTemp: 12, caps: { easy: "warlord" } },
    hard:   { popularityTemp: 16, caps: { easy: "supernova", medium: "warlord" } }
  },
  kingMinAnswers: 8,       // smaller prompts have no Pirate King answers
  kingMax: 5,              // at most this many Pirate King answers on one prompt (set "gem" on a prompt to pin one)
  statsFullPlays: 400,     // real answer counts reach full weight after this many plays of a prompt...
  statsMaxWeight: 0.5,     // ...and never count for more than half (wiki fame is the rest)
  statsMinPlays: 50,       // ...and only start counting after this many plays
  statsEndpoint: "https://script.google.com/macros/s/AKfycbxYCrMveLndHLsiGJbZVNkDo7PJsJu4EnGcpejLhTdeOtld5eeWMtFrhuHZi8cs2Q_Y/exec",       // where finished answers are sent (POST JSON). Blank = only kept in this browser.
  missTier:    { id: "wreck",   name: "Shipwrecked", points: 0, line: "Wrong waters." },
  timeoutTier: { id: "becalmed", name: "Becalmed",   points: 0, line: "The wind died. Out of time." },

  // How famous a character is. If "fame" (1-100) is filled it wins; otherwise
  // "appearances" (episode count) is used; otherwise everyone counts as 50.
  // Set fame by hand for "famous for being obscure" characters (Pandaman) so they don't score as niche.

  // The voyage. nmi = nautical miles from the start. "style" picks the pixel island drawn there
  // (village, navy, town, reverse, cactus, desert, bigtree, city, spooky, bubble, fishman,
  // firefrost, dressrosa, cake, wano, tech, final, or anything else = plain grass island).
  route: {
    length: 7000,
    stops: [
      { nmi: 0,    name: "Foosha Village",    style: "village" },
      { nmi: 450,  name: "Shells Town",       style: "navy" },
      { nmi: 900,  name: "Loguetown",         style: "town" },
      { nmi: 1250, name: "Reverse Mountain",  style: "reverse", redLine: true },
      { nmi: 1650, name: "Whisky Peak",       style: "cactus" },
      { nmi: 2100, name: "Arabasta",          style: "desert" },
      { nmi: 2550, name: "Jaya",              style: "bigtree" },
      { nmi: 2950, name: "Water 7",           style: "city" },
      { nmi: 3350, name: "Thriller Bark",     style: "spooky" },
      { nmi: 3750, name: "Sabaody",           style: "bubble" },
      { nmi: 4100, name: "Fish-Man Island",   style: "fishman", redLine: true },
      { nmi: 4550, name: "Punk Hazard",       style: "firefrost" },
      { nmi: 5000, name: "Dressrosa",         style: "dressrosa" },
      { nmi: 5450, name: "Whole Cake Island", style: "cake" },
      { nmi: 5900, name: "Wano",              style: "wano" },
      { nmi: 6400, name: "Egghead",           style: "tech" },
      { nmi: 7000, name: "???",               style: "final", finale: true }   // spoiler-free on purpose
    ]
  },

  // Readable names for columns, used when a wrong answer is explained.
  fieldLabels: {
    race: "Race", sex: "Sex", height_cm: "Height (cm)", origin_sea: "From", birthplace: "Birthplace",
    affiliation_type: "Affiliation", organizations: "Groups", crew_role: "Role",
    devil_fruits: "Devil Fruit", devil_fruit_types: "Fruit type", haki: "Haki",
    fighting_style: "Fighting style", weapons: "Weapons", tags: "Traits", hair_color: "Hair", first_episode: "First episode",
    first_chapter: "First chapter", debut_arc: "Debut arc", debut_saga: "Debut saga",
    status: "Status", bounty_peak: "Top bounty", epithet: "Epithet", name_length: "Letters in name"
  },

  listFields: ["aliases", "organizations", "devil_fruits", "devil_fruit_names", "devil_fruit_types", "haki", "fighting_style", "crew_role", "weapons", "tags"],

  // Other names for groups and titles, shown in prompts so either name is understood:
  // "Name a member of the Four Emperors (Yonko)". Keys must match the data exactly.
  displayNames: {
    "Four Emperors": "Four Emperors (Yonko)",
    "Seven Warlords of the Sea": "Seven Warlords (Shichibukai)",
    "Admirals": "Admirals (Taisho)",
    "Five Elders": "Five Elders (Gorosei)",
    "Celestial Dragons": "Celestial Dragons (Tenryuubito)",
    "Supreme King": "Conqueror's (Supreme King)",
    "Conqueror's": "Conqueror's (Supreme King)",
    "Armament": "Armament (Busoshoku)",
    "Observation": "Observation (Kenbunshoku)",
    "Worst Generation": "Worst Generation (Supernovas)",
    "Cipher Pol": "Cipher Pol (CP)",
    "Revolutionary Army": "Revolutionary Army (Revs)"
  },
  numberFields: ["height_cm", "first_episode", "first_chapter", "bounty_peak", "appearances", "fame"],

  // ---- Wanted (guess the hidden character) ----
  wanted: {
    maxGuesses: 10,                   // 0 = unlimited
    minFame: 81,
    minFameBy: { easy: 81, medium: 81, hard: 75 },   // per difficulty. Easy also only searches Easy characters
                                                       // (~135 posters); Hard opens the poster to ~615.                      // the hidden character is picked only from characters with fame >= this
                                      // (so the daily target isn't a one-panel extra). 81 = about 190 characters
                                      // with the wiki data (85 = ~65, 80 = ~240). 0 = anyone.
    // Where the ship lands when you catch them: 1st number = caught on guess 1, 2nd = guess 2, ...
    // Past the end of the list you get the last number. Not caught = 0 (stays in port).
    sailByGuesses: [7000, 6400, 5900, 5450, 5000, 4550, 4100, 3750, 3350, 2950, 2550, 2100, 1650, 1250, 900, 450],
    // The tiles shown for each guess, left to right. Every field is a column in characters.csv.
    //   compare: "overlap" = green if the same, yellow if they share at least one item (lists like haki), red if not
    //            "same"    = green or red only
    //            "number"  = green if equal, else red with an arrow (up = the answer is higher).
    //                        Add near: 10 to turn it yellow when within 10.
    //   empty:   what a blank cell means ("None"). Two blanks then match. Without it a blank shows "?" in grey.
    //            "Unknown" in the data always counts as blank.
    //   nearWords: true = yellow when two values share a word (Zoan vs Mythical Zoan).
    //   emptyAs: for numbers, treat a blank as this value (no bounty = 0).
    //   arrowFrom: for a text column, the number column(s) that decide the arrow (first one both characters have).
    //   short:   shorter words for the tile only, e.g. { "Conqueror's": "Conq" }. Matching still uses the full value.
    columns: [
      { field: "sex",               label: "Sex",    compare: "same" },
      { field: "race",              label: "Race",   compare: "overlap" },
      { field: "affiliation_type",  label: "Side",   compare: "overlap" },
      { field: "primary_group",     label: "Group",  compare: "overlap", empty: "None" },
      { field: "devil_fruit_types", label: "Fruit",  compare: "overlap", empty: "None", nearWords: true },
      { field: "haki",              label: "Haki",   compare: "overlap", empty: "None",
        short: { "Observation": "Obs", "Armament": "Arm", "Conqueror's": "Conq" } },
      { field: "hair_color",        label: "Hair",   compare: "overlap" },
      { field: "origin_sea",        label: "From",   compare: "overlap" },
      { field: "height_cm",         label: "Height", compare: "number", unit: "cm" },
      { field: "bounty_peak",       label: "Bounty", compare: "number", format: "berry", empty: "None", emptyAs: 0 },
      { field: "debut_arc",         label: "Debut",  compare: "same", arrowFrom: ["first_episode", "first_chapter"] }
    ]
  },

  // Modes on the title screen. "higher" and "timeline" are not built yet.
  modes: [
    { id: "rarefind", name: "Rare Find", blurb: "7 prompts a day. The rarer the right answer, the further you sail.", ready: true },
    { id: "endless",  name: "Endless Voyage", blurb: "Prompts until you sink. Three lives.", ready: true },
    { id: "wanted",   name: "Wanted", blurb: "Find the hidden character. Each guess shows which traits match.", ready: true },
    { id: "blind",    name: "Blind Ranking", blurb: "One at a time, no take-backs. Rank fruits, characters, arcs and more.", ready: true },
    { id: "tierlist", name: "Tier List", blurb: "Drop characters, fruits or ships into S to F and save the picture.", ready: true },
    { id: "fighter",  name: "Build a Fighter", blurb: "Ten stats, ten characters. Then 1v1 a random rival or a friend.", ready: true },
    { id: "higher",   name: "Higher or Lower", blurb: "Who's taller? Whose bounty is bigger?", ready: false },
    { id: "timeline", name: "First Sighting", blurb: "Guess the episode a character first showed up.", ready: false }
  ]
};
