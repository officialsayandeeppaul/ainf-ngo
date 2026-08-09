#!/usr/bin/env python3
"""Download remaining Framer CDN images, convert to WebP, rewrite all route refs."""
from __future__ import annotations

import re
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
OUT = ROOT / "public" / "assets" / "img" / "cdn"
OUT.mkdir(parents=True, exist_ok=True)

# short stable local names
NAME_MAP = {
    "2d4UzZZdciJPLzjirJSONlA4.jpg": "blog-cover-a.webp",
    "jRgH6Wd4pAo1sPHaxhhKOEklJc.png": "blog-cover-b.webp",
    "U7ff1OnPhh0ZTNmFaGLCoPwxghk.png": "cause-cover-a.webp",
    "mDKYa8ZJBEn7dg3yVztalhSIg.png": "cause-cover-b.webp",
    "dc621wnXRTOpLh2BaPpag0HlbQ.png": "cause-cover-c.webp",
    "T8OAunaKmDsHEDg3IoN6J567G0.png": "cause-cover-d.webp",
}


def collect_urls() -> set[str]:
    urls: set[str] = set()
    for p in APP.rglob("route.ts"):
        t = p.read_text(encoding="utf-8")
        urls.update(re.findall(r"https://framerusercontent.com/images/[^\\\"\s]+", t))
    return urls


def base_name(url: str) -> str:
    path = url.split("?", 1)[0]
    return path.rsplit("/", 1)[-1]


def download_and_convert() -> dict[str, str]:
    """Map any remote URL (with query) -> local /assets/... path"""
    mapping: dict[str, str] = {}
    urls = collect_urls()
    # Prefer full-size variants (no scale-down) for source quality
    by_base: dict[str, str] = {}
    for u in urls:
        b = base_name(u)
        if b not in by_base:
            by_base[b] = u
        # prefer width= without scale-down
        if "scale-down-to" not in u and "width=" in u:
            by_base[b] = u

    for base, url in sorted(by_base.items()):
        local_name = NAME_MAP.get(base)
        if not local_name:
            stem = Path(base).stem[:24]
            local_name = f"{stem}.webp"
        dest = OUT / local_name
        print(f"GET {url}")
        data = urllib.request.urlopen(url, timeout=90).read()
        im = Image.open(BytesIO(data))
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA")
        # opaque photos → RGB
        if im.mode == "RGBA":
            alpha = im.getchannel("A")
            if alpha.getextrema() == (255, 255):
                im = im.convert("RGB")
        w, h = im.size
        longest = max(w, h)
        if longest > 1600:
            scale = 1600 / float(longest)
            im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
        im.save(dest, "WEBP", quality=80, method=6)
        local_path = f"/assets/img/cdn/{local_name}"
        print(f"  -> {local_path} ({dest.stat().st_size} bytes)")
        # map ALL variants of this base
        for u in urls:
            if base_name(u) == base:
                mapping[u] = local_path
    return mapping


def rewrite(mapping: dict[str, str]) -> None:
    # longest first
    pairs = sorted(mapping.items(), key=lambda kv: len(kv[0]), reverse=True)
    for path in APP.rglob("route.ts"):
        text = path.read_text(encoding="utf-8")
        orig = text
        for old, new in pairs:
            text = text.replace(old, new)
        # remove broken search index metas
        text2, n = re.subn(
            r'<meta name=\\"framer-search-index(?:-fallback)?\\" content=\\"[^\\"]+\\">',
            "",
            text,
        )
        text = text2
        # drop preconnect if unused
        pre = '<link rel=\\"preconnect\\" href=\\"https://framerusercontent.com\\">'
        if pre in text:
            without = text.replace(pre, "", 1)
            if "framerusercontent.com" not in without:
                text = without
        if text != orig:
            path.write_text(text, encoding="utf-8")
            print(f"rewrote {path.relative_to(ROOT)} (searchIndex removed x{n})")


def main() -> int:
    mapping = download_and_convert()
    rewrite(mapping)
    # final check
    left = 0
    for p in APP.rglob("route.ts"):
        t = p.read_text(encoding="utf-8")
        c = t.count("framerusercontent.com")
        if c:
            print("STILL", p, c)
            left += c
    print("remaining remote refs:", left)
    return 0 if left == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
