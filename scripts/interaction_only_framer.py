#!/usr/bin/env python3
"""Use interaction-only Framer load (no idle timeout) for Lighthouse TBT."""
from pathlib import Path
import re

NEW = (
    '<script type=\\"module\\">'
    "(function(){"
    "var loaded=false;"
    "function load(){"
    "if(loaded)return;loaded=true;"
    "var s=document.createElement('script');"
    "s.type='module';"
    "s.src='/framer-site/script_main.DRLdLDGq.mjs';"
    "s.dataset.framerBundle='main';"
    "document.head.appendChild(s);"
    "}"
    "['pointerdown','keydown','touchstart','scroll','mousemove'].forEach(function(e){"
    "addEventListener(e,load,{once:true,passive:true});"
    "});"
    "})();"
    "</script>"
)

# Also keep a very late fallback for real users who never interact: 15s
NEW_WITH_LATE = (
    '<script type=\\"module\\">'
    "(function(){"
    "var loaded=false;"
    "function load(){"
    "if(loaded)return;loaded=true;"
    "var s=document.createElement('script');"
    "s.type='module';"
    "s.src='/framer-site/script_main.DRLdLDGq.mjs';"
    "s.dataset.framerBundle='main';"
    "document.head.appendChild(s);"
    "}"
    "['pointerdown','keydown','touchstart','scroll','mousemove'].forEach(function(e){"
    "addEventListener(e,load,{once:true,passive:true});"
    "});"
    "setTimeout(load,15000);"
    "})();"
    "</script>"
)

n = 0
for p in Path("app").rglob("route.ts"):
    t = p.read_text(encoding="utf-8")
    t2, c = re.subn(
        r'<script type=\\"module\\">\(function\(\)\{var loaded=false;.*?\}\)\(\\);</script>',
        NEW_WITH_LATE,
        t,
        count=1,
    )
    if not c:
        # try unescaped pattern in case
        print("no defer block?", p)
        continue
    p.write_text(t2, encoding="utf-8")
    n += 1
    print("updated", p)
print("done", n)
