/* Projects-only polish: INR currency, piggy raised badges, solid CTAs, kill Oxira chrome */
(function () {
  if (window.__ainfProjectsThemeBooted) return;
  window.__ainfProjectsThemeBooted = true;

  var path = (location.pathname || "/").replace(/\/$/, "") || "/";
  var isProjects = path === "/projects" || path.indexOf("/projects/") === 0;
  if (!isProjects) return;

  var PIGGY =
    '<svg class="ainf-piggy" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
    '<path fill="#fff" d="M19.4 10.2c-.3-1.5-1.3-2.7-2.6-3.3.2-.4.3-.8.3-1.2 0-1.3-1-2.3-2.3-2.3-.5 0-1 .2-1.4.5C12.7 3.3 11.9 3 11 3c-1.7 0-3.1 1.2-3.4 2.8C6.4 6.1 5.5 7 5.1 8.1 3.9 8.5 3 9.6 3 11c0 .4.1.8.2 1.2H2v2h1.1c.3 1.1.9 2 1.8 2.6L3.6 18l1.4 1.4 1.4-1.4c.7.3 1.4.5 2.2.5v1.5h2V18.5c.4 0 .8-.1 1.2-.2.5.4 1.1.7 1.8.7.4 0 .8-.1 1.1-.2l1.3 1.3 1.4-1.4-1.2-1.2c.7-.7 1.2-1.6 1.4-2.6H22v-2h-1.3c.2-.4.3-.8.3-1.2 0-.5-.1-1-.3-1.4zM9.5 12.2a1 1 0 110-2 1 1 0 010 2z"/>' +
    "</svg>";

  function looksLikePageContent(el) {
    var t = el.textContent || "";
    return /Our Projects|Winter Relief|Medical Aid|Daily Meal|Education Support|Hear from|Projects That Create|Support a Project/i.test(
      t
    );
  }

  function killOxiraNode(el) {
    if (!el || el.id === "ainf-site-footer") return;
    if (looksLikePageContent(el)) return;
    el.setAttribute("data-ainf-oxira-footer", "1");
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("height", "0", "important");
    el.style.setProperty("max-height", "0", "important");
    el.style.setProperty("overflow", "hidden", "important");
    el.style.setProperty("pointer-events", "none", "important");
    el.style.setProperty("margin", "0", "important");
    el.style.setProperty("padding", "0", "important");
  }

  function isOxiraFooterText(t) {
    return /Through AINF|100k\+|Privacy & Policy|All Rights Reserved|@Oxira|X \/ Twitter|Youtube|Help FAQ|How It Works/i.test(
      t || ""
    );
  }

  function hideOxiraFooterOnly() {
    document.querySelectorAll('[data-framer-name="projects list footer"]').forEach(killOxiraNode);

    document
      .querySelectorAll(
        "footer[data-framer-name='Primary'], footer[data-framer-name='Container'], footer[data-framer-name='Bottom']"
      )
      .forEach(function (el) {
        if (el.id === "ainf-site-footer") return;
        if (looksLikePageContent(el)) return;
        if (isOxiraFooterText(el.textContent)) killOxiraNode(el);
      });

    document.querySelectorAll('[data-framer-name="Bottom"]').forEach(function (el) {
      if (looksLikePageContent(el)) return;
      if (isOxiraFooterText(el.textContent) || /xira|Donate/i.test(el.textContent || "")) {
        killOxiraNode(el);
      }
    });

    document.querySelectorAll("p, span, a, h1, h2, h3, h4").forEach(function (el) {
      if (el.closest && el.closest("#ainf-site-footer, #ainf-global-nav")) return;
      var t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (t === "xira" || t === "Oxira" || /^@Oxira/i.test(t)) {
        var wrap =
          el.closest("footer[data-framer-name]") ||
          el.closest('[data-framer-name="Bottom"]') ||
          el.closest("[data-ainf-oxira-footer]") ||
          el;
        killOxiraNode(wrap);
      }
    });
  }

  function convertToInr() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement) continue;
      if (node.parentElement.closest("#ainf-global-nav, #ainf-site-footer, script, style")) continue;
      var v = node.nodeValue;
      if (!v) continue;
      var trimmed = v.trim();
      if (trimmed === "$" || trimmed === "US$" || trimmed === "USD") {
        node.nodeValue = v.replace(trimmed, "₹");
        continue;
      }
      if (/\$/.test(v) && !/₹/.test(v)) {
        node.nodeValue = v.replace(/\$/g, "₹");
      }
    }
  }

  function injectPiggyIcons() {
    // ONLY raised-amount badges (Icon & title). Never status dots / hero spheres.
    document
      .querySelectorAll('[data-framer-name="Icon & title"] > [data-framer-name="Icon Sphere"]')
      .forEach(function (sphere) {
        if (sphere.getAttribute("data-ainf-piggy") === "1") return;
        // Skip status / live indicators even if nested under Icon & title
        var near = (sphere.parentElement && sphere.parentElement.textContent) || "";
        if (/Current Status|:\s*Live/i.test(near) && !/Raised/i.test(near)) return;

        sphere.setAttribute("data-ainf-piggy", "1");
        sphere.style.setProperty("display", "inline-flex", "important");
        sphere.style.setProperty("align-items", "center", "important");
        sphere.style.setProperty("justify-content", "center", "important");
        sphere.style.setProperty("background", "#39a46b", "important");
        sphere.style.setProperty("background-image", "none", "important");
        sphere.style.setProperty("border-radius", "999px", "important");
        sphere.querySelectorAll("svg, img, [data-framer-name]").forEach(function (child) {
          if (child.classList && child.classList.contains("ainf-piggy")) return;
          child.style.setProperty("display", "none", "important");
        });
        if (!sphere.querySelector(".ainf-piggy")) {
          sphere.insertAdjacentHTML("beforeend", PIGGY);
        }
      });
  }

  function restyleButtons() {
    document.querySelectorAll('[data-framer-name="Primary btn"]').forEach(function (btn) {
      btn.style.setProperty("backdrop-filter", "none", "important");
      btn.style.setProperty("-webkit-backdrop-filter", "none", "important");
      btn.style.setProperty("background", "#39a46b", "important");
      btn.style.setProperty("background-image", "none", "important");
      btn.style.setProperty("box-shadow", "none", "important");
      btn.style.setProperty("border-radius", "999px", "important");
      btn.querySelectorAll("p, span").forEach(function (t) {
        var label = (t.textContent || "").trim();
        if (label === "Donate now") t.textContent = "Support AINF";
        t.style.setProperty("color", "#fff", "important");
        t.style.setProperty("-webkit-text-fill-color", "#fff", "important");
      });
    });
  }

  function rebrandCopy() {
    var map = [
      ["Ostra Supporter", "AINF Supporter"],
      ["Volunteer at Ostra", "Volunteer at AINF"],
      ["Ostra,", "AINF,"],
      ["Ostra", "AINF"],
      ["@Oxira 2026", "© 2026 theainf"],
      ["Oxira", "AINF"],
      ["Donate now", "Support AINF"],
    ];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement) continue;
      if (node.parentElement.closest("#ainf-global-nav, #ainf-site-footer, script, style")) continue;
      var v = node.nodeValue;
      if (!v) continue;
      var next = v;
      map.forEach(function (pair) {
        if (next.indexOf(pair[0]) >= 0) next = next.split(pair[0]).join(pair[1]);
      });
      next = next.replace(/\bOstra\b/gi, "AINF").replace(/\bOxira\b/gi, "AINF");
      if (next !== v) node.nodeValue = next;
    }
  }

  function tick() {
    hideOxiraFooterOnly();
    convertToInr();
    injectPiggyIcons();
    restyleButtons();
    rebrandCopy();
    if (window.__ainfEnsureSiteFooter) window.__ainfEnsureSiteFooter();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick);
  else tick();
  window.addEventListener("load", tick);
  var i = 0;
  var timer = setInterval(function () {
    tick();
    i += 1;
    if (i > 40) clearInterval(timer);
  }, 300);

  var mo = new MutationObserver(function () {
    hideOxiraFooterOnly();
    convertToInr();
    injectPiggyIcons();
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  else
    document.addEventListener("DOMContentLoaded", function () {
      mo.observe(document.body, { childList: true, subtree: true });
    });
})();
