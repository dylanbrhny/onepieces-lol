#!/usr/bin/env python3
"""Turn data/characters.csv into data/characters.js (the file the game loads).

Run from the log-pose folder:
    python3 -I tools/build_data.py

What it does
- Checks every row: id and name present, ids unique, numbers are numbers.
- Splits list columns on "|" (e.g. "Straw Hat Pirates|Four Emperors").
- Fills debut_arc and debut_saga from first_episode, using ../onepiece/episodes.csv
  when that file exists (pass --episodes PATH to point somewhere else).
- Finds pictures: if the image column is blank it looks for
  assets/characters/<id>.png / .jpg / .jpeg / .webp / .gif.
- Prints a report: how filled each column is and the most common values,
  so you can see which questions will have enough answers.
"""
import argparse
import csv
import difflib
import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIST_FIELDS = {"aliases", "organizations", "devil_fruits", "devil_fruit_types", "haki",
               "fighting_style", "crew_role", "weapons", "tags", "devil_fruit_names"}
NUMBER_FIELDS = {"height_cm", "first_episode", "first_chapter", "bounty_peak", "appearances", "fame"}
REPORT_FIELDS = ["race", "sex", "origin_sea", "affiliation_type", "organizations", "devil_fruit_types",
                 "haki", "fighting_style", "weapons", "hair_color", "debut_arc", "debut_saga", "status", "tags"]
IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"]


def load_episodes(path):
    if not path or not os.path.exists(path):
        return {}
    csv.field_size_limit(10 ** 9)
    eps = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            try:
                eps[int(row["number"])] = (row.get("arc", "").strip(), row.get("saga", "").strip())
            except (KeyError, ValueError):
                continue
    return eps


def arc_list(path):
    """Arcs in order with their last episode and last manga chapter."""
    if not path or not os.path.exists(path):
        return []
    csv.field_size_limit(10 ** 9)
    arcs = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            try:
                ep = int(row["number"])
            except (KeyError, ValueError):
                continue
            arc = (row.get("arc") or "").strip()
            if not arc:
                continue
            chs = [int(x) for x in re.findall(r"\d+", row.get("manga_chapters") or "")]
            if not arcs or arcs[-1]["arc"] != arc:
                if any(a["arc"] == arc for a in arcs):
                    a = next(a for a in arcs if a["arc"] == arc)
                    a["last_ep"] = max(a["last_ep"], ep)
                    if chs:
                        a["last_ch"] = max(a["last_ch"], max(chs))
                    continue
                arcs.append({"arc": arc, "saga": (row.get("saga") or "").strip(), "first_ep": ep, "last_ep": ep, "last_ch": 0})
            a = arcs[-1]
            a["last_ep"] = ep
            if chs:
                a["last_ch"] = max(a["last_ch"], max(chs))
    best = 0
    for a in arcs:                       # filler arcs have no chapters: carry the last canon chapter forward
        best = max(best, a["last_ch"])
        a["last_ch"] = best
    return arcs


def fruit_variants(fruit):
    """All the ways a player might type a Devil Fruit's name."""
    out = []
    base = re.split(r",?\s*Model\s*:", fruit)[0].strip()
    for name in {fruit.strip(), base}:
        if not name:
            continue
        out.append(name)
        jp = re.match(r"^(.+?) no Mi$", name, re.I)
        if jp:
            out.append(jp.group(1))                      # Mera Mera
            half = jp.group(1).split(" ")
            if len(half) == 2 and half[0].lower() == half[1].lower():
                out.append(half[0] + " no Mi")           # Mera no Mi
        en = re.match(r"^(.+?)-(.+?) Fruit$", name, re.I)
        if en and en.group(1).lower() == en.group(2).lower():
            out.append(en.group(1) + " Fruit")           # Flame Fruit
            out.append(en.group(1) + " " + en.group(1) + " Fruit")
    return out


def to_number(value):
    v = value.replace(",", "").replace("_", "").strip()
    if v == "":
        return None
    try:
        n = float(v)
    except ValueError:
        return "BAD"
    return int(n) if n.is_integer() else n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=os.path.join(ROOT, "data", "characters.csv"))
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "characters.js"))
    ap.add_argument("--episodes", default=os.path.join(os.path.dirname(ROOT), "onepiece", "episodes.csv"))
    ap.add_argument("--include-noncanon", action="store_true",
                    help="also put filler/movie/game characters (canon = no) in the game")
    args = ap.parse_args()
    skipped_noncanon = 0

    episodes = load_episodes(args.episodes)
    tags_path = os.path.join(ROOT, "data", "tags.csv")
    catalog = {}
    if os.path.exists(tags_path):
        with open(tags_path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                tag = (row.get("tag") or "").strip()
                if tag:
                    catalog[tag] = {"prompt": (row.get("prompt") or "").strip(), "group": (row.get("group") or "").strip()}
    # tags from tools/tag_characters.py (+ your fixes in tags_add / tags_remove / weapons_add)
    char_tags = {}
    char_tags_path = os.path.join(ROOT, "data", "character_tags.csv")
    if os.path.exists(char_tags_path):
        with open(char_tags_path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                split = lambda k: [p.strip() for p in (row.get(k) or "").split("|") if p.strip()]
                char_tags[(row.get("id") or "").strip()] = {
                    "tags": split("tags_auto") + split("tags_add"), "remove": set(split("tags_remove")),
                    "weapons": split("weapons_auto") + split("weapons_add")}
    # tags from the Claude tagging pass (data/character_tags_ai.csv). tags_remove above still wins.
    ai_path = os.path.join(ROOT, "data", "character_tags_ai.csv")
    if os.path.exists(ai_path):
        with open(ai_path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                split = lambda k: [p.strip() for p in (row.get(k) or "").split("|") if p.strip()]
                ct = char_tags.setdefault((row.get("id") or "").strip(), {"tags": [], "remove": set(), "weapons": []})
                ct["tags"] += split("tags_ai")
                ct["weapons"] += split("weapons_ai")
    # A tag that counts for another: an open shirt or open coat over a bare chest counts as "shirtless".
    TAG_IMPLIES = {"open_shirt": ["shirtless"], "open_coat": ["shirtless"], "bare_chest": ["shirtless"]}
    for ct in char_tags.values():
        for t in list(ct["tags"]):
            ct["tags"] += [x for x in TAG_IMPLIES.get(t, []) if x not in ct["tags"]]
    # your hand fixes: data/character_overrides.csv (id, column, value) wins over characters.csv,
    # so re-pulling the wiki never wipes them
    overrides = {}
    ov_path = os.path.join(ROOT, "data", "character_overrides.csv")
    if os.path.exists(ov_path):
        with open(ov_path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                oid, col = (row.get("id") or "").strip(), (row.get("column") or "").strip()
                if oid and col:
                    overrides.setdefault(oid, {})[col] = (row.get("value") or "").strip()
    errors, warnings, out = [], [], []
    seen = set()

    with open(args.csv, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        columns = reader.fieldnames or []
        for line_no, raw in enumerate(reader, start=2):
            row = {k.strip(): (v or "").strip() for k, v in raw.items() if k}
            if not any(row.values()):
                continue
            if row.get("canon", "").lower() == "no" and not args.include_noncanon:
                skipped_noncanon += 1
                continue
            for col, val in overrides.get(row.get("id", ""), {}).items():
                row[col] = val
            cid, name = row.get("id", ""), row.get("name", "")
            where = f"row {line_no}"
            if not cid:
                errors.append(f"{where}: missing id")
                continue
            if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", cid):
                errors.append(f"{where}: id '{cid}' should be lowercase letters, numbers, - or _ only")
            if cid in seen:
                errors.append(f"{where}: duplicate id '{cid}'")
            seen.add(cid)
            if not name:
                errors.append(f"{where} ({cid}): missing name")

            rec = {}
            for key, value in row.items():
                if key in LIST_FIELDS:
                    rec[key] = [p.strip() for p in value.split("|") if p.strip()]
                elif key in NUMBER_FIELDS:
                    n = to_number(value)
                    if n == "BAD":
                        errors.append(f"{where} ({cid}): {key} '{value}' is not a number")
                        n = None
                    rec[key] = n
                else:
                    rec[key] = value

            ep = rec.get("first_episode")
            if ep and ep in episodes:
                arc, saga = episodes[ep]
                if not rec.get("debut_arc"):
                    rec["debut_arc"] = arc
                elif arc and rec["debut_arc"] != arc:
                    warnings.append(f"{cid}: debut_arc '{rec['debut_arc']}' but episode {ep} is in '{arc}' (kept yours)")
                if not rec.get("debut_saga"):
                    rec["debut_saga"] = saga

            # Devil Fruit names count as answers: "Mera Mera no Mi", "Mera Mera", "Flame-Flame Fruit", "Flame Fruit"
            extra = []
            for fruit in rec.get("devil_fruits", []) + rec.get("devil_fruit_names", []):
                extra += fruit_variants(fruit)
            if extra:
                rec["aliases"] = list(dict.fromkeys(rec.get("aliases", []) + extra))

            img = rec.get("image", "")
            if not img:
                for ext in IMAGE_EXTS:
                    candidate = f"assets/characters/{cid}{ext}"
                    if os.path.exists(os.path.join(ROOT, candidate)):
                        rec["image"] = candidate
                        break
            elif not re.match(r"https?://", img) and not os.path.exists(os.path.join(ROOT, img)):
                warnings.append(f"{cid}: image '{img}' not found")
            ct = char_tags.get(cid)
            if ct:
                rec["tags"] = [t for t in dict.fromkeys(rec.get("tags", []) + ct["tags"]) if t not in ct["remove"]]
                rec["weapons"] = list(dict.fromkeys(rec.get("weapons", []) + ct["weapons"]))
            for tag in rec.get("tags", []):
                if tag not in catalog:
                    close = difflib.get_close_matches(tag, list(catalog), n=1)
                    hint = f" (did you mean '{close[0]}'?)" if close else " (add it to data/tags.csv to make a prompt)"
                    warnings.append(f"{cid}: unknown tag '{tag}'{hint}")
            out.append(rec)

    # A single name shared by several characters ("Luffy": Monkey D. Luffy and Yamamoto Luffy)
    # goes straight to the far more famous one; otherwise the game asks "which one?".
    def words(r):
        out = set()
        for n in [r.get("name", "")] + r.get("aliases", []):
            for w in re.sub(r"[^a-z0-9]+", " ", n.lower()).split():
                if len(w) >= 3 and w not in ("the", "and", "fruit", "model", "pirates"):
                    out.add(w)
        return out
    owners = {}
    for r in out:
        for w in words(r):
            owners.setdefault(w, []).append(r)
    given = 0
    for w, rs in owners.items():
        if len(rs) < 2:
            continue
        rs = sorted(rs, key=lambda r: -(r.get("fame") or 0))
        if (rs[0].get("fame") or 0) - (rs[1].get("fame") or 0) >= 25:
            rs[0]["aliases"] = rs[0].get("aliases", []) + [w.capitalize()]
            given += 1

    # Names so close that a typo of one could auto-match the other. Add aliases or accept it.
    # Bucketed by first letter + length so it stays fast with thousands of characters.
    import difflib
    buckets = {}
    for r in out:
        for n in [r.get("name", "")] + r.get("aliases", []):
            k = re.sub(r"[^a-z0-9]+", " ", n.lower()).strip()
            if len(k) >= 4:
                buckets.setdefault(k[0], []).append((k, r["id"]))
    lookalikes = []
    seen_pairs = set()
    for keys in buckets.values():
        keys.sort(key=lambda x: len(x[0]))
        for i, (a, ida) in enumerate(keys):
            for b, idb in keys[i + 1:]:
                if len(b) - len(a) > 2:
                    break
                if ida == idb or (ida, idb) in seen_pairs:
                    continue
                limit = 0.8 if max(len(a), len(b)) <= 6 else 0.85
                sm = difflib.SequenceMatcher(None, a, b)
                if sm.real_quick_ratio() >= limit and sm.quick_ratio() >= limit and sm.ratio() >= limit:
                    seen_pairs.add((ida, idb))
                    lookalikes.append(f"'{a}' ({ida}) vs '{b}' ({idb})")
    if lookalikes:
        warnings.append(f"{len(lookalikes)} pairs of look-alike names (a typo may go to the wrong one), e.g. " + "; ".join(lookalikes[:8]))

    for e in errors:
        print("ERROR  ", e)
    for w in warnings:
        print("warning", w)
    if errors:
        print(f"\n{len(errors)} error(s). Nothing written. Fix the CSV and run again.")
        sys.exit(1)

    # How well known each character is: easy = everyone knows them, hard = deep cuts.
    # Easy mode only uses easy characters, medium adds medium, hard uses everyone.
    EASY_N, MEDIUM_N = 250, 850
    ranked = sorted(out, key=lambda r: -(r.get("fame") or 0))
    for i, r in enumerate(ranked):
        if r.get("difficulty") not in ("easy", "medium", "hard"):
            r["difficulty"] = "easy" if i < EASY_N else "medium" if i < EASY_N + MEDIUM_N else "hard"

    with open(args.out, "w", encoding="utf-8") as f:
        f.write("// Generated by tools/build_data.py from data/characters.csv. Do not edit by hand.\n")
        f.write("window.CHARACTER_DATA = ")
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write(";\n")
        f.write("window.TAG_CATALOG = ")
        json.dump(catalog, f, ensure_ascii=False, indent=1)
        f.write(";\n")

    arcs = arc_list(args.episodes)
    # the episode file rarely lists chapters, so work out how far the manga had got by each arc
    # from characters who have both a first episode and a first chapter
    pairs = sorted((r["first_episode"], r["first_chapter"]) for r in out
                   if isinstance(r.get("first_episode"), int) and isinstance(r.get("first_chapter"), int))
    running = 0
    for a in sorted(arcs, key=lambda a: a["last_ep"]):
        chs = sorted(ch for ep, ch in pairs if a["first_ep"] <= ep <= a["last_ep"])
        if len(chs) >= 3:                              # typical debut chapter of the arc, ignoring flashback outliers
            running = max(running, chs[int(len(chs) * 0.75)])
        a["last_ch"] = running
    if arcs:
        with open(os.path.join(ROOT, "data", "arcs.js"), "w", encoding="utf-8") as f:
            f.write("// Generated by tools/build_data.py from episodes.csv: arcs in story order for the spoiler filter.\n")
            f.write("window.ARC_DATA = ")
            json.dump(arcs, f, ensure_ascii=False)
            f.write(";\n")

    n = len(out)
    print(f"\nWrote {n} characters to {os.path.relpath(args.out, ROOT)}")
    dc = Counter(r["difficulty"] for r in out)
    print(f"Difficulty: {dc['easy']} easy, {dc['medium']} medium, {dc['hard']} hard"
          + (f" ({sum(1 for v in overrides.values() if 'difficulty' in v)} set by hand)" if overrides else ""))
    if overrides:
        print(f"Overrides applied for {len(overrides)} characters from data/character_overrides.csv")
    if arcs:
        print(f"Spoiler filter: {len(arcs)} arcs written to data/arcs.js")
    print(f"Shared names given to the most famous owner: {given}")
    if skipped_noncanon:
        print(f"Left out {skipped_noncanon} non-canon characters (add --include-noncanon to use them)")
    if episodes:
        print(f"Episode lookup: {len(episodes)} episodes from {args.episodes}")
    else:
        print("Episode lookup: off (no episodes.csv found), debut_arc is used as typed")
    if catalog:
        used = sum(1 for t in catalog if any(t in r.get("tags", []) for r in out))
        print(f"Tags: {len(catalog)} in data/tags.csv, {used} used so far")
    with_img = sum(1 for r in out if r.get("image"))
    print(f"Pictures: {with_img}/{n}")

    print("\nHow filled each column is:")
    for col in columns:
        filled = sum(1 for r in out if r.get(col) not in (None, "", []))
        print(f"  {col:<18} {filled:>5}/{n}")

    print("\nMost common values (a question needs enough answers to be used):")
    for col in REPORT_FIELDS:
        c = Counter()
        for r in out:
            v = r.get(col)
            for item in (v if isinstance(v, list) else [v]):
                if item:
                    c[item] += 1
        if c:
            top = ", ".join(f"{k} ({v})" for k, v in c.most_common(12))
            print(f"  {col}: {top}")


if __name__ == "__main__":
    main()
