#!/usr/bin/env python3
from pathlib import Path

OLD_IDLE = "if('requestIdleCallback' in window){requestIdleCallback(function(){setTimeout(load,4000);},{timeout:8000});}else{setTimeout(load,5000);}"
NEW_LATE = "setTimeout(load,15000);"

n = 0
for p in Path("app").rglob("route.ts"):
    t = p.read_text(encoding="utf-8")
    if OLD_IDLE in t:
        t = t.replace(OLD_IDLE, NEW_LATE)
        p.write_text(t, encoding="utf-8")
        n += 1
        print("ok", p)
    elif NEW_LATE in t and "dataset.framerBundle" in t:
        print("already", p)
    else:
        print("miss", p)
print("done", n)
