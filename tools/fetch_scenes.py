#!/usr/bin/env python3
"""Fetch one scenery picture per arc for the voyage map -> assets/scenes/ + data/route.js

Run from the log-pose folder (after tools/build_data.py, which writes data/arcs.js):
    python3 -I tools/fetch_scenes.py

The voyage is a row of boxes, one per arc. Each box shows its place, pixelated in the game
(the pictures here stay full quality; the game shrinks them and cuts the colours itself).
The picture is the infobox image of the place's wiki page (e.g. "Wano Country").

To use a different picture for an arc, drop your own file in assets/scenes/ and put its name
in the SCENES list below (the "file" value), or just overwrite assets/scenes/<slug>.<ext>.
Pictures are the publisher's art: keep them local, don't publish them.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import scrape_wiki as W  # noqa: E402  (api with cache, user agent)

# (arc as named in episodes.csv, wiki page for the picture, label on the map, fallback pixel style)
SCENES = [
    ("Romance Dawn Arc", "Foosha Village", "Foosha Village", "village"),
    ("Orange Town Arc", "Orange Town", "Orange Town", "town"),
    ("Syrup Village Arc", "Syrup Village", "Syrup Village", "village"),
    ("Baratie Arc", "Baratie", "Baratie", "town"),
    ("Arlong Park Arc", "Arlong Park", "Arlong Park", "town"),
    ("Loguetown Arc", "Loguetown", "Loguetown", "town"),
    ("Reverse Mountain Arc", "Reverse Mountain", "Reverse Mountain", "reverse"),
    ("Whisky Peak Arc", "Whisky Peak", "Whisky Peak", "cactus"),
    ("Little Garden Arc", "Little Garden", "Little Garden", "bigtree"),
    ("Drum Island Arc", "Drum Island", "Drum Island", "wano"),
    ("Arabasta Arc", "Arabasta Kingdom", "Arabasta", "desert"),
    ("Jaya Arc", "Jaya", "Jaya", "bigtree"),
    ("Skypiea Arc", "Skypiea", "Skypiea", "grass"),
    ("Long Ring Long Land Arc", "Long Ring Long Land", "Long Ring Long Land", "grass"),
    ("Water 7 Arc", "Water 7", "Water 7", "city"),
    ("Enies Lobby Arc", "Enies Lobby", "Enies Lobby", "city"),
    ("Thriller Bark Arc", "Thriller Bark", "Thriller Bark", "spooky"),
    ("Sabaody Archipelago Arc", "Sabaody Archipelago", "Sabaody", "bubble"),
    ("Amazon Lily Arc", "Amazon Lily", "Amazon Lily", "grass"),
    ("Impel Down Arc", "Impel Down", "Impel Down", "navy"),
    ("Marineford Arc", "Marineford", "Marineford", "navy"),
    ("Fish-Man Island Arc", "Fish-Man Island", "Fish-Man Island", "fishman"),
    ("Punk Hazard Arc", "Punk Hazard", "Punk Hazard", "firefrost"),
    ("Dressrosa Arc", "Dressrosa", "Dressrosa", "dressrosa"),
    ("Zou Arc", "Zou", "Zou", "bigtree"),
    ("Whole Cake Island Arc", "Whole Cake Island", "Whole Cake Island", "cake"),
    ("Levely Arc", "Mary Geoise", "Mary Geoise", "city"),
    ("Wano Country Arc", "Wano Country", "Wano", "wano"),
    ("Egghead Arc", "Egghead", "Egghead", "tech"),
    ("Elbaph Arc", "Elbaph", "Elbaph", "bigtree"),
]
FINAL = {"name": "???", "style": "final", "finale": True}   # never named: no spoilers
EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    arcs_path = os.path.join(ROOT, "data", "arcs.js")
    arcs = {}
    if os.path.exists(arcs_path):
        t = open(arcs_path, encoding="utf-8").read()
        for a in json.loads(t[t.index("["):t.rindex("]") + 1]):
            arcs[a["arc"]] = a
    else:
        print("data/arcs.js not found: run python3 -I tools/build_data.py first (episode ranges are needed for the spoiler filter)")

    folder = os.path.join(ROOT, "assets", "scenes")
    os.makedirs(folder, exist_ok=True)

    pages = [p for _, p, _, _ in SCENES]
    thumbs = {}
    for i in range(0, len(pages), 50):
        d = W.api({"action": "query", "titles": "|".join(pages[i:i + 50]), "prop": "pageimages",
                   "piprop": "thumbnail", "pithumbsize": "800", "pilimit": "50", "redirects": "1"})
        norm = {n["from"]: n["to"] for n in d["query"].get("normalized", []) + d["query"].get("redirects", [])}
        for p in d["query"].get("pages", []):
            if p.get("thumbnail"):
                thumbs[p["title"]] = p["thumbnail"]["source"]
        for a, b in norm.items():
            if b in thumbs:
                thumbs[a] = thumbs[b]

    stops, got, have, missing = [], 0, 0, []
    for arc, page, label, style in SCENES:
        s = slug(label)
        existing = next((f for f in os.listdir(folder) if os.path.splitext(f)[0] == s and f.lower().endswith(EXTS)), None)
        file = existing
        if not existing and page in thumbs:
            url = thumbs[page]
            ext = os.path.splitext(urllib.parse.urlparse(url).path.split("/revision/")[0])[1].lower() or ".png"
            if ext not in EXTS:
                ext = ".png"
            file = s + ext
            req = urllib.request.Request(url, headers={"User-Agent": W.UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                open(os.path.join(folder, file), "wb").write(r.read())
            got += 1
            time.sleep(0.2)
        elif existing:
            have += 1
        if not file:
            missing.append(label)
        a = arcs.get(arc, {})
        stops.append({"name": label, "arc": arc, "style": style,
                      "scene": f"assets/scenes/{file}" if file else "",
                      "first_ep": a.get("first_ep"), "last_ep": a.get("last_ep"), "last_ch": a.get("last_ch")})
    stops.append(dict(FINAL))

    with open(os.path.join(ROOT, "data", "route.js"), "w", encoding="utf-8") as f:
        f.write("// Generated by tools/fetch_scenes.py: the voyage map, one box per arc (in order). Edit SCENES there.\n")
        f.write("window.ROUTE_STOPS = ")
        json.dump(stops, f, ensure_ascii=False, indent=1)
        f.write(";\n")
    print(f"Scenes: {got} downloaded, {have} already there, {len(missing)} without a picture {missing if missing else ''}")
    print(f"Wrote data/route.js with {len(stops)} boxes")


if __name__ == "__main__":
    main()
