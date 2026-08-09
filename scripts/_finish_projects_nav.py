from pathlib import Path
import re

def insert_projects(t: str) -> tuple[str, int]:
    if 'href=\\"./projects\\"' in t and ">Projects<" in t.replace(" ",""):
        # weak check
        pass
    if 'href=\\"./projects\\">Projects<' in t or 'href=\\"./projects\\">Projects</a>' in t:
        return t, 0

    inserted = 0
    # Pattern used successfully on home: styles-preset link
    # Insert before Stories href="./blogs"
    # Try multiple strategies

    # Strategy 1: clone exact home-style if preset exists
    preset_blogs = re.findall(
        r'(<a class=\\"framer-text framer-styles-preset-ojdzmt\\" data-styles-preset=\\"RgGxvnQb8\\" href=\\"./blogs\\">)(.*?)(</a>)',
        t,
    )
    if preset_blogs:
        # replace each blogs preset with projects+blogs
        def repl(m):
            nonlocal inserted
            inserted += 1
            return (
                m.group(0).replace('href=\\"./blogs\\"', 'href=\\"./projects\\"').replace(m.group(2), "Projects")
                + m.group(0)
            )
        t2 = re.sub(
            r'<a class=\\"framer-text framer-styles-preset-ojdzmt\\" data-styles-preset=\\"RgGxvnQb8\\" href=\\"./blogs\\">.*?</a>',
            repl,
            t,
        )
        return t2, inserted

    # Strategy 2: before any href="./blogs" that has Stories nearby
    idx = 0
    while inserted < 8:
        i = t.find('href=\\"./blogs\\"', idx)
        if i < 0:
            break
        a_start = t.rfind("<a ", 0, i)
        a_end = t.find("</a>", i)
        if a_start < 0 or a_end < 0:
            idx = i + 1
            continue
        block = t[a_start:a_end+4]
        window = t[max(0,a_start-100):a_end+50]
        if "Stories" in block or "Stories" in window or "framer-styles-preset" in block:
            proj = block.replace('href=\\"./blogs\\"','href=\\"./projects\\"')
            # replace inner text Stories->Projects if present else force
            if "Stories" in proj:
                proj = proj.replace("Stories", "Projects")
            else:
                # replace content between > and </a>
                proj = re.sub(r">(.*?)</a>", ">Projects</a>", proj, count=1, flags=re.S)
            t = t[:a_start] + proj + t[a_start:]
            inserted += 1
            idx = a_start + len(proj) + (a_end - a_start + 4)
        else:
            idx = i + 1

    # Strategy 3: for project detail pages that already have Projects in axinn nav as current
    if inserted == 0 and "projects/" in str(t[:200]):
        pass

    # Strategy 4: inject after Missions/causes preset link
    if inserted == 0:
        m = re.search(
            r'<a class=\\"framer-text framer-styles-preset-ojdzmt\\" data-styles-preset=\\"RgGxvnQb8\\" href=\\"./causes\\">.*?</a>',
            t,
        )
        if m:
            inj = m.group(0).replace('href=\\"./causes\\"','href=\\"./projects\\"')
            inj = re.sub(r">(.*?)</a>", ">Projects</a>", inj, count=1, flags=re.S)
            # if causes text was Missions
            inj = inj.replace("Missions", "Projects")
            t = t[:m.end()] + inj + t[m.end():]
            inserted = 1

    # Strategy 5: axinn project pages - they have Projects already as ./projects - check
    if inserted == 0 and 'href=\\"./projects\\"' in t:
        # has href but maybe not label Projects in our check - force OK
        return t, -1

    return t, inserted

for p in sorted(Path("app").rglob("route.ts")):
    t = p.read_text(encoding="utf-8")
    has = 'href=\\"./projects\\">Projects</a>' in t or 'href=\\"./projects\\">Projects<' in t
    if has:
        continue
    t2, n = insert_projects(t)
    # Also for project detail pages from axinn - rewrite their top nav to AINF structure
    if "app\\projects\\" in str(p) or "app/projects/" in str(p).replace("\\","/"):
        # Map axinn Contact -> contact-us
        t2 = t2.replace('href=\\"./contact\\"', 'href=\\"./contact-us\\"')
        # Ensure Projects link exists - axinn already has ./projects
        if 'href=\\"./projects\\"' in t2 and n == 0:
            n = -1
    if n != 0 or t2 != t:
        p.write_text(t2, encoding="utf-8")
        print("updated", p, "n=", n)

# final check
miss=[]
for p in sorted(Path("app").rglob("route.ts")):
    t=p.read_text(encoding="utf-8")
    if 'href=\\"./projects\\"' not in t:
        miss.append(p)
print("still missing href", len(miss))
for m in miss: print(m)
