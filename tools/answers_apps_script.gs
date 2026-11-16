// One Pieces: collects every player's answers, events and feedback, hands back how often each answer is
// given, and keeps a live Dashboard tab.
//
// Setup (once, and again after editing this file):
// 1. Open the "One Pieces — Player Answers" Google Sheet > Extensions > Apps Script.
// 2. Replace everything in Code.gs with this file and press Save.
// 3. Pick "setup" in the function menu and press Run (creates the Events, Feedback and Dashboard tabs and
//    their headers; safe to run again). Approve if Google asks.
// 4. Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy. The /exec URL stays the
//    same, so js/config.js (statsEndpoint) doesn't change. A brand-new deployment would need the new URL.
//
// What the game sends (plain-text JSON POSTs, see sendRow / logAnswer / track in js/app.js):
//  - answers: one row per answer in "Answers". final=false rows are wrong guesses that were turned away;
//    first=false rows are a browser answering the same prompt again the same day (a replay).
//  - events ({event: ...}): visit, start, daily-start (value = how many times this browser started today's
//    daily), finish, wanted, blind, tierlist, fight in "Events"; feedback goes to "Feedback".
// Players are an anonymous random id per browser (pid). No names, emails or other personal data.
//
// GET ?stats=1 returns {"<prompt id>": {"plays": n, "counts": {"<answer id>": n}, "modes": {...}}} built
// from first, final answers only, so replays and wrong guesses don't move the tiers.

const ANSWERS = "Answers", EVENTS = "Events", FEEDBACK = "Feedback", DASH = "Dashboard";
const ANSWER_HEAD = ["time", "day", "prompt", "kind", "answer", "right", "mode", "difficulty",
  "player", "session", "daily run", "first try", "final", "ms", "wrong guesses", "tier", "points", "skipped", "device"];
const EVENT_HEAD = ["time", "day", "player", "session", "event", "mode", "detail", "value", "difficulty", "device"];
const FEEDBACK_HEAD = ["time", "day", "player", "kind", "message", "screen", "device", "done?"];

function dayOf(s) {                         // "2026-11-16" -> a real date cell (so TODAY() works in formulas)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
}
const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
function sheet(name, head) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (head && sh.getLastRow() === 0) { sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight("bold"); }
  return sh;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const r = JSON.parse(e.postData.contents);
    if (r.event === "feedback") {
      sheet(FEEDBACK, FEEDBACK_HEAD).appendRow([clip(r.t, 30), dayOf(r.day), clip(r.pid, 12), clip(r.mode, 20),
        clip(r.detail, 1000), clip(r.value, 20), clip(r.device, 10), ""]);
      return ContentService.createTextOutput("ok");
    }
    if (r.event) {
      sheet(EVENTS, EVENT_HEAD).appendRow([clip(r.t, 30), dayOf(r.day), clip(r.pid, 12), clip(r.sid, 12), clip(r.event, 20),
        clip(r.mode, 20), clip(r.detail, 900), r.value === "" || r.value == null ? "" : r.value, clip(r.difficulty, 12), clip(r.device, 10)]);
      return ContentService.createTextOutput("ok");
    }
    if (!r.prompt) return ContentService.createTextOutput("missing prompt");
    sheet(ANSWERS, ANSWER_HEAD).appendRow([
      clip(r.t, 30), dayOf(r.day), clip(r.prompt, 120), clip(r.kind, 20), clip(r.answer, 80), r.ok === true, clip(r.mode, 15), clip(r.difficulty, 10),
      clip(r.pid, 12), clip(r.sid, 12), r.run == null ? "" : r.run, r.first === false ? false : true, r.final === false ? false : true,
      r.ms === "" || r.ms == null ? "" : Math.round(r.ms), r.wrongs || 0, clip(r.tier, 12), r.points || 0, r.skipped === true, clip(r.device, 10)
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
    const rows = SpreadsheetApp.getActive().getSheetByName(ANSWERS).getDataRange().getValues().slice(1);
    const stats = {};
    for (const row of rows) {
      const prompt = row[2], answer = row[4], ok = row[5];
      if (!prompt) continue;
      if (row[12] === false || row[11] === false) continue;          // wrong guesses and replays don't count
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

// ---------- setup: tabs, headers and the live Dashboard (all formulas, so it updates by itself) ----------
function setup() {
  const ans = sheet(ANSWERS, ANSWER_HEAD);
  // older Answers tabs had 8 columns: add the new headers alongside
  const have = ans.getRange(1, 1, 1, ans.getMaxColumns()).getValues()[0];
  if (!have[8]) {
    if (ans.getMaxColumns() < ANSWER_HEAD.length) ans.insertColumnsAfter(ans.getMaxColumns(), ANSWER_HEAD.length - ans.getMaxColumns());
    ans.getRange(1, 1, 1, ANSWER_HEAD.length).setValues([ANSWER_HEAD]).setFontWeight("bold");
    ans.setFrozenRows(1);
  }
  sheet(EVENTS, EVENT_HEAD);
  const fb = sheet(FEEDBACK, FEEDBACK_HEAD);
  fb.getRange("H2:H").insertCheckboxes();
  buildDashboard();
}

function buildDashboard() {
  const ss = SpreadsheetApp.getActive();
  let d = ss.getSheetByName(DASH);
  if (d) ss.deleteSheet(d);                    // fresh tab each time (no leftover formats)
  d = ss.insertSheet(DASH, 0);
  const E = "Events!", A = "Answers!", F = "Feedback!";
  const put = (cell, v) => (String(v).startsWith("=") ? d.getRange(cell).setFormula(v) : d.getRange(cell).setValue(v));
  const title = (cell, v) => { put(cell, v); d.getRange(cell).setFontWeight("bold").setFontSize(12).setFontColor("#4b5c92"); };

  put("A1", "One Pieces — live dashboard"); d.getRange("A1").setFontSize(16).setFontWeight("bold");
  put("A2", "Updates by itself. A player = one browser (anonymous id). Dates are your sheet's time zone.");
  d.getRange("A2").setFontColor("#777777");

  // headline numbers
  const stats = [
    ["Players today", `=COUNTUNIQUEIFS(${E}C2:C, ${E}B2:B, TODAY(), ${E}C2:C, "<>")`],
    ["Players, last 7 days", `=COUNTUNIQUEIFS(${E}C2:C, ${E}B2:B, ">="&(TODAY()-6), ${E}C2:C, "<>")`],
    ["Players, last 30 days", `=COUNTUNIQUEIFS(${E}C2:C, ${E}B2:B, ">="&(TODAY()-29), ${E}C2:C, "<>")`],
    ["Players, all time", `=COUNTUNIQUEIFS(${E}C2:C, ${E}C2:C, "<>")`],
    ["New players today", `=COUNTIFS(${E}E2:E, "visit", ${E}G2:G, "new", ${E}B2:B, TODAY())`],
    ["Finished today's daily", `=COUNTUNIQUEIFS(${E}C2:C, ${E}E2:E, "finish", ${E}F2:F, "rarefind", ${E}B2:B, TODAY())`],
    ["Started the daily again today (replays)", `=COUNTIFS(${E}E2:E, "daily-start", ${E}H2:H, ">1", ${E}B2:B, TODAY())`],
    ["Average daily score today (nmi)", `=IFERROR(ROUND(AVERAGEIFS(${E}H2:H, ${E}E2:E, "finish", ${E}F2:F, "rarefind", ${E}B2:B, TODAY())), "—")`],
    ["Wanted dailies played today", `=COUNTIFS(${E}E2:E, "wanted", ${E}F2:F, "daily", ${E}B2:B, TODAY())`],
    ["Feedback not done yet", `=COUNTIFS(${F}A2:A, "<>", ${F}H2:H, FALSE)`]
  ];
  title("A4", "Right now");
  stats.forEach(([label, f], i) => { put(`A${5 + i}`, label); put(`B${5 + i}`, f); });
  d.getRange("B5:B14").setFontWeight("bold").setHorizontalAlignment("left");

  // players by day (last 30 days)
  title("A17", "By day (last 30 days)");
  const heads = ["Day", "Players", "New", "Daily finished", "Daily replays", "Avg daily nmi", "Endless runs", "Wanted played", "Wanted caught", "Blind / tier / fight", "Feedback"];
  d.getRange(18, 1, 1, heads.length).setValues([heads]).setFontWeight("bold");
  put("A19", `=IFERROR(LET(days, SORT(UNIQUE(FILTER(${E}B2:B, ${E}B2:B<>"", ${E}B2:B>=TODAY()-29)), 1, FALSE),
    HSTACK(days,
      MAP(days, LAMBDA(x, COUNTUNIQUEIFS(${E}C2:C, ${E}B2:B, x, ${E}C2:C, "<>"))),
      MAP(days, LAMBDA(x, COUNTIFS(${E}B2:B, x, ${E}E2:E, "visit", ${E}G2:G, "new"))),
      MAP(days, LAMBDA(x, COUNTUNIQUEIFS(${E}C2:C, ${E}B2:B, x, ${E}E2:E, "finish", ${E}F2:F, "rarefind"))),
      MAP(days, LAMBDA(x, COUNTIFS(${E}B2:B, x, ${E}E2:E, "daily-start", ${E}H2:H, ">1"))),
      MAP(days, LAMBDA(x, IFERROR(ROUND(AVERAGEIFS(${E}H2:H, ${E}B2:B, x, ${E}E2:E, "finish", ${E}F2:F, "rarefind")), ""))),
      MAP(days, LAMBDA(x, COUNTIFS(${E}B2:B, x, ${E}E2:E, "start", ${E}F2:F, "endless"))),
      MAP(days, LAMBDA(x, COUNTIFS(${E}B2:B, x, ${E}E2:E, "wanted"))),
      MAP(days, LAMBDA(x, COUNTIFS(${E}B2:B, x, ${E}E2:E, "wanted", ${E}G2:G, "caught*"))),
      MAP(days, LAMBDA(x, COUNTIFS(${E}B2:B, x, ${E}E2:E, "start", ${E}F2:F, "blind") + COUNTIFS(${E}B2:B, x, ${E}E2:E, "start", ${E}F2:F, "tierlist") + COUNTIFS(${E}B2:B, x, ${E}E2:E, "start", ${E}F2:F, "fighter"))),
      MAP(days, LAMBDA(x, COUNTIFS(${F}B2:B, x))))), "No events yet")`);
  d.getRange("A19:A48").setNumberFormat("ddd mmm d");

  // today's daily, prompt by prompt (first tries only)
  title("A51", "Today's daily, prompt by prompt (first tries only)");
  const ph = ["Prompt", "Players", "% right", "Skipped", "Timed out", "Avg seconds", "Avg wrong guesses", "Top answers", "Most common wrong guesses"];
  d.getRange(52, 1, 1, ph.length).setValues([ph]).setFontWeight("bold");
  put("A53", `=IFERROR(LET(
      r, FILTER(${A}A2:S, ${A}B2:B=TODAY(), ${A}G2:G="rarefind", ${A}M2:M<>FALSE, ${A}L2:L<>FALSE),
      w, FILTER(${A}A2:S, ${A}B2:B=TODAY(), ${A}G2:G="rarefind", ${A}M2:M=FALSE),
      p, UNIQUE(INDEX(r, , 3)),
      top, LAMBDA(col, LET(u, UNIQUE(col), c, MAP(u, LAMBDA(v, COUNTIF(col, v))), s, SORT(HSTACK(u, c), 2, FALSE), TEXTJOIN(", ", TRUE, ARRAY_CONSTRAIN(INDEX(s, , 1) & " (" & INDEX(s, , 2) & ")", 6, 1)))),
      HSTACK(p,
        MAP(p, LAMBDA(x, COUNTIF(INDEX(r, , 3), x))),
        MAP(p, LAMBDA(x, ROUND(100 * COUNTIFS(INDEX(r, , 3), x, INDEX(r, , 6), TRUE) / COUNTIF(INDEX(r, , 3), x)))),
        MAP(p, LAMBDA(x, COUNTIFS(INDEX(r, , 3), x, INDEX(r, , 18), TRUE))),
        MAP(p, LAMBDA(x, COUNTIFS(INDEX(r, , 3), x, INDEX(r, , 16), "becalmed", INDEX(r, , 18), FALSE))),
        MAP(p, LAMBDA(x, IFERROR(ROUND(AVERAGEIFS(INDEX(r, , 14), INDEX(r, , 3), x) / 1000, 1), ""))),
        MAP(p, LAMBDA(x, IFERROR(ROUND(AVERAGEIFS(INDEX(r, , 15), INDEX(r, , 3), x), 1), ""))),
        MAP(p, LAMBDA(x, IFERROR(top(FILTER(INDEX(r, , 5), INDEX(r, , 3)=x, INDEX(r, , 6)=TRUE)), ""))),
        MAP(p, LAMBDA(x, IFERROR(top(FILTER(INDEX(w, , 5), INDEX(w, , 3)=x)), ""))))), "No daily answers yet today")`);

  // what people play (last 7 days)
  title("A64", "What people play (last 7 days)");
  put("A65", `=IFERROR(QUERY(${E}A2:J, "select F, count(F) where E = 'start' and B >= date '" & TEXT(TODAY()-6, "yyyy-mm-dd") & "' group by F order by count(F) desc label F 'Mode', count(F) 'Starts'", 0), "Nothing yet")`);
  title("D64", "Devices (last 7 days)");
  put("D65", `=IFERROR(QUERY(${E}A2:J, "select J, count(J) where E = 'visit' and B >= date '" & TEXT(TODAY()-6, "yyyy-mm-dd") & "' group by J label J 'Device', count(J) 'Visits'", 0), "Nothing yet")`);

  // newest feedback
  title("A78", "Newest feedback (tick 'done?' in the Feedback tab when handled)");
  put("A79", `=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER({${F}A2:A, ${F}D2:D, ${F}E2:E, ${F}F2:F, ${F}H2:H}, ${F}A2:A<>""), 1, FALSE), 25, 5), "No feedback yet")`);

  d.setColumnWidth(1, 250);
  d.getRange("A53:I62").setWrap(true).setVerticalAlignment("top"); d.setColumnWidth(8, 260); d.setColumnWidth(9, 260);
  d.setFrozenRows(2);
}
