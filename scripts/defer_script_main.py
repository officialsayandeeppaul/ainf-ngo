#!/usr/bin/env python3
from pathlib import Path
import re

DEFER = (
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
    "if('requestIdleCallback' in window){"
    "requestIdleCallback(function(){setTimeout(load,4000);},{timeout:8000});"
    "}else{setTimeout(load,5000);}"
    "})();"
    "</script>"
)

n = 0
for p in Path("app").rglob("route.ts"):
    t = p.read_text(encoding="utf-8")
    t2, c = re.subn(
        r'<script[^>]*script_main[^>]*>\s*</script>',
        DEFER,
        t,
        count=1,
    )
    if c:
        p.write_text(t2, encoding="utf-8")
        n += 1
        print("deferred", p)
    else:
        print("MISS", p)
print("done", n)
