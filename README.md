# One Pieces

A daily One Piece fan game with pixel art and chiptune sound. Mode 1, **Rare Find**:
7 prompts like "Name a Fish-Man", 30 seconds each. Any character who fits counts, but
the less famous your pick, the further your pixel ship sails along the Grand Line. The
sky changes as you go: daylight in the East Blue, dusk past Reverse Mountain, stormy night
in the New World, gold at the end. The voyage ends on a wanted poster with your bounty.

Plain HTML/CSS/JS. No build step for the game itself. All art is drawn in code and all
sound is synthesized in code, so there are no image or audio files to download.

## Play it

- Double-click `index.html`, or serve the folder: `python3 -I -m http.server 8765` and open http://localhost:8765
- `index.html#debug` opens the **data check**: every playable prompt, its answers from most
  famous to rarest, and the tier each one scores.
- Music and sound toggles are top right (bottom right while playing). Sound starts after the first click (browser rule).

## Scoring (spoiler-free)

The route is 7,000 nmi. Each answer sails `points x 10` nmi.

| Tier | Sails | Rarity among right answers |
|---|---|---|
| Pirate King | 1,000 nmi | rarer than 90% |
| Emperor | 750 | 70%+ |
| Warlord | 500 | 45%+ |
| Supernova | 250 | 20%+ |
| Rookie | 100 | the most famous answers |
| Shipwrecked / Becalmed | 0 | wrong / out of time |

One answer can never reach the end. Only seven Pirate King answers in a day land on the
final island, which is shown as "???" so nothing is spoiled. Every point is also
฿1,000,000 on the poster.

Fame drives rarity: the `fame` column (1-100) if filled, else `appearances`, else 50.

After an answer the game shows only that answer's tier, never other right answers (prompts come
back on later days). A miss gives one short reason about the guessed character.

## The voyage map

The route is a row of boxes, one per canon arc (Foosha Village … Elbaph), then "???". Each box shows
a pixelated picture of that place: `tools/fetch_scenes.py` downloads each place's wiki infobox
picture to `assets/scenes/` and writes `data/route.js`; the game shrinks it into the pixel buffer and
cuts the colours with a dither, so the files themselves stay full quality. To swap a picture,
overwrite `assets/scenes/<place>.png`. The boxes split the 7,000 nmi evenly (~233 nmi each), so most
right answers move you into a new place. A strip of small squares along the bottom shows the whole map.

Ships: the Going Merry until the end of Enies Lobby; crossing into the next box she burns (her
farewell, episode 312) and the voyage continues on the Thousand Sunny. Sprites are text pixel art in
`js/sprites.js` (`merry`, `sunny`). With a spoiler filter before episode 312 the route ends before
that point and the Merry is never replaced.

## Difficulty and spoiler filter (title screen)

| Difficulty | Characters in play | Daily 7 prompts |
|---|---|---|
| Easy | only `difficulty = easy` (the ~250 everyone knows) | 5 easy, 2 medium |
| Medium (default) | easy + medium (~1,100) | 2 easy, 4 medium, 1 hard |
| Hard | every canon character | 2 medium, 5 hard |

Character difficulty comes from fame rank (top 250 easy, next 850 medium, rest hard); set it by hand
with a `difficulty` row in `data/character_overrides.csv`. Prompt difficulty is worked out from how many
right answers it has, whether it combines two conditions, and name/letter puzzles ("a Giant with fewer
than 10 letters in their full name" is hard); a prompt can also set `difficulty` itself.

Spoilers: players pick the last arc they've watched and anyone who first appears later is left out
(arcs and their last episode/chapter are in `data/arcs.js`, made by `build_data.py`). It filters by debut
only, so later facts about early characters (deaths, new fruits, titles) can still appear.
Each difficulty / spoiler setting has its own daily voyage.

Hand fixes to the wiki data go in `data/character_overrides.csv` (`id,column,value`); `build_data.py`
applies them on top of `characters.csv`, so a re-scrape never wipes them.

## Characters (pulled from the One Piece Wiki)

`data/characters.csv` holds every character page on onepiece.fandom.com (2,433: 1,665 canon,
768 filler/movie/game/spin-off), with pictures in `assets/characters/`. To refresh it:

```
python3 -I tools/scrape_wiki.py --images   # wiki -> data/characters.csv + pictures (cached in tools/.wiki_cache)
python3 -I tools/tag_characters.py         # tags -> data/character_tags.csv
python3 -I tools/build_data.py             # -> data/characters.js (canon only; --include-noncanon for all)
```

Where the values come from: the infobox (first chapter/episode, groups, occupation, origin, epithet,
height, bounty, birthday, blood type, status, Devil Fruits incl. a second one), wiki categories
(sex, race, Haki, fighting style, deceased, canon) and links to the page (`fame`). `hair_color` is
read from each article's Appearance text, so spot-check it. Blank means the wiki doesn't say.
Fruit names count as answers: "Flame Fruit", "Mera Mera" or "Mera Mera no Mi" = Ace;
"Tremor Fruit" asks Whitebeard or Blackbeard. Group nicknames (Yonko, Shichibukai...) show in
prompts through `displayNames` in `js/config.js`. Wiki text is CC BY-SA 3.0; the pictures are the
publisher's art, so keep them local and don't publish them.

Editing by hand: change `data/characters.csv`, then run `tools/build_data.py`. Re-running the
scraper rewrites `characters.csv`, so keep hand fixes small or note them (tags you add in
`data/character_tags.csv` are kept between runs).

Adding your own: open `data/characters_TEMPLATE.csv` (columns, no rows), one row per character,
lists use `|` between items: `Arlong Pirates|Sun Pirates`. Your old 39 test rows are in
`data/characters.before-wiki.csv`.

Pictures: `assets/characters/<id>.png` (square portrait). Full-body cutouts with a transparent
background go in the `image_full` column (used later for silhouette modes).

## Data you need for each game

Everything below is something you type in once and every mode reuses. **Bold** = needed for Rare Find now.

### characters.csv (one row per character)

| Column | Example | Used by |
|---|---|---|
| **`id`**, **`name`** | `hody`, `Hody Jones` | everything |
| **`aliases`** | `Hody` | answer matching in every typing mode |
| **`fame`** (1-100) | `40` | Rare Find scoring. The single most important column. |
| `appearances` | `57` | fallback for fame; Higher or Lower |
| `image` | square portrait | reveal card, wanted poster, Wanted mode (initials if blank) |
| `image_full` | transparent full-body PNG | Silhouette mode |
| **`race`** | `Fish-Man` | Rare Find, Wanted clues |
| **`sex`** | `Male` | Wanted clues |
| **`height_cm`** | `263` | Rare Find, Higher or Lower, Wanted (higher/lower arrow) |
| **`origin_sea`**, `birthplace` | `Grand Line`, `Fish-Man Island` | Rare Find, Wanted |
| **`affiliation_type`** | `Pirate` | Rare Find, Wanted |
| **`organizations`** (list, all ever) | `Arlong Pirates\|Sun Pirates` | Rare Find (one prompt per group) |
| **`primary_group`** (one) | `Arlong Pirates` | Wanted (a clean single answer to compare) |
| **`crew_role`** | `Captain` | Rare Find |
| **`devil_fruits`** (list), **`devil_fruit_types`** | `Yami Yami no Mi\|Gura Gura no Mi` | Rare Find, Wanted |
| **`haki`** | `Armament\|Conqueror's` | Rare Find, Wanted |
| **`fighting_style`** | `Swordsman` | Rare Find |
| **`hair_color`** | `Green` | Rare Find, Wanted |
| **`first_episode`**, `first_chapter` | `69`, `69` | First Sighting, Wanted, auto-fills debut arc |
| **`debut_arc`**, `debut_saga` | `Arlong Park Arc` | Rare Find, Wanted |
| **`status`** | `Alive` | Rare Find |
| **`bounty_peak`** | `20000000` | Rare Find, Higher or Lower, Wanted (blank = no bounty) |
| `epithet`, `birthday`, `blood_type` | `the Saw` | extra prompts and clues |
| **`weapons`** (list) | `Sword\|Gun` | "Name a character who fights with a sword" |
| **`tags`** (list) | `shirtless\|facial_hair\|smokes` | one prompt per tag, from `data/tags.csv` |

Any extra column you add (e.g. `favorite_food`, `dream`, `english_va`) is kept and can be used in prompts.

### Tags: prompts like "often shirtless" or "has facial hair"

`data/tags.csv` is the tag list: `tag`, `group`, `prompt`. It comes with 72 tags in 8 groups:

- **look**: shirtless, facial_hair, beard, mustache, bald, long_hair, unusual_hair, hat, sunglasses, glasses, eyepatch, scar, face_scar, tattoo, makeup, mask, coat_on_shoulders, earrings, long_nose, sharp_teeth, lipstick, cross_dresser
- **body**: horns, wings, tail, extra_limbs, missing_limb, prosthetic, animal
- **habit**: smokes, drinks, glutton, unique_laugh, catchphrase, verbal_tic, cries_easily, flirt, coward, money_lover, bad_sense_of_direction, sleepy
- **story**: royalty, world_noble, former_slave, orphan, traitor, spy, impel_down, defeated_by_luffy, defeated_by_straw_hat, villain_turned_ally, grand_fleet, switched_sides
- **skill**: doctor, scientist, cook, musician, artist, inventor, can_fly, transforms, multiple_swords, pet
- **family**: has_sibling, parent, twin, adopted, sworn_sibling
- **meta**: filler_only, movie, cover_story, running_gag

To use one, put it in a character's `tags` cell (`shirtless|smokes`). Once 5+ characters share a tag
it becomes a prompt. To add a new tag, add a row to `tags.csv` with its prompt and use it in `tags`.
The build script warns about tags that aren't in the list ("unknown tag 'shirtles', did you mean
'shirtless'?"). Only one prompt per tag group is picked each day, so a day never gets two "look" prompts.

### Filling in tags for every character

```
python3 -I tools/tag_characters.py   # -> data/character_tags.csv (seconds, uses the scraper's cache)
python3 -I tools/build_data.py
```

`data/character_tags.csv` has one row per character, sorted by id, with `fame` so you can do the famous ones first:

| Column | What | Used in the game? |
|---|---|---|
| `tags_auto`, `weapons_auto` | from wiki categories (Doctors, Former Marines, World Nobles, Archers...) and your data (fruit powers, race, height, D. in name) | yes |
| `tags_suggested`, `weapons_suggested` | keyword guesses from the first paragraph of the article's Appearance / Personality / Abilities | **no** — copy the right ones into `tags_add` |
| `tags_add`, `tags_remove`, `weapons_add` | your fixes; kept when the tagger re-runs | yes |
| `tags_why` | where each auto tag came from | - |

Tags are kept in this file, not in `characters.csv`, so re-scraping the wiki never wipes them.

`data/character_tags_ai.csv` (`id`, `name`, `tags_ai`, `weapons_ai`) holds a one-time Claude pass over the 600
most famous canon characters (wiki Appearance / Personality / Abilities text + One Piece knowledge, only tags from
`tags.csv`). The build adds these too. To drop a wrong one, put it in that character's `tags_remove` in
`character_tags.csv` (removals always win), or edit the AI file directly.

### Other tables (templates in `data/templates/`)

| File | One row per | Columns | Unlocks |
|---|---|---|---|
| `moments.csv` | story moment | id, description, episode, chapter, arc, saga, character_ids, image, fun_fact, spoiler_level | **First Sighting**: "When did this happen?" Guess the episode, closer = further (the Gazillion mechanic) |
| `quotes.csv` | quote | id, quote, speaker_id, episode, chapter, arc, context, spoiler_level | **Who Said It** |
| `crews.csv` | crew | id, name, captain_id, member_ids, jolly_roger_image, ship_name, ship_image, first_arc, affiliation_type, status | **Jolly Roger** (guess the crew from its flag), crew prompts |
| `fruits.csv` | Devil Fruit | id, name, english_name, type, model, user_ids, past_user_ids, power, first_episode, image | **Fruit** mode ("what does the Hobi Hobi no Mi do?"), fruit prompts |
| `places.csv` | island / place | id, name, sea, type, first_episode, arc, ruler_id, image | place prompts, route stops |

`spoiler_level` = the episode number a player must have seen. Later this lets a player set
"I'm on episode 400" and only get prompts from before that.

### Pictures and sound you can add later

| Asset | Where | Size |
|---|---|---|
| Portraits | `assets/characters/<id>.png` | square, ~200-400 px |
| Full-body cutouts | `assets/characters/<id>_full.png` | transparent PNG |
| Jolly Rogers, ships, fruits | `assets/crews/`, `assets/fruits/` | transparent PNG |
| Ship / Sea King sprites | `assets/sprites/`, then set `file` in `js/sprites.js` | 1x pixel art, transparent |
| Music | set `audio.music` in `js/config.js` | mp3/ogg loop |

The sprites in `js/sprites.js` are also editable as text: one character per pixel.

## Prompts

`js/questions.js`: **templates** make one prompt per value in your data (every crew, race,
arc, fruit type...), and **hand-written prompts** use conditions (taller than 3 m, bounty over
1 billion, a Straw Hat who isn't human). The file lists every operator. A prompt appears once it
has `minAnswers` right answers (`js/config.js`, 5 now; raise to ~12 when the database is big).

### Facts the game works out itself

No extra typing. Worked out from columns you already fill in (a column you fill in yourself wins):

| Worked out | From | Prompts |
|---|---|---|
| `name_initials` | name (each part, "D." skipped) | "Name a character with K in their initials" (A-Z) |
| `name_letters` | name | "...with the letter Z in their name" (J K Q V W X Y Z) |
| `name_words` | name | "...known by a one-word name", "...three or more parts to their name" |
| `will_of_d` | name or aliases contain "D.", or the wiki's Clan of D. category | "Name someone who has the Will of D." |
| `name_has_number`, `name_double_letter` | name | "...with a number in their name", "...a double letter" |
| `birth_month`, `zodiac` | birthday (MM-DD) | "...born in March", "...whose star sign is Leo" |
| ranges | height_cm, bounty_peak, first_episode, first_chapter | taller than 2/2.5/3/4/5/10 m, shorter than 1.8/1.6/1.5/1.2/1 m, bounty over 10M...3B, bounty bands, first 10/50/100/200/300/400 episodes, after episode 500/700/900/1000, first 50/100/300/600 chapters |

The thresholds are plain lists of numbers at the bottom of `questions.js`. Add a number to add a prompt.

### Combinations (thousands of prompts)

`QUESTION_COMBOS` in `questions.js` pairs every **subject** with every **clause**:

- Subjects: a Pirate / Marine / World Government..., every race, "a member of the ___" for every
  group, every crew role, a female character, a character from each sea, a ___ Saga character,
  a Logia/Paramecia/Zoan user, a Devil Fruit user, a character without a Devil Fruit, a pirate captain
- Clauses: hair colour, fruit type, no fruit, Haki, weapon, fighting style, **every tag**, initials,
  rare letters, sea, debut saga, birth month, D. in name, height, bounty, died, has an epithet

So "Name a Marine who smokes", "Name a member of the Straw Hat Pirates with S in their initials",
"Name a Fish-Man with a bounty over 100 million". A combination is kept only if 5+ characters fit
and it actually narrows the subject. At most 3 of the 7 daily prompts are combinations (`perDay`).

Measured: the 39 sample characters give 144 playable prompts; 1,500 test characters with tags gave
6,967 (6,487 combinations), built in about 1 second. The data check page lists combinations collapsed.

## Tuning (`js/config.js`)

Name, launch date, prompts per day, timer, tier names/points/cutoffs, the islands on the route
(name, distance, pixel style), sound volume or your own music file, mode list, and the `wanted`
block (guess cap, who can be the hidden character, how far each catch sails, and the tile columns).

## Modes

| Mode | Status | Needs |
|---|---|---|
| Rare Find | built | characters.csv + fame |
| Endless Voyage | built | same, 3 lives |
| Wanted | built | see "Wanted" below |
| Higher or Lower | next | height_cm, bounty_peak, appearances |
| First Sighting | next | moments.csv |
| Who Said It, Jolly Roger, Fruit, Silhouette | ideas | quotes / crews / fruits / image_full |

## Wanted

One hidden character a day (the same for everyone, picked from the date), plus unlimited
**Practice**. Type in the search box and pick a character. Each guess adds a row of tiles:
**green** = same, **yellow** = partly (lists that share an item, like haki), **red** = different,
**grey** = not filled in for one of them. Number tiles show an arrow: up = the answer is higher.
10 guesses by default. The fewer guesses you need, the further the ship sails: caught on guess 1
reaches the final island, guess 2 Egghead, guess 3 Wano, and so on. Not caught = stays in port.
The win screen is the wanted poster of the hidden character, with their bounty, and a share text
with one row of coloured squares per guess.

Columns Wanted needs (all already in `characters_TEMPLATE.csv`):

| Column | Tile | How it's compared |
|---|---|---|
| `id`, `name`, `aliases` | search box | name and aliases are searched as you type |
| `sex` | Sex | same / different |
| `race` | Race | same / partly / different |
| `affiliation_type` | Side | same / partly / different |
| `primary_group` | Group | same / partly / different |
| `devil_fruit_types` | Fruit | blank = "None"; two blanks match |
| `haki` | Haki | list; shares one = yellow; blank = "None" |
| `hair_color` | Hair | same / partly / different |
| `origin_sea` | From | same / partly / different |
| `height_cm` | Height | number, arrow |
| `bounty_peak` | Bounty | number, arrow; blank = no bounty (counts as 0) |
| `debut_arc` | Debut | same / different; arrow from `first_episode`, else `first_chapter` |
| `fame` | (none) | only characters with fame >= `wanted.minFame` (81, about 190 of the wiki characters) can be the hidden one; `canon` = no is never picked |
| `image` | portraits | in the search list, rows and poster; initials if blank |

Change the tiles in `js/config.js` > `wanted.columns`: add, remove or reorder columns, pick
`compare` ("same", "overlap" or "number"), set `empty` (what a blank means), `near` (yellow when a
number is within that much), `nearWords` (yellow when values share a word: Zoan vs Mythical Zoan)
and `short` (shorter words on the tile, e.g. Conqueror's -> Conq). "Unknown" counts as blank.
Blank cells show as grey "?" tiles, so the more columns you fill, the better the clues.

## Files

```
index.html            screens
css/style.css         pixel UI
js/config.js          settings you tune
js/questions.js       prompts
js/sprites.js         pixel sprites (text art) + PNG override slots
js/engine.js          matching, questions, scoring
js/chart.js           the pixel sea, islands, ship (canvas)
js/audio.js           chiptune music + sound effects (Web Audio)
js/app.js             screens and game flow
data/characters.csv   your database (edit this)
data/characters.js    generated by tools/build_data.py (don't edit)
data/templates/       blank tables for future modes
tools/build_data.py   CSV -> characters.js
assets/               your pictures, sprites, audio
```

Results, streaks (Rare Find and Wanted), today's Wanted guesses, best Endless score, pirate name and sound settings are saved in the player's
browser. Everyone gets the same 7 prompts each day (picked from the date).

## Everything else: fruits, places, weapons, ships, crews... (`data/things/`)

Prompts can ask for things, not just characters: "Name a SMILE...", "Name an Ancient Zoan Devil Fruit",
"Name a place in the East Blue", "Name a named sword", "Name a crew whose captain is one of the Four Emperors (Yonko)".

| File | Rows (canon) | Linked to |
|---|---|---|
| `devil_fruits.csv` | 211 (157) | user_ids → characters |
| `places.csv` | 415 (306) | sea, region, place_ids |
| `weapons.csv` | 105 (96) | owner_ids → characters |
| `ships.csv` | 143 (109) | crew_ids → crews, captain_ids |
| `crews.csv` | 145 (91) | captain_ids, member_ids → characters; ship_ids → ships |
| `organizations.csv` | 114 (92) | member_ids, place_ids |
| `fighting_styles.csv` | 36 (33) | user_ids → characters |
| `races.csv` | 41 (35) | place_ids (homeland) |
| `events.csv` | 26 (23) | place_ids |

Every row has `first_episode` / `first_chapter` (the spoiler filter uses it), a `fame` score and a
difficulty (easy = most famous 20% of that table, medium = next 40%, hard = the rest). Pictures are in
`assets/things/<kind>/`. Refresh:

```
python3 -I tools/scrape_things.py --images   # wiki -> data/things/*.csv (+ pictures)
python3 -I tools/build_things.py             # -> data/things.js (joins, difficulty, answer spellings)
```

Hand fixes go in `data/thing_overrides.csv` (`kind,id,column,value`), kept across re-scrapes.
Prompts for these tables are in `js/questions_things.js` (each has a `kind`). The daily voyage always
includes `thingsPerDay` (default 2) of them; about 1 in 4 Endless prompts is one. Characters also gain
`owns_named_sword`, `owns_named_weapon`, `captains_a_crew`, `ship_names`, `style_names` from these tables.

### Story events, creatures and fights (added)

| File | Rows (canon) | What |
|---|---|---|
| `events.csv` | 51 (41) | every page in the wiki's Events / Battles / Incidents / Operations / Competitions categories, plus Event infoboxes; debut = earliest chapter/episode the article cites |
| `creatures.csv` | 208 (115) | the wiki's "Animal Species/<Saga>" lists + Sea King, Den Den Mushi, South Bird...; location, sea, saga, first chapter |
| `fights.csv` | 1,419 pairs | who fought whom, from every character's "Major Battles" list (filler battles skipped) → characters get `fought_names` |

Prompts: "Name a battle or war from the story", "an incident", "an event first shown in the Wano Country Saga",
"a creature that lives in the Calm Belt", "a creature from Drum Island", "a dinosaur from Little Garden",
"Name a character who fought Kaidou", plus places by sea (every Blue, Grand Line, Paradise, New World,
Calm Belt, sea floor, sky islands). Places and creatures in Paradise / the New World also count as Grand Line.

## Scoring by popularity (Krillion-style) and real answer counts

Tiers go by how many PLAYERS would say an answer, like Krillion. Each valid answer gets a share of players
(from wiki fame at first: famous answers soak up most players; `popularityTemp` in `js/config.js`). Answers are
sorted most-said first and the tiers cut that pile: Rookie 10 = the first 25% of players, Supernova 30 = up to 52%,
Warlord 60 = up to 76%, Emperor 85 = up to 96%, Pirate King 100 = the rare last 4% (at most `kingMax` = 5 answers,
and none on prompts under `kingMinAnswers` = 8 answers; pin one with `gem: "<answer id>"` on a prompt).
Simulated players average about 41 points a prompt, ~285 of 700 a day, in a bell curve like Krillion's.

Real answers: every finished answer is logged in the browser (`answerLog`) and POSTed to `statsEndpoint` once set
(the "Log Pose — Player Answers" Google Sheet + `tools/answers_apps_script.gs`). The game fetches live counts
on load (cached 30 min). After 50 plays of a prompt, real shares blend into the model shares (up to half at 400
plays), so answers people actually say a lot slide toward Rookie. Offline alternative:
`python3 -I tools/aggregate_answers.py answers.jsonl` → `data/answer_stats.js`.

## Security (onepieces.lol)

- HTTPS: GitHub Pages certificate for onepieces.lol, "Enforce HTTPS" on (http:// redirects to https://).
- `index.html` carries a Content-Security-Policy: only the site's own scripts run, fonts only from Google
  Fonts, network calls only to the site and the answers Google Apps Script. Inline scripts are allowed by
  hash, so after editing or adding an inline `<script>` run `python3 -I tools/update_csp.py`.
- No keys or secrets are in the repo. The answers endpoint accepts anonymous answers only (prompt,
  answer, day, mode, difficulty) and trims every field.
