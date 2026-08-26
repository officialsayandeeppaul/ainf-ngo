#!/usr/bin/env python3
"""Download missing /assets/img/*.webp referenced by routes from live site or Framer CDN."""
from __future__ import annotations

import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
IMG = ROOT / "public" / "assets" / "img"
IMG.mkdir(parents=True, exist_ok=True)

CANDIDATES = [
    "https://theainf.in",
    "https://beta.theainf.in",
    "https://www.theainf.in",
]


def collect_local_imgs() -> set[str]:
    names: set[str] = set()
    for p in APP.rglob("route.ts"):
        t = p.read_text(encoding="utf-8")
        names.update(re.findall(r"/assets/img/([a-f0-9]{16,}\.webp)", t))
    return names


def try_download(name: str) -> bool:
    dest = IMG / name
    if dest.exists() and dest.stat().st_size > 1000:
        return True
    for base in CANDIDATES:
        url = f"{base}/assets/img/{name}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ainf-boot/1.0"})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
            if len(data) < 500:
                continue
            dest.write_bytes(data)
            print(f"OK {name} from {base} ({len(data)} bytes)")
            return True
        except Exception as e:
            print(f"fail {url}: {e}")
    return False


def main() -> None:
    names = sorted(collect_local_imgs())
    missing = [n for n in names if not (IMG / n).exists() or (IMG / n).stat().st_size < 1000]
    print(f"referenced={len(names)} missing={len(missing)}")
    ok = 0
    for n in missing:
        if try_download(n):
            ok += 1
    print(f"downloaded {ok}/{len(missing)}")


if __name__ == "__main__":
    main()
