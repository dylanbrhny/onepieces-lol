// Prompts for Rare Find.
//
// Two kinds:
// 1. QUESTION_TEMPLATES make one prompt per value found in your data, so the pool
//    grows on its own as you add characters (every crew, every race, every arc...).
// 2. QUESTIONS are written by hand for anything a template can't say.
//
// A condition is [column, operator, value]. All conditions in "where" must be true.
// Operators:
//   "is"        equals (for list columns: any item equals)      ["race", "is", "Fish-Man"]
//   "isNot"     the opposite of "is"                             ["race", "isNot", "Human"]
//   "contains"  text contains (any item for lists)               ["devil_fruits", "contains", "Model"]
//   "filled"    has any value                                    ["devil_fruits", "filled"]
//   "empty"     has no value                                     ["devil_fruits", "empty"]
//   "gt" "gte" "lt" "lte"  number compare                        ["height_cm", "gt", 300]
//   "between"   number in [low, high]                            ["first_episode", "between", [1, 61]]
//   "countGte"  list has at least N items                        ["devil_fruits", "countGte", 2]
// "group" stops two prompts about the same thing landing on the same day.

window.QUESTION_TEMPLATES = [
  { field: "organizations",     text: "Name a member of the {value}", group: "org" },
  { field: "race",              text: "Name {a} {value}", group: "race", skip: ["Human", "Unknown"] },
  { field: "devil_fruit_types", text: "Name {a} {value} Devil Fruit user", group: "fruit" },
  { field: "fighting_style",    text: "Name a character whose fighting style is {value}", group: "style" },
  { field: "crew_role",         text: "Name {a} {value}", group: "role", skip: ["Officer", "Agent"] },
  { field: "hair_color",        text: "Name a character with {value} hair", group: "hair", skip: ["None"] },
  { field: "origin_sea",        text: "Name a character from the {value}", group: "sea" },
  { field: "debut_arc",         text: "Name a character who debuted in the {value}", group: "debut" },
  { field: "debut_saga",        text: "Name a character who debuted in the {value}", group: "debut" },
  { field: "haki",              text: "Name {a} {value} Haki user", group: "haki" },
  { field: "weapons",           text: "Name a character who fights with {a} {lower}", group: "weapon" },
  // tags: each prompt comes from data/tags.csv (tag -> prompt), so add new tag prompts there
  { field: "tags",              catalog: "TAG_CATALOG", group: "tag" }
];

window.QUESTIONS = [
  { id: "fruit-any",   group: "fruit",  text: "Name a character who ate a Devil Fruit",        where: [["devil_fruits", "filled"]] },
  { id: "fruit-none",  group: "fruit",  text: "Name a character who never ate a Devil Fruit",  where: [["devil_fruits", "empty"]] },
  { id: "fruit-two",   group: "fruit",  text: "Name a character with two Devil Fruits",        where: [["devil_fruits", "countGte", 2]] },
  { id: "fruit-model", group: "fruit",  text: "Name a Mythical or Model Zoan user",            where: [["devil_fruits", "contains", "Model"]] },
  { id: "pirate",      group: "aff",    text: "Name a character on a pirate crew",             where: [["affiliation_type", "is", "Pirate"], ["organizations", "filled"]] },
  { id: "marine",      group: "aff",    text: "Name a Marine, past or present",                where: [["organizations", "is", "Marines"]] },
  { id: "govt",        group: "aff",    text: "Name someone who works for the World Government", where: [["affiliation_type", "is", "World Government"]] },
  { id: "tall-3m",     group: "height", text: "Name a character taller than 3 meters",         where: [["height_cm", "gt", 300]] },
  { id: "short",       group: "height", text: "Name a character shorter than Luffy (174 cm)",  where: [["height_cm", "lt", 174]] },
  { id: "billion",     group: "bounty", text: "Name a character with a bounty over 1 billion", where: [["bounty_peak", "gt", 1000000000]] },
  { id: "sh-nonhuman", group: "org",    text: "Name a Straw Hat who isn't human",              where: [["organizations", "is", "Straw Hat Pirates"], ["race", "isNot", "Human"]] },
  // "anyOf" = a character fits if ANY one of these condition lists is fully true (combined with "where" if both are given).
  { id: "east-blue",   group: "debut",  text: "Name a character who debuted in the East Blue Saga", anyOf: [
      [["debut_saga", "is", "East Blue Saga"]],
      [["debut_arc", "is", "Romance Dawn Arc"]], [["debut_arc", "is", "Orange Town Arc"]], [["debut_arc", "is", "Syrup Village Arc"]],
      [["debut_arc", "is", "Baratie Arc"]], [["debut_arc", "is", "Arlong Park Arc"]], [["debut_arc", "is", "Loguetown Arc"]]
    ] },
  { id: "deceased",    group: "status", text: "Name a character who has died",                 where: [["status", "is", "Deceased"]] },
  { id: "former-warlord-pirate", group: "org", text: "Name a Warlord who was also a captain",  where: [["organizations", "is", "Seven Warlords"], ["crew_role", "is", "Captain"]] }
];

// =====================================================================
// FACTS THE GAME WORKS OUT ITSELF (no extra typing)
// From `name`: name_initials (first letter of each part of the name, "D." skipped),
// name_letters (rare letters J K Q V W X Y Z), name_words, will_of_d, name_has_number,
// name_double_letter. From `birthday` (MM-DD): birth_month, zodiac.
// =====================================================================
window.QUESTION_TEMPLATES.push(
  { field: "name_initials", text: "Name a character with {value} in their initials", group: "name-initial" },
  { field: "name_letters",  text: "Name a character with the letter {value} in their name", group: "name-letter" },
  { field: "birth_month",   text: "Name a character born in {value}", group: "birthday" },
  { field: "sex",           text: "Name a {lower} character", group: "sex", skip: ["Male"] },
  { field: "status",        text: "Name a character whose status is {lower}", group: "status", skip: ["Alive", "Deceased"] }
);

window.QUESTIONS.push(
  { id: "will-of-d",    group: "name", text: "Name someone who has the Will of D.",          where: [["will_of_d", "is", "yes"]] },
  { id: "number-name",  group: "name", text: "Name a character with a number in their name",      where: [["name_has_number", "is", "yes"]] },
  { id: "double-name",  group: "name", text: "Name a character with a double letter in their name", where: [["name_double_letter", "is", "yes"]] },
  { id: "one-word",     group: "name", text: "Name a character known by a one-word name",         where: [["name_words", "lte", 1]] },
  { id: "three-part",   group: "name", text: "Name a character with three or more parts to their name", where: [["name_words", "gte", 3]] },
  { id: "has-epithet",  group: "epithet", text: "Name a character with an epithet",              where: [["epithet", "filled"]] },
  { id: "fruit-paramecia-none", group: "fruit", text: "Name a pirate captain who never ate a Devil Fruit", where: [["crew_role", "is", "Captain"], ["devil_fruits", "empty"]] }
);

// Number ranges, written as loops so you can add a threshold by adding a number.
const bountyText = n => (n >= 1e9 ? `${n / 1e9} billion` : `${n / 1e6} million`);
[200, 250, 300, 400, 500, 1000].forEach(cm => window.QUESTIONS.push(
  { id: `taller-${cm}`, group: "height", text: `Name a character taller than ${cm / 100} meters`, where: [["height_cm", "gt", cm]] }));
[180, 160, 150, 120, 100].forEach(cm => window.QUESTIONS.push(
  { id: `shorter-${cm}`, group: "height", text: `Name a character shorter than ${cm / 100} meters`, where: [["height_cm", "lt", cm]] }));
[1e7, 5e7, 1e8, 3e8, 5e8, 2e9, 3e9].forEach(b => window.QUESTIONS.push(
  { id: `bounty-${b}`, group: "bounty", text: `Name a character with a bounty over ${bountyText(b)}`, where: [["bounty_peak", "gt", b]] }));
[[1e6, 1e8], [1e8, 5e8], [5e8, 1e9]].forEach(([lo, hi]) => window.QUESTIONS.push(
  { id: `bounty-${lo}-${hi}`, group: "bounty", text: `Name a character with a bounty between ${bountyText(lo)} and ${bountyText(hi)}`, where: [["bounty_peak", "between", [lo, hi]]] }));
[10, 50, 100, 200, 300, 400].forEach(ep => window.QUESTIONS.push(
  { id: `debut-ep-${ep}`, group: "debut-ep", text: `Name a character who appeared in the first ${ep} episodes`, where: [["first_episode", "lte", ep]] }));
[500, 700, 900, 1000].forEach(ep => window.QUESTIONS.push(
  { id: `debut-after-${ep}`, group: "debut-ep", text: `Name a character who first appeared after episode ${ep}`, where: [["first_episode", "gt", ep]] }));
[50, 100, 300, 600].forEach(ch => window.QUESTIONS.push(
  { id: `debut-ch-${ch}`, group: "debut-ch", text: `Name a character who appeared in the first ${ch} manga chapters`, where: [["first_chapter", "lte", ch]] }));

// =====================================================================
// COMBINATIONS: every SUBJECT x every CLAUSE -> "Name a Marine who smokes".
// Only combinations with enough right answers are kept, so the count grows with your data.
// At most `perDay` of the daily 7 prompts are combinations.
// =====================================================================
window.QUESTION_COMBOS = {
  minAnswers: 5,
  perDay: 3,
  subjects: [
    { field: "affiliation_type", text: "{a} {value}", skip: ["Civilian"] },   // a Pirate, a Marine
    { field: "race",             text: "{a} {value}", skip: ["Human", "Unknown"] },
    { field: "organizations",    text: "a member of the {value}" },
    { field: "crew_role",        text: "{a} {value}", skip: ["Officer", "Agent"] },
    { field: "sex",              labels: { Female: "a female character" } },
    { field: "origin_sea",       text: "a character from the {value}" },
    { field: "debut_saga",       text: "a {value} character" },               // a Water 7 Saga character
    { field: "devil_fruit_types", text: "{a} {value} user" },
    { id: "s-fruit",  text: "a Devil Fruit user",            where: [["devil_fruits", "filled"]] },
    { id: "s-nofruit", text: "a character without a Devil Fruit", where: [["devil_fruits", "empty"]] },
    { id: "s-captain-pirate", text: "a pirate captain",      where: [["affiliation_type", "is", "Pirate"], ["crew_role", "is", "Captain"]] }
  ],
  clauses: [
    { field: "hair_color",        text: "with {value} hair", group: "hair", skip: ["None"] },
    { field: "devil_fruit_types", text: "who ate {a} {value} Devil Fruit", group: "fruit" },
    { id: "c-nofruit", text: "who never ate a Devil Fruit", group: "fruit", where: [["devil_fruits", "empty"]] },
    { field: "haki",              text: "who can use {value} Haki", group: "haki" },
    { field: "weapons",           text: "who fights with {a} {lower}", group: "weapon" },
    { field: "fighting_style",    text: "who fights as {a} {value}", group: "style" },
    { field: "tags",              fromTags: true, group: "tag" },          // every tag in data/tags.csv
    { field: "name_initials",     text: "with {value} in their initials", group: "name" },
    { field: "name_letters",      text: "with the letter {value} in their name", group: "name" },
    { field: "origin_sea",        text: "from the {value}", group: "sea" },
    { field: "debut_saga",        text: "who debuted in the {value}", group: "debut" },
    { field: "birth_month",       text: "born in {value}", group: "birthday" },
    { id: "c-dname",   text: "who has the Will of D.",       group: "name",   where: [["will_of_d", "is", "yes"]] },
    { id: "c-tall",    text: "taller than 3 meters",          group: "height", where: [["height_cm", "gt", 300]] },
    { id: "c-short",   text: "shorter than 1.7 meters",       group: "height", where: [["height_cm", "lt", 170]] },
    { id: "c-100m",    text: "with a bounty over 100 million", group: "bounty", where: [["bounty_peak", "gt", 1e8]] },
    { id: "c-1b",      text: "with a bounty over 1 billion",  group: "bounty", where: [["bounty_peak", "gt", 1e9]] },
    { id: "c-dead",    text: "who has died",                  group: "status", where: [["status", "is", "Deceased"]] },
    { id: "c-epithet", text: "with an epithet",               group: "epithet", where: [["epithet", "filled"]] },
    // name-length puzzles (hard): letters only, spaces and dots don't count
    { id: "c-name-lt10", text: "with fewer than 10 letters in their full name", group: "name", difficulty: "hard", where: [["name_length", "lt", 10]] },
    { id: "c-name-le5",  text: "with 5 letters or fewer in their full name",   group: "name", difficulty: "hard", where: [["name_length", "lte", 5]] },
    { id: "c-name-gt15", text: "with more than 15 letters in their full name", group: "name", difficulty: "hard", where: [["name_length", "gt", 15]] }
  ]
};
