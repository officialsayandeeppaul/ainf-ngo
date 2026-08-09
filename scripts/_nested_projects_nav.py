from pathlib import Path
import re

def patch_nested(t: str) -> tuple[str, int]:
    """Insert ../projects Projects link before ../blogs Stories links."""
    if 'href=\\"../projects\\"' in t:
        # already has relative projects (detail pages)
        # still ensure a nav label Projects exists near header - usually yes
        return t, 0
    inserted = 0
    idx = 0
    marker = 'href=\\"../blogs\\"'
    while inserted < 8:
        i = t.find(marker, idx)
        if i < 0:
            break
        a_start = t.rfind("<a ", 0, i)
        a_end = t.find("</a>", i)
        if a_start >= 0 and a_end > i:
            block = t[a_start:a_end+4]
            proj = block.replace('href=\\"../blogs\\"','href=\\"../projects\\"')
            if "Stories" in proj:
                proj = proj.replace("Stories", "Projects")
            else:
                proj = re.sub(r">(.*?)</a>", ">Projects</a>", proj, count=1, flags=re.S)
            t = t[:a_start] + proj + t[a_start:]
            inserted += 1
            idx = a_start + len(proj) + len(block)
            continue
        idx = i + 1
    return t, inserted

nfiles = 0
for p in Path("app").rglob("route.ts"):
    t = p.read_text(encoding="utf-8")
    orig = t
    # nested relative nav
    if 'href=\\"../blogs\\"' in t and 'href=\\"../projects\\"' not in t:
        t, n = patch_nested(t)
        print(p, "nested insert", n)
    # project pages: fix contact
    if str(p).replace("\\","/").startswith("app/projects/"):
        t = t.replace('href=\\"../contact\\"', 'href=\\"../contact-us\\"')
        t = t.replace('href=\\"./contact\\"', 'href=\\"./contact-us\\"')
        # privacy/terms that don't exist on AINF - point to terms
        t = t.replace('href=\\"../privacy\\"', 'href=\\"../legal-pages/terms-conditions\\"')
        t = t.replace('href=\\"../terms-of-use\\"', 'href=\\"../legal-pages/terms-conditions\\"')
    if t != orig:
        p.write_text(t, encoding="utf-8")
        nfiles += 1

miss=[]
for p in sorted(Path("app").rglob("route.ts")):
    t=p.read_text(encoding="utf-8")
    if 'href=\\"./projects\\"' not in t and 'href=\\"../projects\\"' not in t:
        miss.append(p)
print("files changed", nfiles)
print("still missing", len(miss))
for m in miss: print(m)
