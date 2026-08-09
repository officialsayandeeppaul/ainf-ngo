#!/usr/bin/env python3
"""Restore fast Framer boot while keeping gzip + external CSS."""
from __future__ import annotations
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
OLD_REV = "4501ad5"

# Create DOMPurify stub (missing file caused 404 / hang)
PURIFY = ROOT / "public" / "framer-site" / "purify.CbWlaYwl.mjs"
PURIFY.write_text(
    "// minimal stub — full DOMPurify not bundled in export\n"
    "export function sanitize(html){return typeof html===\"string\"?html:\"\";}\n"
    "export default {sanitize};\n",
    encoding="utf-8",
)
print("wrote", PURIFY.relative_to(ROOT))


def old_route_content(rel: str) -> str:
    return subprocess.check_output(
        ["git", "show", f"{OLD_REV}:{rel}"],
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def extract_html_esc(ts: str) -> str | None:
    m = re.search(r'const HTML = "(.*)";\s*\n\s*export', ts, re.S)
    return m.group(1) if m else None


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


def get_boot_snippets(old_ts: str) -> tuple[str, str]:
    """Return (modulepreloads_html, handover_html) unescaped."""
    html = unescape(extract_html_esc(old_ts) or "")
    preloads = re.findall(r'<link rel="modulepreload"[^>]*>', html)
    # dedupe keep order
    seen = set()
    pl = []
    for p in preloads:
        if p not in seen:
            seen.add(p)
            pl.append(p)
    hand = re.search(r'<script type="framer/handover"[^>]*>[\s\S]*?</script>', html)
    handover = hand.group(0) if hand else ""
    return "\n".join(pl), handover


SCRIPT_MAIN = (
    '<script type="module" async data-framer-bundle="main" fetchpriority="low" '
    'src="/framer-site/script_main.DRLdLDGq.mjs"></script>'
)

# Early boot: start Framer right after first paint (not click-gated)
EARLY_BOOT = (
    '<script type="module">'
    "(function(){"
    "function boot(){"
    "var s=document.createElement('script');"
    "s.type='module';s.async=true;s.dataset.framerBundle='main';"
    "s.src='/framer-site/script_main.DRLdLDGq.mjs';"
    "document.head.appendChild(s);"
    "}"
    # double rAF = after first paint, then microtask
    "requestAnimationFrame(function(){requestAnimationFrame(boot);});"
    "})();"
    "</script>"
)


def patch_file(path: Path) -> None:
    rel = path.relative_to(ROOT).as_posix()
    try:
        old_ts = old_route_content(rel)
    except subprocess.CalledProcessError:
        print("skip missing in old", rel)
        return

    preloads, handover = get_boot_snippets(old_ts)
    cur = path.read_text(encoding="utf-8")
    m = re.search(r'const HTML = "(.*)";\s*\n\s*export', cur, re.S)
    if not m:
        print("no html", rel)
        return
    html = unescape(m.group(1))

    # Remove click-only defer loader
    html = re.sub(
        r'<script type="module">\(function\(\)\{var loaded=false;[\s\S]*?\}\)\(\);</script>',
        "",
        html,
    )
    # Remove ainfActivateDeferred / i18n deferred hacks — restore normal i18n
    html = re.sub(r'<script>/\*ainfActivateDeferred\*/[\s\S]*?</script>', "", html)
    html = re.sub(r'<script>/\*ainfI18nDeferred\*/[\s\S]*?</script>', "", html)
    html = re.sub(
        r'<script type="text/plain" data-ainf-i18n="1" src="/i18n/home-i18n.js"></script>',
        '<script src="/i18n/home-i18n.js" defer></script>',
        html,
    )
    # Restore ainf deferred scripts to normal
    html = html.replace(' type="text/plain" data-ainf-defer="1"', "")

    # Insert preloads + early boot before </head> if not present
    boot_block = ""
    if preloads and "modulepreload" not in html:
        boot_block += preloads + "\n"
    if "script_main.DRLdLDGq.mjs" not in html or "dataset.framerBundle" in html or "data-framer-bundle" not in html:
        # ensure we have early boot (rAF) — faster perceived than waiting for parser to hit late script
        if EARLY_BOOT.split("boot()")[0] not in html and "data-framer-bundle=\"main\"" not in html:
            boot_block += EARLY_BOOT
        elif "data-framer-bundle=\"main\"" not in html:
            boot_block += EARLY_BOOT

    # Simpler: always inject preloads + SCRIPT_MAIN near end of body before custom scripts
    # Remove any leftover early boot duplicates first
    html = re.sub(
        r'<script type="module">\(function\(\)\{function boot\(\)\{[\s\S]*?\}\)\(\);</script>',
        "",
        html,
    )

    inject = ""
    if preloads:
        # only if not already
        if "rel=\"modulepreload\"" not in html:
            inject += preloads
    inject += SCRIPT_MAIN
    if handover and "framer/handover" not in html:
        inject += handover

    # Place inject before svg-templates or before </body>
    if 'id="svg-templates"' in html:
        html = html.replace('<div id="svg-templates"', inject + '<div id="svg-templates"', 1)
    elif "</body>" in html:
        html = html.replace("</body>", inject + "</body>", 1)
    else:
        html += inject

    # Ensure CSS link stays; ensure ssr visible style exists in head if not in css
    if "ainf-ssr-visible" not in html and "opacity:1!important" not in Path(ROOT / "public/assets/css/home.css").read_text(encoding="utf-8", errors="ignore") if False else True:
        pass

    new_ts = cur[: m.start(1)] + escape(html) + cur[m.end(1) :]
    path.write_text(new_ts, encoding="utf-8")
    print("patched", rel, "preloads", preloads.count("modulepreload"), "handover", bool(handover))


def main():
    for p in sorted(APP.rglob("route.ts")):
        patch_file(p)


if __name__ == "__main__":
    main()
