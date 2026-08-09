from pathlib import Path
import re

missing = []
has = []
for p in sorted(Path("app").rglob("route.ts")):
    t = p.read_text(encoding="utf-8")
    ok = ('href=\\"./projects\\"' in t) and ("Projects" in t)
    (has if ok else missing).append(str(p))
print("HAS", len(has))
print("MISSING", len(missing))
for m in missing:
    print(" ", m)

# Check home nav has Projects near Stories
t = Path("app/route.ts").read_text(encoding="utf-8")
# count projects href
print("home projects href count", t.count('href=\\"./projects\\"'))
# show snippets
for m in re.finditer(r'.{0,30}Projects.{0,30}', t):
    s = m.group(0).replace('\\n',' ')
    if 'href' in s or 'Projects' in s:
        print("snip", s[:80])
        break
# find Projects with href nearby
idxs = [m.start() for m in re.finditer(r'Projects', t)]
print("Projects occurrences", len(idxs))
for i in idxs[:5]:
    print(repr(t[i-80:i+40]))
