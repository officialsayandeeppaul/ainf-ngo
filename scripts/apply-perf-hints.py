#!/usr/bin/env python3
"""
Apply safe performance hints across Framer HTML route handlers.
Does NOT touch animation/transition payloads or Framer script order.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"

FONT_PRELOADS = (
    '<link rel=\\"preload\\" as=\\"font\\" type=\\"font/woff2\\" href=\\"/assets/fonts/0b532b340381e255.woff2\\" crossorigin>'
    '<link rel=\\"preload\\" as=\\"font\\" type=\\"font/woff2\\" href=\\"/assets/fonts/98a11855328341d1.woff2\\" crossorigin>'
)
HERO_PRELOAD = (
    '<link rel=\\"preload\\" as=\\"image\\" href=\\"/assets/img/e948853e2133d9ae.webp\\" fetchpriority=\\"high\\">'
)

REMOTE_REPLACEMENTS = [
    (
        "https://framerusercontent.com/images/6OeWHT7kiXonrgwww1A1voDp7Bg.png",
        "/assets/img/apple-touch.png",
    ),
    (
        "https://framerusercontent.com/images/GGYSFwlvqDcAV12XHFn4A2t011I.png",
        "/assets/img/og-image.jpg",
    ),
    (
        "https://framerusercontent.com/assets/BXGP5l3q2GxJ0kPJA6jpllmPpII.mp4",
        "/assets/img/hero-clip.mp4",
    ),
]

# CMS / srcset variants of the same remote PNG → local WebP
T46_PATTERNS = [
    (
        r"https://framerusercontent\.com/images/T46GKIYH61WU0XLM8ybVe394\.png\?scale-down-to=512&width=1575&height=1350",
        "/assets/img/t46gki.webp",
    ),
    (
        r"https://framerusercontent\.com/images/T46GKIYH61WU0XLM8ybVe394\.png\?scale-down-to=1024&width=1575&height=1350",
        "/assets/img/t46gki.webp",
    ),
    (
        r"https://framerusercontent\.com/images/T46GKIYH61WU0XLM8ybVe394\.png\?width=1575&height=1350",
        "/assets/img/t46gki.webp",
    ),
    (
        r"https://framerusercontent\.com/images/T46GKIYH61WU0XLM8ybVe394\.png",
        "/assets/img/t46gki.webp",
    ),
]


def patch_html_literal(text: str) -> tuple[str, list[str]]:
    notes: list[str] = []
    out = text

    for old, new in REMOTE_REPLACEMENTS:
        if old in out:
            count = out.count(old)
            out = out.replace(old, new)
            notes.append(f"remote->{new} x{count}")

    for pat, repl in T46_PATTERNS:
        new_out, n = re.subn(pat, repl, out)
        if n:
            out = new_out
            notes.append(f"t46gki x{n}")

    # Demote non-LCP CTA backgrounds (keep Hero BG high)
    new_out, n = re.subn(
        r'(alt=\\"CTA Bg\\"[^>]*?)fetchpriority=\\"high\\"',
        r'\1fetchpriority=\\"low\\"',
        out,
    )
    if n:
        out = new_out
        notes.append(f"cta-priority-low x{n}")

    # Inject font (+ optional hero) preloads once, after charset meta
    if 'rel=\\"preload\\" as=\\"font\\"' not in out:
        inject = FONT_PRELOADS
        if "/assets/img/e948853e2133d9ae.webp" in out and HERO_PRELOAD not in out:
            inject = HERO_PRELOAD + inject
            notes.append("hero-preload")
        notes.append("font-preload")
        # Insert after <meta charset=\"utf-8\">
        needle = '<meta charset=\\"utf-8\\">'
        if needle in out:
            out = out.replace(needle, needle + inject, 1)
        else:
            notes.append("WARN: charset not found")

    # Drop unused Framer CDN preconnect if no remaining remote asset refs
    pre = '<link rel=\\"preconnect\\" href=\\"https://framerusercontent.com\\">'
    if pre in out:
        without = out.replace(pre, "", 1)
        if "framerusercontent.com" not in without:
            out = without
            notes.append("drop-preconnect")

    # Remove broken search index metas (404s)
    out2, n = re.subn(
        r'<meta name=\\"framer-search-index(?:-fallback)?\\" content=\\"/framer-site/searchIndex-[^\\"]+\\.json\\">',
        "",
        out,
    )
    if n:
        out = out2
        notes.append(f"drop-searchIndex x{n}")

    return out, notes


def main() -> int:
    routes = sorted(APP.rglob("route.ts"))
    changed = 0
    for path in routes:
        raw = path.read_text(encoding="utf-8")
        patched, notes = patch_html_literal(raw)
        if patched != raw:
            path.write_text(patched, encoding="utf-8")
            changed += 1
            print(f"OK {path.relative_to(ROOT).as_posix()}: {', '.join(notes) or 'touch'}")
        else:
            print(f"-- {path.relative_to(ROOT).as_posix()}: no changes")

    # Delete duplicate fonts under assets/img
    img = ROOT / "public" / "assets" / "img"
    removed = 0
    for woff in img.glob("*.woff2"):
        woff.unlink()
        removed += 1
        print(f"removed duplicate {woff.name}")

    backup = APP / "route.ts.hopper-backup"
    if backup.exists():
        backup.unlink()
        print("removed app/route.ts.hopper-backup")

    print(f"\nPatched {changed}/{len(routes)} routes; removed {removed} duplicate fonts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
