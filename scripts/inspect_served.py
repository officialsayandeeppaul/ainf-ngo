from pathlib import Path
import re
h = Path("scripts/_home.html").read_text(encoding="utf-8", errors="replace")
print("len", len(h))
print("script_main", h.count("script_main"))
print("framerBundle", "framerBundle" in h)
print("modulepreload", h.count("modulepreload"))
print("setTimeout(load", "setTimeout(load" in h)
print("pointerdown", h.count("pointerdown"))
print("scroll event", "scroll" in h[h.find("pointerdown")-50:h.find("pointerdown")+200] if "pointerdown" in h else None)
scripts = re.findall(r"<script[^>]*>", h)
print("script open tags", len(scripts))
for s in scripts:
    print(s[:180])
# find defer loader block
i = h.find("dataset.framerBundle")
print("loader snippet:", repr(h[i-200:i+250]) if i>=0 else "missing")
