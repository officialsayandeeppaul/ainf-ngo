/* Persistent AINF pill navbar for /projects — survives Framer hydration */
(function () {
  if (window.__ainfProjectsNavBooted) return;
  window.__ainfProjectsNavBooted = true;
  // Shared AINF pill owns chrome on every page — this file is a leftover
  // and must never hide Framer "Top" (the projects content wrapper).
  if (window.__ainfSiteNavBooted || document.getElementById("ainf-global-nav")) return;

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
    img.src = "/assets/img/theainf-logo.webp";
    img.alt = "AINF";
    img.width = 40;
    img.height = 40;
    var name = document.createElement("span");
    name.className = "ainf-brand-text";
    name.textContent = "AINF";
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
    var names = ["Navigation", "Navbar", "Nav Items", "Header", "Banner"];
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

  function paintBrand() {}

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
  [600, 1600, 2800].forEach(function (ms) {
    setTimeout(tick, ms);
  });

  var moTimer = 0;
  var mo = new MutationObserver(function () {
    if (moTimer) return;
    moTimer = setTimeout(function () {
      moTimer = 0;
      if (!document.getElementById(NAV_ID) || document.getElementById(NAV_ID).parentNode !== document.documentElement) {
        ensureNav();
      }
    }, 220);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () {
    mo.disconnect();
  }, 4500);
})();
