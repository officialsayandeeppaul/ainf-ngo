#!/usr/bin/env python3
"""Extract Framer HTML from route.ts into public/pages/*.html for static+compressed serving."""
from __future__ import annotations

import codecs
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
OUT = ROOT / "public" / "pages"
OUT.mkdir(parents=True, exist_ok=True)

# map route file -> public filename
# app/route.ts -> index.html
# app/about-us/route.ts -> about-us.html
# app/blogs/foo/route.ts -> blogs/foo.html


def route_to_name(path: Path) -> str:
    rel = path.relative_to(APP).parent.as_posix()
    if rel == ".":
        return "index.html"
    return f"{rel}.html"


def extract_html(ts: str) -> str:
    m = re.search(r'const HTML = "(.*)";\s*\n\s*export', ts, re.S)
    if not m:
        raise ValueError("HTML const not found")
    # Decode JS string escapes
    raw = m.group(1)
    # codecs.decode unicode_escape mishandles utf-8; do manual common escapes
    out = (
        raw.replace(r"\\", "\0")
        .replace(r"\"", '"')
        .replace(r"\n", "\n")
        .replace(r"\t", "\t")
        .replace(r"\r", "\r")
        .replace("\0", "\\")
    )
    return out


def main() -> int:
    routes = sorted(APP.rglob("route.ts"))
    names = []
    for path in routes:
        html = extract_html(path.read_text(encoding="utf-8"))
        name = route_to_name(path)
        dest = OUT / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(html, encoding="utf-8")
        names.append(name)
        print(f"wrote public/pages/{name} ({len(html)/1e6:.2f}MB)")

    # next.config rewrites
    rewrite_entries = []
    for name in names:
        if name == "index.html":
            rewrite_entries.append(('    { source: "/", destination: "/pages/index.html" }',))
        else:
            src = "/" + name[: -len(".html")]
            rewrite_entries.append(
                (f'    {{ source: "{src}", destination: "/pages/{name}" }}',)
            )

    cfg = ROOT / "next.config.js"
    rewrites_js = ",\n".join(e[0] for e in rewrite_entries)
    cfg.write_text(
        f"""/** @type {{import('next').NextConfig}} */
const nextConfig = {{
  reactStrictMode: true,
  compress: true,
  async rewrites() {{
    return [
{rewrites_js}
    ];
  }},
}};
module.exports = nextConfig;
""",
    encoding="utf-8",
    )
    print("updated next.config.js rewrites")

    # Replace route handlers with tiny 308 redirect to static (fallback) OR delete.
    # Prefer deleting conflicting dynamic routes — App Router wins over rewrites!
    # So we must remove app/**/route.ts for rewrites to static to work.
    for path in routes:
        path.unlink()
        print("removed", path.relative_to(ROOT))
        # clean empty dirs later

    print("done", len(names), "pages")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
