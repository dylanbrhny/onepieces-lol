// Log Pose: collects every player's answers and hands back how often each answer is given.
//
// Setup (once):
// 1. Open the "Log Pose — Player Answers" Google Sheet > Extensions > Apps Script.
// 2. Replace everything in Code.gs with this file and press Save.
// 3. Deploy > New deployment > type "Web app": Execute as "Me", Who has access "Anyone". Deploy, approve.
// 4. Copy the Web app URL (ends in /exec) into statsEndpoint in js/config.js.
//
// The game POSTs one answer at a time (plain-text JSON, see logAnswer in js/app.js) and, when it loads,
// GETs ?stats=1 to receive {"<prompt id>": {"plays": n, "counts": {"<answer id>": n},
//                          "modes": {"easy" | "medium" | "hard": {"plays": n, "counts": {...}}}}}.
// Super Easy answers count as Easy. Each difficulty's tiers lean on its own players' counts.
// No names, emails or other personal data are sent: only prompt, answer, day, mode and difficulty.

const SHEET_NAME = "Answers";

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const r = JSON.parse(e.postData.contents);
    const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
    if (!r.prompt) return ContentService.createTextOutput("missing prompt");
    SpreadsheetApp.getActive().getSheetByName(SHEET_NAME).appendRow([
      clip(r.t, 30), clip(r.day, 10), clip(r.prompt, 120), clip(r.kind, 20),
      clip(r.answer, 80), r.ok === true, clip(r.mode, 15), clip(r.difficulty, 10)
    ]);
    return ContentService.createTextOutput("ok");
  } catch (err) {
    return ContentService.createTextOutput("error");
  } finally {
    try { lock.releaseLock(); } catch (e2) { /* not held */ }
  }
}

function doGet(e) {
  const cache = CacheService.getScriptCache();
  let body = cache.get("stats");
  if (!body) {
    const rows = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME).getDataRange().getValues().slice(1);
    const stats = {};
    for (const row of rows) {
      const prompt = row[2], answer = row[4], ok = row[5];
      if (!prompt) continue;
      let mode = String(row[7] || "").toLowerCase();
      if (mode === "supereasy") mode = "easy";
      const s = stats[prompt] || (stats[prompt] = { plays: 0, counts: {}, modes: {} });
      const m = mode && (s.modes[mode] || (s.modes[mode] = { plays: 0, counts: {} }));
      s.plays++;
      if (m) m.plays++;
      if (ok === true && answer) {
        s.counts[answer] = (s.counts[answer] || 0) + 1;
        if (m) m.counts[answer] = (m.counts[answer] || 0) + 1;
      }
    }
    body = JSON.stringify(stats);
    if (body.length < 95000) cache.put("stats", body, 600);   // 10 minutes
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
