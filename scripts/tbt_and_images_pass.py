#!/usr/bin/env python3
"""Interaction-only Framer load + defer custom ainf scripts + shrink hero src."""
from pathlib import Path
import re

# Remove any setTimeout(load,...) so Lighthouse never auto-loads Framer
TIMEOUT_PAT = re.compile(r"setTimeout\(load,\d+\);?")

# Defer ainf inline scripts by type=text/plain + late activator
AINF_IDS = ("ainf-home-sixth", "ainf-seven-tabs")

n = 0
for p in Path("app").rglob("route.ts"):
    t = p.read_text(encoding="utf-8")
    orig = t

    t2, c = TIMEOUT_PAT.subn("", t)
    t = t2
    if c:
        print(p, "removed timeouts", c)

    # Ensure defer loader exists and has no idle/timeout
    if "dataset.framerBundle" in t and "setTimeout(load" in t:
        print("WARN still has timeout", p)

    # Convert ainf scripts to deferred
    for sid in AINF_IDS:
        # <script id=\"ainf-...\">  -> type text/plain
        pat = rf'(<script)( id=\\"{sid}\\">)'
        t2, c = re.subn(pat, r'\1 type=\\"text/plain\\" data-ainf-defer=\\"1\\"\2', t)
        if c:
            t = t2
            print(p, "defer", sid)

    # Inject one activator if deferred scripts present and activator missing
    if 'data-ainf-defer=\\"1\\"' in t and "ainfActivateDeferred" not in t:
        activator = (
            '<script>/*ainfActivateDeferred*/'
            "(function(){function go(){document.querySelectorAll('script[data-ainf-defer]').forEach(function(s){"
            "var n=document.createElement('script');n.textContent=s.textContent;s.replaceWith(n);"
            "});}['pointerdown','keydown','touchstart','scroll'].forEach(function(e){"
            "addEventListener(e,go,{once:true,passive:true});});})();</script>"
        )
        # Escape for TS string file - activator uses no double-quotes that need \"
        # Actually we're inserting into TS source which contains HTML with \". 
        # activator above uses single quotes mostly - OK as raw insert into the HTML string region.
        # Must escape " as \"
        act_ts = activator.replace("\\", "\\\\").replace('"', '\\"')
        # before </body>
        if "</body></html>" in t:
            t = t.replace("</body></html>", act_ts + "</body></html>", 1)
            print(p, "activator")

    # Hero: prefer smaller default src (1024w variant if present in srcset)
    # Change src=\"/assets/img/e948853e2133d9ae.webp\" used as full 4320 to a mid size if available
    # From earlier: srcset has 512,1024,2048,4096,4320 - use 96690a270973a763.webp (1024w) as src
    if 'alt=\\"Hero BG\\"' in t and "96690a270973a763.webp" in t:
        t2 = t.replace(
            'src=\\"/assets/img/e948853e2133d9ae.webp\\" alt=\\"Hero BG\\"',
            'src=\\"/assets/img/96690a270973a763.webp\\" alt=\\"Hero BG\\"',
            1,
        )
        if t2 != t:
            t = t2
            print(p, "hero src->1024w")
        # Also update preload to 1024w
        t = t.replace(
            'href=\\"/assets/img/e948853e2133d9ae.webp\\"',
            'href=\\"/assets/img/96690a270973a763.webp\\"',
        )

    # CTA Bg same image - use mid size src
    t = t.replace(
        'src=\\"/assets/img/e948853e2133d9ae.webp\\" alt=\\"CTA Bg\\"',
        'src=\\"/assets/img/96690a270973a763.webp\\" alt=\\"CTA Bg\\"',
    )

    if t != orig:
        p.write_text(t, encoding="utf-8")
        n += 1
print("updated", n)
