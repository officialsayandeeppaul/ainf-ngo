#!/usr/bin/env python3
"""Extract inline CSS, strip Framer editor scripts, defer i18n, add content-visibility."""
from __future__ import annotations
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
CSS_DIR = ROOT / "public" / "assets" / "css"
CSS_DIR.mkdir(parents=True, exist_ok=True)

# Early Framer editor / tooling scripts to strip (not needed in prod)
STRIP_SCRIPT_MARKERS = [
    "__framer_force_showing_editorbar",
    "framer.com/edit/init.mjs",
    'var w=\\"framer_variant\\"',
    "var w=\"framer_variant\"",  # after extract wouldn't apply to ts
]

def route_css_name(path: Path) -> str:
    rel = path.relative_to(APP).parent.as_posix()
    if rel == ".":
        return "home.css"
    return rel.replace("/", "-") + ".css"


def patch_ts(path: Path) -> None:
    t = path.read_text(encoding="utf-8")
    orig = t

    # Extract style tags from the HTML string content
    styles = re.findall(r"<style[^>]*>([\s\S]*?)</style>", t)
    # In TS file, style body still has \n as two-char escapes etc. We need real CSS file.
    # Better extract from a decoded perspective: operate on the HTML const only.
    
    m = re.search(r'const HTML = "(.*)";\s*\n\s*export', t, re.S)
    if not m:
        print("no html", path)
        return
    html_esc = m.group(1)
    # unescape for processing
    html = (
        html_esc.replace(r"\\", "\0")
        .replace(r"\"", '"')
        .replace(r"\n", "\n")
        .replace(r"\t", "\t")
        .replace("\0", "\\")
    )

    # collect and remove style tags
    css_parts = []
    def take_style(mm: re.Match) -> str:
        css_parts.append(mm.group(1))
        return ""
    html2 = re.sub(r"<style[^>]*>([\s\S]*?)</style>", take_style, html)
    if not css_parts:
        print("no styles", path)
        html2 = html
    else:
        css_name = route_css_name(path)
        css_body = "\n".join(css_parts)
        # add content-visibility for heavy below-fold framer sections
        css_body += (
            "\n/* ainf perf */\n"
            "[data-framer-name=\"Desktop\"] ~ *, section:nth-of-type(n+2), "
            ".framer-vdgunt > div:nth-child(n+3){content-visibility:auto;contain-intrinsic-size:1px 720px;}\n"
        )
        (CSS_DIR / css_name).write_text(css_body, encoding="utf-8")
        link = f'<link rel="stylesheet" href="/assets/css/{css_name}">'
        # inject after charset bootstrap / viewport
        if '<meta name="viewport"' in html2:
            html2 = html2.replace(
                '<meta name="viewport" content="width=device-width">',
                '<meta name="viewport" content="width=device-width">' + link,
                1,
            )
        else:
            html2 = html2.replace("</head>", link + "</head>", 1)
        print(path.name if False else path, "css", css_name, "bytes", len(css_body))

    # Strip editor scripts
    def drop_script(mm: re.Match) -> str:
        body = mm.group(0)
        for marker in ("__framer_force_showing_editorbar", "framer.com/edit/init.mjs", 'var w="framer_variant"', "framer_variant"):
            if marker in body:
                return ""
        return body
    html2 = re.sub(r"<script\b[^>]*>[\s\S]*?</script>", drop_script, html2)

    # Defer i18n: change defer script to text/plain + load on interaction
    if 'src="/i18n/home-i18n.js"' in html2 and "ainfI18nDeferred" not in html2:
        html2 = html2.replace(
            '<script src="/i18n/home-i18n.js" defer></script>',
            '<script type="text/plain" data-ainf-i18n="1" src="/i18n/home-i18n.js"></script>'
            '<script>/*ainfI18nDeferred*/(function(){function go(){var s=document.querySelector("script[data-ainf-i18n]");'
            'if(!s)return;var n=document.createElement("script");n.src=s.getAttribute("src");s.replaceWith(n);}'
            '["pointerdown","keydown","touchstart"].forEach(function(e){addEventListener(e,go,{once:true,passive:true});});})();</script>',
        )

    # re-escape into TS string
    html_esc2 = (
        html2.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    )
    t2 = t[: m.start(1)] + html_esc2 + t[m.end(1) :]
    if t2 != orig:
        path.write_text(t2, encoding="utf-8")
        print("wrote", path.relative_to(ROOT))
    else:
        print("unchanged", path.relative_to(ROOT))


def main():
    for p in sorted(APP.rglob("route.ts")):
        patch_ts(p)


if __name__ == "__main__":
    main()
