#!/usr/bin/env python3
"""Pull everything that isn't a character from the One Piece Wiki into data/things/*.csv.

Run from the log-pose folder, after tools/scrape_wiki.py (it links to data/characters.csv):
    python3 -I tools/scrape_things.py            # tables -> data/things/
    python3 -I tools/scrape_things.py --images   # also pictures -> assets/things/<kind>/
    python3 -I tools/build_things.py             # -> data/things.js (what the game loads)

One CSV per kind. Every row has a first chapter / first episode (for the spoiler filter),
a fame score (links from other wiki pages) and *_ids columns that point at rows in the other
tables, so prompts can join them ("a sword whose owner ate a Logia", "a ship of an Emperor's crew").

    kind          wiki infobox           file
    fruit         Devil Fruit Box        devil_fruits.csv
    place         Island Box             places.csv
    weapon        Weapon Box             weapons.csv
    ship          Ship Box               ships.csv
    crew          Crew Box               crews.csv
    organization  Organization Box       organizations.csv
    style         Fighting Style Box     fighting_styles.csv
    race          Race Box               races.csv
    event         Event Box              events.csv
"""
import argparse
import csv
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import scrape_wiki as W  # noqa: E402  (api, api_all, find_template, template_params, clean, split_items, slug)

OUT_DIR = os.path.join(ROOT, "data", "things")

KINDS = [
    # kind, template, file
    ("fruit", "Devil Fruit Box", "devil_fruits.csv"),
    ("place", "Island Box", "places.csv"),
    ("weapon", "Weapon Box", "weapons.csv"),
    ("ship", "Ship Box", "ships.csv"),
    ("crew", "Crew Box", "crews.csv"),
    ("organization", "Organization Box", "organizations.csv"),
    ("style", "Fighting Style Box", "fighting_styles.csv"),
    ("race", "Race Box", "races.csv"),
    ("event", "Event Box", "events.csv"),
]
COMMON = ["id", "kind", "name", "aliases", "subtype", "tags", "first_episode", "first_chapter", "canon",
          "fame", "image", "wiki_url",
          "character_ids", "user_ids", "owner_ids", "captain_ids", "member_ids",
          "crew_ids", "ship_ids", "place_ids", "organization_ids", "fruit_ids"]
EXTRA = {
    "fruit": ["fruit_type", "english_names", "meaning"],
    "place": ["sea", "region", "place_type"],
    "weapon": ["weapon_type", "grade"],
    "ship": ["affiliation", "status"],
    "crew": ["affiliation", "status", "total_bounty"],
    "organization": ["affiliation", "occupation", "status"],
    "style": ["focus"],
    "race": ["homeland"],
    "event": ["outcome", "event_type"],
}
# story events: battles, wars, incidents, operations, competitions, festivals (canon + non-canon lists)
EVENT_CATEGORIES = ["Events", "Battles", "Incidents", "Operations", "Competitions", "Non-Canon Events"]
EVENT_TYPES = [("Battles", "Battle"), ("Incidents", "Incident"), ("Operations", "Operation"),
               ("Competitions", "Competition"), ("Events", "Event")]

SEAS = ["East Blue", "West Blue", "North Blue", "South Blue", "Grand Line", "Paradise", "New World",
        "Red Line", "Calm Belt", "Sky Islands", "Sea Floor", "Mary Geoise"]
FRUIT_BASE = {"Mythical Zoan": "Zoan", "Ancient Zoan": "Zoan", "Artificial Zoan": "Zoan",
              "Special Paramecia": "Paramecia", "Artificial Paramecia": "Paramecia"}


def link_titles(raw):
    """[[Target|text]] targets in a raw wikitext value (before cleaning), in order."""
    out = []
    for t in re.findall(r"\[\[([^\]|#]+)", raw or ""):
        t = t.strip().replace("_", " ")
        if t and not t.lower().startswith(("file:", "image:", "category:")):
            out.append(t[0].upper() + t[1:])
    return out


def first_numbers(raw):
    ch = re.search(r"Chapters?\s*(\d+)", raw or "")
    ep = re.search(r"Episodes?\s*(\d+)", raw or "")
    return (ch.group(1) if ch else ""), (ep.group(1) if ep else "")


def names_list(raw):
    out = []
    for item in W.split_items(W.clean(raw)):
        item = re.sub(r"\s*\([^)]*\)", "", item).strip(' "')
        for bit in re.split(r",\s*", item):
            bit = bit.strip(' "')
            if bit and len(bit) < 60 and not W.JUNK.match(bit) and not re.search(r'[():"]', bit):
                out.append(bit)
    return out


def battle_lines(text):
    """Canon lines of a page's Major Battles section (filler / movie / game lists cut off)."""
    m = re.search(r"==+\s*Major Battles\s*==+(.*?)(\n==[^=]|\Z)", text or "", re.S)
    if not m:
        return []
    body = re.split(r"\n===+\s*[^=\n]*(Filler|Non-Canon|Movie|Video Game|Game|Anime Only|Novel|One-Shot|Special)[^=\n]*===+", m.group(1))[0]
    return [ln[1:].strip() for ln in body.split("\n") if ln.strip().startswith("*")]


CREATURE_PAGES = ["Animal Species/East Blue Saga", "Animal Species/Arabasta Saga", "Animal Species/Sky Island Saga",
                  "Animal Species/Water 7 Saga", "Animal Species/Summit War Saga", "Animal Species/Fish-Man Island Saga",
                  "Animal Species/Dressrosa Saga", "Animal Species/Whole Cake Island Saga", "Animal Species/Wano Country Saga",
                  "Animal Species/Final Saga", "Animal Species/Other"]
OWN_PAGE_SPECIES = ["Sea King", "Den Den Mushi", "South Bird", "Sea Beast", "Kestia", "Dollar Abalone"]


def write_creatures(places, links):
    """One row per animal species: where it lives (heading on the wiki list), saga, first chapter."""
    place_by_name = {p["name"].lower(): p for p in places}
    for p in places:
        for a in p.get("aliases", "").split("|"):
            if a:
                place_by_name.setdefault(a.lower(), p)
    d = W.api({"action": "query", "titles": "|".join(CREATURE_PAGES + OWN_PAGE_SPECIES), "prop": "revisions",
               "rvprop": "content", "rvslots": "main"})
    texts = {p["title"]: p["revisions"][0]["slots"]["main"]["content"] for p in d["query"]["pages"] if p.get("revisions")}
    rows, seen = [], set()

    def add(name, location, saga, section, own_page=False):
        name = W.clean(name).strip(" '\"")
        if not name or len(name) > 50 or name.lower() in seen or re.search(r"(?i)\bothers?\b|misc|unnamed|various|\band other\b", name):
            return
        if name.lower() in place_by_name:          # a heading that is a place, not a species
            return
        seen.add(name.lower())
        chs = [int(x) for x in re.findall(r"chap=(\d+)", section)]
        eps = [int(x) for x in re.findall(r"\bep=(\d+)", section)]
        lead = section.strip().split("\n", 1)[0]
        aliases = []
        m = re.search(r"\{\{Nihongo\|([^{}]*)\}\}", lead)
        if m:
            for bit in m.group(1).split("|")[3:]:
                aliases += re.findall(r'"([^"]+)"', bit)
        loc = W.clean(location).strip()
        place = place_by_name.get(loc.lower()) or next((p for n, p in place_by_name.items() if loc and n.startswith(loc.lower() + " ")), None)
        seas = (place.get("sea", "") if place else "")
        if not seas and loc in SEAS:
            seas = loc
        refs = len(re.findall(r"\{\{Qref", section))
        fame = min(100, 25 + 6 * refs + (40 if own_page else 0) + min(20, links.get(name, 0)))
        rows.append({"id": W.slug(name), "kind": "creature", "name": name, "aliases": "|".join(dict.fromkeys(a for a in aliases if a.lower() != name.lower())),
                     "subtype": loc, "tags": saga, "first_episode": str(min(eps)) if eps else "",
                     "first_chapter": str(min(chs)) if chs else "", "canon": "yes" if (chs or own_page) else "no",
                     "fame": str(fame), "image": "",
                     "wiki_url": W.WIKI + urllib.parse.quote(("Animal Species/" + saga if saga else name).replace(" ", "_")),
                     "place_ids": place["id"] if place else "", "location": loc, "sea": seas, "saga": saga})

    for title in OWN_PAGE_SPECIES:
        t = texts.get(title, "")
        lead = t.split("\n==", 1)[0]
        habitat = "Calm Belt" if re.search(r"Calm Belt", lead) else ""
        add(title, habitat, "", lead, own_page=True)
    for title in CREATURE_PAGES:
        saga = title.split("/", 1)[1] if title.endswith("Saga") else ""
        t = texts.get(title, "")
        loc = ""
        for block in re.split(r"(?m)^(?===[^=])", t):
            h2 = re.match(r"==\s*([^=].*?)\s*==\s*$", block.split("\n", 1)[0])
            if h2:
                loc = h2.group(1)
            if re.search(r"(?i)non-canon|filler|movie|video game", loc):
                continue
            for sec in re.split(r"(?m)^(?====[^=])", block):
                h3 = re.match(r"===\s*([^=].*?)\s*===\s*$", sec.split("\n", 1)[0])
                if h3:
                    body = sec.split("\n", 1)[1] if "\n" in sec else ""
                    bullets = [b for b in body.split("\n") if b.startswith("*")]
                    if len(bullets) >= 3 and re.search(r"(?i)and other|animals|creatures|species", h3.group(1)):
                        # a list heading ("Dinosaurs and other Prehistoric Animals"): each bullet is a species
                        for b in bullets:
                            m = re.match(r"\*\s*(?:\[\[(?:[^|\]]*\|)?([^\]]+)\]\]|'''([^']+)'''|([^(.,{\[]+))", b)
                            if m:
                                add(next(g for g in m.groups() if g), loc, saga, b)
                    else:
                        add(h3.group(1), loc, saga, body)
    cols = ["id", "kind", "name", "aliases", "subtype", "tags", "first_episode", "first_chapter", "canon", "fame",
            "image", "wiki_url", "place_ids", "location", "sea", "saga"]
    with open(os.path.join(OUT_DIR, "creatures.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"wrote data/things/creatures.csv: {len(rows)} species")


def write_fights(chars, char_by_title):
    char_titles = sorted({urllib.parse.unquote((c.get("wiki_url") or "").rsplit("/wiki/", 1)[-1]).replace("_", " ") for c in chars} - {""})
    id_by_title = {t: char_by_title[t] for t in char_titles if t in char_by_title}
    names = {}
    for c in sorted(chars, key=lambda c: -int(c.get("fame") or 0)):
        for n in [c["name"]] + (c.get("aliases") or "").split("|"):
            if n:
                names.setdefault(n.lower(), c["id"])
    texts = {}
    for i in range(0, len(char_titles), 50):
        d = W.api({"action": "query", "titles": "|".join(char_titles[i:i + 50]), "prop": "revisions", "rvprop": "content", "rvslots": "main"})
        for p in d["query"].get("pages", []):
            if p.get("revisions"):
                texts[p["title"]] = p["revisions"][0]["slots"]["main"]["content"]
    # main cast keep it on a subpage
    misc = [t + "/Misc." for t, x in texts.items() if re.match(r"\s*\{\{[^|}\n]+Tabs Top", x)]
    for i in range(0, len(misc), 50):
        d = W.api({"action": "query", "titles": "|".join(misc[i:i + 50]), "prop": "revisions", "rvprop": "content", "rvslots": "main"})
        for p in d["query"].get("pages", []):
            if p.get("revisions"):
                texts[p["title"][:-6]] = (texts.get(p["title"][:-6], "") + "\n" + p["revisions"][0]["slots"]["main"]["content"])
    pairs = set()
    lines_out = []
    for title, text in texts.items():
        me = id_by_title.get(title)
        if not me:
            continue
        mine = [c for c in chars if c["id"] == me]
        my_names = set()
        for c in mine:
            my_names |= {c["name"].lower(), *[a.lower() for a in (c.get("aliases") or "").split("|") if a]}
            my_names |= {w.lower() for w in c["name"].split() if len(w) > 2}
        for ln in battle_lines(text):
            ln = re.sub(r"\{\{Scroll Box\|", "", ln)
            sides = re.split(r"\s+vs\.?\s+", ln, flags=re.I)
            if len(sides) < 2:
                continue
            side_ids = []
            for side in sides:
                side = re.sub(r"\([^)]*\)", "", side)
                ids = []
                for t in link_titles(side):
                    if t in id_by_title:
                        ids.append(id_by_title[t])
                plain = W.clean(re.sub(r"\[\[[^\]]*\]\]", ",", side))
                for bit in re.split(r",|\band\b|&", plain):
                    b = bit.strip(" .'").lower()
                    if not b:
                        continue
                    if b in my_names:
                        ids.append(me)
                    elif b in names:
                        ids.append(names[b])
                side_ids.append(list(dict.fromkeys(ids)))
            if not any(me in s_ for s_ in side_ids):
                continue
            for i_, s_ in enumerate(side_ids):
                if me in s_:
                    for j, other in enumerate(side_ids):
                        if j != i_:
                            for o in other:
                                if o != me:
                                    pairs.add(tuple(sorted((me, o))))
            lines_out.append((me, W.clean(ln)[:140]))
    with open(os.path.join(OUT_DIR, "fights.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["a_id", "b_id"])
        w.writerows(sorted(pairs))
    print(f"wrote data/things/fights.csv: {len(pairs)} fought-each-other pairs from {len(lines_out)} battle lines")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", action="store_true")
    args = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)

    # title -> character id, from the character table
    char_by_title = {}
    with open(os.path.join(ROOT, "data", "characters.csv"), encoding="utf-8-sig", newline="") as f:
        # most famous first, so a shared alias ("Blackbeard") goes to the famous owner
        for r in sorted(csv.DictReader(f), key=lambda r: -int(r.get("fame") or 0)):
            t = urllib.parse.unquote((r.get("wiki_url") or "").rsplit("/wiki/", 1)[-1]).replace("_", " ")
            if t:
                char_by_title[t] = r["id"]
            char_by_title.setdefault(r["name"], r["id"])
            for a in (r.get("aliases") or "").split("|"):       # links often use another spelling (Kaido -> Kaidou)
                if a and a[0].isupper():
                    char_by_title.setdefault(a, r["id"])
    chars = list(csv.DictReader(open(os.path.join(ROOT, "data", "characters.csv"), encoding="utf-8-sig")))

    # 1. pages of every kind
    pages_by_kind, title_kind = {}, {}
    for kind, tpl, _ in KINDS:
        titles = []
        W.api_all({"action": "query", "list": "embeddedin", "eititle": "Template:" + tpl, "einamespace": "0", "eilimit": "500"},
                  lambda d: titles.extend(p["title"] for p in d["query"]["embeddedin"]))
        if kind == "event":
            for cat in EVENT_CATEGORIES:
                W.api_all({"action": "query", "list": "categorymembers", "cmtitle": "Category:" + cat, "cmnamespace": "0", "cmlimit": "500"},
                          lambda d: titles.extend(p["title"] for p in d["query"]["categorymembers"]))
        titles = sorted({t for t in titles if "/" not in t})
        pages_by_kind[kind] = titles
        for t in titles:
            title_kind.setdefault(t, kind)
        print(f"{kind:13} {len(titles)} pages")

    # redirects matter for linking: [[Gol D. Roger]] may point at a renamed page
    all_titles = [t for k in pages_by_kind for t in pages_by_kind[k]]
    pages, redirects = {}, {}
    for i in range(0, len(all_titles), 50):
        batch = all_titles[i:i + 50]
        def merge(d):
            for p in d["query"].get("pages", []):
                rec = pages.setdefault(p["title"], {"cats": set()})
                if p.get("revisions"):
                    rec["text"] = p["revisions"][0]["slots"]["main"]["content"]
                for c in p.get("categories", []):
                    rec["cats"].add(c["title"].split(":", 1)[1])
                if p.get("thumbnail"):
                    rec["thumb"] = p["thumbnail"]["source"]
                if p.get("fullurl"):
                    rec["url"] = p["fullurl"]
        W.api_all({"action": "query", "titles": "|".join(batch), "prop": "revisions|categories|pageimages|info",
                   "rvprop": "content", "rvslots": "main", "cllimit": "max", "clshow": "!hidden",
                   "piprop": "thumbnail", "pithumbsize": "320", "pilimit": "50", "inprop": "url"}, merge)
        print(f"  pages {min(i + 50, len(all_titles))}/{len(all_titles)}", end="\r")
    print()

    # big pages (Straw Hat Pirates...) keep their infobox in "Template:<Name> Tabs Top"
    tab_names = {}
    for t, rec in pages.items():
        m = re.match(r"\s*\{\{\s*([^|}\n]+?Tabs Top)\s*[|}]", rec.get("text", ""))
        if m:
            tab_names["Template:" + m.group(1).strip()] = t
    names = sorted(tab_names)
    for i in range(0, len(names), 50):
        d = W.api({"action": "query", "titles": "|".join(names[i:i + 50]), "prop": "revisions", "rvprop": "content", "rvslots": "main"})
        for p in d["query"].get("pages", []):
            if p.get("revisions"):
                pages[tab_names[p["title"]]]["box_text"] = p["revisions"][0]["slots"]["main"]["content"]

    # fame = links from other articles
    links = Counter()
    for i in range(0, len(all_titles), 50):
        batch = all_titles[i:i + 50]
        def merge(d):
            for p in d["query"].get("pages", []):
                links[p["title"]] += len(p.get("linkshere", []))
        W.api_all({"action": "query", "titles": "|".join(batch), "prop": "linkshere", "lhnamespace": "0",
                   "lhshow": "!redirect", "lhprop": "pageid", "lhlimit": "max"}, merge)
        print(f"  links {min(i + 50, len(all_titles))}/{len(all_titles)}", end="\r")
    print()

    # ids for every thing page, so tables can point at each other
    thing_id = {}
    used = set()
    for kind, _, _ in KINDS:
        for t in pages_by_kind[kind]:
            if t in thing_id:
                continue
            base = W.slug(re.sub(r"\s*\([^)]*\)$", "", t))
            tid = base
            while (kind, tid) in used:
                tid += "-2"
            used.add((kind, tid))
            thing_id[t] = (kind, tid)

    def resolve(titles, want=None):
        """Wiki titles -> ids of one kind (want='character' / 'crew' / ...)."""
        out = []
        for t in titles:
            if want in (None, "character") and t in char_by_title:
                if want == "character":
                    out.append(char_by_title[t])
                continue
            k = thing_id.get(t)
            if k and (want is None or k[0] == want):
                out.append(k[1])
        return list(dict.fromkeys(out))

    rows_by_kind = {k: [] for k, _, _ in KINDS}
    for kind, tpl, _ in KINDS:
        for title in pages_by_kind[kind]:
            if title_kind.get(title) != kind:
                continue
            rec = pages.get(title, {})
            text = rec.get("text", "")
            box = W.find_template(rec.get("box_text", ""), [tpl]) or W.find_template(text, [tpl])
            if not box and kind != "event":
                continue
            P = W.template_params(box) if box else {}
            box = box or text.split("\n==", 1)[0]          # events without an infobox: use the lead section
            raw = lambda k: P.get(k, "")
            cats = {c.replace("Non-Canon ", "") for c in rec.get("cats", set())}
            name = re.sub(r"\s*\([^)]*\)$", "", title)
            ch, ep = first_numbers(raw("first"))
            if kind == "event" and not (ch or ep):
                ch, ep = first_numbers(raw("duration"))
            if kind == "event" and not (ch or ep):
                # earliest chapter / episode the article's lead cites
                lead = text.split("\n==", 1)[0]
                chs = [int(x) for x in re.findall(r"chap=(\d+)", lead)]
                eps = [int(x) for x in re.findall(r"\bep=(\d+)", lead)]
                ch, ep = (str(min(chs)) if chs else ""), (str(min(eps)) if eps else "")
            noncanon = any(c.startswith("Non-Canon") for c in rec.get("cats", set()))
            canon = "no" if (noncanon and not ch) or "(Non-Canon" in title else "yes"
            aliases = [a for a in names_list(raw("ename")) + names_list(raw("rname")) if a.lower() != name.lower()]
            row = {c: "" for c in COMMON + EXTRA.get(kind, [])}
            row.update({
                "id": thing_id[title][1], "kind": kind, "name": name, "aliases": "|".join(dict.fromkeys(aliases)),
                "tags": "|".join(sorted(c for c in cats if not c.startswith(("Flashback", "Articles", "Stubs")))),
                "first_episode": ep, "first_chapter": ch, "canon": canon,
                "wiki_url": rec.get("url", W.WIKI + urllib.parse.quote(title.replace(" ", "_"))),
                "_thumb": rec.get("thumb", ""), "_links": links[title],
            })
            every_link = link_titles(box)
            row["character_ids"] = "|".join(resolve(every_link, "character"))

            if kind == "fruit":
                ftype = W.clean(raw("type")).replace("\n", " ")
                types = [t.strip(" -") for t in re.split(r"[;\n]|-{2,}", ftype) if t.strip(" -")]
                types = [t for t in types if len(t) < 30]
                for t in list(types):
                    if t in FRUIT_BASE:
                        types.append(FRUIT_BASE[t])
                types = list(dict.fromkeys(types)) or ["Unknown"]
                row["fruit_type"] = "|".join(types)
                row["subtype"] = types[0]
                row["english_names"] = "|".join(names_list(raw("ename")))
                row["meaning"] = W.clean(raw("meaning"))[:80]
                row["user_ids"] = "|".join(resolve(link_titles(raw("user")) + link_titles(raw("previous")), "character"))
            elif kind == "place":
                seas = [s for s in SEAS if f"{s} Locations" in cats or f"{s} Islands" in cats or s in cats]
                if "Sea Floor" in seas and not seas[:1]:
                    seas.append("Grand Line")
                row["sea"] = "|".join(seas)
                row["region"] = W.clean(raw("region"))[:60]
                ptypes = [c for c in cats if c in ("Towns and Cities", "Mountains", "Islands", "Kingdoms", "Twenty Kingdoms",
                                                    "Prisons", "Bases", "Forests", "Villages", "Sky Islands", "Regimes",
                                                    "Four Emperors Territories", "Marine Bases", "Countries")]
                row["place_type"] = "|".join(ptypes)
                row["subtype"] = (seas or [""])[0]
                row["place_ids"] = "|".join(resolve(link_titles(raw("region")), "place"))
            elif kind == "weapon":
                row["weapon_type"] = W.clean(raw("type"))[:60]
                grades = [c for c in cats if re.search(r"Wazamono|Meito|Black Blades|Cursed", c)]
                row["grade"] = "|".join(grades)
                row["subtype"] = "Sword" if re.search(r"sword|katana|blade|saber|sabre|nodachi|rapier|cutlass", row["weapon_type"] + " " + " ".join(cats), re.I) else row["weapon_type"].split(" ")[-1].title() if row["weapon_type"] else ""
                row["owner_ids"] = "|".join(resolve(link_titles(raw("owner")) + link_titles(raw("previous")), "character"))
            elif kind == "ship":
                row["affiliation"] = W.clean(raw("affiliation"))[:80]
                st = W.clean(raw("status")).lower()
                row["status"] = {"1": "Active", "2": "Destroyed", "3": "Unknown"}.get(st, W.clean(raw("status"))[:30])
                row["crew_ids"] = "|".join(resolve(link_titles(raw("affiliation")), "crew"))
                row["organization_ids"] = "|".join(resolve(link_titles(raw("affiliation")), "organization"))
                row["captain_ids"] = "|".join(resolve(link_titles(raw("captain")), "character"))
            elif kind == "crew":
                row["affiliation"] = W.clean(raw("affiliation"))[:80]
                row["status"] = W.clean(raw("status"))[:30]
                nums = [int(n.replace(",", "")) for n in re.findall(r"\d{1,3}(?:,\d{3})+|\d{4,}", W.clean(raw("bounty")))]
                row["total_bounty"] = str(max(nums)) if nums else ""
                caps = link_titles(raw("captain"))
                if not caps:
                    for k, v in P.items():
                        if re.fullmatch(r"extra\d+title", k) and re.search(r"captain|chief|leader|boss|head|governor|emperor|king|queen|commander-in-chief", W.clean(v), re.I):
                            caps += link_titles(P.get(k[:-5], ""))
                row["captain_ids"] = "|".join(resolve(caps, "character"))
                row["ship_ids"] = "|".join(resolve(link_titles(raw("ship")), "ship"))
                row["organization_ids"] = "|".join(resolve(link_titles(raw("affiliation")), "organization"))
                row["subtype"] = "Pirates" if "pirates" in name.lower() else ""
            elif kind == "organization":
                row["affiliation"] = W.clean(raw("affiliation"))[:80]
                row["occupation"] = W.clean(raw("occupation"))[:60]
                row["status"] = W.clean(raw("status"))[:30]
                row["place_ids"] = "|".join(resolve(link_titles(raw("residency")) + link_titles(raw("base")), "place"))
                row["subtype"] = row["occupation"].split(";")[0][:40]
            elif kind == "style":
                row["focus"] = W.clean(raw("focus"))[:80]
                row["user_ids"] = "|".join(resolve(link_titles(raw("user")), "character"))
            elif kind == "race":
                row["homeland"] = W.clean(raw("homeland"))[:60]
                row["place_ids"] = "|".join(resolve(link_titles(raw("homeland")), "place"))
            elif kind == "event":
                row["outcome"] = W.clean(raw("outcome"))[:60]
                row["place_ids"] = "|".join(resolve(link_titles(raw("location")) or link_titles(box), "place"))
                row["subtype"] = next((lbl for cat, lbl in EVENT_TYPES if cat in cats), "Event")
                row["event_type"] = "|".join(dict.fromkeys(lbl for cat, lbl in EVENT_TYPES if cat in cats)) or "Event"
            rows_by_kind[kind].append(row)

    # members: characters list their groups by name, so join on the group's name
    for kind in ("crew", "organization"):
        for row in rows_by_kind[kind]:
            n = row["name"].lower()
            mem = [c["id"] for c in chars if n in [o.lower() for o in (c.get("organizations") or "").split("|")]]
            row["member_ids"] = "|".join(mem)
            if kind == "crew" and not row["captain_ids"]:
                members = [c for c in chars if c["id"] in mem]
                # "Blackbeard Pirates" -> the member called Blackbeard; else the most famous member who is a Captain
                base = re.sub(r"\s+Pirates$", "", row["name"]).lower()
                named = [c for c in members if base in [x.lower() for x in [c["name"], c.get("epithet", "")] + (c.get("aliases") or "").split("|")]]
                caps = named or sorted([c for c in members if "Captain" in (c.get("crew_role") or "").split("|")],
                                       key=lambda c: -int(c.get("fame") or 0))
                row["captain_ids"] = caps[0]["id"] if caps else ""
    # fruits <-> characters: fruits name their user; characters name their fruit. Use both.
    fruit_by_name = {}
    for row in rows_by_kind["fruit"]:
        for n in [row["name"]] + row["aliases"].split("|") + row["english_names"].split("|"):
            if n:
                fruit_by_name[n.lower()] = row
    for c in chars:
        for fn in (c.get("devil_fruits") or "").split("|") + (c.get("devil_fruit_names") or "").split("|"):
            row = fruit_by_name.get(fn.strip().lower())
            if row and c["id"] not in row["user_ids"].split("|"):
                row["user_ids"] = "|".join([x for x in row["user_ids"].split("|") if x] + [c["id"]])

    # ---- fights: "Major Battles" on every character page (main cast: "<Name>/Misc.") ----
    write_fights(chars, char_by_title)
    # ---- creatures: the wiki's "Animal Species/<Saga>" lists + species with their own page ----
    write_creatures(rows_by_kind["place"], links)

    # fame per kind, 1-100
    for kind, rows in rows_by_kind.items():
        mx = math.log(1 + max([r["_links"] for r in rows] or [1]))
        for r in rows:
            r["fame"] = str(max(1, round(100 * math.log(1 + r["_links"]) / mx))) if mx else "1"

    for kind, _, fname in KINDS:
        cols = COMMON + EXTRA.get(kind, [])
        with open(os.path.join(OUT_DIR, fname), "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
            w.writeheader()
            w.writerows(rows_by_kind[kind])
        c = Counter(r["canon"] for r in rows_by_kind[kind])
        print(f"wrote data/things/{fname}: {len(rows_by_kind[kind])} rows ({c['yes']} canon)")

    if args.images:
        got = failed = 0
        for kind, rows in rows_by_kind.items():
            folder = os.path.join(ROOT, "assets", "things", kind)
            os.makedirs(folder, exist_ok=True)
            for r in rows:
                url = r["_thumb"]
                if not url:
                    continue
                ext = os.path.splitext(urllib.parse.urlparse(url).path.split("/revision/")[0])[1].lower() or ".png"
                if ext not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
                    ext = ".png"
                dest = os.path.join(folder, r["id"] + ext)
                if os.path.exists(dest):
                    continue
                try:
                    time.sleep(0.15)
                    req = urllib.request.Request(url, headers={"User-Agent": W.UA})
                    with urllib.request.urlopen(req, timeout=60) as resp:
                        open(dest, "wb").write(resp.read())
                    got += 1
                except Exception as e:
                    failed += 1
                    print(f"  picture failed {kind}/{r['id']}: {e}", file=sys.stderr)
        print(f"pictures: {got} new, {failed} failed -> assets/things/")
    print("Next: python3 -I tools/build_things.py")


if __name__ == "__main__":
    main()
