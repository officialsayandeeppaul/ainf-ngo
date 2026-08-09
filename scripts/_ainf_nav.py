from pathlib import Path
import re
t = Path("app/route.ts").read_text(encoding="utf-8")
hrefs = sorted(set(re.findall(r'href=\\"(/[^\\"]+)\\"', t)))
for h in hrefs:
    if h.startswith(("/assets","/framer","/i18n")): continue
    print(h)
# also look for nav labels near Causes Blogs
for label in ["Causes","Blogs","About","Contact","Donate","Projects","Home"]:
    print(label, t.count(label))
