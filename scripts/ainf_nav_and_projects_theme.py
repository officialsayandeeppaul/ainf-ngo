#!/usr/bin/env python3
"""Sync /projects pages to AINF navbar + theme (nav survives Framer hydrate)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
CSS_PATH = ROOT / "public" / "assets" / "css" / "ainf-projects.css"
JS_PATH = ROOT / "public" / "assets" / "js" / "ainf-projects-nav.js"

# Head inject: CSS first (hide Oxira nav immediately), then persistent nav JS
HEAD_INJECT = (
    '<link rel="stylesheet" href="/assets/css/ainf-projects.css" id="ainf-projects-css">'
    '<script>document.documentElement.classList.add("ainf-projects-skin");</script>'
    '<script src="/assets/js/ainf-projects-nav.js" id="ainf-projects-nav-js"></script>'
)

COLOR_MAP = {
    "#043f2d": "#39a46b",
    "#04402e": "#39a46b",
    "#1d5242": "#39a46b",
    "#117345": "#39a46b",
    "rgb(4, 63, 45)": "rgb(57, 164, 107)",
    "rgb(4, 64, 46)": "rgb(57, 164, 107)",
    "rgb(29, 82, 66)": "rgb(57, 164, 107)",
    "rgb(17, 115, 69)": "rgb(57, 164, 107)",
}


def unescape(s: str) -> str:
    return (
        s.replace(r"\\", "\0")
        .replace(r"\"", '"')
        .replace(r"\n", "\n")
        .replace(r"\t", "\t")
        .replace(r"\r", "\r")
        .replace("\0", "\\")
    )


def escape(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    )


SPLIT_MARK = (
    "<!--/$--></p></div>"
    '<div class="framer-ainf-proj-link" data-framer-component-type="RichTextContainer" '
    'style="--extracted-r6o4lv:var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(34, 34, 34));transform:none">'
    '<p class="framer-text framer-styles-preset-19x7ezw" data-styles-preset="u0JoyKeHY" dir="auto" '
    'style="--framer-text-color:var(--extracted-r6o4lv, var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(34, 34, 34)))">'
    "<!--$-->"
)


def fix_mashed_nav(html: str) -> tuple[str, int]:
    pat = re.compile(
        r'(<a class="framer-text[^"]*" data-styles-preset="RgGxvnQb8" href="(?:\./|\.\./|\.\./\.\./)?projects">Projects</a>)'
        r'(<a class="framer-text[^"]*" data-styles-preset="RgGxvnQb8" href="(?:\./|\.\./|\.\./\.\./)?blogs">Stories</a>)'
    )
    n = 0

    def repl(m: re.Match) -> str:
        nonlocal n
        n += 1
        return m.group(1) + SPLIT_MARK + m.group(2)

    return pat.sub(repl, html), n


def remap_colors(html: str) -> str:
    for old, new in COLOR_MAP.items():
        html = html.replace(old, new)
        html = html.replace(old.upper(), new)
    return html


def strip_old_inject(html: str) -> str:
    html = re.sub(r'<style id="ainf-global-nav-css">[\s\S]*?</style>', "", html)
    html = re.sub(r'<style id="ainf-projects-theme">[\s\S]*?</style>', "", html)
    html = re.sub(r'<script id="ainf-projects-theme-js">[\s\S]*?</script>', "", html)
    html = re.sub(r'<link[^>]*ainf-projects\.css[^>]*>', "", html)
    html = re.sub(r'<script[^>]*ainf-projects-nav\.js[^>]*>\s*</script>', "", html)
    html = re.sub(
        r'<script>document\.documentElement\.classList\.add\("ainf-projects-skin"\);</script>',
        "",
        html,
    )
    # Remove ANY static ainf-global-nav div (Framer wipes these anyway)
    html = re.sub(
        r'<div id="ainf-global-nav"[^>]*>[\s\S]*?</div>\s*',
        "",
        html,
    )
    # Clean body class then re-add
    html = re.sub(
        r'(<body[^>]*)\sclass="ainf-projects-skin"',
        r"<body",
        html,
        count=1,
    )
    html = re.sub(
        r'(<body[^>]*class=")ainf-projects-skin\s*',
        r"\1",
        html,
        count=1,
    )
    html = re.sub(
        r'(<html[^>]*)\sclass="ainf-projects-skin"',
        r"<html",
        html,
        count=1,
    )
    html = re.sub(
        r'(<html[^>]*class=")ainf-projects-skin\s*',
        r"\1",
        html,
        count=1,
    )
    return html


def inject_ainf(html: str) -> str:
    html = strip_old_inject(html)

    # html class for CSS that targets html.ainf-projects-skin
    if re.search(r"<html[^>]*class=", html):
        html = re.sub(r'(<html[^>]*class=")', r"\1ainf-projects-skin ", html, count=1)
    else:
        html = re.sub(r"<html", '<html class="ainf-projects-skin"', html, count=1)

    if re.search(r"<body[^>]*class=", html):
        html = re.sub(r'(<body[^>]*class=")', r"\1ainf-projects-skin ", html, count=1)
    else:
        html = html.replace("<body", '<body class="ainf-projects-skin"', 1)

    if "</head>" in html:
        html = html.replace("</head>", HEAD_INJECT + "</head>", 1)
    else:
        html = HEAD_INJECT + html
    return html


def process_route(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    m = re.search(r'const HTML = "(.*)";\s*\n\s*export', text, re.S)
    if not m:
        return
    html = unescape(m.group(1))
    rel = path.relative_to(APP).as_posix()
    orig = html

    html, n_mash = fix_mashed_nav(html)

    if rel.startswith("projects/") or rel == "projects/route.ts":
        html = inject_ainf(html)
        html = remap_colors(html)
        html = html.replace(
            "Oxira - Charity & Non-Profit Framer Template", "Projects | theainf.in"
        )
        html = html.replace("Oxira is a modern", "AINF is a modern")
        html = re.sub(r"<title>Oxira[^<]*</title>", "<title>Projects | theainf.in</title>", html)
        if rel == "projects/route.ts":
            html = re.sub(
                r"<title>[^<]*</title>",
                "<title>Projects | theainf.in — All Indian Nevarlands Foundation</title>",
                html,
                count=1,
            )

    if html == orig:
        return

    new_text = text[: m.start(1)] + escape(html) + text[m.end(1) :]
    path.write_text(new_text, encoding="utf-8")
    print("updated", rel, f"(mash_splits={n_mash})")


def main() -> None:
    if not CSS_PATH.exists():
        raise SystemExit(f"missing {CSS_PATH}")
    if not JS_PATH.exists():
        raise SystemExit(f"missing {JS_PATH}")

    for p in sorted(APP.rglob("route.ts")):
        process_route(p)
    print("done")


if __name__ == "__main__":
    main()
