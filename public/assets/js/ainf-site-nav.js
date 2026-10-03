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
      '" alt="AINF" width="40" height="40" decoding="async"/>' +
      '<span class="ainf-brand-text">AINF</span>'
    );
  }

  function applyBrandToLink(link) {
    if (!link) return false;
    link.classList.add("ainf-brand", "ainf-ft-logo");
    link.setAttribute("aria-label", "AINF home");
    var img = link.querySelector("img");
    var src = img ? img.getAttribute("src") || "" : "";
    if (img && src.indexOf("theainf-logo.webp") !== -1 && link.querySelector(".ainf-brand-text")) {
      if (src !== BRAND_LOGO) img.setAttribute("src", BRAND_LOGO);
      img.setAttribute("width", "40");
      img.setAttribute("height", "40");
      img.setAttribute("alt", "AINF");
      link.setAttribute("data-ainf-brand-sync", "1");
      return false;
    }
    link.innerHTML = brandHTML();
    link.setAttribute("data-ainf-brand-sync", "1");
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

    var menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "ainf-menu-btn";
    menuBtn.setAttribute("aria-label", "Open menu");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-controls", "ainf-nav-links");
    menuBtn.innerHTML =
      '<svg class="ainf-menu-bars" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
      "</svg>" +
      '<svg class="ainf-menu-x" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
      "</svg>";

    var links = document.createElement("nav");
    links.className = "ainf-links";
    links.id = "ainf-nav-links";
    links.setAttribute("aria-label", "Primary");
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

    // Portal entry point. Always /account: the server redirects signed-out
    // visitors to /sign-in, so these static pages need no auth state.
    var account = document.createElement("a");
    account.className = "ainf-account";
    account.href = "/account";
    account.setAttribute("data-ainf-i18n", "Account");
    account.setAttribute("aria-label", "Your account");
    account.innerHTML =
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">' +
      '<circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M5 20c0-3.4 3.1-5.6 7-5.6s7 2.2 7 5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      "</svg>" +
      '<span class="ainf-account-text">Account</span>';
    right.appendChild(account);

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
    var full = document.createElement("span");
    full.className = "ainf-cta-full";
    full.textContent = "Support AINF";
    var short = document.createElement("span");
    short.className = "ainf-cta-short";
    short.setAttribute("aria-hidden", "true");
    short.textContent = "Support";
    cta.appendChild(full);
    cta.appendChild(short);
    right.appendChild(cta);

    nav.appendChild(brand);
    nav.appendChild(links);
    nav.appendChild(right);
    nav.appendChild(menuBtn);
    return nav;
  }

  function setMenuOpen(nav, open) {
    var btn = nav.querySelector(".ainf-menu-btn");
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("ainf-nav-open", open);
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
  }

  function bindMobileMenu(nav) {
    if (!nav || nav.getAttribute("data-ainf-menu-bound") === "1") return;
    var btn = nav.querySelector(".ainf-menu-btn");
    if (!btn) return;
    nav.setAttribute("data-ainf-menu-bound", "1");
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(nav, !nav.classList.contains("is-open"));
    });
    Array.prototype.forEach.call(nav.querySelectorAll(".ainf-links a"), function (a) {
      a.addEventListener("click", function () {
        setMenuOpen(nav, false);
      });
    });
    document.addEventListener("click", function (e) {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(e.target)) return;
      setMenuOpen(nav, false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenuOpen(nav, false);
    });
  }

  function ensureMobileMenu(nav) {
    if (!nav) return;
    var links = nav.querySelector(".ainf-links");
    if (links && !links.id) links.id = "ainf-nav-links";
    var btn = nav.querySelector(".ainf-menu-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ainf-menu-btn";
      btn.setAttribute("aria-label", "Open menu");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", "ainf-nav-links");
      btn.innerHTML =
        '<svg class="ainf-menu-bars" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
        "</svg>" +
        '<svg class="ainf-menu-x" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
        "</svg>";
      nav.appendChild(btn);
    } else if (btn !== nav.lastElementChild) {
      nav.appendChild(btn);
    }
    bindMobileMenu(nav);
  }

  function ensureNav() {
    var host = document.documentElement;
    var existing = document.getElementById(NAV_ID);
    if (existing) {
      if (existing.parentNode !== host) host.appendChild(existing);
      applyBrandToLink(existing.querySelector("a.ainf-brand"));
      ensureMobileMenu(existing);
      return existing;
    }
    var nav = buildNav();
    host.appendChild(nav);
    ensureMobileMenu(nav);
    return nav;
  }

  function shouldKill(el) {
    if (!el || el.id === NAV_ID || el.id === "ainf-support-banner") return false;
    if (el.closest && el.closest("#" + NAV_ID + ", #ainf-support-banner")) return false;
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
      if (el.closest && el.closest("#" + NAV_ID + ", #ainf-support-banner, #ainf-site-footer")) return;
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
    document.querySelectorAll('[data-framer-name="Footer Top"], #ainf-site-footer').forEach(function (top) {
      var link = findFooterLogoLink(top) || top.querySelector("a.ainf-brand, a.ainf-ft-logo, [data-framer-name='Details Top'] a[href]");
      applyBrandToLink(link);
      top.querySelectorAll(
        '[data-framer-name="Details Top"] svg, [data-framer-name="Details Top"] [data-framer-component-type="SVG"], [data-framer-name="Details Top"] [data-framer-name="Logo"], [data-framer-name="Details Top"] .framer-1yg9568, [data-framer-name="Details Top"] .svgContainer'
      ).forEach(function (el) {
        if (el.closest && el.closest("a.ainf-brand, a.ainf-ft-logo")) return;
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("visibility", "hidden", "important");
      });
      top.querySelectorAll(".ainf-brand-text, .ainf-ft-brand-text").forEach(function (el) {
        if ((el.textContent || "").trim() !== "AINF") el.textContent = "AINF";
      });
    });
  }

  var accountState = null;
  var accountFetchStarted = false;

  function clerkKey() {
    var script = document.getElementById("ainf-site-nav-js");
    return script ? script.getAttribute("data-clerk-key") || "" : "";
  }

  function hasClerkClient() {
    var parts = (document.cookie || "").split(";");
    for (var i = 0; i < parts.length; i++) {
      var bit = parts[i].trim();
      if (bit.indexOf("__client_uat=") !== 0 && bit.indexOf("__client_uat_") !== 0) continue;
      var value = decodeURIComponent(bit.split("=").slice(1).join("=") || "");
      if (value && value !== "0") return true;
    }
    return false;
  }

  function renderAccount() {
    var account = document.querySelector("#" + NAV_ID + " .ainf-account");
    if (!account || !accountState || !accountState.signedIn) return;
    account.classList.add("is-in");
    account.removeAttribute("data-ainf-i18n");
    account.setAttribute("aria-label", accountState.name || "Your account");
    var want = accountState.image || "mark";
    var current = account.querySelector(".ainf-account-avatar");
    var shown = current && current.tagName === "IMG" ? current.getAttribute("src") || "" : current ? "mark" : "";
    if (current && !(current.textContent || "").trim() && shown === want) return;
    account.textContent = "";
    if (accountState.image) {
      var img = document.createElement("img");
      img.className = "ainf-account-avatar";
      img.alt = "";
      img.src = accountState.image;
      account.appendChild(img);
    } else {
      var icon = document.createElement("span");
      icon.className = "ainf-account-avatar ainf-account-avatar--mark";
      icon.setAttribute("aria-hidden", "true");
      account.appendChild(icon);
    }
  }

  function rememberAccount(name, image) {
    accountState = {
      signedIn: true,
      name: String(name || "").trim(),
      image: /^https:\/\//.test(String(image || "")) ? String(image) : "",
    };
    renderAccount();
  }

  function loadClerkUser(done) {
    var key = clerkKey();
    if (!key) {
      done(null);
      return;
    }
    if (window.Clerk && window.Clerk.user) {
      done(window.Clerk.user);
      return;
    }
    if (window.__ainfClerkLoading) {
      document.addEventListener("ainf-clerk-ready", function onReady() {
        document.removeEventListener("ainf-clerk-ready", onReady);
        done(window.Clerk && window.Clerk.user ? window.Clerk.user : null);
      });
      return;
    }
    window.__ainfClerkLoading = true;
    var raw = key.replace(/^pk_(test|live)_/, "").replace(/\$+$/, "");
    var host = "";
    try {
      host = atob(raw).replace(/\$$/, "");
    } catch (e) {
      host = "";
    }
    if (!host || host.indexOf(" ") !== -1) {
      done(null);
      return;
    }
    var script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-clerk-publishable-key", key);
    script.src = "https://" + host + "/npm/@clerk/clerk-js@6/dist/clerk.browser.js";
    script.onload = function () {
      var clerk = window.Clerk;
      var ready = clerk && clerk.load ? clerk.load() : Promise.resolve();
      Promise.resolve(ready)
        .then(function () {
          if (clerk && clerk.user) window.dispatchEvent(new Event("ainf-session"));
          document.dispatchEvent(new Event("ainf-clerk-ready"));
          done(clerk && clerk.user ? clerk.user : null);
        })
        .catch(function () {
          done(null);
        });
    };
    script.onerror = function () {
      done(null);
    };
    document.head.appendChild(script);
  }

  function paintAccount() {
    renderAccount();
    if (accountFetchStarted) return;
    if (!document.querySelector("#" + NAV_ID + " .ainf-account")) return;
    accountFetchStarted = true;
    fetch("/api/session/state", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (data && data.signedIn) {
          var giver = data.giver || {};
          rememberAccount(giver.name, "");
          if (giver.imageUrl && hasClerkClient()) {
            loadClerkUser(function (user) {
              if (!user || !user.hasImage) return;
              rememberAccount(user.fullName || giver.name, user.imageUrl);
            });
          }
          return;
        }
        if (!hasClerkClient()) return;
        loadClerkUser(function (user) {
          if (!user) return;
          var image = user.hasImage ? user.imageUrl : "";
          rememberAccount(user.fullName || user.firstName || "", image);
        });
      })
      .catch(function () {
        accountFetchStarted = false;
      });
  }

  var killedOnce = false;
  function tick(full) {
    document.documentElement.classList.add("ainf-shared-nav");
    if (document.body) document.body.classList.add("ainf-shared-nav");
    if (isProjects) {
      document.documentElement.classList.add("ainf-projects-skin");
      if (document.body) document.body.classList.add("ainf-projects-skin");
    }
    ensureNav();
    paintAccount();
    if (full || !killedOnce) {
      killTemplateNavs();
      killedOnce = true;
    }
    syncHopperFooterBrand();
  }

  tick(true);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      tick(true);
    });
  }

  [500, 1400, 2800].forEach(function (ms) {
    setTimeout(function () {
      tick(ms < 1600);
    }, ms);
  });

  var moTimer = 0;
  var mo = new MutationObserver(function () {
    if (moTimer) return;
    moTimer = setTimeout(function () {
      moTimer = 0;
      var nav = document.getElementById(NAV_ID);
      if (!nav || nav.parentNode !== document.documentElement) ensureNav();
    }, 220);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () {
    mo.disconnect();
  }, 4500);

  // Live support campaign under the shared nav (admin-managed).
  (function mountSupportBanner() {
    if (window.__ainfSupportBannerBooted) return;
    window.__ainfSupportBannerBooted = true;
    var BANNER_ID = "ainf-support-banner";

    function pad(n) {
      return String(Math.max(0, n)).padStart(2, "0");
    }

    function parts(endsAt) {
      var total = new Date(endsAt).getTime() - Date.now();
      if (!(total > 0)) return null;
      var s = Math.floor(total / 1000);
      return {
        d: Math.floor(s / 86400),
        h: Math.floor((s % 86400) / 3600),
        m: Math.floor((s % 3600) / 60),
        s: s % 60,
      };
    }

    function renderCountdown(el, endsAt) {
      function paint() {
        var p = parts(endsAt);
        if (!p) {
          el.textContent = "Ended";
          el.className = "ainf-support-count is-done";
          return false;
        }
        el.className = "ainf-support-count";
        el.innerHTML =
          (p.d > 0
            ? '<span><b>' + p.d + "</b><i>Days</i></span>"
            : "") +
          "<span><b>" +
          pad(p.h) +
          "</b><i>Hrs</i></span><span><b>" +
          pad(p.m) +
          "</b><i>Mins</i></span><span><b>" +
          pad(p.s) +
          "</b><i>Secs</i></span>";
        return true;
      }
      if (!paint()) return;
      var id = setInterval(function () {
        if (!paint()) clearInterval(id);
      }, 1000);
    }

    function mount(banner) {
      if (!banner || !document.documentElement) return;
      var dismissKey =
        "ainf_support_dismiss:" +
        String(banner.endsAt || "") +
        ":" +
        String(banner.updatedAt || banner.headline || "");
      try {
        if (sessionStorage.getItem(dismissKey) === "1") return;
      } catch (e) {}

      var existing = document.getElementById(BANNER_ID);
      if (existing) existing.remove();
      var root = document.createElement("aside");
      root.id = BANNER_ID;
      root.setAttribute("aria-label", "Support campaign");
      var copy = document.createElement("div");
      copy.className = "ainf-support-copy";
      var tipParts = [];
      if (banner.headline) {
        var title = document.createElement("strong");
        title.textContent = banner.headline;
        tipParts.push(banner.headline);
        copy.appendChild(title);
      }
      if (banner.message) {
        var text = document.createElement("span");
        text.textContent = banner.message;
        tipParts.push(banner.message);
        copy.appendChild(text);
      }
      if (tipParts.length) copy.setAttribute("title", tipParts.join(" — "));
      root.appendChild(copy);
      if (banner.endsAt) {
        var count = document.createElement("div");
        count.className = "ainf-support-count";
        root.appendChild(count);
        renderCountdown(count, banner.endsAt);
      }
      var cta = document.createElement("a");
      cta.className = "ainf-support-cta";
      cta.href = banner.ctaHref || "/donate-now";
      cta.textContent = banner.ctaLabel || "Support AINF";
      root.appendChild(cta);
      var dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.className = "ainf-support-dismiss";
      dismiss.setAttribute("aria-label", "Dismiss campaign banner");
      dismiss.textContent = "×";
      dismiss.addEventListener("click", function () {
        try {
          sessionStorage.setItem(dismissKey, "1");
        } catch (e) {}
        root.remove();
        document.documentElement.classList.remove("ainf-has-support");
        document.documentElement.style.removeProperty("--ainf-support-h");
      });
      root.appendChild(dismiss);
      // Mount on <html> next to the floating nav so Framer body layers
      // (high stacking contexts) cannot cover the strip.
      document.documentElement.appendChild(root);
      document.documentElement.classList.add("ainf-has-support");
      document.documentElement.style.setProperty("--ainf-support-h", "44px");
    }

    fetch("/api/support-banner", { credentials: "same-origin" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (data && data.banner) mount(data.banner);
      })
      .catch(function () {});
  })();

  // Expose for language switcher
  window.__ainfEnsureSiteNav = ensureNav;
})();
