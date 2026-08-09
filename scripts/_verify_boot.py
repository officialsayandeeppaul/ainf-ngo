from pathlib import Path
import re
t = Path("app/route.ts").read_text(encoding="utf-8")
html = re.search(r'const HTML = "(.*)";\s*\n\s*export', t, re.S).group(1)
print("script_main count", html.count("script_main"))
print("handover", "framer/handover" in html)
print("modulepreload", html.count("modulepreload"))
print("click-only loaded=false", "var loaded=false" in html)
print("home.css", "/assets/css/home.css" in html)
print("gzipSync", "gzipSync" in t)
