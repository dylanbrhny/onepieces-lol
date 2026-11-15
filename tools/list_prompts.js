// Writes data/prompts_all.csv: every prompt the game can make from your current data,
// with how many characters answer it right now and whether it is playable yet.
// Run from the log-pose folder (after tools/build_data.py):   node tools/list_prompts.js
// Combinations below the answer bar are left out (there can be 100,000+); add --all to include them.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["js/config.js", "js/questions.js", "data/characters.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx);
const W = ctx.window;
globalThis.TAG_CATALOG = W.TAG_CATALOG || {};
globalThis.QUESTION_COMBOS = W.QUESTION_COMBOS;
const E = require(path.join(ROOT, "js/engine.js"));
const C = W.GAME_CONFIG;
const data = E.prepare(W.CHARACTER_DATA || [], C);

// single-fact prompts (templates + hand-written), playable or not
const singles = E.buildQuestions(data, W.QUESTION_TEMPLATES, W.QUESTIONS, { ...C, minAnswers: 0 })
  .playable.filter(q => !q.combo);
// tags nobody has yet still get listed, with 0 answers
const usedTagPrompts = new Set(singles.map(q => q.text));
for (const [tag, e] of Object.entries(W.TAG_CATALOG || {})) {
  if (e.prompt && !usedTagPrompts.has(e.prompt)) singles.push({ text: e.prompt, group: `tags:${e.group}`, answers: [], tagOnly: tag });
}
// combinations, including the ones below the answer bar
const ALL = process.argv.includes("--all");
const combos = E.comboQuestions(data, W.QUESTION_COMBOS, C, { includeSmall: ALL }).list;

const minS = C.minAnswers, minC = (W.QUESTION_COMBOS || {}).minAnswers || minS;
const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
const rows = [["prompt", "kind", "group", "answers_now", "playable_now", "example_answers"]];
const ex = q => q.answers.slice().sort((a, b) => data.byId.get(b)._fame - data.byId.get(a)._fame).slice(0, 5).map(id => data.byId.get(id).name).join(" | ");
for (const q of singles) rows.push([q.text, q.tagOnly ? "tag (unused)" : "single", q.group || "", q.answers.length, q.answers.length >= minS ? "yes" : "no", ex(q)]);
for (const q of combos) rows.push([q.text, "combination", q.group, q.answers.length, q.answers.length >= minC ? "yes" : "no", ex(q)]);
const out = path.join(ROOT, "data", "prompts_all.csv");
fs.writeFileSync(out, rows.map(r => r.map(esc).join(",")).join("\n") + "\n");

const playS = singles.filter(q => q.answers.length >= minS).length, playC = combos.filter(q => q.answers.length >= minC).length;
console.log(`Wrote ${rows.length - 1} prompts to data/prompts_all.csv`);
console.log(`  single-fact: ${singles.length} (${playS} playable now)`);
console.log(`  combinations: ${combos.length} (${playC} playable now)`);
