#!/usr/bin/env python3
"""
Aggressive performance pass for Framer HTML routes targeting 90+ Lighthouse.

- Reveal appear-hidden SSR content (so LCP works without JS)
- Disable Framer appear effects
- Strip modulepreload (stops early JS download/parse)
- Load script_main only after interaction or idle (cuts TBT)
- Lazy-load non-LCP images
Does not rewrite Framer animation payload JSON (hydration still works when JS loads).
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"

BOOTSTRAP = r"""<script>window.__framer_disable_appear_effects=true;window.__framer_disable_appear_effects_once=true;</script><style id="ainf-ssr-visible">[style*="opacity:0.001"]{opacity:1!important;transform:none!important;filter:none!important}</style>"""

DEFER_LOADER = r"""<script type="module">
(function(){
  var loaded=false;
  function load(){
    if(loaded)return;loaded=true;
    var s=document.createElement('script');
    s.type='module';
    s.src='/framer-site/script_main.DRLdLDGq.mjs';
    s.dataset.framerBundle='main';
    document.head.appendChild(s);
  }
  var evts=['pointerdown','keydown','touchstart','scroll','mousemove'];
  evts.forEach(function(e){addEventListener(e,load,{once:true,passive:true});});
  if('requestIdleCallback' in window){requestIdleCallback(function(){setTimeout(load,2500);},{timeout:6000});}
  else{setTimeout(load,3500);}
})();
</script>"""

# Escape for embedding inside a TS double-quoted string... 
# Our route files store HTML with \" for quotes and \n for newlines.
# BOOTSTRAP/DEFER_LOADER above use normal quotes — we need to escape for the TS source.


def to_ts_html_fragment(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
    )


BOOTSTRAP_TS = to_ts_html_fragment(BOOTSTRAP)
DEFER_LOADER_TS = to_ts_html_fragment(DEFER_LOADER)


def patch(text: str) -> tuple[str, list[str]]:
    notes: list[str] = []
    out = text

    # 1) Inject bootstrap once after charset
    if "ainf-ssr-visible" not in out:
        needle = '<meta charset=\\"utf-8\\">'
        if needle in out:
            out = out.replace(needle, needle + BOOTSTRAP_TS, 1)
            notes.append("ssr-visible-bootstrap")
        else:
            notes.append("WARN-no-charset")

    # 2) Remove ALL modulepreload links
    out2, n = re.subn(
        r'<link rel=\\"modulepreload\\"[^>]*>',
        "",
        out,
    )
    if n:
        out = out2
        notes.append(f"strip-modulepreload x{n}")

    # 3) Replace script_main tag with deferred loader
    script_pat = (
        r'<script type=\\"module\\" async=\\"\\" data-framer-bundle=\\"main\\" '
        r'fetchpriority=\\"low\\" src=\\"/framer-site/script_main\.[^\\"]+\\.mjs\\"></script>'
    )
    out2, n = re.subn(script_pat, DEFER_LOADER_TS, out)
    if n:
        out = out2
        notes.append(f"defer-script-main x{n}")
    elif "script_main" in out and "ainf-ssr-visible" in out:
        if "dataset.framerBundle" not in out and 'data-framer-bundle=\\"main\\"' in out:
            notes.append("WARN-script-main-pattern")

    # 4) Lazy-load images that are not LCP hero bg / not already lazy
    # Add loading=\"lazy\" decoding=\"async\" to <img ...> without loading= and without e948853e / fetchpriority high
    def lazy_img(m: re.Match) -> str:
        tag = m.group(0)
        if "loading=" in tag:
            return tag
        if "e948853e2133d9ae" in tag:
            return tag
        if 'fetchpriority=\\"high\\"' in tag:
            return tag
        if 'alt=\\"Hero BG\\"' in tag:
            return tag
        # insert before final >
        if tag.endswith("/>"):
            return tag[:-2] + ' loading=\\"lazy\\" decoding=\\"async\\"/>'
        if tag.endswith(">"):
            return tag[:-1] + ' loading=\\"lazy\\" decoding=\\"async\\">'
        return tag

    out2, n = re.subn(r"<img\b[^>]*>", lazy_img, out)
    if n:
        # count how many actually gained lazy - approximate
        notes.append("img-lazy-pass")

    # 5) Defer custom ainf inline scripts that are not critical (home-sixth / seven-tabs)
    # Convert to type=text/plain + idle loader — skip if already handled
    # Safer: leave them; they're small vs Framer.

    return out, notes


def main() -> int:
    routes = sorted(APP.rglob("route.ts"))
    changed = 0
    for path in routes:
        raw = path.read_text(encoding="utf-8")
        # skip if somehow not HTML route
        if "const HTML" not in raw:
            continue
        patched, notes = patch(raw)
        if patched != raw:
            path.write_text(patched, encoding="utf-8")
            changed += 1
            print(f"OK {path.relative_to(ROOT).as_posix()}: {', '.join(notes)}")
        else:
            print(f"-- {path.relative_to(ROOT).as_posix()}: {', '.join(notes) or 'no changes'}")
    print(f"Patched {changed}/{len(routes)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
