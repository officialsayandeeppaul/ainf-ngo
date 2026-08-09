#!/usr/bin/env python3
"""Inject shared AINF site navbar on every page; retire Oxira/projects-only nav inject."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"

SITE_CSS = '<link rel="stylesheet" href="/assets/css/ainf-site-nav.css" id="ainf-site-nav-css">'
SITE_JS = '<script src="/assets/js/ainf-site-nav.js" id="ainf-site-nav-js"></script>'
BOOT = '<script>document.documentElement.classList.add("ainf-shared-nav");</script>'

HEAD_BITS = BOOT + SITE_CSS + SITE_JS


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


def strip_old(html: str) -> str:
    patterns = [
        r'<link[^>]*ainf-projects\.css[^>]*>',
        r'<link[^>]*ainf-site-nav\.css[^>]*>',
        r'<script[^>]*ainf-projects-nav\.js[^>]*>\s*</script>',
        r'<script[^>]*ainf-site-nav\.js[^>]*>\s*</script>',
        r'<script>document\.documentElement\.classList\.add\("ainf-projects-skin"\);</script>',
        r'<script>document\.documentElement\.classList\.add\("ainf-shared-nav"\);</script>',
        r'<style id="ainf-global-nav-css">[\s\S]*?</style>',
        r'<style id="ainf-projects-theme">[\s\S]*?</style>',
        r'<script id="ainf-projects-theme-js">[\s\S]*?</script>',
        r'<div id="ainf-global-nav"[^>]*>[\s\S]*?</div>\s*',
    ]
    for p in patterns:
        html = re.sub(p, "", html)
    return html


def ensure_class(tag_open: str, classname: str, html: str) -> str:
    # tag_open like <html or <body
    m = re.search(rf"<{tag_open}([^>]*)>", html, re.I)
    if not m:
        return html
    attrs = m.group(1)
    full = m.group(0)
    if re.search(rf'\bclass="[^"]*\b{classname}\b', attrs):
        return html
    if re.search(r'\bclass="', attrs):
        new = re.sub(r'\bclass="', f'class="{classname} ', full, count=1)
    else:
        new = f'<{tag_open} class="{classname}"{attrs}>'
    return html.replace(full, new, 1)


def inject(html: str, projects: bool) -> str:
    html = strip_old(html)
    html = ensure_class("html", "ainf-shared-nav", html)
    html = ensure_class("body", "ainf-shared-nav", html)
    if projects:
        html = ensure_class("html", "ainf-projects-skin", html)
        html = ensure_class("body", "ainf-projects-skin", html)

    if "</head>" in html:
        html = html.replace("</head>", HEAD_BITS + "</head>", 1)
    else:
        html = HEAD_BITS + html
    return html


def main() -> None:
    for path in sorted(APP.rglob("route.ts")):
        rel = path.relative_to(APP).as_posix()
        text = path.read_text(encoding="utf-8")
        m = re.search(r'const HTML = "(.*)";\s*\n\s*export', text, re.S)
        if not m:
            continue
        html = unescape(m.group(1))
        projects = rel.startswith("projects/")
        new_html = inject(html, projects)
        if new_html == html and "ainf-site-nav.js" in html:
            continue
        path.write_text(
            text[: m.start(1)] + escape(new_html) + text[m.end(1) :],
            encoding="utf-8",
        )
        print("updated", rel)

    # Keep projects CSS as thin alias so old caches still get site nav styles
    alias = ROOT / "public" / "assets" / "css" / "ainf-projects.css"
    alias.write_text(
        '/* alias — use ainf-site-nav.css */\n@import url("/assets/css/ainf-site-nav.css");\n',
        encoding="utf-8",
    )
    print("wrote alias", alias.relative_to(ROOT))
    print("done")


if __name__ == "__main__":
    main()
