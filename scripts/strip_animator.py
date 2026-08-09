#!/usr/bin/env python3
from pathlib import Path

n = 0
for p in Path("app").rglob("route.ts"):
    t = p.read_text(encoding="utf-8")
    if "var animator=(()=>{" not in t:
        print("no animator", p)
        continue
    if "ainf: deferred framer animator" in t:
        print("already", p)
        continue
    idx = t.find("var animator=(()=>{")
    s0 = t.rfind("<script", 0, idx)
    s1 = t.find("</script>", idx)
    if s0 < 0 or s1 < 0:
        print("bounds fail", p)
        continue
    old = t[s0 : s1 + len("</script>")]
    new = (
        "<script>/* ainf: deferred framer animator (appear disabled) */"
        "window.__framer_disable_appear_effects=true;"
        "</script>"
    )
    t2 = t[:s0] + new + t[s1 + len("</script>") :]
    p.write_text(t2, encoding="utf-8")
    n += 1
    print("stripped animator", p, "saved", len(old) - len(new))
print("done", n)
