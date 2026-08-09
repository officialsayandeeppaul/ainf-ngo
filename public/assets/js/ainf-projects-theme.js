/* Replace Oxira footer + polish buttons on /projects pages */
(function () {
  if (window.__ainfProjectsThemeBooted) return;
  window.__ainfProjectsThemeBooted = true;

  var path = (location.pathname || "/").replace(/\/$/, "") || "/";
  var isProjects = path === "/projects" || path.indexOf("/projects/") === 0;
  if (!isProjects) return;

  function buildFooter() {
    var footer = document.createElement("footer");
    footer.id = "ainf-site-footer";
    footer.setAttribute("data-ainf-footer", "1");
    footer.innerHTML =
      '<div class="ainf-ft-inner">' +
      '<div class="ainf-ft-brand">' +
      '<a class="ainf-ft-logo" href="/"><img src="/assets/img/theainf-mark.svg" alt="" width="28" height="28"/><span>theainf</span></a>' +
      '<p class="ainf-ft-tag">All Indian Nevarlands Foundation works from Jamtara outward — classrooms, skill labs, job linkages, and village welfare.</p>' +
      '<p class="ainf-ft-copy">© 2026 theainf. All rights reserved</p>' +
      "</div>" +
      '<div class="ainf-ft-col"><h4>Menu</h4>' +
      '<a href="/">Home</a><a href="/about-us">About AINF</a><a href="/causes">Missions</a><a href="/projects">Projects</a><a href="/blogs">Stories</a></div>' +
      '<div class="ainf-ft-col"><h4>Quick Links</h4>' +
      '<a href="/contact-us">Contact</a><a href="/donate-now">Support AINF</a><a href="/join-as-volunteer">Join as Field Sevak</a><a href="/legal-pages/terms-conditions">Terms &amp; Conditions</a></div>' +
      '<div class="ainf-ft-col"><h4>Contact</h4>' +
      '<a href="mailto:uiuxocean@gmail.com">uiuxocean@gmail.com</a><a href="tel:+919574468870">+91 95744 68870</a><a href="/contact-us">Reach Us</a></div>' +
      "</div>" +
      '<div class="ainf-ft-bottom">' +
      '<p class="ainf-ft-copy" style="margin:0">We are a non-profit organization dedicated to providing education, healthcare &amp; support.</p>' +
      '<div class="ainf-ft-social">' +
      '<a href="/donate-now">Support AINF</a>' +
      '<a href="/join-as-volunteer">Volunteer</a>' +
      '<a href="/contact-us">Contact</a>' +
      "</div></div>";
    return footer;
  }

  function killOxiraFooter() {
    document.querySelectorAll('[data-framer-name="projects list footer"]').forEach(function (el) {
      var node = el;
      for (var i = 0; i < 10 && node; i++) {
        var name = node.getAttribute && node.getAttribute("data-framer-name");
        if (name === "Bottom") break;
        node = node.parentElement;
      }
      try {
        (node || el).remove();
      } catch (e) {
        el.style.setProperty("display", "none", "important");
      }
    });

    document.querySelectorAll('[data-framer-name="Bottom"]').forEach(function (el) {
      var t = el.textContent || "";
      if (/Oxira|Ostra|xira|All Rights Reserved|Youtube|X \/ Twitter/i.test(t)) {
        try {
          el.remove();
        } catch (e) {
          el.style.setProperty("display", "none", "important");
        }
      }
    });

    // leftover brand bits
    document.querySelectorAll("p, span, a, strong").forEach(function (el) {
      var t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (/^@?Oxira\b/i.test(t) || t === "Ostra Supporter" || t === "xira") {
        var wrap = el.closest('[data-framer-name]') || el;
        try {
          wrap.remove();
        } catch (e) {
          el.style.setProperty("display", "none", "important");
        }
      }
    });
  }

  function ensureFooter() {
    killOxiraFooter();
    if (!document.getElementById("ainf-site-footer")) {
      var host = document.body || document.documentElement;
      host.appendChild(buildFooter());
    }
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
      if (next !== v) node.nodeValue = next;
    }
  }

  function tick() {
    ensureFooter();
    restyleButtons();
    rebrandCopy();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick);
  else tick();
  window.addEventListener("load", tick);
  var i = 0;
  var timer = setInterval(function () {
    tick();
    i += 1;
    if (i > 40) clearInterval(timer);
  }, 250);
  var mo = new MutationObserver(function () {
    killOxiraFooter();
    if (!document.getElementById("ainf-site-footer") && document.body) {
      document.body.appendChild(buildFooter());
    }
    restyleButtons();
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  else
    document.addEventListener("DOMContentLoaded", function () {
      mo.observe(document.body, { childList: true, subtree: true });
    });
})();
