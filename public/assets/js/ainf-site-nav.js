/* Shared AINF pill navbar — one component for every page */
(function () {
  if (window.__ainfSiteNavBooted) return;
  window.__ainfSiteNavBooted = true;

  var NAV_ID = "ainf-global-nav";
  var BRAND_LOGO = "/assets/img/theainf-logo.webp";
  var path = (location.pathname || "/").replace(/\/$/, "") || "/";
  var isProjects = path === "/projects" || path.indexOf("/projects/") === 0;

  function brandHTML() {
    return (
      '<img src="' +
      BRAND_LOGO +
      '" alt="AINF" width="36" height="36" decoding="async"/>' +
      '<span class="ainf-brand-text">AINF</span>'
    );
  }

  function applyBrandToLink(link) {
    if (!link || link.getAttribute("data-ainf-brand-sync") === "1") return false;
    link.setAttribute("data-ainf-brand-sync", "1");
    link.classList.add("ainf-brand", "ainf-ft-logo");
    link.innerHTML = brandHTML();
    link.setAttribute("aria-label", "AINF home");
    return true;
  }

  function findFooterLogoLink(top) {
    if (!top) return null;
    return (
      top.querySelector('[data-framer-name="Details Top"] a[href]') ||
      top.querySelector(".framer-stohzb-container a[href]") ||
      top.querySelector("a.framer-sLb0B") ||
      top.querySelector('a[aria-label="Home"]')
    );
  }

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
    brand.innerHTML = brandHTML();
    brand.querySelector("img").setAttribute("fetchpriority", "high");

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
      a.setAttribute("data-ainf-i18n", item[0]);
      if (isCurrent(item[1])) a.setAttribute("aria-current", "page");
      links.appendChild(a);
    });

    var right = document.createElement("div");
    right.className = "ainf-right";
    right.setAttribute("data-ainf-nav-right", "1");

    var cta = document.createElement("a");
    cta.className = "ainf-cta";
    cta.href = "/donate-now";
    cta.setAttribute("data-ainf-i18n", "Support AINF");
    var ico = document.createElement("span");
    ico.className = "ainf-cta-ico";
    ico.setAttribute("aria-hidden", "true");
    ico.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
      '<path fill="#39a46b" d="M19.4 10.2c-.3-1.5-1.3-2.7-2.6-3.3.2-.4.3-.8.3-1.2 0-1.3-1-2.3-2.3-2.3-.5 0-1 .2-1.4.5C12.7 3.3 11.9 3 11 3c-1.7 0-3.1 1.2-3.4 2.8C6.4 6.1 5.5 7 5.1 8.1 3.9 8.5 3 9.6 3 11c0 .4.1.8.2 1.2H2v2h1.1c.3 1.1.9 2 1.8 2.6L3.6 18l1.4 1.4 1.4-1.4c.7.3 1.4.5 2.2.5v1.5h2V18.5c.4 0 .8-.1 1.2-.2.5.4 1.1.7 1.8.7.4 0 .8-.1 1.1-.2l1.3 1.3 1.4-1.4-1.2-1.2c.7-.7 1.2-1.6 1.4-2.6H22v-2h-1.3c.2-.4.3-.8.3-1.2 0-.5-.1-1-.3-1.4zM9.5 12.2a1 1 0 110-2 1 1 0 010 2z"/>' +
      "</svg>";
    cta.appendChild(ico);
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
    // Never kill "Top" — on Oxira/projects it wraps the main page content.
    var selectors = [
      '[data-framer-name="Nav"]',
      '[data-framer-name="Navigation"]',
      '[data-framer-name="Navbar"]',
      '[data-framer-name="Nav Items"]',
      '[data-framer-name="Header"]',
      '[data-framer-name="Banner"]',
      'header[data-framer-name="Desktop"]',
      'nav[data-framer-name="Navigation"]',
      'header',
    ];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (!shouldKill(el)) return;
        // Keep page <header> only if it's Framer template chrome near top
        if (sel === "header") {
          var r = el.getBoundingClientRect();
          var t = el.textContent || "";
          if (!(r.top < 120 && (/Why Us|Impact|Donate now|Nav Items|Support AINF/i.test(t) || el.querySelector('[data-framer-name="Navigation"]')))) {
            return;
          }
        }
        try {
          el.remove();
        } catch (e) {
          el.style.setProperty("display", "none", "important");
        }
      });
    });

    // Kill escaped leftover CTA labels from Oxira (top-left blue text / sticky orphans)
    document.querySelectorAll("a").forEach(function (el) {
      if (!shouldKill(el)) return;
      if (el.closest && el.closest("#" + NAV_ID + ", #ainf-site-footer")) return;
      // Keep real project CTAs (Primary btn / green pills)
      if (el.getAttribute("data-framer-name") === "Primary btn") return;
      var t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (
        t !== "Support AINF" &&
        t !== "Donate now" &&
        t !== "• Support AINF" &&
        t !== "Support a Project"
      ) {
        return;
      }
      var r = el.getBoundingClientRect();
      var color = "";
      try {
        color = getComputedStyle(el).color || "";
      } catch (e) {}
      var isDefaultBlue = color === "rgb(0, 0, 238)" || color === "rgb(0,0,238)";
      // orphans under the floating pill / left rail (body pad is ~132px)
      var nearTop = r.top < 220;
      var leftRail = r.left < 40 && r.width < 120;
      if (nearTop || leftRail || isDefaultBlue) {
        try {
          el.remove();
        } catch (e) {
          el.style.setProperty("display", "none", "important");
          el.style.setProperty("visibility", "hidden", "important");
          el.style.setProperty("height", "0", "important");
          el.style.setProperty("overflow", "hidden", "important");
        }
      }
    });
  }

  function paintProjectsBrand() {
    // Intentionally no-op: painting all matching backgrounds to #39a46b
    // was destroying white project cards / progress bars.
  }

  function syncHopperFooterBrand() {
    if (isProjects) return;
    document.querySelectorAll('[data-framer-name="Footer Top"]').forEach(function (top) {
      var link = findFooterLogoLink(top);
      if (!applyBrandToLink(link)) return;
      top.querySelectorAll(
        '[data-framer-component-type="SVG"], [data-framer-name="Logo"], .framer-1yg9568, .svgContainer'
      ).forEach(function (el) {
        el.style.setProperty("display", "none", "important");
      });
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
    syncHopperFooterBrand();
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
    if (i > 16) clearInterval(timer);
  }, 300);

  var moTimer = 0;
  var mo = new MutationObserver(function () {
    if (moTimer) return;
    moTimer = setTimeout(function () {
      moTimer = 0;
      if (!document.getElementById(NAV_ID) || document.getElementById(NAV_ID).parentNode !== document.documentElement) {
        ensureNav();
      }
      killTemplateNavs();
      syncHopperFooterBrand();
    }, 180);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  setTimeout(paintProjectsBrand, 600);
  setTimeout(paintProjectsBrand, 1800);

  // Expose for language switcher
  window.__ainfEnsureSiteNav = ensureNav;
})();
