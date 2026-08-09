#!/usr/bin/env python3
from pathlib import Path
import re

# Ensure ALL routes always gzip (no Accept-Encoding check)
NEW = '''export async function GET() {
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

for p in Path("app").rglob("route.ts"):
    t = p.read_text(encoding="utf-8")
    if 'from "zlib"' not in t:
        lines = t.splitlines(keepends=True)
        i = 0
        while i < len(lines) and (lines[i].startswith("//") or lines[i].strip() == ""):
            i += 1
        t = "".join(lines[:i]) + 'import { gzipSync } from "zlib";\n' + "".join(lines[i:])
    t2, n = re.subn(
        r"export async function GET\([^)]*\)\s*\{[\s\S]*?\n\}\s*$",
        NEW.rstrip() + "\n",
        t,
        count=1,
    )
    if not n:
        print("FAIL", p)
    else:
        p.write_text(t2, encoding="utf-8")
        print("ok", p)
