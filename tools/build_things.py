#!/usr/bin/env python3
"""Turn data/things/*.csv into data/things.js (what the game loads for non-character prompts).

Run from the log-pose folder after tools/scrape_things.py and tools/build_data.py:
    python3 -I tools/build_things.py            # canon only
    python3 -I tools/build_things.py --include-noncanon

What it adds on top of the CSVs
- debut_arc / debut_saga from first_episode (episodes.csv), so the spoiler filter works on everything
- difficulty per row: easy = most famous ~20% of that kind, medium = next 40%, hard = the rest
  (set a "difficulty" value in data/thing_overrides.csv to change one)
- answer spellings: English fruit names, "Mera Mera", "Flame Fruit", other romanizations
- joined facts, so prompts can mix tables without the game doing joins:
    fruit:  user_affiliation_types, user_groups, user_roles, user_races, user_count, user_died
    weapon: owner_affiliation_types, owner_groups
    ship:   crew_names, captain_names
    crew:   captain_fruit_types, captain_has_fruit, captain_groups, member_count
    place:  (sea, region already there)
- window.THING_LINKS.character: per character, what they own or lead (weapon_names, ship_names,
  crew_names_captained, owns_named_weapon, captains_a_crew) for character prompts
Hand fixes: data/thing_overrides.csv with columns kind,id,column,value (kept when you re-scrape).
"""
import argparse
import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import build_data as B  # noqa: E402  (load_episodes, fruit_variants)

FILES = {"fruit": "devil_fruits.csv", "place": "places.csv", "weapon": "weapons.csv", "ship": "ships.csv",
         "crew": "crews.csv", "organization": "organizations.csv", "style": "fighting_styles.csv",
         "race": "races.csv", "event": "events.csv", "creature": "creatures.csv"}
LISTS = {"aliases", "tags", "fruit_type", "english_names", "sea", "place_type", "grade", "event_type"}
NUMBERS = {"first_episode", "first_chapter", "fame", "total_bounty"}


def read_csv(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def split(v):
    return [p.strip() for p in (v or "").split("|") if p.strip()]


def num(v):
    try:
        n = float(str(v).replace(",", ""))
        return int(n) if n.is_integer() else n
    except (TypeError, ValueError):
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--include-noncanon", action="store_true")
    ap.add_argument("--episodes", default=os.path.join(os.path.dirname(ROOT), "onepiece", "episodes.csv"))
    args = ap.parse_args()
    episodes = B.load_episodes(args.episodes)

    overrides = defaultdict(dict)
    for r in read_csv(os.path.join(ROOT, "data", "thing_overrides.csv")):
        if r.get("kind") and r.get("id") and r.get("column"):
            overrides[(r["kind"].strip(), r["id"].strip())][r["column"].strip()] = (r.get("value") or "").strip()

    chars = {r["id"]: r for r in read_csv(os.path.join(ROOT, "data", "characters.csv"))}
    char_over = defaultdict(dict)
    for r in read_csv(os.path.join(ROOT, "data", "character_overrides.csv")):
        if r.get("id") and r.get("column"):
            char_over[r["id"].strip()][r["column"].strip()] = (r.get("value") or "").strip()
    for cid, ov in char_over.items():
        if cid in chars:
            chars[cid].update(ov)

    out = {}
    for kind, fname in FILES.items():
        rows = []
        for r in read_csv(os.path.join(ROOT, "data", "things", fname)):
            r.update(overrides.get((kind, r.get("id", "")), {}))
            if r.get("canon", "yes").lower() == "no" and not args.include_noncanon:
                continue
            rec = {}
            for k, v in r.items():
                if k.endswith("_ids") or k in LISTS:
                    rec[k] = split(v)
                elif k in NUMBERS:
                    rec[k] = num(v)
                else:
                    rec[k] = (v or "").strip()
            ep = rec.get("first_episode")
            if ep and ep in episodes:
                rec["debut_arc"], rec["debut_saga"] = episodes[ep]
            img = rec.get("image") or ""
            if not img:
                for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
                    cand = f"assets/things/{kind}/{rec['id']}{ext}"
                    if os.path.exists(os.path.join(ROOT, cand)):
                        rec["image"] = cand
                        break
            rows.append(rec)
        out[kind] = rows

    # answer spellings for fruits
    for f in out["fruit"]:
        extra = []
        for n in [f["name"]] + f.get("english_names", []) + f.get("aliases", []):
            extra += B.fruit_variants(n)
        f["aliases"] = list(dict.fromkeys([a for a in f.get("aliases", []) + extra if a and a != f["name"]]))

    # the Grand Line = Paradise + the New World (+ the sea floor below it)
    for kind in ("place", "creature"):
        for r in out.get(kind, []):
            seas = r.get("sea", [])
            if any(x in seas for x in ("Paradise", "New World", "Sea Floor")) and "Grand Line" not in seas:
                r["sea"] = seas + ["Grand Line"]

    # crews answer to their short names too: "Straw Hats", "Straw Hat", "Red Hair"
    for c in out["crew"]:
        m = re.match(r"^(.+?) Pirates$", c["name"])
        if m:
            base = m.group(1)
            c["aliases"] = list(dict.fromkeys(c.get("aliases", []) + [base, base + "s", base + " Crew"]))

    # ---- joined facts ----
    def cf(cid, col):
        return split(chars.get(cid, {}).get(col, "")) if col in ("organizations", "crew_role", "devil_fruit_types", "devil_fruits") else \
            [chars.get(cid, {}).get(col, "")] if chars.get(cid, {}).get(col) else []
    crew_by_id = {c["id"]: c for c in out["crew"]}
    crew_names = {c["name"] for c in out["crew"]}
    TITLES = {"Four Emperors", "Seven Warlords of the Sea", "Worst Generation", "Super Rookies", "Admirals",
              "Revolutionary Army", "Marines", "Cipher Pol", "Five Elders", "Celestial Dragons", "Cross Guild",
              "Straw Hat Grand Fleet", "Ninja-Pirate-Mink-Samurai Alliance", "Clan of D."}
    crews_of = lambda groups: sorted(g for g in groups if g in crew_names)
    titles_of = lambda groups: sorted(g for g in groups if g in TITLES)
    for f in out["fruit"]:
        users = f.get("user_ids", [])
        f["user_count"] = len(users)
        f["user_affiliation_types"] = sorted({x for u in users for x in cf(u, "affiliation_type")})
        f["user_groups"] = sorted({x for u in users for x in cf(u, "organizations")})
        f["user_crews"] = crews_of(f["user_groups"])
        f["user_titles"] = titles_of(f["user_groups"])
        f["user_roles"] = sorted({x for u in users for x in cf(u, "crew_role")})
        f["user_races"] = sorted({x for u in users for x in cf(u, "race")})
        f["user_died"] = "yes" if any(chars.get(u, {}).get("status") == "Deceased" for u in users) else ""
    for w in out["weapon"]:
        owners = w.get("owner_ids", [])
        w["owner_affiliation_types"] = sorted({x for u in owners for x in cf(u, "affiliation_type")})
        w["owner_groups"] = sorted({x for u in owners for x in cf(u, "organizations")})
        w["owner_crews"] = crews_of(w["owner_groups"])
        w["owner_titles"] = titles_of(w["owner_groups"])
    for s in out["ship"]:
        s["crew_names"] = [crew_by_id[c]["name"] for c in s.get("crew_ids", []) if c in crew_by_id]
        caps = s.get("captain_ids", []) + [x for c in s.get("crew_ids", []) for x in crew_by_id.get(c, {}).get("captain_ids", [])]
        s["captain_names"] = sorted({chars[c]["name"] for c in caps if c in chars})
        s["captain_groups"] = sorted({x for u in caps for x in cf(u, "organizations")})
    for c in out["crew"]:
        caps = c.get("captain_ids", [])
        c["captain_fruit_types"] = sorted({x for u in caps for x in cf(u, "devil_fruit_types")})
        c["captain_has_fruit"] = "yes" if any(chars.get(u, {}).get("devil_fruits") for u in caps) else "no" if caps else ""
        c["captain_groups"] = sorted({x for u in caps for x in cf(u, "organizations")})
        c["captain_titles"] = titles_of(c["captain_groups"])
        c["member_count"] = len(c.get("member_ids", []))

    # what each character owns / leads (for character prompts)
    links = defaultdict(lambda: defaultdict(list))
    for w in out["weapon"]:
        for u in w.get("owner_ids", []):
            links[u]["weapon_names"].append(w["name"])
            if w.get("subtype") == "Sword":
                links[u]["named_sword_names"].append(w["name"])
    for s in out["ship"]:
        for u in s.get("captain_ids", []):
            links[u]["ship_names"].append(s["name"])
    for c in out["crew"]:
        for u in c.get("captain_ids", []):
            links[u]["crew_names_captained"].append(c["name"])
    for st in out["style"]:
        for u in st.get("user_ids", []):
            links[u]["style_names"].append(st["name"])
    # who fought whom (data/things/fights.csv, from the wiki's Major Battles lists)
    for r in read_csv(os.path.join(ROOT, "data", "things", "fights.csv")):
        a, b = r.get("a_id"), r.get("b_id")
        if a in chars and b in chars:
            links[a]["fought_names"].append(chars[b]["name"])
            links[b]["fought_names"].append(chars[a]["name"])
    char_links = {}
    for u, d in links.items():
        rec = {k: sorted(set(v)) for k, v in d.items()}
        if rec.get("weapon_names"):
            rec["owns_named_weapon"] = "yes"
        if rec.get("named_sword_names"):
            rec["owns_named_sword"] = "yes"
        if rec.get("crew_names_captained"):
            rec["captains_a_crew"] = "yes"
        char_links[u] = rec

    # difficulty per kind from fame rank (overrides win)
    for kind, rows in out.items():
        ranked = sorted(rows, key=lambda r: -(r.get("fame") or 0))
        n = len(ranked)
        for i, r in enumerate(ranked):
            if r.get("difficulty") not in ("easy", "medium", "hard"):
                r["difficulty"] = "easy" if i < max(5, round(n * 0.2)) else "medium" if i < round(n * 0.6) else "hard"

    with open(os.path.join(ROOT, "data", "things.js"), "w", encoding="utf-8") as f:
        f.write("// Generated by tools/build_things.py from data/things/*.csv. Do not edit by hand.\n")
        f.write("window.THING_DATA = ")
        json.dump(out, f, ensure_ascii=False)
        f.write(";\nwindow.THING_LINKS = ")
        json.dump({"character": char_links}, f, ensure_ascii=False)
        f.write(";\n")

    print("Wrote data/things.js")
    for kind, rows in out.items():
        d = Counter(r["difficulty"] for r in rows)
        pics = sum(1 for r in rows if r.get("image"))
        eps = sum(1 for r in rows if r.get("first_episode") or r.get("first_chapter"))
        print(f"  {kind:13} {len(rows):4} rows  easy {d['easy']:3} medium {d['medium']:3} hard {d['hard']:3}  "
              f"with debut {eps:4}  pictures {pics:4}")
    print(f"  characters with owned/led things: {len(char_links)}")


if __name__ == "__main__":
    main()
