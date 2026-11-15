#!/usr/bin/env python3
"""Recompute the Content-Security-Policy in index.html after any inline <script> changes.

    python3 -I tools/update_csp.py

The policy only lets the page run its own .js files plus inline scripts whose exact text is
listed by hash. Edit an inline script without re-running this and the browser blocks it.
"""
import base64, hashlib, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, "index.html")
s = open(p, encoding="utf-8").read()
inline = [m.group(1) for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', s, re.S)]
hashes = " ".join("'sha256-%s'" % base64.b64encode(hashlib.sha256(x.encode()).digest()).decode() for x in inline)
csp = ("default-src 'self'; "
       f"script-src 'self' {hashes}; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src 'self' https://fonts.gstatic.com; "
       "img-src 'self' data: blob:; media-src 'self' blob: data:; "
       "connect-src 'self' https://script.google.com https://script.googleusercontent.com; "
       "base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests")
s2 = re.sub(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">',
            f'<meta http-equiv="Content-Security-Policy" content="{csp}">', s)
open(p, "w", encoding="utf-8").write(s2)
print(f"CSP updated: {len(inline)} inline script(s) allowed by hash")
