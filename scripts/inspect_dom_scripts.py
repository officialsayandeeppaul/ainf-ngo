from pathlib import Path
import re
h = Path("scripts/_home.html").read_text(encoding="utf-8", errors="replace")
# count open tags roughly
tags = re.findall(r"<(?!/)([a-zA-Z0-9]+)", h)
from collections import Counter
c = Counter(tags)
print("approx elements", len(tags))
print("top", c.most_common(15))
# find remaining modulepreload
for m in re.finditer(r".{0,40}modulepreload.{0,120}", h):
    print("MP:", m.group(0))
# list early script bodies sizes
parts = re.split(r"(?=<script\b)", h)
for i,p in enumerate(parts):
    if not p.startswith("<script"): continue
    m = re.match(r"<script([^>]*)>(.*?)</script>", p, re.S)
    if not m:
        print(i, "external", p[:100].replace("\n"," "))
        continue
    attrs, body = m.group(1), m.group(2)
    print(i, "len", len(body), "attrs", attrs[:80], "body0", body[:50].replace("\n"," "))
