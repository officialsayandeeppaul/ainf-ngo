#!/usr/bin/env python3
from pathlib import Path
import re

t = Path("app/route.ts").read_text(encoding="utf-8")
pat = r'<script type=\\"module\\" async=\\"\\" data-framer-bundle=\\"main\\" fetchpriority=\\"low\\" src=\\"/framer-site/script_main\.[A-Za-z0-9_.-]+\\.mjs\\"></script>'
print("match", bool(re.search(pat, t)))
# simpler
pat2 = r'src=\\"/framer-site/script_main\.[^\\"]+\\.mjs\\"'
print("pat2", re.search(pat2, t))
pat3 = r'<script[^>]*script_main[^>]*>\s*</script>'
print("pat3", re.search(pat3, t))
# maybe > is escaped? 
j = t.find("script_main")
print([hex(ord(c)) for c in t[j-5:j+50]])
