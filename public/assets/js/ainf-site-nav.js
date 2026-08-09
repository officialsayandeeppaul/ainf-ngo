/* Shared AINF pill navbar — one component for every page */
(function () {
  if (window.__ainfSiteNavBooted) return;
  window.__ainfSiteNavBooted = true;

  var NAV_ID = "ainf-global-nav";
  var path = (location.pathname || "/").replace(/\/$/, "") || "/";
  var isProjects = path === "/projects" || path.indexOf("/projects/") === 0;

  function isCurrent(href) {
    if (href === "/projects") return isProjects;
    if (href === "/") return path === "/";
    return path === href || path.indexOf(href + "/") === 0;
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
    img.src = "/assets/img/theainf-mark.svg";
    img.alt = "";
    img.width = 28;
    img.height = 28;
    img.decoding = "async";
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
      var a = document.createElement("a");
      a.href = item[1];
      a.textContent = item[0];
      if (isCurrent(item[1])) a.setAttribute("aria-current", "page");
      links.appendChild(a);
    });

    var right = document.createElement("div");
    right.className = "ainf-right";
    right.setAttribute("data-ainf-nav-right", "1");

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
    var host = document.documentElement;
    var existing = document.getElementById(NAV_ID);
    if (existing) {
      if (existing.parentNode !== host) host.appendChild(existing);
      return existing;
    }
    var nav = buildNav();
    host.appendChild(nav);
    return nav;
  }

  function shouldKill(el) {
    if (!el || el.id === NAV_ID) return false;
    if (el.closest && el.closest("#" + NAV_ID)) return false;
    return true;
  }

  function killTemplateNavs() {
    var selectors = [
      '[data-framer-name="Nav"]',
      '[data-framer-name="Navigation"]',
      '[data-framer-name="Navbar"]',
      '[data-framer-name="Nav Items"]',
      '[data-framer-name="Top"]',
      '[data-framer-name="Header"]',
      '[data-framer-name="Banner"]',
      'header[data-framer-name="Desktop"]',
      'nav[data-framer-name="Navigation"]',
    ];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (!shouldKill(el)) return;
        try {
          el.remove();
        } catch (e) {
          el.style.setProperty("display", "none", "important");
        }
      });
    });

    // Kill escaped leftover CTA labels from Oxira (top-left blue text)
    document.querySelectorAll("a, p, span, div").forEach(function (el) {
      if (!shouldKill(el)) return;
      if (el.id === NAV_ID || (el.closest && el.closest("#" + NAV_ID))) return;
      var t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (t !== "Support AINF" && t !== "Donate now" && t !== "• Support AINF") return;
      // only nuke tiny leftover nodes (not big page sections)
      if (el.children && el.children.length > 3) return;
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        try {
          el.remove();
        } catch (e) {}
        return;
      }
      if (r.top < 140 && (r.left < 220 || r.right > window.innerWidth - 40)) {
        var victim =
          el.closest("a") ||
          el.closest('[data-framer-name]') ||
          el.closest(".framer-1alz978-container, .framer-l21yr0-container, .framer-gc2xy7-container") ||
          el;
        try {
          victim.remove();
        } catch (e) {
          el.style.setProperty("display", "none", "important");
        }
      }
    });
  }

  function paintProjectsBrand() {
    if (!isProjects) return;
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
    document.documentElement.classList.add("ainf-shared-nav");
    if (document.body) document.body.classList.add("ainf-shared-nav");
    if (isProjects) {
      document.documentElement.classList.add("ainf-projects-skin");
      if (document.body) document.body.classList.add("ainf-projects-skin");
    }
    ensureNav();
    killTemplateNavs();
  }

  tick();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tick);
  }
  window.addEventListener("load", tick);

  var i = 0;
  var timer = setInterval(function () {
    tick();
    i += 1;
    if (i > 50) clearInterval(timer);
  }, 200);

  var mo = new MutationObserver(function () {
    if (!document.getElementById(NAV_ID) || document.getElementById(NAV_ID).parentNode !== document.documentElement) {
      ensureNav();
    }
    killTemplateNavs();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  setTimeout(paintProjectsBrand, 600);
  setTimeout(paintProjectsBrand, 1800);

  // Expose for language switcher
  window.__ainfEnsureSiteNav = ensureNav;
})();
