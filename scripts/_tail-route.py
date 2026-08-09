#!/usr/bin/env python3
from pathlib import Path
p = Path("app/route.ts")
t = p.read_text(encoding="utf-8")
print(t[-800:])
print("---")
print("GET idx", t.rfind("export async function GET"))
