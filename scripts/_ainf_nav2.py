from pathlib import Path
import re
t = Path("app/route.ts").read_text(encoding="utf-8")
html = re.search(r'const HTML = "(.*)";\s*\n\s*export', t, re.S).group(1)
# unescape lightly for search
h = html.replace('\\"', '"').replace('\\n','\n')
# find nav section
for pat in ["causes","blogs","about-us","donate","volunteer","contact","Projects","Shiksha"]:
    print(pat, h.lower().count(pat.lower()) if pat!="Projects" else h.count(pat))
# extract anchors with visible text near header
anchors = re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', h, re.S)
# filter short text
seen=set()
for href, inner in anchors:
    text = re.sub(r'<[^>]+>','',inner)
    text = re.sub(r'\s+',' ',text).strip()
    if not text or len(text)>60: continue
    if href.startswith('/assets') or 'framerusercontent' in href: continue
    key=(href,text)
    if key in seen: continue
    seen.add(key)
    if any(x in href for x in ['#','http']) and 'about' not in href and 'contact' not in href and 'blog' not in href and 'cause' not in href and 'donate' not in href and 'join' not in href:
        if href.startswith('#'): 
            pass
    print(f'{text!r} -> {href}')
