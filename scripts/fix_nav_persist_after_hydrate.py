#!/usr/bin/env python3
"""Patch Framer script_main nav labels + inject nav-persist on AINF pages."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
SCRIPT_MAIN = ROOT / "public" / "framer-site" / "script_main.DRLdLDGq.mjs"
STRINGS = ROOT / "public" / "i18n" / "home-strings.json"

NAV_PERSIST_TAG = '<script src="/assets/js/ainf-nav-persist.js" defer></script>'
I18N_TAG = '<script src="/i18n/home-i18n.js" defer></script>'


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


def patch_script_main() -> None:
    t = SCRIPT_MAIN.read_text(encoding="utf-8")
    orig = t
    # Framer canvas label strings that overwrite SSR nav after hydrate
    t = t.replace("children:`Diary`", "children:`Stories`")
    t = t.replace("children:`Reach Us`", "children:`Contact`")
    if t == orig:
        print("script_main: no label changes needed (already patched?)")
    else:
        SCRIPT_MAIN.write_text(t, encoding="utf-8")
        print(
            "script_main patched:",
            "Diary->Stories",
            orig.count("children:`Diary`"),
            "Reach Us->Contact",
            orig.count("children:`Reach Us`"),
        )


def patch_i18n_strings() -> None:
    import json

    data = json.loads(STRINGS.read_text(encoding="utf-8"))
    strings = data.setdefault("strings", {})
    # Prefer Stories/Contact/Projects keys for EN + translations
    if "Diary" in strings and "Stories" not in strings:
        strings["Stories"] = strings["Diary"]
    if "Reach Us" in strings and "Contact" not in strings:
        strings["Contact"] = strings["Reach Us"]
    strings.setdefault(
        "Projects",
        {"bn": "প্রজেক্ট", "hi": "प्रोजेक्ट्स"},
    )
    strings.setdefault(
        "Stories",
        {"bn": "ডায়েরি", "hi": "डायरी"},
    )
    strings.setdefault(
        "Contact",
        {"bn": "যোগাযোগ", "hi": "संपर्क करें"},
    )
    # Keep Diary/Reach Us aliases pointing at same translations so brief flashes still translate
    strings["Diary"] = strings["Stories"]
    strings["Reach Us"] = strings["Contact"]
    STRINGS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("updated", STRINGS.relative_to(ROOT))


def inject_persist_script(html: str) -> str:
    if "ainf-nav-persist.js" in html:
        return html
    if I18N_TAG in html:
        return html.replace(I18N_TAG, NAV_PERSIST_TAG + I18N_TAG, 1)
    # fallback before </body>
    if "</body>" in html:
        return html.replace("</body>", NAV_PERSIST_TAG + "</body>", 1)
    return html + NAV_PERSIST_TAG


def process_ainf_routes() -> None:
    for path in sorted(APP.rglob("route.ts")):
        rel = path.relative_to(APP).as_posix()
        if rel.startswith("projects/"):
            continue
        text = path.read_text(encoding="utf-8")
        m = re.search(r'const HTML = "(.*)";\s*\n\s*export', text, re.S)
        if not m:
            continue
        html = unescape(m.group(1))
        if "home-i18n.js" not in html and "script_main" not in html:
            continue
        new_html = inject_persist_script(html)
        if new_html == html:
            continue
        path.write_text(text[: m.start(1)] + escape(new_html) + text[m.end(1) :], encoding="utf-8")
        print("injected persist", rel)


def main() -> None:
    patch_script_main()
    patch_i18n_strings()
    process_ainf_routes()
    print("done")


if __name__ == "__main__":
    main()
