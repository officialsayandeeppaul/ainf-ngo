from pathlib import Path
import re
h = Path("scripts/_home.html").read_text(encoding="utf-8", errors="replace")
styles = re.findall(r"<style[^>]*>(.*?)</style>", h, re.S)
print("style tags", len(styles), "total css chars", sum(len(s) for s in styles))
# svg-templates
i = h.find('id="svg-templates"')
print("svg-templates idx", i)
if i>=0:
    j = h.find("</div>", i)
    # find matching - rough
    chunk = h[i:i+500]
    print(chunk[:300])
# size of svg-templates section
m = re.search(r'<div id="svg-templates".*?</div>\s*</body>', h, re.S)
if m:
    print("svg-templates bytes", len(m.group(0)))
else:
    # try until next major
    m = re.search(r'<div id="svg-templates"[^>]*>([\s\S]*?)</div>', h)
    if m:
        print("svg inner", len(m.group(1)))
