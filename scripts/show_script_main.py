#!/usr/bin/env python3
from pathlib import Path

t = Path("app/route.ts").read_text(encoding="utf-8")
i = t.find("script_main")
print("idx", i)
chunk = t[i - 120 : i + 80]
print(repr(chunk))
# find start of script tag
j = t.rfind("<script", 0, i)
k = t.find("</script>", i)
print("tag repr:", repr(t[j : k + len("</script>")]))
