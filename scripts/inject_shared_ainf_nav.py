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
I18N_CSS = '<link rel="stylesheet" href="/i18n/home-i18n.css" id="ainf-i18n-css">'
I18N_JS = '<script src="/i18n/home-i18n.js" defer id="ainf-i18n-js"></script>'
PROJ_THEME_CSS = '<link rel="stylesheet" href="/assets/css/ainf-projects-theme.css" id="ainf-projects-theme-css">'
PROJ_THEME_JS = '<script src="/assets/js/ainf-projects-theme.js" id="ainf-projects-theme-js"></script>'

HEAD_BITS = BOOT + SITE_CSS + I18N_CSS + SITE_JS + I18N_JS
PROJ_HEAD_BITS = HEAD_BITS + PROJ_THEME_CSS + PROJ_THEME_JS


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
        r'<link[^>]*ainf-projects-theme\.css[^>]*>',
        r'<link[^>]*ainf-site-nav\.css[^>]*>',
        r'<link[^>]*home-i18n\.css[^>]*>',
        r'<link[^>]*id="ainf-i18n-css"[^>]*>',
        r'<script[^>]*ainf-projects-nav\.js[^>]*>\s*</script>',
        r'<script[^>]*ainf-projects-theme\.js[^>]*>\s*</script>',
        r'<script[^>]*ainf-site-nav\.js[^>]*>\s*</script>',
        r'<script[^>]*home-i18n\.js[^>]*>\s*</script>',
        r'<script>document\.documentElement\.classList\.add\("ainf-projects-skin"\);</script>',
        r'<script>document\.documentElement\.classList\.add\("ainf-shared-nav"\);</script>',
        r'<style id="ainf-global-nav-css">[\s\S]*?</style>',
        r'<style id="ainf-projects-theme">[\s\S]*?</style>',
        r'<script id="ainf-projects-theme-js">[\s\S]*?</script>',
        r'<div id="ainf-global-nav"[^>]*>[\s\S]*?</div>\s*',
        r'<footer id="ainf-site-footer"[\s\S]*?</footer>\s*',
    ]
    for p in patterns:
        html = re.sub(p, "", html)
    return html


def rebrand_projects_copy(html: str) -> str:
    replacements = [
        ("@Oxira 2026", "© 2026 theainf"),
        ("Oxira – Charity & Non-Profit Framer Template", "Projects | theainf.in"),
        ("Oxira - Charity & Non-Profit Framer Template", "Projects | theainf.in"),
        ("Ostra Supporter", "AINF Supporter"),
        ("Volunteer at Ostra", "Volunteer at AINF"),
        ("Ostra,", "AINF,"),
        ("Through Ostra,", "Through AINF,"),
        ("Ostra", "AINF"),
        ("Oxira", "AINF"),
        (">Donate now<", ">Support AINF<"),
        (">Donate now", ">Support AINF"),
    ]
    for old, new in replacements:
        html = html.replace(old, new)
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
    bits = HEAD_BITS
    if projects:
        html = ensure_class("html", "ainf-projects-skin", html)
        html = ensure_class("body", "ainf-projects-skin", html)
        html = rebrand_projects_copy(html)
        bits = PROJ_HEAD_BITS

    if "</head>" in html:
        html = html.replace("</head>", bits + "</head>", 1)
    else:
        html = bits + html
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
        if new_html == html:
            continue
        path.write_text(
            text[: m.start(1)] + escape(new_html) + text[m.end(1) :],
            encoding="utf-8",
        )
        print("updated", rel)

    alias = ROOT / "public" / "assets" / "css" / "ainf-projects.css"
    alias.write_text(
        '/* alias */\n@import url("/assets/css/ainf-site-nav.css");\n@import url("/assets/css/ainf-projects-theme.css");\n',
        encoding="utf-8",
    )
    print("wrote alias", alias.relative_to(ROOT))
    print("done")


if __name__ == "__main__":
    main()
