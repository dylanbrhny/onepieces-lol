#!/usr/bin/env python3
"""The unlockable ships (Shipyard), drawn as pixel art from simple shapes in the game's sprite style:
bow to the right, dark outline, chunky 1px detail. Writes data/ships_art.js (rows of palette letters,
like js/sprites.js, plus the extra colours they use). Unlock rules and names live in js/fleet.js.

    python3 -I tools/make_ships.py

To change a ship, edit its function below and run this again.
"""
import math, json, os
PAL = {  # existing game palette + new colours (letters unused by js/sprites.js)
 "k":"#1a1020","w":"#f4ecd8","s":"#d8cbb0","b":"#8a4b2a","B":"#5e3018","y":"#f1c04a","r":"#b8322a","m":"#6b3a1e",
 "K":"#141018","g":"#3fae6a","G":"#23744a","e":"#fff7d6","p":"#e88bb0","W":"#f7f5ee","n":"#9aa3ad","h":"#9a6a3a",
 "t":"#ff9a2a","R":"#c8402c","O":"#f08a24","o":"#ffc24a","c":"#8fd8ff",
 "u":"#34528f","U":"#7fa8dc","v":"#5b3a8a","V":"#9a74c8","x":"#6f747c","X":"#40444c","q":"#7a1f1a","f":"#86ff6a",
 "F":"#2fbf3a","i":"#fff3b0","a":"#2f8f8a","d":"#3e2412","z":"#a8551f","Z":"#c9ccd1","j":"#4a6b3a","l":"#e8d9a0",
}
class Cv:
    def __init__(s, w, h): s.w, s.h = w, h; s.g = [["."] * w for _ in range(h)]
    def P(s, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = c
    def get(s, x, y): return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else "."
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.P(x, y, c)
    def line(s, x0, y0, x1, y1, c):
        n = int(math.ceil(max(abs(x1 - x0), abs(y1 - y0), 1)))
        for i in range(n + 1): s.P(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c)
    def poly(s, pts, c):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []
            for i in range(len(pts)):
                (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % len(pts)]
                if (ya <= y + .5 < yb) or (yb <= y + .5 < ya):
                    xs.append(xa + (y + .5 - ya) * (xb - xa) / (yb - ya))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(int(math.ceil(a - .5)), int(math.floor(b - .5)) + 1): s.P(x, y, c)
    def ell(s, cx, cy, rx, ry, c):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x - cx) / max(rx, .5)) ** 2 + ((y - cy) / max(ry, .5)) ** 2 <= 1: s.P(x, y, c)
    def sail(s, x0, y0, x1, y1, c, bulge=2, shade=None, right=True):
        """billowed square sail: straight top, curved bottom bulging down"""
        for x in range(x0, x1 + 1):
            t = (x - x0) / max(1, x1 - x0)
            yb = y1 + round(bulge * math.sin(math.pi * t))
            for y in range(y0, yb + 1): s.P(x, y, c)
            if shade and (x == x1 if right else x == x0): 
                for y in range(y0 + 1, yb): s.P(x, y, shade)
        if shade:
            for x in range(x0, x1 + 1):
                t = (x - x0) / max(1, x1 - x0); s.P(x, y1 + round(bulge * math.sin(math.pi * t)), shade)
    def outline(s, c="k"):
        add = []
        for y in range(s.h):
            for x in range(s.w):
                if s.g[y][x] == "." and any(s.get(x + dx, y + dy) not in (".", c) for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                    add.append((x, y))
        for x, y in add: s.g[y][x] = c
    def rows(s):
        r = ["".join(row).rstrip(".") for row in s.g]
        while r and not r[0]: r.pop(0)
        while r and not r[-1]: r.pop()
        return r

def skull(cv, cx, cy, line="K", fill="W", hat=False, bones=True):
    """jolly roger: crossbones behind, a white skull with a dark outline, dark eyes and teeth"""
    if bones:
        for d in (-1, 1):
            cv.line(cx - 6 * d, cy - 2, cx + 6 * d, cy + 6, line); cv.line(cx - 6 * d, cy - 1, cx + 6 * d, cy + 7, line)
            cv.ell(cx - 6 * d, cy - 2, 1.2, 1.2, fill); cv.ell(cx + 6 * d, cy + 7, 1.2, 1.2, fill)
    cv.ell(cx, cy, 4, 3.6, line); cv.rect(cx - 2, cy + 3, cx + 2, cy + 5, line)
    cv.ell(cx, cy, 3, 2.6, fill); cv.rect(cx - 1, cy + 3, cx + 1, cy + 4, fill)
    cv.rect(cx - 2, cy, cx - 1, cy + 1, line); cv.rect(cx + 1, cy, cx + 2, cy + 1, line); cv.P(cx, cy + 4, line)
    if hat:
        cv.rect(cx - 6, cy - 3, cx + 6, cy - 3, "y"); cv.rect(cx - 3, cy - 6, cx + 3, cy - 4, "y")
        cv.rect(cx - 3, cy - 4, cx + 3, cy - 4, "r"); cv.rect(cx - 6, cy - 4, cx - 5, cy - 4, line); cv.rect(cx + 5, cy - 4, cx + 6, cy - 4, line)

# ------------------------------------------------------------------ ships
def going_merry():
    cv = Cv(66, 50)
    # hull: brown upper, dark lower band, rounded stern left, bow rises right
    cv.poly([(6, 32), (52, 32), (58, 28), (56, 38), (50, 45), (12, 45), (6, 40)], "b")
    cv.rect(8, 41, 52, 45, "K"); cv.poly([(50, 41), (55, 37), (52, 45), (48, 45)], "K")
    for x in range(10, 50, 6): cv.line(x, 33, x, 40, "B")
    cv.rect(6, 31, 50, 31, "W")                                     # white rail
    for x in range(10, 48, 4): cv.P(x, 30, "W"); cv.P(x, 29, "W")
    cv.rect(10, 28, 46, 28, "W")
    cv.ell(14, 35, 2.2, 2, "W"); cv.P(14, 35, "b")                   # white curl trims
    cv.ell(40, 35, 2.2, 2, "W"); cv.P(40, 35, "b")
    # sheep figurehead: long white neck, round head, brown curled horn
    cv.poly([(49, 31), (54, 21), (58, 21), (55, 33)], "W")
    cv.ell(58, 17, 5, 4, "W"); cv.ell(61, 18.5, 2.4, 2, "W"); cv.P(59, 16, "K"); cv.P(62, 19, "x"); cv.P(57, 19, "Z")
    cv.ell(54, 15, 3, 3, "z"); cv.ell(54, 15, 1.6, 1.6, "h"); cv.P(54, 15, "z")
    cv.rect(50, 34, 55, 35, "X"); cv.P(56, 34, "K")                  # bow cannon
    # tangerine trees at the stern
    cv.ell(16, 26, 4, 2.6, "g"); cv.P(14, 25, "O"); cv.P(18, 26, "O"); cv.P(16, 27, "G")
    # masts
    cv.rect(31, 4, 32, 31, "m"); cv.rect(14, 12, 14, 27, "m")
    cv.rect(28, 3, 35, 5, "h"); cv.rect(29, 1, 34, 2, "m")         # crow's nest
    cv.rect(31, 0, 32, 0, "m"); cv.rect(33, 0, 36, 1, "K")           # flag
    # main sail with straw hat jolly roger
    cv.sail(20, 7, 44, 23, "s", bulge=3, shade="h")
    cv.rect(20, 7, 44, 7, "h")
    skull(cv, 32, 15, "K", "W", hat=True)
    # striped lateen sail on the stern mast
    cv.poly([(14, 12), (24, 26), (14, 26)], "W")
    for y in range(13, 26, 3):
        for x in range(14, 25):
            if cv.get(x, y) == "W": cv.P(x, y, "r")
    cv.outline(); return cv.rows()

def thousand_sunny():
    cv = Cv(70, 52)
    # hull: red with white trim, rounded, lion figurehead
    cv.poly([(5, 33), (54, 33), (60, 30), (58, 41), (50, 48), (12, 48), (5, 42)], "R")
    cv.rect(7, 44, 52, 48, "B"); cv.poly([(50, 44), (57, 40), (51, 48)], "B")
    for x in range(9, 52, 2): cv.P(x, 46, "b")
    cv.rect(5, 33, 54, 34, "W"); cv.rect(8, 39, 50, 39, "W")
    for x in range(10, 50, 5): cv.ell(x, 36.5, 1, 1, "W"); cv.P(x, 36, "K")
    cv.ell(30, 41, 3.5, 3, "y"); cv.ell(30, 41, 2, 1.8, "W"); cv.line(30, 39, 30, 43, "K")  # "1" shield
    # lion figurehead: orange spiky mane ring, yellow face
    for a in range(0, 360, 30):
        r = math.radians(a); cv.line(60, 25, 60 + 7 * math.cos(r), 25 + 6.5 * math.sin(r), "O")
    cv.ell(60, 25, 5, 4.6, "O"); cv.ell(60, 25, 3.4, 3.2, "y")
    cv.P(59, 24, "K"); cv.P(62, 24, "K"); cv.rect(59, 27, 62, 27, "z")
    cv.line(52, 30, 56, 27, "W"); cv.line(55, 32, 65, 21, "W")      # crossbones behind the lion
    # deck: lawn and the cabin
    cv.rect(8, 31, 52, 32, "g")
    cv.rect(8, 26, 20, 32, "z"); cv.rect(9, 27, 19, 28, "y"); cv.rect(10, 29, 11, 30, "c"); cv.rect(15, 29, 16, 30, "c")
    cv.ell(14, 24, 6, 2.5, "r"); cv.rect(8, 24, 20, 25, "y"); cv.line(8, 24, 20, 24, "r")
    # masts and crow's nest (striped dome observation room)
    cv.rect(32, 5, 33, 31, "m"); cv.rect(22, 14, 22, 30, "m")
    cv.rect(28, 3, 37, 6, "y"); cv.rect(28, 5, 37, 5, "r"); cv.ell(32.5, 2, 4.5, 2, "r"); cv.rect(30, 4, 31, 4, "c"); cv.rect(34, 4, 35, 4, "c")
    # main sail with the sun emblem
    cv.sail(21, 8, 46, 24, "w", bulge=3, shade="s")
    cv.ell(33.5, 18, 6, 4, "y"); cv.rect(27, 18, 40, 24, "w"); cv.line(27, 18, 40, 18, "r"); cv.rect(27, 19, 40, 19, "w")
    skull(cv, 33, 13, "K", "W", hat=True)
    # red-black striped rear sail
    cv.poly([(22, 15), (11, 22), (22, 23)], "R")
    for y in range(16, 23, 2):
        for x in range(11, 23):
            if cv.get(x, y) == "R": cv.P(x, y, "K")
    cv.outline(); return cv.rows()

def marine_warship():
    cv = Cv(74, 52)
    cv.poly([(4, 31), (62, 31), (70, 26), (66, 38), (58, 47), (10, 47), (4, 40)], "u")
    cv.rect(6, 43, 60, 47, "X"); cv.poly([(58, 43), (64, 38), (59, 47)], "X")
    cv.rect(4, 31, 62, 32, "Z"); cv.rect(6, 37, 60, 37, "U")
    for x in range(9, 60, 5): cv.rect(x, 34, x + 1, 35, "K")
    for x in range(10, 58, 8): cv.rect(x, 39, x + 2, 40, "x"); cv.P(x + 3, 39, "K")      # gun ports
    cv.rect(56, 27, 64, 28, "x"); cv.P(65, 27, "K")                                       # bow cannon
    cv.rect(52, 24, 60, 30, "X"); cv.ell(56, 24, 4, 2, "x")                               # turret
    for mx, top, w in ((16, 8, 9), (34, 2, 11), (50, 9, 8)):
        cv.rect(mx, top, mx + 1, 30, "m")
        for k, (yy, ww) in enumerate(((top + 2, w), (top + 10, w + 1))):
            cv.sail(mx - ww, yy, mx + ww + 1, yy + 6, "W", bulge=2, shade="Z")
            cv.rect(mx - ww, yy, mx + ww + 1, yy, "h")
        # blue seagull emblem on the lower sail
        cx, cy = mx + 1, top + 13
        cv.line(cx - 4, cy - 1, cx, cy + 1, "u"); cv.line(cx + 4, cy - 1, cx, cy + 1, "u"); cv.line(cx, cy - 2, cx, cy + 2, "u")
        cv.rect(mx, top - 2, mx + 3, top - 1, "U")
    cv.outline(); return cv.rows()

def coffin_boat():
    cv = Cv(50, 46)
    # coffin hull: flat, cut corners, gold-beige
    cv.poly([(6, 34), (42, 34), (46, 37), (42, 42), (8, 42), (3, 38)], "l")
    cv.rect(6, 40, 42, 42, "h"); cv.rect(7, 35, 41, 35, "y")
    for x in (10, 22, 34): cv.rect(x, 36, x + 2, 38, "h")
    # candles with green flames at both ends
    for x in (4, 44):
        cv.rect(x, 29, x + 1, 34, "W"); cv.ell(x + .5, 26, 1.4, 2.6, "f"); cv.P(x, 27, "F"); cv.P(x + 1, 23, "F")
    # Mihawk: dark seated figure with a plumed hat and the black blade on his back
    cv.rect(21, 28, 27, 34, "K"); cv.rect(22, 29, 26, 33, "q")
    cv.ell(24, 26, 2, 2, "i"); cv.rect(20, 23, 28, 23, "K"); cv.rect(22, 21, 26, 22, "K"); cv.P(27, 20, "W")
    cv.line(17, 31, 31, 20, "X")
    # tall mast with a cross top and one black curtain sail on a long yard
    cv.rect(24, 3, 25, 33, "W"); cv.rect(21, 3, 28, 4, "W"); cv.rect(23, 1, 26, 2, "W")
    cv.rect(5, 10, 44, 10, "W"); cv.rect(3, 9, 5, 11, "W"); cv.rect(44, 9, 46, 11, "W")
    for x in range(6, 44):
        sag = round(4 * math.sin(math.pi * ((x - 6) % 13) / 13))
        for y in range(11, 13 + sag): cv.P(x, y, "K")
    for x in (18, 31): cv.line(x, 11, x, 13, "X")
    cv.outline(); return cv.rows()

def sexy_foxy():
    cv = Cv(68, 52)
    # round bulbous hull, gold trim
    cv.ell(31, 38, 26, 10, "b"); cv.rect(4, 28, 58, 34, "b")
    cv.rect(4, 28, 58, 29, "y"); cv.rect(8, 40, 54, 40, "y")
    for x in range(10, 54, 7): cv.ell(x, 34, 1.3, 1.3, "y"); cv.P(x, 34, "K")
    cv.rect(10, 45, 52, 48, "B")
    # fox figurehead with ears and whiskers
    cv.ell(58, 24, 6, 5, "l"); cv.poly([(53, 20), (55, 13), (58, 19)], "l"); cv.poly([(59, 19), (63, 13), (64, 21)], "l")
    cv.P(55, 16, "p"); cv.P(62, 16, "p"); cv.P(56, 23, "K"); cv.P(60, 23, "K"); cv.rect(57, 26, 59, 26, "K"); cv.ell(58, 28, 3, 1.5, "W")
    cv.line(61, 26, 66, 25, "K"); cv.line(61, 27, 66, 28, "K")
    cv.rect(54, 29, 58, 33, "l")
    # masts and black sails, red FOXY-style band
    cv.rect(30, 3, 31, 28, "m"); cv.rect(14, 10, 15, 28, "m"); cv.rect(45, 9, 46, 28, "m")
    cv.sail(20, 6, 42, 15, "K", bulge=2); cv.rect(22, 11, 40, 12, "r")
    cv.sail(20, 17, 42, 25, "K", bulge=2); skull(cv, 31, 20, "X", "W", bones=True)
    cv.sail(8, 12, 21, 24, "W", bulge=2, shade="s"); cv.sail(40, 12, 52, 24, "W", bulge=2, shade="s")
    cv.rect(29, 0, 33, 2, "K"); cv.P(31, 1, "r")
    cv.outline(); return cv.rows()

def flying_dutchman():
    cv = Cv(70, 54)
    cv.poly([(4, 30), (56, 32), (64, 26), (60, 40), (52, 49), (12, 49), (4, 42)], "z")
    cv.rect(6, 45, 54, 49, "d")
    for x in range(8, 54, 3):
        cv.line(x, 31, x, 44, "B" if x % 2 else "z")
    for (x, y) in ((12, 38), (24, 42), (36, 35), (46, 44), (18, 33), (40, 40)): cv.ell(x, y, 2.5, 1.5, "j"); cv.P(x, y + 2, "j")
    for x in range(10, 52, 6): cv.rect(x, 36, x + 1, 37, "K")
    # skull figurehead
    cv.ell(60, 25, 5, 4.5, "Z"); cv.rect(57, 28, 63, 31, "Z"); cv.ell(58, 24, 1.3, 1.3, "K"); cv.ell(62, 24, 1.3, 1.3, "K")
    for x in range(57, 64, 2): cv.P(x, 30, "K")
    cv.line(50, 30, 57, 29, "Z")
    # three masts with tattered gray sails
    for mx, top, w in ((14, 10, 8), (32, 3, 11), (48, 9, 7)):
        cv.rect(mx, top, mx + 1, 31, "d")
        for yy in (top + 2, top + 10):
            cv.sail(mx - w, yy, mx + w + 1, yy + 6, "Z", bulge=2, shade="x")
            for x in range(mx - w, mx + w + 2, 3):        # torn bottom edge
                cv.P(x, yy + 7, "."); cv.P(x, yy + 8, ".")
                if x % 2: cv.rect(x, yy + 3, x, yy + 4, "x")
    cv.rect(31, 0, 35, 2, "K"); cv.P(33, 1, "W")
    cv.outline(); return cv.rows()

def thriller_bark():
    cv = Cv(80, 56)
    # huge hull with the mouth gate and teeth
    cv.poly([(4, 30), (70, 30), (76, 26), (73, 40), (64, 52), (12, 52), (4, 44)], "b")
    cv.rect(6, 48, 66, 52, "B")
    cv.ell(38, 40, 16, 7, "q"); cv.ell(38, 40, 14, 5.5, "p"); cv.rect(23, 34, 53, 36, "q")
    for x in range(25, 52, 3): cv.poly([(x, 35), (x + 2, 35), (x + 1, 38)], "W"); cv.poly([(x + 1, 46), (x + 3, 46), (x + 2, 43)], "W")
    for x in (10, 64): cv.rect(x, 33, x + 2, 46, "B")
    # the island on deck: castle, towers, dead trees
    cv.rect(26, 14, 50, 30, "x"); cv.rect(30, 8, 35, 30, "X"); cv.rect(42, 10, 47, 30, "X")
    for x in range(26, 51, 3): cv.rect(x, 13, x + 1, 13, "x")
    cv.poly([(29, 8), (32.5, 3), (36, 8)], "v"); cv.poly([(41, 10), (44.5, 5), (48, 10)], "v")
    for x, y in ((32, 18), (44, 18), (38, 22), (32, 25), (44, 25)): cv.rect(x, y, x + 1, y + 1, "o")
    for x in (18, 56):
        cv.rect(x, 22, x, 30, "d"); cv.line(x, 24, x - 3, 21, "d"); cv.line(x, 25, x + 3, 22, "d")
    # black sails with the bat-wing jolly roger on two masts
    for mx in (13, 63):
        cv.rect(mx, 6, mx + 1, 30, "m")
        cv.sail(mx - 8, 8, mx + 9, 20, "K", bulge=2)
        cx, cy = mx + 1, 14
        cv.poly([(cx - 7, cy - 3), (cx - 2, cy - 1), (cx - 2, cy + 2), (cx - 6, cy + 1)], "V")
        cv.poly([(cx + 7, cy - 3), (cx + 2, cy - 1), (cx + 2, cy + 2), (cx + 6, cy + 1)], "V")
        cv.ell(cx, cy, 2, 2, "W"); cv.P(cx - 1, cy, "K"); cv.P(cx + 1, cy, "K")
    cv.outline(); return cv.rows()

def saber_of_xebec():
    cv = Cv(70, 52)
    # dark hull resting on four big rolling drums
    cv.poly([(5, 28), (58, 28), (64, 24), (60, 36), (54, 40), (10, 40), (5, 36)], "d")
    cv.rect(5, 28, 58, 29, "y"); for_x = None
    for x in range(9, 56, 6): cv.rect(x, 32, x + 1, 33, "o")
    for cx in (14, 26, 38, 50):
        cv.ell(cx, 43, 5.5, 5.5, "h"); cv.ell(cx, 43, 3.5, 3.5, "z"); cv.ell(cx, 43, 1.6, 1.6, "q")
    # black square sails with the skull and crossed bones
    cv.rect(31, 2, 32, 28, "m"); cv.rect(16, 8, 17, 28, "m")
    cv.sail(18, 5, 46, 15, "K", bulge=2); cv.sail(18, 16, 46, 25, "K", bulge=2)
    cv.rect(18, 15, 46, 15, "h"); cv.rect(18, 5, 46, 5, "h")
    skull(cv, 32, 18, "X", "W", bones=True)
    cv.sail(8, 10, 22, 22, "K", bulge=2); cv.rect(8, 10, 22, 10, "h")
    # gold fan sail at the bow
    for i in range(6):
        cv.line(56, 26, 52 + i * 3, 8 + i, "y" if i % 2 else "o")
    cv.poly([(56, 26), (51, 8), (68, 14)], "y")
    for i in range(5): cv.line(56, 26, 53 + i * 3, 9 + i, "O")
    cv.rect(30, 0, 34, 1, "K"); cv.P(32, 0, "W")
    cv.outline(); return cv.rows()

SHIPS = {"going-merry": going_merry, "thousand-sunny": thousand_sunny, "marine-warship": marine_warship,
         "coffin-boat": coffin_boat, "sexy-foxy": sexy_foxy, "flying-dutchman": flying_dutchman,
         "thriller-bark": thriller_bark, "saber-of-xebec": saber_of_xebec}
# ---------------------------------------------------------------- lighting ("3D, still pixels")
# Light comes from the upper left. Every run of one colour gets a highlight on its lit side and a shadow on
# the far side, measured across the run, so hulls read as rounded, sails billow and masts are cylinders.
# Shadows shift toward blue-purple and highlights toward warm yellow, like hand-shaded pixel art.
NO_SHADE = set("k")                       # the outline stays flat
def _rgb(h): h = h.lstrip("#"); return [int(h[i:i + 2], 16) for i in (0, 2, 4)]
def _hex(c): return "#" + "".join(f"{max(0, min(255, round(v))):02x}" for v in c)
def light(h, amt):
    r, g, b = _rgb(h)
    if amt > 0:   # toward warm white
        return _hex((r + (255 - r) * amt, g + (246 - g) * amt, b + (214 - b) * amt * 0.8))
    a = -amt      # toward deep blue-purple
    return _hex((r * (1 - a) + 30 * a, g * (1 - a) + 22 * a, b * (1 - a) + 60 * a))

def shade(rows):
    h, w = len(rows), max(map(len, rows))
    g = [list(r.ljust(w, ".")) for r in rows]
    out = [[None] * w for _ in range(h)]
    def run(x, y, dx, dy):
        n, cx, cy = 0, x + dx, y + dy
        while 0 <= cx < w and 0 <= cy < h and g[cy][cx] == g[y][x]: n += 1; cx += dx; cy += dy
        return n
    for y in range(h):
        for x in range(w):
            c = g[y][x]
            if c == "." : continue
            base = PAL[c]
            if c in NO_SHADE: out[y][x] = base; continue
            up, dn, lf, rt = run(x, y, 0, -1), run(x, y, 0, 1), run(x, y, -1, 0), run(x, y, 1, 0)
            hgt, wid = up + dn + 1, lf + rt + 1
            if (hgt < 6 and wid < 9) or hgt < 3 or wid < 2: out[y][x] = base; continue   # emblems, eyes, trim stay flat
            ty = up / max(1, hgt - 1) if hgt >= 3 else 0.5
            tx = lf / max(1, wid - 1) if wid >= 3 else 0.5
            lit = 1 - (0.62 * ty + 0.38 * tx)                            # 1 = facing the light
            if (up == 0 and hgt >= 3) or (lf == 0 and wid >= 4 and ty < 0.6): out[y][x] = light(base, 0.34)   # rim light
            elif lit > 0.70: out[y][x] = light(base, 0.16)
            elif lit < 0.22: out[y][x] = light(base, -0.42)
            elif lit < 0.42: out[y][x] = light(base, -0.22)
            else: out[y][x] = base
    return out

POOL = [c for c in "ACDEHIJLMNPQSTY0123456789@#$%&*+=?!~^<>;:,_-|/" + "".join(chr(i) for i in range(192, 600)) if c not in PAL]
if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    base_keys = set("kwsbByrmKgGepWnhtRoOc")         # js/sprites.js already has these colours
    by_hex = {v: k for k, v in PAL.items() if k in base_keys}
    pal, ships = {}, {}
    for k, f in SHIPS.items():
        lit = shade(f())
        rows = []
        for line in lit:
            r = ""
            for col in line:
                if col is None: r += "."; continue
                if col not in by_hex:
                    ch = POOL[len(pal)]; pal[ch] = col; by_hex[col] = ch
                r += by_hex[col]
            rows.append(r.rstrip("."))
        ships[k] = rows
    with open(os.path.join(root, "data", "ships_art.js"), "w", encoding="utf-8") as f:
        f.write("// Generated by tools/make_ships.py: pixel art for the unlockable ships (see js/fleet.js).\n")
        f.write("window.SHIP_ART = ")
        json.dump({"palette": pal, "ships": ships}, f, ensure_ascii=False, indent=0)
        f.write(";\n")
    print(f"wrote data/ships_art.js: {len(pal)} colours,", {k: f"{max(map(len, v))}x{len(v)}" for k, v in ships.items()})
