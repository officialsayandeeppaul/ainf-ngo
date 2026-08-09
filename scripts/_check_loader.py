from pathlib import Path
import re
t = Path("app/route.ts").read_text(encoding="utf-8")
# find loader
i = t.find("dataset.framerBundle")
print(repr(t[i-300:i+400]) if i>=0 else "no loader")
print("---")
print("home.css link", "/assets/css/home.css" in t)
print("gzip", "gzipSync" in t)
print("ainf-ssr-visible", "ainf-ssr-visible" in t or "opacity:1!important" in t)
