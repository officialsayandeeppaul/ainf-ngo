/* Lightweight motion overlay — skip Framer letter-animated headings */
(function () {
  if (window.__ainfMotionBooted) return;
  window.__ainfMotionBooted = true;

  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function hasLetterAnimation(el) {
    return !!el.querySelector('span[style*="inline-block"]');
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
      if (hasLetterAnimation(el) && el.matches("h1,h2,h3")) return;
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
        el.classList.add("ainf-lift");
      });
  }

  function prefetchNav() {
    var hrefs = ["/about-us", "/causes", "/projects", "/blogs", "/contact-us", "/donate-now"];
    var run = function () {
      hrefs.forEach(function (href) {
        var link = document.createElement("link");
        link.rel = "prefetch";
        link.href = href;
        document.head.appendChild(link);
      });
    };
    if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 2500 });
    else setTimeout(run, 1800);
  }

  function start() {
    observeStats();
    revealSections();
    liftCards();
    prefetchNav();
  }

  function whenReady() {
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
