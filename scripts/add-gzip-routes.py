#!/usr/bin/env python3
"""Add gzip Content-Encoding support to all HTML route handlers."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"

NEW_IMPORTS = 'import { gzipSync } from "zlib";\n'

NEW_GET = '''export async function GET(request: Request) {
  const accept = request.headers.get("accept-encoding") || "";
  const headers: Record<string, string> = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400",
    "netlify-cdn-cache-control": "public, durable, max-age=31536000, stale-while-revalidate=86400",
    "vary": "accept-encoding",
  };
  if (/\\bgzip\\b/.test(accept)) {
    headers["content-encoding"] = "gzip";
    return new Response(new Uint8Array(gzipSync(HTML)), { headers });
  }
  return new Response(HTML, { headers });
}
'''


def patch_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if "gzipSync" in text:
        return False

    if 'from "zlib"' not in text:
        lines = text.splitlines(keepends=True)
        i = 0
        while i < len(lines) and (lines[i].startswith("//") or lines[i].strip() == ""):
            i += 1
        text = "".join(lines[:i]) + NEW_IMPORTS + "".join(lines[i:])

    text2, n = re.subn(
        r"export (?:async )?function GET\([^)]*\)\s*\{[\s\S]*?\n\}\s*$",
        NEW_GET.rstrip() + "\n",
        text,
        count=1,
    )
    if n == 0:
        print("FAIL", path)
        return False
    path.write_text(text2, encoding="utf-8")
    print("OK", path.relative_to(ROOT))
    return True


def main() -> int:
    n = 0
    for p in sorted(APP.rglob("route.ts")):
        if patch_file(p):
            n += 1
    print("updated", n)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
