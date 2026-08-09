from pathlib import Path
import re
for label, p in [
 ("blog", Path("app/blogs/education-can-break-poverty/route.ts")),
 ("cause", Path("app/causes/healthcare-for-all/route.ts")),
 ("proj", Path("app/projects/clean-water-initiative/route.ts")),
 ("legal", Path("app/legal-pages/terms-conditions/route.ts")),
]:
    t = p.read_text(encoding="utf-8")
    hrefs = sorted(set(re.findall(r'href=\\"([^\\"]+)\\"', t)))
    nav = [h for h in hrefs if not h.startswith(("/assets","/framer","mailto","tel","http","#")) and "img" not in h]
    print("\n==", label)
    print(nav[:30])
    print("Stories", "Stories" in t, "Missions", "Missions" in t, "Projects", "Projects" in t)
    # show a nav-like anchor
    m = re.search(r'href=\\"./about-us\\".{0,120}', t)
    print("about snip", m.group(0)[:120] if m else None)
