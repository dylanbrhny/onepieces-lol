#!/usr/bin/env python3
"""Fill in tags for every character automatically -> data/character_tags.csv

Run from the log-pose folder, after tools/scrape_wiki.py:
    python3 -I tools/tag_characters.py
    python3 -I tools/build_data.py

It reuses the scraper's cached wiki pages (tools/.wiki_cache), so it doesn't hit the wiki
again unless the cache is missing. Three sources, in order of how much to trust them:
  1. wiki categories      e.g. "Doctors", "Former Marines", "World Nobles"   (reliable)
  2. your data            Devil Fruit names, race, height, groups            (reliable)
  3. keywords in the article's Appearance / Personality / Abilities text    (check these)

data/character_tags.csv columns:
  id, name, fame                       who it is (sort by fame to do the famous ones first)
  tags_auto, weapons_auto              from categories + data: reliable, used in the game, rewritten every run
  tags_suggested, weapons_suggested    keyword guesses from the article text: NOT used. Copy the right
                                       ones into tags_add / weapons_add.
  tags_add, tags_remove, weapons_add   YOURS: kept between runs.
  tags_why                             where each auto tag came from
The build script uses: (tags_auto + tags_add) - tags_remove, and weapons_auto + weapons_add.
"""
import csv
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import scrape_wiki as W  # noqa: E402  (api, api_all, section, clean)

OUT = os.path.join(ROOT, "data", "character_tags.csv")

# ---------- 1. wiki categories -> tags (canon and non-canon versions both count) ----------
CAT = {
    "doctor": ["Doctors"], "scientist": ["Scientists"], "cook": ["Cooks", "Marine Cooks"], "musician": ["Musicians"],
    "martial_artist": ["Martial Artists"], "navigator": ["Navigators"], "carpenter": ["Shipwrights", "Carpenters"],
    "archaeologist": ["Ohara Archaeologists"], "assassin": ["Assassins", "Former Assassins"],
    "bounty_hunter": ["Bounty Hunters", "Former Bounty Hunters"], "mercenary": ["Mercenaries", "Former Mercenaries"],
    "spy": ["Cipher Pol Agents", "Former Cipher Pol Agents"], "journalist": ["Reporters"], "bartender": ["Bartenders"],
    "fisherman": ["Fishermen"], "farmer": ["Farmers"], "teacher": ["Teachers"], "performer": ["Performers"],
    "king_or_queen": ["Kings", "Former Kings", "Queens", "Queens Regnant"],
    "prince_or_princess": ["Princes", "Former Princes", "Princesses", "Former Princesses"],
    "royalty": ["Royalty", "Kings", "Former Kings", "Queens", "Queens Regnant", "Princes", "Former Princes", "Princesses", "Former Princesses"],
    "world_noble": ["World Nobles"], "former_slave": ["Former Slaves", "Former Mary Geoise Slaves", "Slaves", "Mary Geoise Slaves"],
    "impel_down": ["Impel Down Prisoners", "Former Impel Down Prisoners", "Impel Down Level 6 Prisoners", "Former Impel Down Level 6 Prisoners"],
    "former_marine": ["Former Marines"], "former_pirate": ["Former Pirates", "Former Pirate Captains", "Former Pirate Officers"],
    "gunner": ["Gunmen"], "sniper_skill": ["Snipers"], "whip": ["Whip Users"], "archer": ["Archers"],
    "child": ["Children"], "zombie": ["Zombies", "General Zombies", "Wild Zombies"], "prosthetic": ["Cyborgs"],
    "summons_animals": ["Fighters Who Use Animals"], "will_of_d": ["Clan of D."], "mythical_form": ["Mythical Zoan Devil Fruit Users"],
    "game_only": ["Game Characters", "Game Antagonists"], "animal": ["Animals", "Talking Animals"],
}
CAT_WEAPON = {"Swordsmen": "Sword", "Gunmen": "Gun", "Archers": "Bow", "Whip Users": "Whip"}
CAT_RE = {"movie": re.compile(r"^(Non-Canon )?Movie \d+ (Characters|Antagonists)$")}

# ---------- 2. from the data columns ----------
FRUIT = {  # first word of the fruit name -> tags
    "mera": "fire_powers", "magu": "fire_powers", "hie": "ice_powers", "goro": "lightning_powers", "pika": "light_powers",
    "moku": "smoke_powers", "suna": "sand_powers", "doku": "poison_powers", "bomu": "explosion_powers",
    "ito": "string_powers controls_others", "gasu": "gas_powers", "suke": "invisible", "mane": "copies_others",
    "bara": "splits_body", "bari": "barriers", "doru": "creates_objects", "gomu": "stretchy", "ope": "teleport heals",
    "chiyu": "heals", "mini": "shrinks_or_grows", "doa": "teleport", "nikyu": "teleport", "yomi": "skeleton",
    "hana": "extra_limbs", "kage": "controls_others", "horo": "controls_others",
}
RACE = {
    "Mink": "fur", "Fish-Man": "gills fins underwater", "Merfolk": "mermaid_tail underwater gills", "Giant": "very_tall",
    "Skypiean": "wings sky_island", "Shandia": "wings sky_island", "Birkan": "wings sky_island", "Sky Islander": "sky_island",
    "Lunarian": "wings", "Longarm Tribe": "long_limbs", "Longleg Tribe": "long_limbs", "Animal": "animal",
    "Cyborg": "prosthetic", "Dwarf": "very_short",
}

# ---------- 3. keywords in the article (section -> tag -> pattern) ----------
LOOK = {
    "shirtless": r"\b(shirtless|bare[- ]chested|bare chest|no shirt|without a shirt|bare torso)\b",
    "beard": r"\bbeard", "mustache": r"\bmou?stache", "goatee": r"\bgoatee", "sideburns": r"\bsideburns",
    "bald": r"\bbald\b", "long_hair": r"\blong (\w+ ){0,2}hair\b", "afro": r"\bafro\b", "ponytail": r"\bponytail",
    "braids": r"\bbraid", "pompadour": r"\bpompadour", "spiky_hair": r"\bspiky (\w+ )?hair", "dreadlocks": r"\bdread(lock)?s\b",
    "mohawk": r"\bmohawk", "curly_eyebrow": r"\bcurl(y|ed) eyebrow", "no_eyebrows": r"\b(no|lacks|without) eyebrows",
    "hat": r"\b(hat|bicorne|tricorne|top hat|cap)\b", "sunglasses": r"\b(sunglasses|shades)\b",
    "glasses": r"\b(glasses|spectacles)\b", "eyepatch": r"\beye ?patch", "scar": r"\bscar(s|red)?\b",
    "face_scar": r"\bscar\w* (on|across|over|running (down|across|over)) (his|her|their|the) (face|left eye|right eye|eye|forehead|cheek|nose|chin|lip)",
    "tattoo": r"\btattoo", "face_tattoo": r"\b(facial tattoo|tattoo\w* on (his|her|their) face)",
    "makeup": r"\b(make-?up|face paint|eye ?shadow|rouge)\b", "lipstick": r"\blipstick", "mask": r"\b(mask|helmet)\b",
    "coat_on_shoulders": r"\b(coat|jacket|cape)\b[^.]{0,40}\b(draped|worn|hangs?|hung)\b[^.]{0,20}\bshoulders",
    "earrings": r"\bearrings?\b", "long_nose": r"\blong(ish)? nose", "sharp_teeth": r"\b(sharp|pointed|shark-like|jagged|fang-like)\b[^.]{0,10}\bteeth",
    "big_lips": r"\b(large|big|thick) lips", "big_chin": r"\b(large|big|huge|long|prominent) chin", "freckles": r"\bfreckle",
    "stitches": r"\bstitch(es|ed)\b", "monocle": r"\bmonocle", "goggles": r"\bgoggles",
    "cape": r"\bcape\b", "kimono": r"\bkimono", "armor": r"\barmou?r\b", "suit": r"\bsuit\b", "uniform": r"\buniform\b",
    "crown": r"\bcrown\b", "headband": r"\bheadband", "bandana": r"\bbandann?a", "hood": r"\bhood(ed)?\b", "scarf": r"\bscarf",
    "jewelry": r"\b(jewel(le)?ry|necklaces)\b", "flowers": r"\bflowers?\b", "barefoot": r"\bbarefoot",
    "bandages": r"\bbandage", "open_shirt": r"\b(open|unbuttoned)\b[^.]{0,10}\b(shirt|coat|jacket|vest)\b",
    "striped_clothes": r"\bstriped\b", "horns": r"\bhorns?\b", "wings": r"\bwings?\b", "tail": r"\btail\b",
    "extra_limbs": r"\b(four|six|eight) arms\b|\bextra (arms|legs)\b",
    "missing_limb": r"\b(missing|lost) (his|her|their) (left |right )?(arm|leg|hand)\b|\bone-armed\b|\bpeg ?leg\b|\bmissing an? (arm|leg)\b",
    "prosthetic": r"\bprosthetic|\bpeg ?leg\b|\bhook (for a|in place of)|\bmechanical (arm|leg|hand|body)|\bcybernetic",
    "muscular": r"\b(muscular|muscle-bound|well-built|brawny)\b", "fat": r"\b(obese|overweight|rotund|corpulent|portly|fat)\b",
    "elderly": r"\b(elderly|old man|old woman)\b", "fins": r"\bfins?\b", "gills": r"\bgills?\b", "tentacles": r"\btentacle",
    "fur": r"\bfur\b|\bfurry\b", "feathers": r"\bfeather", "beak": r"\bbeak\b", "scales": r"\bscales\b", "third_eye": r"\bthird eye",
    "big_mouth": r"\b(huge|large|big|wide) mouth", "cigar": r"\bcigars?\b",
    "smokes": r"\b(smok(es|ing|er)|cigarettes?|cigars?|tobacco pipe|smoking pipe)\b",
}
PERSONALITY = {
    "smokes": LOOK["smokes"], "cigar": r"\bcigars?\b",
    "drinks": r"\b(alcohol|sake|booze|drunkard|heavy drinker|drinking)\b",
    "glutton": r"\b(glutton|gluttonous|voracious appetite|huge appetite|big eater|enormous appetite)",
    "unique_laugh": r"\b(unique|distinctive|peculiar|signature|strange|unusual|odd) laugh",
    "catchphrase": r"\bcatch ?phrase", "verbal_tic": r"\bverbal tic|\bends (his|her|their) sentences|\bspeech (pattern|quirk)",
    "cries_easily": r"\bcries (easily|a lot|often)|\bcrybaby|\beasily moved to tears|\bbursts? into tears",
    "flirt": r"\b(flirt|womani[sz]|lecher|ladies' man|lustful|perverted)", "coward": r"\bcoward",
    "money_lover": r"\b(love|loves|obsessed|obsession|greed) (of|with|for) (money|treasure|gold|berries|wealth)|\bmoney-loving",
    "greedy": r"\bgreed(y|iness)\b", "bad_sense_of_direction": r"\b(no|poor|terrible|bad|awful) sense of direction|\bgets lost",
    "sleepy": r"\bfalls? asleep|\bnarcolep", "sings": r"\b(loves|likes|enjoys) (to )?sing", "dances": r"\b(loves|likes|enjoys) (to )?danc",
    "meat_lover": r"\b(loves|likes) meat|\bfavorite food is meat", "sweet_tooth": r"\bsweet tooth|\bloves sweets",
    "reader": r"\b(loves|likes|enjoys) reading|\bavid reader", "gambler": r"\bgambl", "liar": r"\b(liar|habitual(ly)? l(ie|ying))\b",
    "arrogant": r"\b(arrogan|condescend|haughty|egotistic)", "polite": r"\b(polite|courteous)\b",
    "hot_headed": r"\b(short[- ]tempered|hot[- ]headed|quick temper|easily angered|hot[- ]blooded)",
    "calm": r"\b(calm|composed|stoic|level-headed)\b", "nosebleeds": r"\bnose ?bleed", "signature_pose": r"\b(signature|trademark) pose",
    "third_person": r"\bthird person", "childish": r"\b(childish|child-like|childlike|immature)\b",
    "honor_code": r"\b(code of honou?r|honou?rable|bushido|sense of honou?r)\b", "vengeful": r"\b(revenge|vengeance|vengeful)\b",
    "cheerful": r"\b(cheerful|jovial|upbeat|happy-go-lucky)\b", "gloomy": r"\b(gloomy|pessimis|melanchol)",
    "afraid_of_something": r"\b(afraid|scared|terrified|frightened) of\b|\bphobia", "loves_animals": r"\b(loves|fond of) animals",
    "lazy": r"\b(lazy|laziness|lethargic)\b", "loud": r"\b(loud|boisterous|rowdy)\b", "shy": r"\b(shy|timid)\b",
    "dramatic": r"\b(dramatic|theatrical|flamboyant)\b", "prays": r"\b(prays?|religious|devout)\b",
    "orphan": r"\borphan",
}
ABILITIES = {
    "inventor": r"\b(inventor|invents|invented)\b", "artist": r"\b(painter|artist|sculpt)", "writer": r"\b(author|novelist|writer)\b",
    "swimmer": r"\b(excellent|great|skilled|expert|strong) swimmer", "map_maker": r"\b(cartograph|map ?maker|draws? maps)",
    "can_fly": r"\b(can fly|ability to fly|able to fly|flight)\b", "strategist": r"\b(strategist|tactician)\b",
    "pacifist": r"\bpacifis", "fights_dirty": r"\b(dirty tricks|underhanded|fights dirty)\b",
    "super_strength": r"\b(immense|monstrous|superhuman|tremendous|incredible) strength", "super_speed": r"\b(superhuman|incredible|immense|tremendous) speed",
    "kicker": r"\bkick(ing)?[- ]based\b|\bfights (mainly |primarily )?(with|using) (his|her) legs",
    "dual_wielder": r"\b(two|twin|dual) (swords|blades|pistols|guns|daggers)\b|\bdual[- ]wield",
    "multiple_swords": r"\b(two|three|four|five|six|seven|eight|nine) swords\b", "named_sword": r"\bmeito\b|\bgrade (sword|blade)",
    "seastone": r"\bseastone|sea prism stone", "rides_animal": r"\brides? (on )?(a|an|his|her) \w+",
    "giant_weapon": r"\b(giant|huge|enormous|massive) (sword|axe|hammer|club|weapon|blade|cannon)",
}
WEAPON_WORDS = [
    ("Sword", r"\b(swords?|katanas?|sabers?|sabres?|cutlass(es)?|blades?)\b"), ("Gun", r"\b(guns?|pistols?|rifles?|muskets?|flintlocks?|revolvers?)\b"),
    ("Staff", r"\b(staff|staves|bo staff)\b"), ("Spear", r"\b(spears?|tridents?|halberds?|naginatas?|lances?)\b"),
    ("Whip", r"\bwhips?\b"), ("Bow", r"\b(bows? and arrows?|crossbows?|archery)\b"), ("Club", r"\b(clubs?|kanabos?|maces?)\b"),
    ("Axe", r"\baxes?\b"), ("Hammer", r"\bhammers?\b"), ("Knife", r"\b(knives|knife|daggers?)\b"), ("Cannon", r"\bcannons?\b"),
    ("Scythe", r"\bscythes?\b"), ("Chain", r"\bchains?\b"), ("Fan", r"\b(war )?fans?\b"), ("Shield", r"\bshields?\b"),
]


def read_existing():
    keep = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f):
                keep[r["id"]] = {k: r.get(k, "") for k in ("tags_add", "tags_remove", "weapons_add")}
    return keep


def load_pages():
    """Same requests as scrape_wiki.py, so they come from its cache."""
    titles = []
    W.api_all({"action": "query", "list": "embeddedin", "eititle": "Template:Char Box", "einamespace": "0", "eilimit": "500"},
              lambda d: titles.extend(p["title"] for p in d["query"]["embeddedin"]))
    titles = sorted({t for t in titles if "/" not in t})
    pages = {}
    for i in range(0, len(titles), 50):
        def merge(d):
            for p in d["query"].get("pages", []):
                rec = pages.setdefault(p["title"], {"cats": set()})
                if p.get("revisions"):
                    rec["text"] = p["revisions"][0]["slots"]["main"]["content"]
                for c in p.get("categories", []):
                    rec["cats"].add(c["title"].split(":", 1)[1])
                if p.get("fullurl"):
                    rec["url"] = p["fullurl"]
        W.api_all({"action": "query", "titles": "|".join(titles[i:i + 50]), "prop": "revisions|categories|pageimages|info",
                   "rvprop": "content", "rvslots": "main", "cllimit": "max", "clshow": "!hidden",
                   "piprop": "thumbnail", "pithumbsize": "320", "pilimit": "50", "inprop": "url"}, merge)
        print(f"   pages {min(i + 50, len(titles))}/{len(titles)}", end="\r")
    print()
    return pages


def first_para(t):
    paras = [p.strip() for p in re.split(r"\n\s*\n", t) if len(p.strip()) > 40]
    return paras[0] if paras else ""


def text_of(text, heading):
    return W.clean(W.section(text, heading)).lower()


def main():
    chars = list(csv.DictReader(open(os.path.join(ROOT, "data", "characters.csv"), encoding="utf-8-sig")))
    keep = read_existing()
    print("reading cached wiki pages")
    pages = load_pages()
    by_url = {rec.get("url", ""): rec for rec in pages.values()}
    cat_index = defaultdict(set)
    for tag, names in CAT.items():
        for n in names:
            cat_index[n].add(tag)
            cat_index["Non-Canon " + n].add(tag)
    look_re = {t: re.compile(p) for t, p in LOOK.items()}
    pers_re = {t: re.compile(p) for t, p in PERSONALITY.items()}
    abil_re = {t: re.compile(p) for t, p in ABILITIES.items()}
    weap_re = [(w, re.compile(p)) for w, p in WEAPON_WORDS]

    out, counts, scounts, matched_pages = [], Counter(), Counter(), 0
    for c in chars:
        tags, sugg = {}, {}
        def add(t, src):
            # keyword hits from article text are only suggestions; categories and data go straight in
            target = sugg if src.startswith("text:") else tags
            if t not in target:
                target[t] = src
        rec = by_url.get(c.get("wiki_url", ""))
        if rec:
            matched_pages += 1
            for cat in rec["cats"]:
                for t in cat_index.get(cat, ()):
                    add(t, "cat:" + cat)
                for t, rx in CAT_RE.items():
                    if rx.match(cat):
                        add(t, "cat:" + cat)
            text = rec.get("text", "")
            # first paragraph only: it describes the usual look/personality, later ones list every outfit and arc
            appear, pers, abil = (first_para(text_of(text, h)) for h in ("Appearance", "Personality", r"Abilities and Powers"))
            for t, rx in look_re.items():
                if rx.search(appear):
                    add(t, "text:Appearance")
            for t, rx in pers_re.items():
                if rx.search(pers):
                    add(t, "text:Personality")
            for t, rx in abil_re.items():
                if rx.search(abil):
                    add(t, "text:Abilities")
            weapons_sugg = [w for w, rx in weap_re if rx.search(abil)]
            weapons = sorted({wp for cat in rec["cats"] for name, wp in CAT_WEAPON.items() if cat in (name, "Non-Canon " + name)})
        else:
            weapons, weapons_sugg = [], []
        # from the data columns
        for fruit in filter(None, (c.get("devil_fruits") or "").split("|")):
            first = re.sub(r"[^a-z]", "", fruit.strip().split(" ")[0].lower())
            for t in FRUIT.get(first, "").split():
                add(t, "data:" + fruit.strip())
        types = (c.get("devil_fruit_types") or "")
        if "Zoan" in types:
            add("transforms", "data:Zoan"); add("animal_form", "data:Zoan")
        for t in RACE.get(c.get("race", ""), "").split():
            add(t, "data:race " + c["race"])
        try:
            h = float(c.get("height_cm") or "nan")
            if h >= 400: add("very_tall", "data:height")
            if h < 100: add("very_short", "data:height")
        except ValueError:
            pass
        place = (c.get("birthplace", "") + " " + c.get("origin_sea", "")).lower()
        if "wano" in place:
            add("wano", "data:birthplace")
        if c.get("canon", "").lower() == "no":
            add("filler_only", "data:canon=no")
        if re.search(r"(^|\s)D\.(\s|$)", c.get("name", "")):
            add("will_of_d", "data:name")
        k = keep.get(c["id"], {})
        for t in tags:
            counts[t] += 1
        for t in sugg:
            scounts[t] += 1
        out.append({"id": c["id"], "name": c["name"], "fame": c.get("fame", ""), "tags_auto": "|".join(sorted(tags)),
                    "tags_add": k.get("tags_add", ""), "tags_remove": k.get("tags_remove", ""),
                    "tags_suggested": "|".join(sorted(t for t in sugg if t not in tags)),
                    "weapons_auto": "|".join(weapons), "weapons_add": k.get("weapons_add", ""),
                    "weapons_suggested": "|".join(w for w in weapons_sugg if w not in weapons),
                    "tags_why": "; ".join(f"{t}={s}" for t, s in sorted(tags.items()))})

    cols = ["id", "name", "fame", "tags_auto", "tags_add", "tags_remove", "tags_suggested",
            "weapons_auto", "weapons_add", "weapons_suggested", "tags_why"]
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(out)
    tagged = sum(1 for r in out if r["tags_auto"])
    print(f"Wrote {len(out)} characters to data/character_tags.csv ({matched_pages} matched to wiki pages, {tagged} got tags)")
    print(f"tags_auto (used in the game): {len(counts)} different tags, {sum(counts.values())} in total. Most common:")
    print("  " + ", ".join(f"{t} ({n})" for t, n in counts.most_common(40)))
    print(f"tags_suggested (keyword guesses, NOT used until you copy them into tags_add): {sum(scounts.values())} in total")
    print("Next: python3 -I tools/build_data.py")


if __name__ == "__main__":
    main()
