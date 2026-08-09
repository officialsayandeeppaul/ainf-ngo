#!/usr/bin/env python3
import json
from pathlib import Path

for label, path in [("desktop", "scripts/_lh-desktop.json"), ("mobile", "scripts/_lh-mobile.json")]:
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    print("\n==", label, "score", round(d["categories"]["performance"]["score"] * 100))
    opps = []
    for a in d["audits"].values():
        if a.get("details", {}).get("type") == "opportunity" and a.get("score") is not None and a["score"] < 1:
            opps.append((a.get("numericValue") or 0, a["id"], a.get("title"), a.get("displayValue")))
    for nv, i, t, dv in sorted(opps, reverse=True)[:12]:
        print(f"  {i}: {dv} | {t}")
    # diagnostics
    for i in ["bootup-time", "mainthread-work-breakdown", "dom-size", "unused-javascript", "render-blocking-resources"]:
        a = d["audits"].get(i)
        if a:
            print(f"  diag {i}: {a.get('displayValue')} score={a.get('score')}")
