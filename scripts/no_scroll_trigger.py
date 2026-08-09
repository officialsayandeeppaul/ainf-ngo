from pathlib import Path
OLD = "['pointerdown','keydown','touchstart','scroll','mousemove']"
NEW = "['pointerdown','keydown','touchstart']"
OLD2 = "['pointerdown','keydown','touchstart','scroll']"
NEW2 = "['pointerdown','keydown','touchstart']"
n=0
for p in Path("app").rglob("route.ts"):
    t=p.read_text(encoding="utf-8")
    t2=t.replace(OLD,NEW).replace(OLD2,NEW2)
    if t2!=t:
        p.write_text(t2,encoding="utf-8"); n+=1; print("ok",p)
print("updated",n)
