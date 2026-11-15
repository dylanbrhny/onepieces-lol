#!/usr/bin/env python3
"""Hand-drawn pixel favicon for One Pieces: a big skull sail, gold flag, hull and sea, sharp at 16 px.

    python3 -I tools/make_icons.py

Writes assets/brand/favicon-16/32, apple-touch-icon, icon-192/512 and favicon.ico (16/32/48) at the root.
Edit the G16 grid below to change the art: one letter per pixel, colours in PAL.
(tools/brand.html still draws the share banner, og-banner.png.)
"""
import struct, zlib, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "brand")
PAL = {"N": (16, 24, 61), "M": (110, 62, 30), "Y": (241, 192, 74), "W": (244, 236, 216), "w": (214, 200, 168),
       "K": (5, 8, 24), "B": (139, 74, 34), "b": (92, 46, 20), "L": (241, 192, 74), "S": (61, 143, 214), "s": (29, 85, 145)}
G16 = [
    "NNNNNNNMYYYNNNNN",
    "NNNNNNNMYYNNNNNN",
    "NNWWWWWWWWWWWWNN",
    "NNWWWKKKKKKWWWNN",
    "NNWWKKKKKKKKWWNN",
    "NNWWKWWKKWWKWWNN",
    "NNWWKWWKKWWKWWNN",
    "NNKWKKKWWKKKWKNN",
    "NNWKWKKKKKKWKWNN",
    "NNWWWKWKKWKWWWNN",
    "NNWKWWWWWWWWKWNN",
    "NNKwwwwwwwwwwKNN",
    "NBBBBBBBBBBBBBBN",
    "NNbLbbLbbLbbLbNN",
    "SSSbbbbbbbbbbSSS",
    "ssssssssssssssss",
]
assert all(len(r) == 16 for r in G16) and len(G16) == 16

def png(w, h, px):
    raw = b"".join(b"\x00" + bytes(c for p in px[y * w:(y + 1) * w] for c in p) for y in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")

def render(size, border):
    s = size // 16 if not border else max(1, (size * 13 // 16) // 16)
    off = (size - 16 * s) // 2
    navy, gold = PAL["N"] + (255,), PAL["Y"] + (255,)
    px = [navy] * (size * size)
    for y, row in enumerate(G16):
        for x, ch in enumerate(row):
            col = PAL[ch] + (255,)
            for dy in range(s):
                for dx in range(s):
                    px[(off + y * s + dy) * size + off + x * s + dx] = col
    if border:   # sea fills the bottom edge so the art doesn't float; gold frame like the banner logo
        seaTop = off + 14 * s
        for y in range(seaTop, size):
            for x in range(size):
                if not (off <= x < off + 16 * s and y < off + 16 * s):
                    px[y * size + x] = (PAL["S"] if y < off + 15 * s else PAL["s"]) + (255,)
        t = max(2, size // 40)
        for y in range(size):
            for x in range(size):
                if x < t or y < t or x >= size - t or y >= size - t:
                    px[y * size + x] = gold
    return png(size, size, px)

files = {}
for size, name, border in [(16, "favicon-16.png", False), (32, "favicon-32.png", False), (48, None, False),
                           (180, "apple-touch-icon.png", True), (192, "icon-192.png", True), (512, "icon-512.png", True)]:
    data = render(size, border)
    files[size] = data
    if name:
        open(os.path.join(OUT, name), "wb").write(data)
# favicon.ico holding PNG 16/32/48
imgs = [files[16], files[32], files[48]]
hdr = struct.pack("<HHH", 0, 1, len(imgs)); off = 6 + 16 * len(imgs); ent = b""
for sz, d in zip([16, 32, 48], imgs):
    ent += struct.pack("<BBBBHHII", sz, sz, 0, 0, 1, 32, len(d), off); off += len(d)
open(os.path.join(ROOT, "favicon.ico"), "wb").write(hdr + ent + b"".join(imgs))
print("wrote", OUT, "and favicon.ico")
