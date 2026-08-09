from pathlib import Path
import re

# Fix project route GET handlers cleanly
GET = '''export async function GET() {
  const headers: Record<string, string> = {
    "content-type": "text/html; charset=utf-8",
    "content-encoding": "gzip",
    "cache-control": "public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400",
    "netlify-cdn-cache-control": "public, durable, max-age=31536000, stale-while-revalidate=86400",
    "vary": "accept-encoding",
  };
  return new Response(new Uint8Array(gzipSync(HTML)), { headers });
}
'''

for p in Path("app/projects").rglob("route.ts"):
    t = p.read_text(encoding="utf-8")
    # ensure single zlib import at top
    t = t.replace('import { gzipSync } from "zlib";\n', "")
    lines = t.splitlines(keepends=True)
    i = 0
    while i < len(lines) and (lines[i].startswith("//") or lines[i].strip()==""):
        i += 1
    t = "".join(lines[:i]) + 'import { gzipSync } from "zlib";\n' + "".join(lines[i:])
    t2, n = re.subn(r"export async function GET\([^)]*\)\s*\{[\s\S]*?\n\}\s*$", GET.rstrip()+"\n", t)
    if not n:
        t2, n = re.subn(r"export function GET\([^)]*\)\s*\{[\s\S]*?\n\}\s*$", GET.rstrip()+"\n", t)
    p.write_text(t2 if n else t, encoding="utf-8")
    print(p, "GET", n, "framer-local", t.count("/framer-site-axinn/"), "cdn-left", t.count("framerusercontent.com/sites/3EbldEGHOfJofc0YB5Fk5S"))

# Add Projects nav to ALL remaining AINF routes that have Stories/blogs nav but no projects
count = 0
for p in Path("app").rglob("route.ts"):
    t = p.read_text(encoding="utf-8")
    if 'href=\\"./projects\\"' in t and "Projects" in t:
        continue
    if 'href=\\"./blogs\\"' not in t and 'href=\\"./causes\\"' not in t:
        continue
    orig = t
    inserted = 0
    idx = 0
    marker = 'href=\\"./blogs\\"'
    while inserted < 8:
        i = t.find(marker, idx)
        if i < 0:
            break
        a_start = t.rfind("<a ", 0, i)
        a_end = t.find("</a>", i)
        if a_start >= 0 and a_end > i:
            blogs_a = t[a_start:a_end+4]
            if "Stories" in blogs_a or len(blogs_a) < 3000:
                projects_a = blogs_a.replace('href=\\"./blogs\\"','href=\\"./projects\\"').replace("Stories","Projects").replace("stories","Projects")
                if 'href=\\"./projects\\"' in projects_a:
                    t = t[:a_start] + projects_a + t[a_start:]
                    inserted += 1
                    idx = a_end + 4 + len(projects_a)
                    continue
        idx = i + len(marker)
    if inserted == 0 and 'href=\\"./causes\\"' in t:
        # insert simple link before first blogs or after causes
        i = t.find('href=\\"./blogs\\"')
        if i < 0:
            i = t.find('href=\\"./contact-us\\"')
        if i >= 0:
            a_start = t.rfind("<a ", 0, i)
            if a_start >= 0:
                simple = '<a href=\\"./projects\\"><div style=\\"display:contents\\">Projects</div></a>'
                t = t[:a_start] + simple + t[a_start:]
                inserted = 1
    if t != orig:
        p.write_text(t, encoding="utf-8")
        count += 1
        print("nav", p, "x", inserted)
print("nav pages updated", count)

# Verify framer files
from pathlib import Path as P
mjs = list(P("public/framer-site-axinn").glob("*.mjs"))
print("framer mjs", len(mjs))
print("project routes", len(list(P("app/projects").rglob("route.ts"))))
