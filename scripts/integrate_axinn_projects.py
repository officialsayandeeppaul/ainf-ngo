#!/usr/bin/env python3
"""Integrate axinn projects into AINF site: copy routes/assets, localize framer CDN, add nav."""
from __future__ import annotations

import re
import shutil
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AX = ROOT / "axinn-theme-framer-website-optimized"
FRAMER_DIR = ROOT / "public" / "framer-site-axinn"
IMG_DST = ROOT / "public" / "assets" / "img"
FONT_DST = ROOT / "public" / "assets" / "fonts"
CDN_BASE = "https://framerusercontent.com/sites/3EbldEGHOfJofc0YB5Fk5S/"

GET_HANDLER = '''
import { gzipSync } from "zlib";

export async function GET() {
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


def copy_project_routes():
    src = AX / "app" / "projects"
    dst = ROOT / "app" / "projects"
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    print("copied project routes")

    # Fix each route.ts: ensure gzip GET + localize framer CDN + AINF favicon if needed
    for path in dst.rglob("route.ts"):
        text = path.read_text(encoding="utf-8")
        # Replace CDN framer-site URLs with local
        text2 = text.replace(
            "https://framerusercontent.com/sites/3EbldEGHOfJofc0YB5Fk5S/",
            "/framer-site-axinn/",
        )
        # Remove framer editor init remote if present
        text2 = re.sub(
            r'<script[^>]*src=\\"https://framer\\.com/edit/init\\.mjs\\"[^>]*>\\s*</script>',
            "",
            text2,
        )
        # Replace GET handler
        if "gzipSync" not in text2:
            # strip existing export function GET...
            text2 = re.sub(
                r"\nexport (?:async )?function GET\([^)]*\)\s*\{[\s\S]*?\n\}\s*$",
                "\n" + GET_HANDLER.rstrip() + "\n",
                text2,
            )
            if 'from "zlib"' not in text2:
                # insert import after comments
                lines = text2.splitlines(keepends=True)
                i = 0
                while i < len(lines) and (lines[i].startswith("//") or lines[i].strip() == ""):
                    i += 1
                # GET_HANDLER already has import - avoid duplicate if we embed import in handler block only once at top
                text2 = "".join(lines[:i]) + 'import { gzipSync } from "zlib";\n' + "".join(lines[i:])
                # remove duplicate import inside GET_HANDLER replacement
                text2 = text2.replace(
                    'import { gzipSync } from "zlib";\n\nimport { gzipSync } from "zlib";\n',
                    'import { gzipSync } from "zlib";\n',
                )
                text2 = text2.replace(
                    "\nimport { gzipSync } from \"zlib\";\n\nexport async function GET",
                    "\nexport async function GET",
                )
        # Prefer AINF logo for icon if oxira icons present - optional keep as-is for same-to-same
        path.write_text(text2, encoding="utf-8")
        print("patched", path.relative_to(ROOT))


def collect_refs_from_projects() -> tuple[set[str], set[str], set[str]]:
    imgs, fonts, mjs = set(), set(), set()
    for path in (ROOT / "app" / "projects").rglob("route.ts"):
        t = path.read_text(encoding="utf-8")
        imgs.update(re.findall(r"/assets/img/([A-Za-z0-9._-]+)", t))
        fonts.update(re.findall(r"/assets/fonts/([A-Za-z0-9._-]+)", t))
        mjs.update(re.findall(r"/framer-site-axinn/([A-Za-z0-9._-]+\\.mjs)", t))
        # also still-cdn form before replace - already replaced
        mjs.update(re.findall(r"framer-site-axinn/([A-Za-z0-9._-]+\\.mjs)", t))
    return imgs, fonts, mjs


def copy_assets(imgs: set[str], fonts: set[str]):
    IMG_DST.mkdir(parents=True, exist_ok=True)
    FONT_DST.mkdir(parents=True, exist_ok=True)
    for name in sorted(imgs):
        src = AX / "public" / "assets" / "img" / name
        dst = IMG_DST / name
        if not src.exists():
            print("MISSING IMG", name)
            continue
        if not dst.exists() or dst.stat().st_size != src.stat().st_size:
            shutil.copy2(src, dst)
            print("img", name)
    for name in sorted(fonts):
        src = AX / "public" / "assets" / "fonts" / name
        dst = FONT_DST / name
        if not src.exists():
            # sometimes fonts live under img in these exports
            alt = AX / "public" / "assets" / "img" / name
            src = alt if alt.exists() else src
        if not src.exists():
            print("MISSING FONT", name)
            continue
        if not dst.exists() or dst.stat().st_size != src.stat().st_size:
            shutil.copy2(src, dst)
            print("font", name)


def download_framer(mjs: set[str]):
    FRAMER_DIR.mkdir(parents=True, exist_ok=True)
    # discover from original axinn files too
    for path in (AX / "app" / "projects").rglob("route.ts"):
        t = path.read_text(encoding="utf-8")
        for name in re.findall(
            r"https://framerusercontent\\.com/sites/3EbldEGHOfJofc0YB5Fk5S/([A-Za-z0-9._-]+\\.mjs)",
            t,
        ):
            mjs.add(name)
        for name in re.findall(
            r"https://framerusercontent.com/sites/3EbldEGHOfJofc0YB5Fk5S/([A-Za-z0-9._-]+\.mjs)",
            t,
        ):
            mjs.add(name)

    for name in sorted(mjs):
        dest = FRAMER_DIR / name
        if dest.exists() and dest.stat().st_size > 100:
            continue
        url = CDN_BASE + name
        print("GET", url)
        try:
            data = urllib.request.urlopen(url, timeout=120).read()
            dest.write_bytes(data)
            print(" ", name, len(data))
        except Exception as e:
            print("FAIL", name, e)


def add_nav_projects():
    """Insert Projects nav item after Missions on all AINF pages."""
    # Patterns in escaped TS HTML strings
    # Desktop/mobile nav often: ...Missions...</a> then next item Stories
    # We'll insert a Projects anchor cloned from Missions style by string replace of href sequences.

    replacements = [
        # After Missions link before Stories - common structure uses separate anchors
        (
            'href=\\"./causes\\"',
            None,  # handled below more carefully
        ),
    ]

    # Strategy: for each route, if ./projects not in nav area, replace the Stories nav entry
    # by Projects+Stories, and duplicate Missions-like link.
    #
    # Simpler reliable approach used for Framer exports:
    # Replace first occurrence clusters of label Missions with Missions + Projects
    # by replacing href="./blogs" label Stories - insert before it.

    nav_link_projects = (
        # We'll do label-level replacements that appear in rich text
    )

    for path in (ROOT / "app").rglob("route.ts"):
        if "app\\projects" in str(path) or "app/projects" in str(path).replace("\\", "/"):
            # also update axinn project pages nav to AINF paths where needed
            pass
        t = path.read_text(encoding="utf-8")
        if 'href=\\"./projects\\"' in t and ">Projects<" in t.replace("\\n", ""):
            # may already have
            if "Projects" in t and 'href=\\"./projects\\"' in t:
                # ensure present
                pass

        orig = t
        # Insert Projects link by cloning Missions anchor patterns when Stories follows
        # Pattern A: visible text Missions then Stories as siblings in nav
        if 'href=\\"./projects\\"' not in t:
            # Insert after causes/Missions link block - replace Stories href prelude
            # Common: ...<a ... href=\"./causes\">...Missions...</a>...<a ... href=\"./blogs\">...Stories...
            t2, n = re.subn(
                r'(href=\\"./causes\\")',
                r'\1',
                t,
                count=0,
            )
            # Add projects link before blogs links in nav by injecting an extra anchor
            # Replace `href=\"./blogs\"` with projects+blogs for first few nav occurrences only
            # Better: replace label sequence in HTML comments / structured nav

            # Framer often has: Missions</...> then Stories
            # Insert: after `>Missions<` / `>Missions</` related - actually text is inside p/span
            # Practical approach: replace `./blogs` with `./projects` for ONE dedicated duplicate...

            # Insert nav item HTML snippet before first desktop blogs nav link that contains Stories
            marker = 'href=\\"./blogs\\"'
            # Find a richer pattern with Stories nearby
            idx = 0
            inserted = 0
            while inserted < 6:  # desktop+tablet+mobile variants
                i = t.find(marker, idx)
                if i < 0:
                    break
                window = t[max(0, i - 200) : i + 400]
                if "Stories" in window or "stories" in window.lower() or True:
                    # Build a projects sibling by copying the blogs anchor start
                    # Find <a before href
                    a_start = t.rfind("<a ", 0, i)
                    a_end = t.find("</a>", i)
                    if a_start >= 0 and a_end > i:
                        blogs_a = t[a_start : a_end + 4]
                        projects_a = (
                            blogs_a.replace('href=\\"./blogs\\"', 'href=\\"./projects\\"')
                            .replace("Stories", "Projects")
                            .replace("stories", "Projects")
                        )
                        # only if looks like nav (short)
                        if "Stories" in blogs_a or "Blogs" in blogs_a or len(blogs_a) < 2500:
                            if "Projects" in projects_a and 'href=\\"./projects\\"' in projects_a:
                                t = t[:a_start] + projects_a + t[a_start:]
                                inserted += 1
                                idx = a_end + 4 + len(projects_a)
                                continue
                idx = i + len(marker)
            if inserted:
                print(path.relative_to(ROOT), "inserted project nav x", inserted)
            else:
                # Fallback: after Missions text link - inject simple anchors near causes
                if 'href=\\"./causes\\"' in t:
                    t = t.replace(
                        'href=\\"./causes\\"',
                        'href=\\"./causes\\"',
                        1,
                    )
                    # append projects after first about-us/causes group using unique string
                    needle = 'href=\\"./blogs\\"'
                    if needle in t:
                        # prepend a minimal projects link tag before first blogs
                        i = t.find(needle)
                        a_start = t.rfind("<a ", 0, i)
                        if a_start >= 0:
                            simple = (
                                '<a href=\\"./projects\\" data-framer-page-link-current=\\"false\\">'
                                '<div style=\\"display:contents\\">Projects</div></a>'
                            )
                            # Prefer cloning - if clone failed use simple before blogs
                            t = t[:a_start] + simple + t[a_start:]
                            print(path.relative_to(ROOT), "fallback projects link")
        else:
            print(path.relative_to(ROOT), "already has ./projects")

        # Also add Missions-adjacent: replace "Missions" nav only - ensure Projects visible
        # Fix oxira contact paths on project pages toward AINF
        if "app/projects" in str(path).replace("\\", "/"):
            t = t.replace('href=\\"./contact\\"', 'href=\\"./contact-us\\"')
            t = t.replace('href=\\"./about-us\\"', 'href=\\"./about-us\\"')
            # Map axinn nav Impact/Why Us to AINF-ish anchors if needed - keep projects-local
            # Branding: leave project content same-to-same

        if t != orig:
            path.write_text(t, encoding="utf-8")


def main():
    assert AX.exists(), f"missing {AX}"
    copy_project_routes()
    imgs, fonts, mjs = collect_refs_from_projects()
    print(f"refs imgs={len(imgs)} fonts={len(fonts)} mjs={len(mjs)}")
    copy_assets(imgs, fonts)
    # re-collect mjs from axinn originals
    download_framer(mjs)
    add_nav_projects()
    print("DONE")


if __name__ == "__main__":
    main()
