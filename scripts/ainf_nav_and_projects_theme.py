#!/usr/bin/env python3
"""Fix mashed Projects/Stories nav; sync project pages to AINF navbar + theme."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
CSS_OUT = ROOT / "public" / "assets" / "css" / "ainf-projects.css"

AINF_PROJECTS_CSS = r"""
/* AINF skin for /projects pages — keep Oxira layout, AINF brand */
@font-face{font-family:Onest;font-style:normal;font-weight:400;font-display:swap;src:url("/assets/fonts/0b532b340381e255.woff2") format("woff2")}
@font-face{font-family:Onest;font-style:normal;font-weight:700;font-display:swap;src:url("/assets/fonts/98a11855328341d1.woff2") format("woff2")}

#ainf-global-nav{
  position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:99999;
  width:min(1100px,calc(100% - 24px));
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:10px 14px 10px 18px;background:#fff;border-radius:999px;
  box-shadow:0 10px 40px rgba(0,0,0,.12);
  font-family:Onest,Inter,system-ui,sans-serif;
}
#ainf-global-nav a{text-decoration:none;color:#222}
#ainf-global-nav .ainf-brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:18px;letter-spacing:-.02em;color:#222}
#ainf-global-nav .ainf-brand img{width:28px;height:28px;border-radius:50%;object-fit:cover}
#ainf-global-nav .ainf-brand small{font-size:10px;font-weight:600;color:#999;margin-left:2px}
#ainf-global-nav .ainf-links{display:flex;align-items:center;gap:22px;flex:1;justify-content:center}
#ainf-global-nav .ainf-links a{font-size:14px;font-weight:500;color:#222;white-space:nowrap}
#ainf-global-nav .ainf-links a:hover{color:#39a46b}
#ainf-global-nav .ainf-links a[aria-current="page"]{color:#39a46b;font-weight:600}
#ainf-global-nav .ainf-right{display:flex;align-items:center;gap:12px}
#ainf-global-nav .ainf-cta{
  display:inline-flex;align-items:center;gap:8px;background:#39a46b;color:#fff!important;
  padding:10px 18px;border-radius:999px;font-size:14px;font-weight:600;white-space:nowrap
}
#ainf-global-nav .ainf-cta:hover{filter:brightness(1.05)}
#ainf-global-nav .ainf-dot{width:6px;height:6px;border-radius:50%;background:#fff;display:inline-block}
@media(max-width:900px){
  #ainf-global-nav{padding:8px 10px 8px 12px;gap:8px}
  #ainf-global-nav .ainf-links{display:none}
  #ainf-global-nav .ainf-brand small{display:none}
}

/* Hide Oxira / Framer template navbar completely */
body.ainf-projects-skin [data-framer-name="Navigation"],
body.ainf-projects-skin [data-framer-name="Navbar"],
body.ainf-projects-skin [data-framer-name="Nav Items"],
body.ainf-projects-skin [data-framer-name="Top"],
body.ainf-projects-skin [data-framer-name="Header"],
body.ainf-projects-skin [data-framer-name="Banner"],
body.ainf-projects-skin header,
body.ainf-projects-skin nav:not(#ainf-global-nav){
  display:none!important;visibility:hidden!important;pointer-events:none!important;height:0!important;overflow:hidden!important
}
body.ainf-projects-skin #ainf-global-nav{display:flex!important;visibility:visible!important;height:auto!important;overflow:visible!important;pointer-events:auto!important}

body.ainf-projects-skin{
  --ainf-green:#39a46b;
  --token-e3f77d53-9b12-48ea-9c29-327ba647a7e2:#39a46b;
  /* Oxira dark-green brand token → AINF */
  --token-aa09f766-4b4c-44d5-8207-66ca250b5f75:#39a46b;
  --token-508c7d2b-295a-4a6d-b378-0e6a8233ced0:#39a46b66;
  background:#f6faf0!important;
  font-family:Onest,Inter,system-ui,sans-serif!important;
  padding-top:88px!important;
}
body.ainf-projects-skin,
body.ainf-projects-skin *:not(script):not(style){
  --framer-font-family:Onest,Inter,system-ui,sans-serif!important;
}
body.ainf-projects-skin h1,
body.ainf-projects-skin h2,
body.ainf-projects-skin h3,
body.ainf-projects-skin h4,
body.ainf-projects-skin p,
body.ainf-projects-skin a,
body.ainf-projects-skin span,
body.ainf-projects-skin button,
body.ainf-projects-skin li{
  font-family:Onest,Inter,system-ui,sans-serif!important;
}
"""

AINF_THEME_JS = r"""
<script id="ainf-projects-theme-js">
(function(){
  var GREEN='#39a46b';
  var BAD=['rgb(4, 63, 45)','rgb(4, 64, 46)','rgb(29, 82, 66)','rgb(17, 115, 69)'];
  function killOxiraNav(){
    var names=['Navigation','Navbar','Nav Items','Top','Header','Banner'];
    names.forEach(function(n){
      document.querySelectorAll('[data-framer-name="'+n+'"]').forEach(function(el){
        if(el.closest && el.closest('#ainf-global-nav')) return;
        el.style.setProperty('display','none','important');
        el.setAttribute('aria-hidden','true');
      });
    });
  }
  function paint(){
    document.querySelectorAll('a,button,div,span,p,path').forEach(function(el){
      try{
        var bg=getComputedStyle(el).backgroundColor;
        if(BAD.indexOf(bg)>=0){ el.style.setProperty('background-color',GREEN,'important'); }
        var c=getComputedStyle(el).color;
        if(c==='rgb(4, 63, 45)' || c==='rgb(29, 82, 66)'){ el.style.setProperty('color',GREEN,'important'); }
        var fill=el.getAttribute && el.getAttribute('fill');
        if(fill && (fill==='#043f2d' || fill==='#1d5242' || fill==='#04402e')) el.setAttribute('fill',GREEN);
      }catch(e){}
    });
  }
  function run(){ killOxiraNav(); paint(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run);
  else run();
  setTimeout(run,400);
  setTimeout(run,1200);
  setTimeout(run,2500);
  var mo=new MutationObserver(function(){ killOxiraNav(); });
  if(document.body) mo.observe(document.body,{childList:true,subtree:true});
  else document.addEventListener('DOMContentLoaded',function(){ mo.observe(document.body,{childList:true,subtree:true}); });
})();
</script>
"""


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


SPLIT_MARK = (
    "<!--/$--></p></div>"
    '<div class="framer-ainf-proj-link" data-framer-component-type="RichTextContainer" '
    'style="--extracted-r6o4lv:var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(34, 34, 34));transform:none">'
    '<p class="framer-text framer-styles-preset-19x7ezw" data-styles-preset="u0JoyKeHY" dir="auto" '
    'style="--framer-text-color:var(--extracted-r6o4lv, var(--token-7e762acf-8506-4626-8fd0-26eadf01dbe6, rgb(34, 34, 34)))">'
    "<!--$-->"
)


def fix_mashed_nav(html: str) -> tuple[str, int]:
    """Split any remaining Projects</a><a...>Stories into separate RichText containers."""
    pat = re.compile(
        r'(<a class="framer-text[^"]*" data-styles-preset="RgGxvnQb8" href="(?:\./|\.\./|\.\./\.\./)?projects">Projects</a>)'
        r'(<a class="framer-text[^"]*" data-styles-preset="RgGxvnQb8" href="(?:\./|\.\./|\.\./\.\./)?blogs">Stories</a>)'
    )
    n = 0

    def repl(m: re.Match) -> str:
        nonlocal n
        n += 1
        return m.group(1) + SPLIT_MARK + m.group(2)

    return pat.sub(repl, html), n


def nav_html(current: str) -> str:
    def alink(label: str, path: str) -> str:
        cur = ' aria-current="page"' if current == path or current.startswith(path + "/") else ""
        if path == "/projects" and current.startswith("/projects"):
            cur = ' aria-current="page"'
        if path != "/projects" and current.startswith("/projects"):
            if path != current:
                # only projects is current on project pages for that link
                pass
        return f'<a href="{path}"{cur}>{label}</a>'

    # Projects current when on any /projects*
    links = [
        ("About AINF", "/about-us"),
        ("Missions", "/causes"),
        ("Projects", "/projects"),
        ("Stories", "/blogs"),
        ("Contact", "/contact-us"),
    ]
    parts = []
    for label, path in links:
        is_cur = False
        if path == "/projects":
            is_cur = current.startswith("/projects")
        else:
            is_cur = current == path or current.startswith(path + "/")
        cur = ' aria-current="page"' if is_cur else ""
        parts.append(f'<a href="{path}"{cur}>{label}</a>')

    return f"""
<div id="ainf-global-nav" role="navigation" aria-label="AINF">
  <a class="ainf-brand" href="/">
    <img src="/assets/img/theainf-logo.svg" alt="theainf" width="28" height="28"/>
    <span>theainf</span><small>AINF</small>
  </a>
  <div class="ainf-links">
    {" ".join(parts)}
  </div>
  <div class="ainf-right">
    <a class="ainf-cta" href="/donate-now"><span class="ainf-dot"></span> Support AINF</a>
  </div>
</div>
"""


COLOR_MAP = {
    "#043f2d": "#39a46b",
    "#04402e": "#39a46b",
    "#1d5242": "#39a46b",
    "#117345": "#39a46b",
    "rgb(4, 63, 45)": "rgb(57, 164, 107)",
    "rgb(4, 64, 46)": "rgb(57, 164, 107)",
    "rgb(29, 82, 66)": "rgb(57, 164, 107)",
    "rgb(17, 115, 69)": "rgb(57, 164, 107)",
}


def remap_colors(html: str) -> str:
    for old, new in COLOR_MAP.items():
        html = html.replace(old, new)
        html = html.replace(old.upper(), new)
    return html


def strip_old_inject(html: str) -> str:
    """Remove previous ainf inject blocks so we can re-inject cleanly."""
    html = re.sub(r'<style id="ainf-global-nav-css">[\s\S]*?</style>', "", html)
    html = re.sub(r'<style id="ainf-projects-theme">[\s\S]*?</style>', "", html)
    html = re.sub(r'<script id="ainf-projects-theme-js">[\s\S]*?</script>', "", html)
    html = re.sub(r'<link[^>]*ainf-projects\.css[^>]*>', "", html)
    html = re.sub(r'<div id="ainf-global-nav"[\s\S]*?</div>\s*', "", html, count=1)
    # normalize body class
    html = re.sub(r'<body([^>]*)\sclass="ainf-projects-skin"', r"<body\1", html, count=1)
    html = re.sub(r'<body([^>]*)class="ainf-projects-skin"\s*', r"<body\1", html, count=1)
    return html


def inject_ainf(html: str, current: str) -> str:
    html = strip_old_inject(html)
    if 'class="ainf-projects-skin"' in html or "ainf-projects-skin" in html[:500]:
        pass
    # ensure body class
    if re.search(r"<body[^>]*class=", html):
        html = re.sub(
            r"(<body[^>]*class=\")",
            r'\1ainf-projects-skin ',
            html,
            count=1,
        )
    else:
        html = html.replace("<body", '<body class="ainf-projects-skin"', 1)

    head_bits = (
        '<link rel="stylesheet" href="/assets/css/ainf-projects.css" id="ainf-projects-css">'
        + AINF_THEME_JS
    )
    if "</head>" in html:
        html = html.replace("</head>", head_bits + "</head>", 1)
    else:
        html = head_bits + html

    inject = nav_html(current)
    html = re.sub(r"(<body[^>]*>)", r"\1" + inject, html, count=1)
    return html


def process_route(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    m = re.search(r'const HTML = "(.*)";\s*\n\s*export', text, re.S)
    if not m:
        return
    html = unescape(m.group(1))
    rel = path.relative_to(APP).as_posix()
    orig = html

    html, n_mash = fix_mashed_nav(html)

    if rel.startswith("projects/") or rel == "projects/route.ts":
        if rel == "projects/route.ts":
            current = "/projects"
        else:
            current = "/" + rel[: -len("/route.ts")]
        html = inject_ainf(html, current)
        html = remap_colors(html)
        html = html.replace("Oxira - Charity & Non-Profit Framer Template", "Projects | theainf.in")
        html = html.replace("Oxira is a modern", "AINF is a modern")
        # titles that still say Oxira
        html = re.sub(r"<title>Oxira[^<]*</title>", "<title>Projects | theainf.in</title>", html)
        if rel == "projects/route.ts" and "<title>" in html:
            html = re.sub(
                r"<title>[^<]*</title>",
                "<title>Projects | theainf.in — All Indian Nevarlands Foundation</title>",
                html,
                count=1,
            )

    if html == orig:
        if n_mash:
            print("noop but mash?", rel, n_mash)
        return

    new_text = text[: m.start(1)] + escape(html) + text[m.end(1) :]
    path.write_text(new_text, encoding="utf-8")
    print("updated", rel, f"(mash_splits={n_mash})")


def main() -> None:
    CSS_OUT.parent.mkdir(parents=True, exist_ok=True)
    CSS_OUT.write_text(AINF_PROJECTS_CSS.strip() + "\n", encoding="utf-8")
    print("wrote", CSS_OUT.relative_to(ROOT))

    for p in sorted(APP.rglob("route.ts")):
        process_route(p)
    print("done")


if __name__ == "__main__":
    main()
