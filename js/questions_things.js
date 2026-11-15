// Prompts whose answers are NOT characters: Devil Fruits, places, weapons, ships, crews,
// organizations, fighting styles, races, events. Data: data/things.js (tools/build_things.py).
//
// Same format as js/questions.js plus "kind" (which table the answer comes from).
// Conditions use that table's columns; joined facts are precomputed (see tools/build_things.py),
// e.g. a fruit has user_affiliation_types, a crew has captain_fruit_types.
// "difficulty": "easy" | "medium" | "hard" fixes a prompt's level; otherwise it is worked out
// from how many right answers it has.
// Answers are typed as names (fruit names in Japanese or English both work).

window.THING_KINDS = {
  fruit:        { noun: "Devil Fruit",    placeholder: "Type a Devil Fruit..." },
  place:        { noun: "place",          placeholder: "Type an island or place..." },
  weapon:       { noun: "weapon",         placeholder: "Type a weapon's name..." },
  ship:         { noun: "ship",           placeholder: "Type a ship's name..." },
  crew:         { noun: "crew",           placeholder: "Type a crew's name..." },
  organization: { noun: "organization",   placeholder: "Type an organization..." },
  style:        { noun: "fighting style", placeholder: "Type a fighting style..." },
  race:         { noun: "race or tribe",  placeholder: "Type a race or tribe..." },
  event:        { noun: "event",          placeholder: "Type an event, battle or incident..." },
  creature:     { noun: "creature",       placeholder: "Type a creature or animal species..." }
};

// One prompt per value found in the data (grows with the tables).
window.THING_TEMPLATES = [
  { kind: "fruit",  field: "fruit_type",  text: "Name {a} {value} Devil Fruit", group: "t-fruit-type", skip: ["Unknown"] },
  { kind: "fruit",  field: "user_crews",  text: "Name a Devil Fruit eaten by a member of the {value}", group: "t-fruit-group" },
  { kind: "fruit",  field: "user_titles", text: "Name a Devil Fruit eaten by one of the {value}", group: "t-fruit-title", skip: ["Clan of D.", "Marines", "Straw Hat Grand Fleet", "Ninja-Pirate-Mink-Samurai Alliance"] },
  { kind: "fruit",  field: "user_races",  text: "Name a Devil Fruit eaten by {a} {value}", group: "t-fruit-race", skip: ["Human", "Unknown"] },
  { kind: "place",  field: "sea",         text: "Name a place in the {value}", group: "t-place-sea", skip: ["Paradise", "Sky Islands", "Sea Floor", "Calm Belt"] },
  { kind: "place",  field: "place_type",  text: "Name {label}", group: "t-place-type", labels: {
      "Towns and Cities": "a town or city", "Mountains": "a mountain", "Twenty Kingdoms": "a kingdom of the Twenty Kingdoms",
      "Four Emperors Territories": "an island ruled by an Emperor (Yonko)", "Prisons": "a prison", "Kingdoms": "a kingdom",
      "Sky Islands": "a sky island", "Regimes": "a place with its own regime", "Marine Bases": "a Marine base",
      "Forests": "a forest", "Villages": "a village", "Countries": "a country", "Bases": "a base", "Islands": "an island" } },
  { kind: "weapon", field: "grade",       text: "Name {a} {value} sword", group: "t-weapon-grade" },
  { kind: "weapon", field: "owner_crews",  text: "Name a named weapon owned by a member of the {value}", group: "t-weapon-group" },
  { kind: "weapon", field: "owner_titles", text: "Name a named weapon owned by one of the {value}", group: "t-weapon-title", skip: ["Clan of D.", "Marines", "Straw Hat Grand Fleet", "Ninja-Pirate-Mink-Samurai Alliance"] },
  { kind: "ship",   field: "crew_names",  text: "Name a ship sailed by the {value}", group: "t-ship-crew" },
  { kind: "crew",   field: "captain_titles", text: "Name a crew whose captain is one of the {value}", group: "t-crew-capgroup", skip: ["Clan of D.", "Marines", "Straw Hat Grand Fleet", "Ninja-Pirate-Mink-Samurai Alliance"] },
  { kind: "crew",   field: "captain_fruit_types", text: "Name a crew whose captain ate {a} {value} Devil Fruit", group: "t-crew-capfruit" },
  // story events, battles, incidents
  { kind: "event",  field: "event_type",  text: "Name {label}", group: "t-event-type", labels: {
      "Battle": "a battle or war from the story", "Incident": "an incident from the story", "Operation": "a named operation or plan",
      "Competition": "a competition or contest from the story", "Event": "a festival, ceremony or natural event" } },
  { kind: "event",  field: "debut_saga",  text: "Name an event, battle or incident first shown or mentioned in the {value}", group: "t-event-saga" },
  // creatures
  { kind: "creature", field: "sea",       text: "Name a creature or animal species found in the {value}", group: "t-creature-sea", skip: ["Paradise", "Sky Islands", "Sea Floor", "Calm Belt"] },
  { kind: "creature", field: "location",  text: "Name a creature or animal species from {value}", group: "t-creature-loc" },
  { kind: "creature", field: "saga",      text: "Name a creature first seen in the {value}", group: "t-creature-saga" },
  // who fought whom (data/things/fights.csv)
  { kind: "character", field: "fought_names", text: "Name a character who fought {value}", group: "t-fought" }
];

// Written by hand.
window.THING_QUESTIONS = [
  // Devil Fruits
  { kind: "fruit", id: "t-fruit-any",      group: "t-fruit",   difficulty: "easy",   text: "Name a Devil Fruit", where: [] },
  { kind: "fruit", id: "t-fruit-dead",     group: "t-fruit",   text: "Name a Devil Fruit whose user has died", where: [["user_died", "is", "yes"]] },
  { kind: "fruit", id: "t-fruit-marine",   group: "t-fruit",   text: "Name a Devil Fruit eaten by a Marine", where: [["user_affiliation_types", "is", "Marine"]] },
  { kind: "fruit", id: "t-fruit-pirate",   group: "t-fruit",   text: "Name a Devil Fruit eaten by a pirate", where: [["user_affiliation_types", "is", "Pirate"]] },
  { kind: "fruit", id: "t-fruit-captain",  group: "t-fruit",   text: "Name a Devil Fruit eaten by a captain", where: [["user_roles", "is", "Captain"]] },
  { kind: "fruit", id: "t-fruit-two",      group: "t-fruit",   difficulty: "hard", text: "Name a Devil Fruit that has had more than one user", where: [["user_count", "gte", 2]] },
  { kind: "fruit", id: "t-fruit-model",    group: "t-fruit",   text: "Name a Devil Fruit with a Model (like Model: Phoenix)", where: [["name", "contains", "Model"]] },
  { kind: "fruit", id: "t-fruit-govt",     group: "t-fruit",   text: "Name a Devil Fruit eaten by someone in the World Government", where: [["user_affiliation_types", "is", "World Government"]] },
  // places
  { kind: "place", id: "t-place-any",      group: "t-place",   difficulty: "easy",   text: "Name an island or place in One Piece", where: [] },
  { kind: "place", id: "t-place-kingdom",  group: "t-place",   text: "Name a place with \"Kingdom\" in its name", where: [["name", "contains", "Kingdom"]] },
  { kind: "place", id: "t-place-island",   group: "t-place",   text: "Name a place with \"Island\" in its name", where: [["name", "contains", "Island"]] },
  { kind: "place", id: "t-place-calm",     group: "t-place",   difficulty: "hard", minAnswers: 3, text: "Name an island or place in the Calm Belt", where: [["sea", "is", "Calm Belt"]] },
  { kind: "place", id: "t-place-paradise", group: "t-place",   text: "Name a place in Paradise (the first half of the Grand Line)", where: [["sea", "is", "Paradise"]] },
  { kind: "place", id: "t-place-floor",    group: "t-place",   minAnswers: 3, text: "Name a place on the sea floor", where: [["sea", "is", "Sea Floor"]] },
  { kind: "place", id: "t-place-sky",      group: "t-place",   minAnswers: 3, text: "Name a sky island", where: [["sea", "is", "Sky Islands"]] },
  // weapons
  { kind: "weapon", id: "t-weapon-any",    group: "t-weapon",  difficulty: "easy",   text: "Name a named weapon", where: [] },
  { kind: "weapon", id: "t-weapon-sword",  group: "t-weapon",  text: "Name a named sword", where: [["subtype", "is", "Sword"]] },
  { kind: "weapon", id: "t-weapon-marine", group: "t-weapon",  text: "Name a named weapon owned by a Marine", where: [["owner_affiliation_types", "is", "Marine"]] },
  { kind: "weapon", id: "t-weapon-pirate", group: "t-weapon",  text: "Name a named weapon owned by a pirate", where: [["owner_affiliation_types", "is", "Pirate"]] },
  // ships
  { kind: "ship", id: "t-ship-any",        group: "t-ship",    difficulty: "easy",   text: "Name a ship", where: [] },
  { kind: "ship", id: "t-ship-pirate",     group: "t-ship",    text: "Name a pirate ship", where: [["crew_names", "filled"]] },
  { kind: "ship", id: "t-ship-sunk",       group: "t-ship",    text: "Name a ship that was destroyed", where: [["status", "is", "Destroyed"]] },
  { kind: "ship", id: "t-ship-emperor",    group: "t-ship",    text: "Name a ship sailed by an Emperor's crew", where: [["captain_groups", "is", "Four Emperors"]] },
  // crews
  { kind: "crew", id: "t-crew-any",        group: "t-crew",    difficulty: "easy",   text: "Name a pirate crew", where: [["name", "contains", "Pirates"]] },
  { kind: "crew", id: "t-crew-fruitcap",   group: "t-crew",    text: "Name a crew whose captain ate a Devil Fruit", where: [["captain_has_fruit", "is", "yes"]] },
  { kind: "crew", id: "t-crew-nofruitcap", group: "t-crew",    text: "Name a crew whose captain never ate a Devil Fruit", where: [["captain_has_fruit", "is", "no"]] },
  { kind: "crew", id: "t-crew-billion",    group: "t-crew",    text: "Name a crew with a total bounty over 1 billion", where: [["total_bounty", "gt", 1e9]] },
  { kind: "crew", id: "t-crew-fleet",      group: "t-crew",    text: "Name a crew in the Straw Hat Grand Fleet", where: [["affiliation", "contains", "Straw Hat Grand Fleet"]] },
  { kind: "crew", id: "t-crew-d",          group: "t-crew",    text: "Name a crew whose captain has the Will of D.", where: [["captain_titles", "is", "Clan of D."]] },
  { kind: "crew", id: "t-crew-worst",      group: "t-crew",    text: "Name a crew led by one of the Worst Generation", where: [["captain_groups", "is", "Worst Generation"]] },
  { kind: "crew", id: "t-crew-big",        group: "t-crew",    difficulty: "hard", text: "Name a crew with more than 20 named members", where: [["member_count", "gt", 20]] },
  // the rest
  { kind: "organization", id: "t-org-any", group: "t-org",     difficulty: "easy",   text: "Name an organization that isn't a pirate crew", where: [] },
  { kind: "organization", id: "t-org-wg",  group: "t-org",     text: "Name an organization tied to the World Government", where: [["affiliation", "contains", "World Government"]] },
  { kind: "style", id: "t-style-any",      group: "t-style",   text: "Name a named fighting style", where: [] },
  { kind: "race", id: "t-race-any",        group: "t-race",    text: "Name a race or tribe", where: [] },
  { kind: "event", id: "t-event-any",      group: "t-event",   difficulty: "easy", text: "Name a major event, war or incident from the story", where: [] },
  // creatures
  { kind: "creature", id: "t-creature-any", group: "t-creature", difficulty: "easy", text: "Name a creature or animal species from One Piece", where: [] },
  { kind: "creature", id: "t-creature-paradise", group: "t-creature", text: "Name a creature found in Paradise (the first half of the Grand Line)", where: [["sea", "is", "Paradise"]] },
  { kind: "creature", id: "t-creature-sky", group: "t-creature", text: "Name a creature from a sky island", where: [["sea", "is", "Sky Islands"]] },
  { kind: "creature", id: "t-creature-calm", group: "t-creature", minAnswers: 3, text: "Name a creature that lives in the Calm Belt", where: [["sea", "is", "Calm Belt"]] },
  { kind: "creature", id: "t-creature-dino", group: "t-creature", minAnswers: 3, text: "Name a dinosaur or prehistoric creature from Little Garden", where: [["location", "is", "Little Garden"]] },

  // character prompts that use the other tables (kind: "character")
  { kind: "character", id: "t-char-sword",   group: "t-char-own", text: "Name a character who owns a named sword", where: [["owns_named_sword", "is", "yes"]] },
  { kind: "character", id: "t-char-weapon",  group: "t-char-own", text: "Name a character who owns a named weapon", where: [["owns_named_weapon", "is", "yes"]] },
  { kind: "character", id: "t-char-captain", group: "t-char-own", text: "Name a character who captains a crew", where: [["captains_a_crew", "is", "yes"]] },
  { kind: "character", id: "t-char-ship",    group: "t-char-own", text: "Name a character who captains a named ship", where: [["ship_names", "filled"]] },
  { kind: "character", id: "t-char-style",   group: "t-char-own", text: "Name a character who uses a named fighting style", where: [["style_names", "filled"]] },
  { kind: "character", id: "t-char-animal",  group: "t-char-animal", difficulty: "easy", text: "Name an animal character or pet", where: [["race", "is", "Animal"]] }
];
