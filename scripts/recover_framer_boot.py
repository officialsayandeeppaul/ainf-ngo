import subprocess, re
raw = subprocess.check_output(["git", "show", "4501ad5:app/route.ts"], text=True, encoding="utf-8", errors="replace")
m = re.search(r"<script type=\\\"framer/handover\\\"[^>]*>.*?</script>", raw)
print("handover found", bool(m), "len", len(m.group(0)) if m else 0)
m2 = re.search(r"<script[^>]*script_main[^>]*>\s*</script>", raw)
print("script_main", (m2.group(0)[:160] if m2 else None))
print("modulepreload count", raw.count("modulepreload"))
# save handover to file
if m:
    Path = __import__("pathlib").Path
    Path("scripts/_handover_snippet.txt").write_text(m.group(0), encoding="utf-8")
    print("saved handover snippet")
# list modulepreload hrefs
hrefs = re.findall(r"modulepreload\\\" fetchpriority=\\\"low\\\" href=\\\"([^\\\"]+)\\\"", raw)
print("preloads", len(hrefs))
Path = __import__("pathlib").Path
Path("scripts/_modulepreloads.txt").write_text("\n".join(hrefs), encoding="utf-8")
