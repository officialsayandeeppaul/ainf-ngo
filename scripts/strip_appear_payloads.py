#!/usr/bin/env python3
from pathlib import Path
import re

n = 0
for p in Path("app").rglob("route.ts"):
    t = p.read_text(encoding="utf-8")
    orig = t
    t, c1 = re.subn(r'<script type=\\"framer/appear\\"[^>]*>[\s\S]*?</script>', "", t)
    t, c2 = re.subn(r'<script data-framer-appear-animation=\\"[^\\"]*\\">[\s\S]*?</script>', "", t)
    t, c3 = re.subn(r'<script type=\\"framer/handover\\"[^>]*>[\s\S]*?</script>', "", t)
    if t != orig:
        p.write_text(t, encoding="utf-8")
        n += 1
        print(p, f"appear={c1} runner={c2} handover={c3}")
print("updated", n)
