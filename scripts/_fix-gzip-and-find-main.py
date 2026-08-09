#!/usr/bin/env python3
from pathlib import Path
import re

# Fix gzip regex corruption (literal backspace) and ensure defer loader
for p in Path("app").rglob("route.ts"):
    t = p.read_text(encoding="utf-8")
    orig = t
    # Fix accept-encoding check
    t = re.sub(
        r'if \(/.*?gzip.*?/.test\(accept\)\)',
        'if (accept.includes("gzip"))',
        t,
    )
    # Find remaining script_main tags
    if "script_main" in t and "dataset.framerBundle" not in t:
        print("NEED DEFER", p)
        m = re.search(r".{0,40}script_main.{0,80}", t)
        if m:
            print(" ", repr(m.group(0)[:120]))
    if t != orig:
        p.write_text(t, encoding="utf-8")
        print("fixed gzip", p)
