/* Lightweight motion overlay — skip Framer letter-animated headings */
(function () {
  if (window.__ainfMotionBooted) return;
  window.__ainfMotionBooted = true;

  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function hasLetterAnimation(el) {
    if (!el || !el.querySelectorAll) return false;
    var all = el.querySelectorAll("span[style]");
    var n = 0;
    for (var i = 0; i < all.length; i++) {
      var span = all[i];
      if (span.querySelector("span")) continue;
      var style = span.getAttribute("style") || "";
      if (/inline-block/i.test(style) || (/transform/i.test(style) && /opacity/i.test(style))) n += 1;
      if (n >= 4) return true;
    }
    return false;
  }

  function parseStat(text) {
    var raw = String(text || "").replace(/,/g, "").trim();
    var m = raw.match(/([\d.]+)\s*(k|m|\+)?/i);
    if (!m) return null;
    var n = parseFloat(m[1]);
    if (!isFinite(n)) return null;
    var suffix = (m[2] || "") + (/\+$/.test(raw) && m[2] !== "+" ? "+" : "");
    if (/\+$/.test(raw) && suffix.indexOf("+") < 0) suffix += "+";
    return { n: n, suffix: suffix, decimals: /\./.test(m[1]) ? m[1].split(".")[1].length : 0 };
  }

  function formatStat(n, info) {
    var value = info.decimals ? n.toFixed(info.decimals) : String(Math.round(n));
    if (!info.decimals && n >= 1000) {
      value = Math.round(n).toLocaleString("en-IN");
    }
    return value + info.suffix;
  }

  function animateCount(el, info) {
    if (el.getAttribute("data-ainf-counted") === "1") return;
    el.setAttribute("data-ainf-counted", "1");
    if (reduced) {
      el.textContent = formatStat(info.n, info);
      return;
    }
    var start = performance.now();
    var dur = 1100;
    function frame(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = formatStat(info.n * eased, info);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function observeStats() {
    var heads = document.querySelectorAll(
      '[data-framer-name="Statastic"] h3, [data-framer-name="Statistics"] h3, [data-framer-name="Stats"] h3'
    );
    if (!heads.length) {
      document.querySelectorAll("h3").forEach(function (h) {
        if (parseStat(h.textContent)) heads = heads.length ? heads : [];
      });
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var info = parseStat(entry.target.textContent);
          if (info) animateCount(entry.target, info);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.4 }
    );
    document.querySelectorAll("h3").forEach(function (h) {
      if (hasLetterAnimation(h)) return;
      if (!parseStat(h.textContent)) return;
      io.observe(h);
    });
  }

  function revealSections() {
    var names = [
      "About AINF Section",
      "How you can help Section",
      "Testimonials Section",
      "Meet the team Section",
      "Gallery Section",
      "Support AINF CTA",
      "Mission & Vission",
    ];
    var nodes = [];
    names.forEach(function (name) {
      document.querySelectorAll('[data-framer-name="' + name + '"]').forEach(function (el) {
        nodes.push(el);
      });
    });
    if (!nodes.length) {
      document.querySelectorAll("section").forEach(function (el, i) {
        if (i > 0 && i < 8) nodes.push(el);
      });
    }
    if (reduced) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    nodes.forEach(function (el) {
      var name = (el.getAttribute && el.getAttribute("data-framer-name")) || "";
      if (/hero/i.test(name) || /Hero Sect/i.test(name)) return;
      if (hasLetterAnimation(el)) return;
      el.classList.add("ainf-reveal");
      io.observe(el);
    });
  }

  function liftCards() {
    document
      .querySelectorAll(
        '[data-framer-name="Team Card"], [data-framer-name="Cause Card"], [data-framer-name="Project Card"], [data-framer-name="Card"]'
      )
      .forEach(function (el) {
        if (el.closest && el.closest('[data-framer-name="Clients"]')) return;
        el.classList.add("ainf-lift");
      });
  }

  function prefetchNav() {
    var done = Object.create(null);
    function prefetch(href) {
      if (!href || done[href]) return;
      if (href.charAt(0) !== "/") return;
      if (href.indexOf("/api/") === 0) return;
      done[href] = 1;
      var link = document.createElement("link");
      link.rel = "prefetch";
      link.href = href;
      document.head.appendChild(link);
    }
    document.addEventListener(
      "pointerover",
      function (e) {
        var a = e.target && e.target.closest && e.target.closest("a[href]");
        if (!a) return;
        var href = (a.getAttribute("href") || "").split("?")[0].split("#")[0];
        prefetch(href);
      },
      { capture: true, passive: true }
    );
    var idle = window.requestIdleCallback || function (fn) {
      return setTimeout(fn, 1200);
    };
    idle(function () {
      ["/about-us", "/donate-now", "/sign-in", "/causes", "/projects"].forEach(prefetch);
    });
  }

  function deskIcon(inner) {
    return (
      '<svg class="ainf-desk-ico" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">' +
      inner +
      "</svg>"
    );
  }

  var DESK_MARKS = [
    {
      name: "Shiksha",
      sub: "Desk",
      href: "/causes/education-for-every-child",
      icon: deskIcon(
        '<path d="M6 8.5c3.2-1.2 6.2-.4 10 1.5 3.8-1.9 6.8-2.7 10-1.5v15c-3.2-1.2-6.2-.4-10 1.5-3.8-1.9-6.8-2.7-10-1.5v-15z" fill="none" stroke="#39a46b" stroke-width="1.7" stroke-linejoin="round"/>' +
          '<path d="M16 10v15" stroke="#39a46b" stroke-width="1.7"/>'
      ),
    },
    {
      name: "Rozgar",
      sub: "Skills",
      href: "/causes/food-nutrition-for-families",
      icon: deskIcon(
        '<rect x="6" y="18" width="5" height="8" rx="1" fill="#39a46b"/>' +
          '<rect x="13.5" y="13" width="5" height="13" rx="1" fill="#39a46b"/>' +
          '<rect x="21" y="8" width="5" height="18" rx="1" fill="#39a46b"/>'
      ),
    },
    {
      name: "Swasthya",
      sub: "Care",
      href: "/causes/healthcare-for-all",
      icon: deskIcon(
        '<circle cx="16" cy="16" r="11" fill="none" stroke="#39a46b" stroke-width="1.8"/>' +
          '<path d="M16 10v12M10 16h12" stroke="#39a46b" stroke-width="1.8" stroke-linecap="round"/>'
      ),
    },
    {
      name: "Nari",
      sub: "Suraksha",
      href: "/causes/women-empowerment-for-rise",
      icon: deskIcon(
        '<path d="M16 5l10 4v7c0 6-4.2 9.5-10 11.5C10.2 25.5 6 22 6 16V9l10-4z" fill="none" stroke="#39a46b" stroke-width="1.7" stroke-linejoin="round"/>' +
          '<path d="M16 12v8M13 16.5h6" stroke="#39a46b" stroke-width="1.6" stroke-linecap="round"/>'
      ),
    },
    {
      name: "Kheti",
      sub: "Janajati",
      href: "/causes/water-sanitation-for-health",
      icon: deskIcon(
        '<path d="M16 26V13" stroke="#39a46b" stroke-width="1.8" stroke-linecap="round"/>' +
          '<path d="M16 15c-5.2-1-8.2-5.2-8.2-10.2 6.2 0 8.2 4.2 8.2 10.2z" fill="#39a46b"/>' +
          '<path d="M16 17c5-1 8-5 8-9.2-6 0-8 3.4-8 9.2z" fill="#2d8a58"/>'
      ),
    },
  ];

  function hideDummyLogo(node) {
    if (!node || (node.classList && node.classList.contains("ainf-desk-mark"))) return;
    if (node.closest && node.closest(".ainf-desk-mark")) return;
    if (node.getAttribute && node.getAttribute("data-ainf-logo-hide") === "1") return;
    node.setAttribute("data-ainf-logo-hide", "1");
    node.setAttribute("aria-hidden", "true");
    node.style.setProperty("display", "none", "important");
    node.style.setProperty("visibility", "hidden", "important");
    node.style.setProperty("opacity", "0", "important");
    node.style.setProperty("animation", "none", "important");
    node.style.setProperty("pointer-events", "none", "important");
  }

  function fillDeskCard(card, desk) {
    if (!card || !desk) return;
    if (!card.classList.contains("ainf-desk-card")) card.classList.add("ainf-desk-card");
    var mark = card.querySelector(":scope > .ainf-desk-mark");
    Array.prototype.forEach.call(card.children, function (child) {
      if (child.classList && child.classList.contains("ainf-desk-mark")) return;
      hideDummyLogo(child);
    });
    if (mark) return;
    mark = document.createElement("a");
    mark.className = "ainf-desk-mark";
    mark.href = desk.href;
    mark.setAttribute("aria-label", desk.name + " " + desk.sub);
    mark.innerHTML =
      desk.icon +
      '<span class="ainf-desk-name" data-ainf-i18n="' +
      desk.name +
      '">' +
      desk.name +
      "</span>" +
      '<span class="ainf-desk-sub">' +
      desk.sub +
      "</span>";
    card.appendChild(mark);
  }

  function paintDeskMarks() {
    var rows = document.querySelectorAll('[data-framer-name="Clients"]');
    if (!rows.length) return;
    Array.prototype.forEach.call(rows, function (row) {
      var cards = row.querySelectorAll('[data-framer-name^="Client Logo"]');
      if (cards.length) {
        Array.prototype.forEach.call(cards, function (card) {
          var name = card.getAttribute("data-framer-name") || "";
          var n = parseInt(name.replace(/\D/g, ""), 10);
          var desk = DESK_MARKS[(n || 1) - 1] || DESK_MARKS[0];
          fillDeskCard(card, desk);
        });
        return;
      }
      DESK_MARKS.forEach(function (desk, i) {
        var card = row.querySelector('[data-framer-name="Client Logo ' + (i + 1) + '"]');
        if (card) fillDeskCard(card, desk);
      });
    });
  }

  function watchDeskMarks() {
    paintDeskMarks();
    if (window.__ainfDeskWatch) return;
    var rows = document.querySelectorAll('[data-framer-name="Clients"]');
    if (!rows.length) return;
    window.__ainfDeskWatch = true;
    var busy = false;
    var mo = new MutationObserver(function () {
      if (busy) return;
      busy = true;
      requestAnimationFrame(function () {
        paintDeskMarks();
        busy = false;
      });
    });
    Array.prototype.forEach.call(rows, function (row) {
      mo.observe(row, { childList: true, subtree: false });
    });
    document.querySelectorAll('[data-framer-name^="Client Logo"]').forEach(function (card) {
      mo.observe(card, { childList: true, subtree: false });
    });
    setTimeout(function () {
      mo.disconnect();
    }, 4500);
  }

  function start() {
    observeStats();
    revealSections();
    liftCards();
    prefetchNav();
    watchDeskMarks();
  }

  function whenReady() {
    paintDeskMarks();
    if (document.documentElement.classList.contains("ainf-ready")) {
      start();
      return;
    }
    var n = 0;
    var t = setInterval(function () {
      n += 1;
      if (document.documentElement.classList.contains("ainf-ready") || n > 40) {
        clearInterval(t);
        start();
      }
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", whenReady);
  } else {
    whenReady();
  }
})();
