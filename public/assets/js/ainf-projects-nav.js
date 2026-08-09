/* Persistent AINF pill navbar for /projects — survives Framer hydration */
(function () {
  if (window.__ainfProjectsNavBooted) return;
  window.__ainfProjectsNavBooted = true;

  var NAV_ID = "ainf-global-nav";
  var path = (location.pathname || "/").replace(/\/$/, "") || "/";

  function isCurrent(href) {
    if (href === "/projects") return path === "/projects" || path.indexOf("/projects/") === 0;
    return path === href || path.indexOf(href + "/") === 0;
  }

  function link(label, href) {
    var a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    if (isCurrent(href)) a.setAttribute("aria-current", "page");
    return a;
  }

  function buildNav() {
    var nav = document.createElement("div");
    nav.id = NAV_ID;
    nav.setAttribute("role", "navigation");
    nav.setAttribute("aria-label", "AINF");
    nav.setAttribute("data-ainf-persistent", "1");

    var brand = document.createElement("a");
    brand.className = "ainf-brand";
    brand.href = "/";
    var img = document.createElement("img");
    img.src = "/assets/img/theainf-logo.svg";
    img.alt = "theainf";
    img.width = 28;
    img.height = 28;
    var name = document.createElement("span");
    name.textContent = "theainf";
    brand.appendChild(img);
    brand.appendChild(name);

    var links = document.createElement("div");
    links.className = "ainf-links";
    [
      ["About AINF", "/about-us"],
      ["Missions", "/causes"],
      ["Projects", "/projects"],
      ["Stories", "/blogs"],
      ["Contact", "/contact-us"],
    ].forEach(function (item) {
      links.appendChild(link(item[0], item[1]));
    });

    var right = document.createElement("div");
    right.className = "ainf-right";
    var cta = document.createElement("a");
    cta.className = "ainf-cta";
    cta.href = "/donate-now";
    var dot = document.createElement("span");
    dot.className = "ainf-dot";
    cta.appendChild(dot);
    cta.appendChild(document.createTextNode(" Support AINF"));
    right.appendChild(cta);

    nav.appendChild(brand);
    nav.appendChild(links);
    nav.appendChild(right);
    return nav;
  }

  function ensureNav() {
    var existing = document.getElementById(NAV_ID);
    // Prefer mounting on <html> so Framer body re-renders cannot wipe it
    var host = document.documentElement;
    if (existing) {
      if (existing.parentNode !== host) {
        host.appendChild(existing);
      }
      return existing;
    }
    var nav = buildNav();
    host.appendChild(nav);
    return nav;
  }

  function killOxiraNav() {
    var names = ["Navigation", "Navbar", "Nav Items", "Top", "Header", "Banner"];
    names.forEach(function (n) {
      document.querySelectorAll('[data-framer-name="' + n + '"]').forEach(function (el) {
        if (el.id === NAV_ID || (el.closest && el.closest("#" + NAV_ID))) return;
        el.setAttribute("data-ainf-hidden-nav", "1");
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("visibility", "hidden", "important");
        el.style.setProperty("pointer-events", "none", "important");
        el.style.setProperty("opacity", "0", "important");
        el.style.setProperty("position", "fixed", "important");
        el.style.setProperty("left", "-100vw", "important");
        el.style.setProperty("top", "-100vh", "important");
        el.style.setProperty("width", "0", "important");
        el.style.setProperty("height", "0", "important");
        el.style.setProperty("overflow", "hidden", "important");
        el.setAttribute("aria-hidden", "true");
      });
    });
  }

  function paintBrand() {
    var GREEN = "#39a46b";
    var BAD = {
      "rgb(4, 63, 45)": 1,
      "rgb(4, 64, 46)": 1,
      "rgb(29, 82, 66)": 1,
      "rgb(17, 115, 69)": 1,
    };
    document.querySelectorAll("a,button,div,span").forEach(function (el) {
      if (el.closest && el.closest("#" + NAV_ID)) return;
      try {
        var bg = getComputedStyle(el).backgroundColor;
        if (BAD[bg]) el.style.setProperty("background-color", GREEN, "important");
      } catch (e) {}
    });
  }

  function tick() {
    document.documentElement.classList.add("ainf-projects-skin");
    if (document.body) document.body.classList.add("ainf-projects-skin");
    ensureNav();
    killOxiraNav();
  }

  tick();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tick);
  }
  window.addEventListener("load", tick);

  // Framer hydrates ~0.5–2s later and may wipe body; keep restoring
  var i = 0;
  var timer = setInterval(function () {
    tick();
    i += 1;
    if (i > 40) clearInterval(timer); // ~8s
  }, 200);

  var mo = new MutationObserver(function () {
    if (!document.getElementById(NAV_ID) || document.getElementById(NAV_ID).parentNode !== document.documentElement) {
      ensureNav();
    }
    killOxiraNav();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  setTimeout(paintBrand, 600);
  setTimeout(paintBrand, 1800);
})();
