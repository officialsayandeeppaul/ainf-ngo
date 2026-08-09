/* Replace Oxira footer + polish buttons on /projects — keep page content intact */
(function () {
  if (window.__ainfProjectsThemeBooted) return;
  window.__ainfProjectsThemeBooted = true;

  var path = (location.pathname || "/").replace(/\/$/, "") || "/";
  var isProjects = path === "/projects" || path.indexOf("/projects/") === 0;
  if (!isProjects) return;

  var ARROW =
    '<svg class="ainf-ft-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICO_MAIL =
    '<svg class="ainf-ft-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></svg>';
  var ICO_PHONE =
    '<svg class="ainf-ft-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6.5 3.5l2.2 2.2a1.5 1.5 0 010 2.1L7.5 9c1.6 3.1 4.4 5.9 7.5 7.5l1.2-1.2a1.5 1.5 0 012.1 0l2.2 2.2a1.5 1.5 0 010 2.1l-1.1 1.1c-.9.9-2.2 1.2-3.4.8C10.2 19.7 4.3 13.8 2.5 7.5c-.4-1.2-.1-2.5.8-3.4l1.1-1.1a1.5 1.5 0 012.1 0z"/></svg>';
  var ICO_PIN =
    '<svg class="ainf-ft-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';

  function buildFooter() {
    var footer = document.createElement("footer");
    footer.id = "ainf-site-footer";
    footer.setAttribute("data-ainf-footer", "1");
    footer.innerHTML =
      '<div class="ainf-ft-wrap">' +
      '<div class="ainf-ft-row">' +
      '<div class="ainf-ft-card ainf-ft-brand-card">' +
      '<div><a class="ainf-ft-logo" href="/"><img src="/assets/img/theainf-mark.svg" alt="" width="28" height="28"/><span>theainf</span><span class="ainf-ft-badge">AINF</span></a>' +
      '<p class="ainf-ft-tag">We are a non-profit organization dedicated to providing education, healthcare &amp; support.</p></div>' +
      '<p class="ainf-ft-copy">© 2026 theainf · All Indian Nevarlands Foundation · theainf.in</p>' +
      "</div>" +
      '<div class="ainf-ft-card ainf-ft-nav-card">' +
      '<div class="ainf-ft-col"><h4>Menu</h4>' +
      '<a href="/">Home</a><a href="/about-us">About AINF</a><a href="/causes">Missions</a><a class="is-active" href="/projects">Projects</a><a href="/blogs">Stories</a></div>' +
      '<div class="ainf-ft-col"><h4>Quick Links</h4>' +
      '<a href="/contact-us">Contact</a><a href="/donate-now">Support AINF</a><a href="/join-as-volunteer">Join as Field Sevak</a><a href="/legal-pages/terms-conditions">Terms &amp; Conditions</a></div>' +
      '<div class="ainf-ft-col"><h4>Contact</h4>' +
      '<a class="ainf-ft-contact-row" href="mailto:uiuxocean@gmail.com">' +
      ICO_MAIL +
      "<span>uiuxocean@gmail.com</span></a>" +
      '<a class="ainf-ft-contact-row" href="tel:+919574468870">' +
      ICO_PHONE +
      "<span>+91 95744 68870</span></a>" +
      '<div class="ainf-ft-contact-row">' +
      ICO_PIN +
      "<span>Surat, India</span></div>" +
      "</div></div></div>" +
      '<div class="ainf-ft-social">' +
      '<a href="https://www.linkedin.com/" target="_blank" rel="noopener">LinkedIn' +
      ARROW +
      "</a>" +
      '<a href="https://www.instagram.com/" target="_blank" rel="noopener">Instagram' +
      ARROW +
      "</a>" +
      '<a href="https://x.com/" target="_blank" rel="noopener">X' +
      ARROW +
      "</a>" +
      '<a href="https://www.facebook.com/" target="_blank" rel="noopener">Facebook' +
      ARROW +
      "</a>" +
      "</div></div>";
    return footer;
  }

  function looksLikePageContent(el) {
    var t = el.textContent || "";
    return /Our Projects|Winter Relief|Medical Aid|Daily Meal|Education Support|Hear from|Projects That Create|Support a Project/i.test(
      t
    );
  }

  function hideOxiraFooterOnly() {
    // Hide the Oxira link-columns footer block — do NOT walk up into page content.
    document.querySelectorAll('[data-framer-name="projects list footer"]').forEach(function (el) {
      el.setAttribute("data-ainf-oxira-footer", "1");
      el.style.setProperty("display", "none", "important");
    });

    // Green Oxira Bottom strip — only if it is footer-like and not page content
    document.querySelectorAll('[data-framer-name="Bottom"]').forEach(function (el) {
      if (looksLikePageContent(el)) return;
      var t = el.textContent || "";
      if (
        /All Rights Reserved|Youtube|X \/ Twitter|@Oxira|© 2026 theainf|Medical Aid & Health Camps/i.test(t) &&
        /Instagram|Youtube|Twitter|FAQ|Privacy|Terms of Use|Help/i.test(t)
      ) {
        el.setAttribute("data-ainf-oxira-footer", "1");
        el.style.setProperty("display", "none", "important");
      }
    });
  }

  function ensureFooter() {
    hideOxiraFooterOnly();
    if (!document.getElementById("ainf-site-footer")) {
      (document.body || document.documentElement).appendChild(buildFooter());
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
    if (i > 30) clearInterval(timer);
  }, 300);

  var mo = new MutationObserver(function () {
    hideOxiraFooterOnly();
    if (!document.getElementById("ainf-site-footer") && document.body) {
      document.body.appendChild(buildFooter());
    }
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  else
    document.addEventListener("DOMContentLoaded", function () {
      mo.observe(document.body, { childList: true, subtree: true });
    });
})();
