#!/usr/bin/env python3
import json
import sys
from pathlib import Path

p = Path(sys.argv[1] if len(sys.argv) > 1 else "scripts/_lighthouse-home.json")
d = json.loads(p.read_text(encoding="utf-8"))
score = round(d["categories"]["performance"]["score"] * 100)
print(f"Performance score: {score}/100")
for k in [
    "first-contentful-paint",
    "largest-contentful-paint",
    "total-blocking-time",
    "cumulative-layout-shift",
    "speed-index",
    "interactive",
]:
    a = d["audits"].get(k, {})
    print(f"{k}: {a.get('displayValue')} (audit score {a.get('score')})")
