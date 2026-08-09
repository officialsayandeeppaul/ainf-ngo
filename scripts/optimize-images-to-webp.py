#!/usr/bin/env python3
"""
Convert PNG/JPEG under public/assets/img to optimized WebP and rewrite
references across the site so nothing 404s.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG_ROOT = ROOT / "public" / "assets" / "img"

# Text files that may reference image paths
REWRITE_GLOBS = [
    "app/**/*.ts",
    "app/**/*.tsx",
    "app/**/*.js",
    "public/framer-site/**/*.mjs",
    "public/framer-site/**/*.js",
    "public/framer-site/**/*.css",
    "public/i18n/**/*",
    "public/**/*.html",
    "scripts/content/**/*.json",
    "scripts/*.json",
]

SKIP_DIR_NAMES = {".git", "node_modules", ".next", "out"}
SOURCE_EXTS = {".png", ".jpg", ".jpeg"}
QUALITY = 80
METHOD = 6
MAX_EDGE = 1920  # downscale only if larger


def is_opaque(im: Image.Image) -> bool:
    if im.mode in ("RGB", "L"):
        return True
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    alpha = im.getchannel("A")
    extrema = alpha.getextrema()
    return extrema == (255, 255)


def prepare_image(im: Image.Image) -> Image.Image:
    # Drop useless alpha for better compression
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        if is_opaque(im):
            im = im.convert("RGB")
    elif im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")

    w, h = im.size
    longest = max(w, h)
    if longest > MAX_EDGE:
        scale = MAX_EDGE / float(longest)
        nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
        im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    return im


def convert_one(src: Path, *, delete_source: bool, dry_run: bool) -> tuple[Path, int, int] | None:
    dst = src.with_suffix(".webp")
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        # Already converted; still allow rewrite/delete path
        before = src.stat().st_size
        after = dst.stat().st_size
        if delete_source and not dry_run and src.exists():
            src.unlink()
        return dst, before, after

    if dry_run:
        return dst, src.stat().st_size, 0

    with Image.open(src) as im:
        im = prepare_image(im)
        save_kwargs = {
            "format": "WEBP",
            "quality": QUALITY,
            "method": METHOD,
        }
        if im.mode == "RGBA":
            save_kwargs["lossless"] = False
        im.save(dst, **save_kwargs)

    before = src.stat().st_size
    after = dst.stat().st_size
    if delete_source:
        src.unlink()
    return dst, before, after


def collect_sources() -> list[Path]:
    files: list[Path] = []
    for path in IMG_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() in SOURCE_EXTS:
            files.append(path)
    return sorted(files)


def rewrite_references(replacements: dict[str, str], *, dry_run: bool) -> int:
    """Replace old path strings with new ones in text files. Returns file count."""
    changed_files = 0
    # Prefer longer keys first to avoid partial collisions
    pairs = sorted(replacements.items(), key=lambda kv: len(kv[0]), reverse=True)

    candidates: list[Path] = []
    for pattern in REWRITE_GLOBS:
        candidates.extend(ROOT.glob(pattern))

    # Dedupe + filter
    seen: set[Path] = set()
    files: list[Path] = []
    for p in candidates:
        rp = p.resolve()
        if rp in seen or not p.is_file():
            continue
        if any(part in SKIP_DIR_NAMES for part in p.parts):
            continue
        seen.add(rp)
        files.append(p)

    for path in files:
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        new = text
        for old, repl in pairs:
            if old in new:
                new = new.replace(old, repl)

        if new != text:
            changed_files += 1
            rel = path.relative_to(ROOT).as_posix()
            print(f"  rewrite {rel}")
            if not dry_run:
                path.write_text(new, encoding="utf-8")

    return changed_files


def remove_debug_screenshots(*, dry_run: bool) -> int:
    """Delete unused debug PNGs at public/ root (_*.png)."""
    removed = 0
    public = ROOT / "public"
    for path in public.glob("_*.png"):
        print(f"  remove debug {path.relative_to(ROOT).as_posix()}")
        removed += 1
        if not dry_run:
            path.unlink()
    for path in public.glob("_*.html"):
        print(f"  remove debug {path.relative_to(ROOT).as_posix()}")
        removed += 1
        if not dry_run:
            path.unlink()
    return removed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--keep-source", action="store_true", help="Keep original PNG/JPEG files")
    parser.add_argument("--skip-cleanup", action="store_true", help="Keep public/_*.png debug shots")
    args = parser.parse_args()

    if not IMG_ROOT.is_dir():
        print(f"Missing {IMG_ROOT}", file=sys.stderr)
        return 1

    sources = collect_sources()
    print(f"Found {len(sources)} PNG/JPEG under public/assets/img")

    replacements: dict[str, str] = {}
    total_before = 0
    total_after = 0

    for src in sources:
        result = convert_one(src, delete_source=not args.keep_source, dry_run=args.dry_run)
        if not result:
            continue
        dst, before, after = result
        total_before += before
        total_after += after

        rel_src = src.relative_to(ROOT / "public").as_posix()  # assets/img/...
        rel_dst = dst.relative_to(ROOT / "public").as_posix()
        # Absolute site paths
        replacements[f"/{rel_src}"] = f"/{rel_dst}"
        replacements[rel_src] = rel_dst
        # Basename fallback (hashed unique names)
        replacements[src.name] = dst.name

        saved = before - after if after else 0
        print(
            f"  {src.relative_to(ROOT).as_posix()}  "
            f"{before/1e6:.2f}MB -> {after/1e6:.2f}MB  "
            f"(-{saved/1e6:.2f}MB)"
            if after
            else f"  {src.relative_to(ROOT).as_posix()}  dry-run"
        )

    print("\nRewriting references...")
    n_files = rewrite_references(replacements, dry_run=args.dry_run)
    print(f"Updated {n_files} files")

    if not args.skip_cleanup:
        print("\nCleaning debug screenshots in public/...")
        remove_debug_screenshots(dry_run=args.dry_run)

    print(
        f"\nDone. Image bytes: {total_before/1e6:.1f}MB -> {total_after/1e6:.1f}MB "
        f"(saved {max(0, total_before - total_after)/1e6:.1f}MB)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
