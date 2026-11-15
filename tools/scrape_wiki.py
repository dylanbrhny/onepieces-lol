#!/usr/bin/env python3
"""Pull every named character from the One Piece Wiki into data/characters.csv.

Run from the log-pose folder:
    python3 -I tools/scrape_wiki.py              # traits -> data/characters.csv
    python3 -I tools/scrape_wiki.py --images     # also download pictures to assets/characters/
then:
    python3 -I tools/build_data.py

Source: onepiece.fandom.com (text CC BY-SA 3.0; pictures are the publisher's art,
for personal/local use only). Raw API answers are cached in tools/.wiki_cache so
re-runs are fast and don't hit the wiki again (delete the folder to refresh).

Where each column comes from
- every page that uses the character infobox ({{Char Box}}); subpages skipped
- infobox: first appearance, affiliation, occupation, origin, epithet, other names,
  height, bounty, birthday, blood type, status, Devil Fruits (dfname, dfname2...)
- wiki categories: sex, race, Haki, fighting style, deceased, canon / non-canon, groups
- the article's Appearance section: hair colour (text search, so check it)
- links from other articles: fame (more links = more famous)
"""
import argparse
import csv
import hashlib
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://onepiece.fandom.com/api.php"
UA = "LogPoseFanGame/0.1 (personal non-commercial project)"
CACHE = os.path.join(ROOT, "tools", ".wiki_cache")
WIKI = "https://onepiece.fandom.com/wiki/"

COLUMNS = ["id", "name", "aliases", "image", "image_full", "epithet", "sex", "race", "height_cm", "origin_sea",
           "birthplace", "affiliation_type", "organizations", "primary_group", "crew_role", "devil_fruits",
           "devil_fruit_names", "devil_fruit_types", "haki", "fighting_style", "hair_color", "first_episode",
           "first_chapter", "debut_arc", "debut_saga", "status", "birthday", "blood_type", "bounty_peak",
           "appearances", "fame", "canon", "wiki_url"]

RACE_PRIORITY = [
    ("Lunarians", "Lunarian"), ("Mink Tribe", "Mink"), ("Fish-Men", "Fish-Man"), ("Merfolk", "Merfolk"),
    ("Giants", "Giant"), ("Dwarves", "Dwarf"), ("Longarms", "Longarm Tribe"), ("Longlegs", "Longleg Tribe"),
    ("Buccaneers", "Buccaneer"), ("Birkans", "Birkan"), ("Shandia", "Shandia"), ("Skypieans", "Skypiean"),
    ("Sky Island Natives", "Sky Islander"), ("Cyborgs", "Cyborg"), ("Hybrids", "Hybrid"),
    ("Mythological Beings", "Mythological Being"), ("Characters Created by Devil Fruits", "Devil Fruit Creation"),
    ("Characters Created by Science", "Artificial Being"), ("Living Weapons", "Living Weapon"),
    ("Talking Animals", "Animal"), ("Animals", "Animal"), ("Humans", "Human"),
]
HAKI = {"Observation Haki Users": "Observation", "Armament Haki Users": "Armament", "Supreme King Haki Users": "Conqueror's"}
STYLES = {
    "Swordsmen": "Swordsman", "Gunmen": "Gunman", "Snipers": "Sniper", "Martial Artists": "Martial Artist",
    "Fish-Man Karate Users": "Fish-Man Karate", "Six Powers Users": "Six Powers", "Whip Users": "Whip",
    "Polearm Wielders": "Polearm", "Club Users": "Club", "Explosive Users": "Explosives", "Fist Weapon Users": "Fist Weapons",
    "Shield Users": "Shield", "Flail Users": "Flail", "Chemical Weapon Users": "Chemical Weapons", "Dial Weapon Users": "Dials",
    "Laser Weapon Users": "Laser Weapons", "Flamethrower Users": "Flamethrower", "Fighters Who Use Animals": "Animal Partner",
    "Hypnotists": "Hypnotist", "Blade Users": "Blades",
}
GROUP_CATEGORIES = {"Four Emperors", "Seven Warlords of the Sea", "Worst Generation", "Super Rookies", "Admirals",
                    "Five Elders", "Celestial Dragons", "God's Knights", "Cipher Pol", "CP9", "CP0", "SWORD",
                    "Revolutionary Army", "Marines", "Baroque Works", "Straw Hat Grand Fleet"}
COLORS = {
    "black": "Black", "blond": "Blond", "blonde": "Blond", "golden": "Blond", "gold": "Blond", "yellow": "Blond",
    "brown": "Brown", "auburn": "Brown", "red": "Red", "crimson": "Red", "scarlet": "Red", "ginger": "Orange",
    "orange": "Orange", "pink": "Pink", "green": "Green", "blue": "Blue", "navy": "Blue", "teal": "Teal",
    "cyan": "Teal", "turquoise": "Teal", "white": "White", "silver": "Silver", "gray": "Gray", "grey": "Gray",
    "purple": "Purple", "violet": "Purple", "lavender": "Purple", "magenta": "Pink",
}

JUNK = re.compile(r"^(n/?a|none|unknown|civilian|\?+|-+|(his|her|their) own.*|independent)$", re.I)

_last = [0.0]


def api(params, cache=True):
    params = dict(params, format="json", formatversion="2", maxlag="5")
    key = hashlib.sha1(json.dumps(params, sort_keys=True).encode()).hexdigest()
    path = os.path.join(CACHE, key + ".json")
    if cache and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    for attempt in range(5):
        wait = 0.25 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
        except Exception as e:  # network hiccup: back off and retry
            print("  retry after error:", e, file=sys.stderr)
            time.sleep(2 + attempt * 3)
            continue
        if "error" in data and data["error"].get("code") == "maxlag":
            time.sleep(5)
            continue
        os.makedirs(CACHE, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)
        return data
    raise RuntimeError("API failed: %s" % params)


def api_all(params, merge):
    """Follow 'continue' until done; merge(data) is called on every page of results."""
    cont = {}
    while True:
        data = api(dict(params, **cont))
        merge(data)
        if "continue" not in data:
            return
        cont = data["continue"]


# ---------------- wikitext helpers ----------------
def find_template(text, names):
    for name in names:
        m = re.search(r"\{\{\s*" + re.escape(name).replace(r"\ ", r"[ _]") + r"\s*[|\n}]", text, re.I)
        if m:
            start, depth, i = m.start(), 0, m.start()
            while i < len(text) - 1:
                two = text[i:i + 2]
                if two == "{{":
                    depth += 1; i += 2; continue
                if two == "}}":
                    depth -= 1; i += 2
                    if depth == 0:
                        return text[start:i]
                    continue
                i += 1
    return None


def template_params(tpl):
    body = tpl[2:-2]
    parts, depth_c, depth_s, cur = [], 0, 0, ""
    i = 0
    while i < len(body):
        two = body[i:i + 2]
        if two == "{{": depth_c += 1; cur += two; i += 2; continue
        if two == "}}": depth_c -= 1; cur += two; i += 2; continue
        if two == "[[": depth_s += 1; cur += two; i += 2; continue
        if two == "]]": depth_s -= 1; cur += two; i += 2; continue
        if body[i] == "|" and depth_c == 0 and depth_s == 0:
            parts.append(cur); cur = ""; i += 1; continue
        cur += body[i]; i += 1
    parts.append(cur)
    params = {}
    for p in parts[1:]:
        if "=" in p:
            k, v = p.split("=", 1)
            params[k.strip().lower()] = v.strip()
    return params


def strip_templates(s):
    def repl(m):
        inner = m.group(0)[2:-2]
        bits = inner.split("|")
        name = bits[0].strip().lower()
        if name in ("qref", "ref", "status", "b", "citation needed", "cn", "sic", "!"):
            return ""
        if name == "nihongo":
            return bits[1] if len(bits) > 1 else ""
        if name in ("w", "wp", "wikipedia"):
            return bits[-1] if len(bits) > 1 else ""
        if name in ("nowrap", "small", "big", "color", "s"):
            return bits[-1] if len(bits) > 1 else ""
        return ""
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r"\{\{[^{}]*\}\}", repl, s)
    return s


def clean(s, keep_struck=True):
    if not s:
        return ""
    s = re.sub(r"<ref[^>]*/>", "", s)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"<br\s*/?>", ";", s, flags=re.I)
    if not keep_struck:
        s = re.sub(r"<s>.*?</s>", "", s, flags=re.S)
    s = strip_templates(s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"\[https?://\S+\s*([^\]]*)\]", r"\1", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("'''", "").replace("''", "")
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip(" ;,")


def split_items(s):
    return [x.strip(" ;,") for x in re.split(r";|\n", s) if x.strip(" ;,")]


NOTE_WORDS = r"former|defected|disbanded|temporary|formerly|temporarily|retired|deceased|disguise|undercover|partial|currently|promoted|demoted|acting|briefly|initially|later|honorary|unofficial|non-canon|anime|manga|descended|descendant|adopted|by blood|by marriage|captured|imprisoned|affiliated|allied|ally|loosely|nominal|technically|presumably|possibly|status unknown"


def drop_notes(item):
    return re.sub(r"\s*\((?:" + NOTE_WORDS + r")[^)]*\)", "", item, flags=re.I).strip()


def split_outside_parens(s, seps=",;"):
    """'Marines (Headquarters, SWORD), G-2' -> ['Marines (Headquarters, SWORD)', 'G-2']"""
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch in seps and depth == 0:
            out.append(cur); cur = ""
        else:
            cur += ch
    out.append(cur)
    return [x.strip(" ;,") for x in out if x.strip(" ;,")]


def group_names(item):
    """One affiliation item -> group names. 'Marines (Headquarters, SWORD)' -> Marines, Headquarters, SWORD;
    a bracket that's only a note ('(former)') is dropped instead."""
    names = []
    m = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", item)
    inner = m.group(2).strip() if m else ""
    # group names start with a capital letter; "(resigned)", "(double agent)" are notes
    if m and inner[:1].isupper() and not re.match(r"(?:" + NOTE_WORDS + r")\b", inner, re.I):
        names.append(m.group(1).strip())
        names += [x for x in split_outside_parens(m.group(2)) if x]
    else:
        names.append(re.sub(r"\s*\([^)]*\)", "", item).strip())
    return names


def slug(title):
    t = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-") or "c" + hashlib.sha1(title.encode()).hexdigest()[:6]


def section(text, heading):
    m = re.search(r"^==\s*" + heading + r"\s*==\s*$", text, re.M)
    if not m:
        return ""
    rest = text[m.end():]
    n = re.search(r"^==[^=].*==\s*$", rest, re.M)
    return rest[:n.start()] if n else rest


# ---------------- main ----------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "characters.csv"))
    ap.add_argument("--images", action="store_true", help="download pictures to assets/characters/")
    ap.add_argument("--limit", type=int, default=0, help="only the first N characters (testing)")
    args = ap.parse_args()

    print("1/5 listing character pages")
    titles = []
    api_all({"action": "query", "list": "embeddedin", "eititle": "Template:Char Box", "einamespace": "0", "eilimit": "500"},
            lambda d: titles.extend(p["title"] for p in d["query"]["embeddedin"]))
    titles = sorted({t for t in titles if "/" not in t})
    if args.limit:
        titles = titles[:args.limit]
    print(f"   {len(titles)} pages")

    print("2/5 reading pages, categories, pictures")
    pages = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
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
        api_all({"action": "query", "titles": "|".join(batch), "prop": "revisions|categories|pageimages|info",
                 "rvprop": "content", "rvslots": "main", "cllimit": "max", "clshow": "!hidden",
                 "piprop": "thumbnail", "pithumbsize": "320", "pilimit": "50", "inprop": "url"}, merge)
        print(f"   {min(i + 50, len(titles))}/{len(titles)}", end="\r")
    print()

    # main characters keep their infobox in "Template:<Name> Tabs Top"
    tabs = {}
    for t, rec in pages.items():
        m = re.match(r"\s*\{\{\s*([^|}\n]+?Tabs Top)\s*[|}]", rec.get("text", ""))
        if m:
            tabs["Template:" + m.group(1).strip()] = t
    tab_text = {}
    names = sorted(tabs)
    for i in range(0, len(names), 50):
        d = api({"action": "query", "titles": "|".join(names[i:i + 50]), "prop": "revisions", "rvprop": "content", "rvslots": "main"})
        for p in d["query"].get("pages", []):
            if p.get("revisions"):
                tab_text[p["title"]] = p["revisions"][0]["slots"]["main"]["content"]
    print(f"   {len(tab_text)} main-character infobox templates")

    print("3/5 counting links (fame)")
    links = Counter()
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        def merge(d):
            for p in d["query"].get("pages", []):
                links[p["title"]] += len(p.get("linkshere", []))
        api_all({"action": "query", "titles": "|".join(batch), "prop": "linkshere", "lhnamespace": "0",
                 "lhshow": "!redirect", "lhprop": "pageid", "lhlimit": "max"}, merge)
        print(f"   {min(i + 50, len(titles))}/{len(titles)}", end="\r")
    print()
    maxlog = math.log(1 + max(links.values() or [1]))

    print("4/5 parsing")
    rows, used_ids = [], set()
    base_count = Counter(re.sub(r"\s*\([^)]*\)$", "", t) for t in titles)
    for title in titles:
        rec = pages.get(title, {})
        text = rec.get("text", "")
        tabs_name = next((k for k, v in tabs.items() if v == title), None)
        box_src = tab_text.get(tabs_name, "") if tabs_name else text
        box = find_template(box_src, ["Char Box"]) or find_template(text, ["Char Box"])
        if not box:
            continue
        P = template_params(box)
        cats = {c.replace("Non-Canon ", "") for c in rec["cats"]}
        raw_cats = rec["cats"]
        name = re.sub(r"\s*\([^)]*\)$", "", title)
        if base_count[name] > 1 and name != title:
            name = title                      # keep "(Ship)", "(Non-Canon)" etc. when names clash

        cid = slug(name)
        while cid in used_ids:
            cid += "-2"
        used_ids.add(cid)

        # names a player might type
        aliases = []
        for key in ("ename", "alias", "birthname", "rname"):
            for item in split_items(clean(P.get(key, ""))):
                item = re.sub(r"\s*\([^)]*\)", "", item).strip(' "')
                for bit in re.split(r",\s*", item):
                    bit = bit.strip(' "')
                    if bit and bit.lower() != name.lower() and len(bit) < 50 and not JUNK.match(bit):
                        aliases.append(bit)
        epithet = clean(P.get("epithet", ""))
        q = re.search(r'"([^"]+)"', epithet)
        if q:
            epithet = q.group(1).strip()
        elif epithet:
            epithet = re.sub(r"\s*\([^)]*\)", "", split_items(epithet)[0]).strip(' "')
        if epithet:
            ep_short = epithet
            for tok in name.split():
                ep_short = re.sub(r"\b" + re.escape(tok) + r"\b", "", ep_short)
            ep_short = re.sub(r"\s+", " ", ep_short).strip(' "')
            if ep_short and ep_short.lower() not in (name.lower(), "the"):
                aliases.append(ep_short)
                epithet = ep_short
        aliases = list(dict.fromkeys(a for a in aliases if a and not re.search(r'[():"]', a)))

        # sex, race, haki, styles, status, canon
        sex = "Male" if "Male Characters" in cats else "Female" if "Female Characters" in cats else "Unknown"
        if "Transgender Characters" in cats:
            sex = "Female" if "Female Characters" in cats else sex
        race = next((label for cat, label in RACE_PRIORITY if cat in cats), "Unknown")
        haki = [v for k, v in HAKI.items() if k in cats]
        styles = [v for k, v in STYLES.items() if k in cats]
        st =clean(P.get("status", "")).lower()
        if "Deceased Characters" in cats or st in ("2", "deceased", "dead"):
            status = "Deceased"
        elif st in ("1", "alive"):
            status = "Alive"
        elif st in ("3", "unknown"):
            status = "Unknown"
        else:
            status = "Alive" if P.get("status") is None and "Mentioned Only Characters" not in cats else "Unknown"
        first_raw = P.get("first", "")
        ch = re.search(r"Chapter\s*(\d+)", first_raw)
        ep = re.search(r"Episode\s*(\d+)", first_raw)
        noncanon_cat = any(c.startswith("Non-Canon") for c in raw_cats)
        canon = "no" if (noncanon_cat and (not ch or "(" in title)) or "(Non-Canon" in title else "yes"

        # groups and roles
        affil_items = [x for x in split_outside_parens(clean(P.get("affiliation", "")), ",;\n")
                       if not x.lower().startswith("ally")]
        orgs, current = [], []
        for it in affil_items:
            is_current = not re.search(r"\((former|defected|disbanded)", it, re.I)
            for base in group_names(drop_notes(it)):
                base = re.sub(r"\s+\d+(st|nd|rd|th) Division$", "", base).strip()
                if base and len(base) < 60 and not JUNK.match(base):
                    orgs.append(base)
                    if is_current:
                        current.append(base)
        for c in cats:
            if c.endswith(" Members"):
                orgs.append(c[:-8])
            elif c in GROUP_CATEGORIES:
                orgs.append(c)
        orgs = list(dict.fromkeys(orgs))
        primary = (current or orgs or [""])[0]
        roles = []
        for it in split_outside_parens(clean(P.get("occupation", "")), ",;\n"):
            r = drop_notes(it)
            r = re.sub(r"\s*\([^)]*\)", "", r).strip()
            if r and len(r) < 40:
                roles.append(r)
        style_words = {v.lower(): v for v in STYLES.values()}
        style_words.update({"swordswoman": "Swordsman", "master swordsman": "Swordsman", "marksman": "Gunman", "gunman": "Gunman"})
        moved = [style_words[r.lower()] for r in roles if r.lower() in style_words]
        roles = list(dict.fromkeys(r for r in roles if r.lower() not in style_words))
        styles = list(dict.fromkeys(styles + moved))
        if "Swordsman" in styles and "Blades" in styles:
            styles.remove("Blades")
        joined = " ".join(orgs + roles).lower()
        if "revolutionary" in joined:
            aff_type = "Revolutionary"
        elif "pirate" in " ".join(current + roles).lower():
            aff_type = "Pirate"
        elif "marine" in joined:
            aff_type = "Marine"
        elif re.search(r"cipher pol|\bcp\d|world government|five elders|celestial|god's knights", joined):
            aff_type = "World Government"
        elif re.search(r"\b(king|queen|prince|princess|daimyo|shogun)\b", joined):
            aff_type = "Royalty"
        elif "pirate" in joined:
            aff_type = "Pirate"
        else:
            aff_type = "Civilian"

        # Devil Fruits (dfname, dfname2, ...)
        fruits, fruit_names, fruit_types = [], [], []
        for n in ["", "2", "3"]:
            fn = clean(P.get("dfname" + n, ""))
            if not fn:
                continue
            # "(Hito Hito no Mi, Model: Nika)" is a whole second name; "Nikyu Nikyu no Mi (Artificial)" is a note
            def fruit_item(x):
                x = x.strip()
                return x.strip(" ()") if x.startswith("(") else re.sub(r"\s*\(.*$", "", x).strip()
            items = [fruit_item(x) for x in split_items(fn) if fruit_item(x)]
            fruits.append(items[0])
            fruit_names.extend(items[1:])          # e.g. Luffy: "Hito Hito no Mi, Model: Nika"
            for ft in split_items(clean(P.get("dftype" + n, ""))):
                ft = fruit_item(ft)
                if ft and len(ft) < 30:
                    fruit_types.append(ft)
            for item in split_items(clean(P.get("dfename" + n, ""))):
                nm = re.sub(r"\s*\([^)]*\)", "", item).strip(' "')
                if nm:
                    fruit_names.append(nm)
        fruit_names = list(dict.fromkeys(fruit_names))
        # "Mythical Zoan" / "Artificial Paramecia" also count as plain Zoan / Paramecia
        for ft in list(fruit_types):
            for base_type in ("Zoan", "Paramecia", "Logia"):
                if base_type in ft and ft != base_type:
                    fruit_types.append(base_type)
        fruit_types = list(dict.fromkeys(fruit_types))

        # numbers and small facts
        # heights are listed by age in no fixed order (Luffy: child first; Ace: adult first, age 10 last),
        # so keep the largest, which is the grown-up / current height
        hs = []
        for h in re.findall(r"([\d,.]+)\s*cm", clean(P.get("height", ""))):
            try:
                hs.append(float(h.replace(",", "")))
            except ValueError:
                pass
        height = str(round(max(hs))) if hs else ""
        nums = [int(n.replace(",", "")) for n in re.findall(r"\d{1,3}(?:,\d{3})+|\d{4,}", clean(P.get("bounty", "")))]
        bounty = str(max(nums)) if nums else ""
        b = re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})", clean(P.get("birth", "")))
        months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        birthday = f"{months.index(b.group(1)) + 1:02d}-{int(b.group(2)):02d}" if b else ""
        blood = clean(P.get("blood type", ""))
        blood = split_items(blood)[0].split()[0] if blood else ""
        origin = clean(P.get("origin", ""))
        origin_sea = re.sub(r"\s*\(.*", "", origin).strip()
        bp = re.search(r"\(([^)]*)\)", origin)
        birthplace = bp.group(1) if bp else ""

        # hair from the Appearance section
        hair = ""
        appear = clean(section(text, "Appearance"))
        for m in re.finditer(r"([A-Za-z-]+(?:[\s,-]+[A-Za-z-]+){0,3})\s+hair", appear):
            words = re.findall(r"[a-z]+", m.group(1).lower())
            found = [COLORS[w] for w in reversed(words) if w in COLORS]
            if found:
                hair = found[0]
                break
        if not hair and re.search(r"\bbald\b", appear, re.I):
            hair = "Bald"

        fame = max(1, round(100 * math.log(1 + links[title]) / maxlog))
        if canon == "no":
            fame = max(1, fame // 2)

        rows.append({
            "id": cid, "name": name, "aliases": "|".join(aliases), "image": "", "image_full": "",
            "epithet": epithet, "sex": sex, "race": race, "height_cm": height, "origin_sea": origin_sea,
            "birthplace": birthplace, "affiliation_type": aff_type, "organizations": "|".join(orgs),
            "primary_group": primary, "crew_role": "|".join(roles), "devil_fruits": "|".join(fruits),
            "devil_fruit_names": "|".join(fruit_names), "devil_fruit_types": "|".join(fruit_types),
            "haki": "|".join(haki), "fighting_style": "|".join(styles), "hair_color": hair,
            "first_episode": ep.group(1) if ep else "", "first_chapter": ch.group(1) if ch else "",
            "debut_arc": "", "debut_saga": "", "status": status, "birthday": birthday, "blood_type": blood,
            "bounty_peak": bounty, "appearances": "", "fame": str(fame), "canon": canon,
            "wiki_url": rec.get("url", WIKI + urllib.parse.quote(title.replace(" ", "_"))),
            "_thumb": rec.get("thumb", ""),
        })

    print(f"   {len(rows)} characters parsed")
    if os.path.exists(args.out):
        backup = args.out.replace(".csv", ".before-wiki.csv")
        if not os.path.exists(backup):
            os.replace(args.out, backup)
            print(f"   your previous file is saved as {os.path.relpath(backup, ROOT)}")
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"   wrote {os.path.relpath(args.out, ROOT)}")

    if args.images:
        print("5/5 downloading pictures")
        folder = os.path.join(ROOT, "assets", "characters")
        os.makedirs(folder, exist_ok=True)
        got = skipped = failed = 0
        for n, r in enumerate(rows, 1):
            url = r["_thumb"]
            if not url:
                continue
            ext = os.path.splitext(urllib.parse.urlparse(url).path.split("/revision/")[0])[1].lower() or ".png"
            if ext not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
                ext = ".png"
            dest = os.path.join(folder, r["id"] + ext)
            if os.path.exists(dest):
                skipped += 1
                continue
            try:
                wait = 0.15 - (time.time() - _last[0])
                if wait > 0:
                    time.sleep(wait)
                _last[0] = time.time()
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=60) as resp:
                    data = resp.read()
                with open(dest, "wb") as f:
                    f.write(data)
                got += 1
            except Exception as e:
                failed += 1
                print(f"   failed {r['id']}: {e}", file=sys.stderr)
            if n % 50 == 0:
                print(f"   {n}/{len(rows)}", end="\r")
        print(f"\n   pictures: {got} new, {skipped} already there, {failed} failed")
    else:
        print("5/5 pictures skipped (add --images)")

    c = Counter(r["canon"] for r in rows)
    print(f"\nDone: {len(rows)} characters ({c['yes']} canon, {c['no']} non-canon). Now run: python3 -I tools/build_data.py")


if __name__ == "__main__":
    main()
