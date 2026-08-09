from pathlib import Path
css = Path("public/assets/css/home.css")
t = css.read_text(encoding="utf-8")
# remove content-visibility hack that can make sections look blank
import re
t2 = re.sub(r"/\* ainf perf \*/[\s\S]*$", "", t)
if t2 != t:
    css.write_text(t2, encoding="utf-8")
    print("removed content-visibility from home.css")
for p in Path("public/assets/css").glob("*.css"):
    tt = p.read_text(encoding="utf-8")
    tt2 = re.sub(r"/\* ainf perf \*/[\s\S]*$", "", tt)
    if tt2 != tt:
        p.write_text(tt2, encoding="utf-8")
        print("cleaned", p.name)
