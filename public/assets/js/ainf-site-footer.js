/* Shared AINF footer — exact Hopper/home Framer clone for /projects only */
(function () {
  if (window.__ainfSiteFooterBooted) return;
  window.__ainfSiteFooterBooted = true;

  var path = (location.pathname || "/").replace(/\/$/, "") || "/";
  var isProjects = path === "/projects" || path.indexOf("/projects/") === 0;
  if (!isProjects) return;

  var FOOTER_ID = "ainf-site-footer";
  var FOOTER_VER = "5";

  function pathNorm() {
    return (location.pathname || "/").replace(/\/$/, "") || "/";
  }

  function isActive(href) {
    var p = pathNorm();
    if (!href || href.indexOf("http") === 0 || href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) {
      return false;
    }
    if (href === "/") return p === "/";
    if (href === "/projects") return p === "/projects" || p.indexOf("/projects/") === 0;
    return p === href || p.indexOf(href + "/") === 0;
  }

  function paintActiveLinks(footer) {
    footer.querySelectorAll("a[href]").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (isActive(href)) {
        a.setAttribute("data-framer-page-link-current", "true");
      } else {
        a.removeAttribute("data-framer-page-link-current");
      }
    });
  }

  function buildFooter() {
    var tpl = window.__AINF_FOOTER_TEMPLATE;
    if (!tpl) return null;
    var wrap = document.createElement("div");
    wrap.innerHTML = tpl.trim();
    var footer = wrap.firstElementChild;
    if (!footer) return null;
    footer.id = FOOTER_ID;
    footer.setAttribute("data-ainf-footer", "1");
    footer.setAttribute("data-ainf-ft-ver", FOOTER_VER);
    paintActiveLinks(footer);
    return footer;
  }

  function hideNativeFooters() {
    document.documentElement.classList.add("ainf-shared-footer");
    if (document.body) document.body.classList.add("ainf-shared-footer");

    var selectors = [
      '[data-framer-name="projects list footer"]',
      'footer[data-framer-name="Primary"]',
      'footer[data-framer-name="Container"]',
      'footer[data-framer-name="Bottom"]',
    ];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (el.id === FOOTER_ID) return;
        var t = el.textContent || "";
        if (
          /Our Projects|Projects That Create|Winter Relief|Medical Aid|Daily Meal|Education Support/i.test(t) &&
          !/Through AINF|Privacy & Policy|100k\+|Youtube|X \/ Twitter/i.test(t)
        ) {
          return;
        }
        el.setAttribute("data-ainf-oxira-footer", "1");
        el.style.setProperty("display", "none", "important");
      });
    });
  }

  function ensureFooter() {
    hideNativeFooters();
    var existing = document.getElementById(FOOTER_ID);
    if (existing) {
      var ver = existing.getAttribute("data-ainf-ft-ver");
      var hopper = existing.classList.contains("framer-KyKwn");
      if (ver !== FOOTER_VER || !hopper) {
        existing.remove();
        existing = null;
      }
    }
    if (existing) {
      paintActiveLinks(existing);
      if (existing.parentNode !== document.body && document.body) {
        document.body.appendChild(existing);
      }
      return existing;
    }
    if (!document.body || !window.__AINF_FOOTER_TEMPLATE) return null;
    var footer = buildFooter();
    if (!footer) return null;
    document.body.appendChild(footer);
    return footer;
  }

  function tick() {
    ensureFooter();
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
    if (i > 40) clearInterval(timer);
  }, 250);

  var mo = new MutationObserver(function () {
    hideNativeFooters();
    ensureFooter();
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  else
    document.addEventListener("DOMContentLoaded", function () {
      mo.observe(document.body, { childList: true, subtree: true });
    });

  window.__ainfEnsureSiteFooter = ensureFooter;
})();
