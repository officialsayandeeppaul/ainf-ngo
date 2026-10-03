(function () {
  "use strict";

  var STORAGE_KEY = "ainf_lang";
  var SWITCHER_ID = "ainf-lang-switcher";

  var state = {
    lang: "en",
    dict: null,
    reverse: { bn: {}, hi: {} },
    applying: false,
    observer: null,
    debounceTimer: null,
  };

  function normalize(text) {
    return (text || "")
      .replace(/[\u2013\u2014\u2212]/g, "—")
      .replace(/\s+/g, " ")
      .trim();
  }

  function dedupeRepeated(text) {
    var t = normalize(text);
    if (t.length < 4) return t;
    var half = Math.floor(t.length / 2);
    if (t.length % 2 === 0 && t.slice(0, half) === t.slice(half)) {
      return t.slice(0, half);
    }
    return t;
  }

  function inSwitcher(node) {
    if (!node || !node.closest) return false;
    return !!node.closest('[id^="' + SWITCHER_ID + '"]');
  }

  function shouldSkipNode(node) {
    if (!node || !node.parentElement) return true;
    if (inSwitcher(node)) return true;
    if (node.parentElement.closest && node.parentElement.closest(".ainf-hero-ghost")) return true;
    var tag = node.parentElement.tagName;
    return tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "SVG";
  }

  function isLetterLeaf(span) {
    if (!span || span.nodeType !== 1) return false;
    if (span.classList && span.classList.contains("ainf-hero-ghost")) return false;
    if (span.querySelector("span")) return false;
    var style = span.getAttribute("style") || "";
    if (!style) return false;
    var motion =
      /inline-block/i.test(style) ||
      (/transform/i.test(style) && (/opacity/i.test(style) || /blur\(/i.test(style)));
    if (!motion) return false;
    var t = span.textContent || "";
    return t.length <= 8;
  }

  function hasLetterAnimation(el) {
    return letterLeaves(el).length >= 4;
  }

  function buildReverseMaps(strings) {
    state.reverse = { bn: {}, hi: {} };
    state.compact = {};
    Object.keys(strings).forEach(function (key) {
      var entry = strings[key];
      if (entry.bn) state.reverse.bn[entry.bn] = key;
      if (entry.hi) state.reverse.hi[entry.hi] = key;
      state.compact[compact(key)] = key;
      if (entry.bn) state.compact[compact(entry.bn)] = key;
      if (entry.hi) state.compact[compact(entry.hi)] = key;
    });
    state.compactKeys = Object.keys(state.compact).sort(function (a, b) {
      return b.length - a.length;
    });
  }

  function compact(text) {
    return normalize(text)
      .toLowerCase()
      .replace(/[\u2019']/g, "")
      .replace(/[^a-z0-9\u0980-\u09FF\u0900-\u097F]+/gi, "");
  }

  function resolveEnglishKey(text) {
    var t = dedupeRepeated(normalize(text));
    if (!t || !state.dict) return null;
    if (state.dict.strings[t]) return t;
    if (state.reverse.bn[t]) return state.reverse.bn[t];
    if (state.reverse.hi[t]) return state.reverse.hi[t];
    var nospace = t.replace(/\s+/g, "");
    if (state.dict.strings[nospace]) return nospace;
    var c = compact(t);
    if (c && state.compact && state.compact[c]) return state.compact[c];
    if (c && state.compactKeys) {
      var best = "";
      for (var i = 0; i < state.compactKeys.length; i++) {
        var ck = state.compactKeys[i];
        if (ck.length < 10) continue;
        if (c.indexOf(ck) === 0 && ck.length > best.length) best = ck;
      }
      if (best) return state.compact[best];
    }
    return null;
  }

  function translateKey(key, lang) {
    if (!key) return null;
    if (key === "theainfAINF" || key === "theainf") return "AINF";
    if (lang === "en") {
      if (key === "Ghar Pahunch") return "Youth Supported";
      if (key === "Zila Sahyog") return "District Support";
      return key;
    }
    var entry = state.dict.strings[key];
    if (!entry) return key;
    return entry[lang] || key;
  }

  function translateText(text, lang) {
    var key = resolveEnglishKey(text);
    if (!key) return null;
    return translateKey(key, lang);
  }

  function detectPageKey() {
    var path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    if (path === "/" || path === "") return "home";
    var key = path.replace(/^\//, "");
    if (key === "contact-us") return "contact-us";
    return key;
  }

  function applyMeta(lang) {
    if (!state.dict) return;
    var pageKey = detectPageKey();
    var pageMeta =
      (state.dict.pages && (state.dict.pages[pageKey] || (pageKey === "contact-us" && state.dict.pages.contact))) ||
      null;
    var meta = pageMeta || state.dict.meta;
    if (!meta) return;

    var titleMap = meta.title || {};
    var descMap = meta.description || {};
    var title =
      lang === "en"
        ? titleMap.en
        : titleMap[lang] || titleMap.en;
    if (!title && state.dict.meta) {
      title =
        lang === "en"
          ? state.dict.meta.title.en
          : state.dict.meta.title[lang] || state.dict.meta.title.en;
    }
    if (title) {
      document.title = title;
      var titleEl = document.querySelector("head title");
      if (titleEl && titleEl.textContent !== title) titleEl.textContent = title;
    }

    var descEl = document.querySelector('meta[name="description"]');
    if (descEl) {
      var desc =
        lang === "en"
          ? descMap.en
          : descMap[lang] || descMap.en;
      if (!desc && state.dict.meta && state.dict.meta.description) {
        desc =
          lang === "en"
            ? state.dict.meta.description.en
            : state.dict.meta.description[lang] || state.dict.meta.description.en;
      }
      if (desc) descEl.setAttribute("content", desc);
    }

    document.documentElement.lang = lang === "bn" ? "bn" : lang === "hi" ? "hi" : "en";
  }

  function graphemes(text) {
    var str = String(text || "");
    try {
      if (window.Intl && Intl.Segmenter) {
        var seg = new Intl.Segmenter(state.lang === "bn" ? "bn" : state.lang === "hi" ? "hi" : "en", {
          granularity: "grapheme",
        });
        return Array.from(seg.segment(str), function (part) {
          return part.segment;
        });
      }
    } catch (_) {}
    return Array.from(str);
  }

  function letterLeaves(el) {
    if (!el || !el.querySelectorAll) return [];
    var all = el.querySelectorAll("span[style]");
    var leaves = [];
    for (var i = 0; i < all.length; i++) {
      if (isLetterLeaf(all[i])) leaves.push(all[i]);
    }
    return leaves;
  }

  function fillLetterSpans(el, text) {
    if (!el || !text) return false;
    var leaves = letterLeaves(el);
    if (leaves.length < 4) return false;
    var chars = graphemes(text).filter(function (ch) {
      return ch !== "\n" && ch !== "\r";
    });
    var i;
    for (i = 0; i < leaves.length; i++) {
      if (i < chars.length) {
        var glyph = chars[i] === " " ? "\u00a0" : chars[i];
        if (leaves[i].textContent !== glyph) leaves[i].textContent = glyph;
        leaves[i].style.removeProperty("display");
        leaves[i].style.removeProperty("width");
        leaves[i].style.removeProperty("visibility");
        leaves[i].removeAttribute("aria-hidden");
      } else {
        leaves[i].textContent = "";
        leaves[i].style.setProperty("display", "none", "important");
        leaves[i].setAttribute("aria-hidden", "true");
      }
    }
    if (chars.length > leaves.length) {
      var last = leaves[leaves.length - 1];
      var parent = last.parentNode;
      for (i = leaves.length; i < chars.length; i++) {
        var clone = last.cloneNode(false);
        clone.textContent = chars[i] === " " ? "\u00a0" : chars[i];
        clone.style.removeProperty("display");
        clone.style.removeProperty("width");
        clone.style.removeProperty("visibility");
        clone.style.removeProperty("opacity");
        clone.removeAttribute("aria-hidden");
        parent.appendChild(clone);
      }
    }
    return true;
  }

  function letterEase() {
    return "cubic-bezier(.16, 1, .3, 1)";
  }

  function letterEaseOut() {
    return "cubic-bezier(.4, 0, .2, 1)";
  }

  function setLetterVisible(span, on, delay) {
    if (!span) return;
    var reduced =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ms = reduced ? 0 : typeof delay === "number" ? delay : 0;
    window.setTimeout(function () {
      if (reduced) {
        span.style.transition = "none";
        span.style.opacity = on ? "1" : "0.001";
        span.style.filter = "none";
        span.style.transform = "none";
        span.classList.toggle("is-in", on);
        span.classList.toggle("is-out", !on);
        return;
      }
      var dur = on ? ".72s" : ".55s";
      var ease = on ? letterEase() : letterEaseOut();
      span.style.willChange = "transform, opacity, filter";
      span.style.transition =
        "opacity " + dur + " " + ease + ", filter " + dur + " " + ease + ", transform " + dur + " " + ease;
      if (on) {
        span.classList.add("is-in");
        span.classList.remove("is-out");
        span.style.opacity = "1";
        span.style.filter = "blur(0px)";
        span.style.transform = "translate3d(0,0,0)";
      } else {
        span.classList.add("is-out");
        span.classList.remove("is-in");
        span.style.opacity = "0.001";
        span.style.filter = "blur(7px)";
        span.style.transform = "translate3d(0,8px,0)";
      }
      var clear = function () {
        span.style.willChange = "auto";
        span.removeEventListener("transitionend", clear);
      };
      span.addEventListener("transitionend", clear);
      window.setTimeout(clear, on ? 900 : 700);
    }, ms);
  }

  function runLetterWave(spans, show, reverse) {
    var list = Array.prototype.slice.call(spans || []);
    if (!list.length) return 0;
    var n = list.length;
    var step = show ? 18 : 12;
    var start = show ? 24 : 10;
    for (var i = 0; i < n; i++) {
      var idx = reverse ? n - 1 - i : i;
      var t = i / Math.max(1, n - 1);
      var delay = start + i * step * (0.82 + 0.28 * (1 - t));
      setLetterVisible(list[idx], show, delay);
    }
    return start + n * step + (show ? 760 : 600);
  }

  var letterScrollBound = false;
  var letterScrollState = new WeakMap();

  function bootOwnsHeading(el) {
    if (!el) return false;
    if (el.getAttribute && (el.getAttribute("data-ainf-letters") || el.getAttribute("data-ainf-ready"))) return true;
    if (el.querySelector && el.querySelector("[data-ainf-word], .ainf-letter")) return true;
    if (
      el.tagName === "H1" &&
      el.closest &&
      el.closest('[data-framer-name="Hero Sectiion"], [data-framer-name="Hero Section"], [data-framer-name="Hero Description"]')
    ) {
      return true;
    }
    return false;
  }

  function playLetterIn(el, text) {
    if (!el || !text) return;
    if (bootOwnsHeading(el) && state.lang === "en") return;
    if (hasLetterAnimation(el) && !looksLatinLetters(el) && normalize(textIgnoringGhost(el)) === normalize(text)) {
      watchLetterOut(el);
      return;
    }
    var wrapExisting = el.querySelector("[data-ainf-letter-wrap]");
    if (
      wrapExisting &&
      normalize(wrapExisting.textContent) === normalize(text) &&
      !looksLatinLetters(wrapExisting)
    ) {
      watchLetterOut(el);
      return;
    }
    var playKey = (location.pathname || "") + ":" + state.lang + ":" + normalize(text);
    window.__ainfLetterPlayed = window.__ainfLetterPlayed || {};
    var alreadyPlayed = !!window.__ainfLetterPlayed[playKey];
    window.__ainfLetterPlayed[playKey] = true;
    var chars = graphemes(text).filter(function (ch) {
      return ch !== "\n" && ch !== "\r";
    });
    if (!chars.length) return;
    var keepGhost = el.querySelector(".ainf-hero-ghost");
    var wrap = document.createElement("span");
    wrap.setAttribute("data-ainf-letter-wrap", "1");
    wrap.className = "ainf-letter-wrap";
    wrap.style.whiteSpace = "pre-wrap";
    el.textContent = "";
    if (keepGhost) {
      keepGhost.textContent = text;
      el.appendChild(keepGhost);
    }
    el.appendChild(wrap);
    if (!el.style.position || el.style.position === "static") el.style.position = "relative";
    chars.forEach(function (ch) {
      var s = document.createElement("span");
      s.className = "ainf-letter is-out";
      s.style.display = "inline-block";
      s.style.whiteSpace = "pre";
      s.textContent = ch === " " ? "\u00a0" : ch;
      if (alreadyPlayed) {
        s.className = "ainf-letter is-in";
        s.style.opacity = "1";
        s.style.filter = "blur(0px)";
        s.style.transform = "translate3d(0,0,0)";
      } else {
        s.style.opacity = "0.001";
        s.style.filter = "blur(8px)";
        s.style.transform = "translate3d(0,10px,0)";
      }
      wrap.appendChild(s);
    });
    if (!alreadyPlayed) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          runLetterWave(wrap.children, true, false);
          if (keepGhost) {
            window.setTimeout(function () {
              keepGhost.classList.add("is-out");
              window.setTimeout(function () {
                if (keepGhost.parentNode) keepGhost.parentNode.removeChild(keepGhost);
              }, 380);
            }, 420);
          }
        });
      });
    } else if (keepGhost && keepGhost.parentNode) {
      keepGhost.parentNode.removeChild(keepGhost);
    }
    el.setAttribute("data-ainf-letter-armed", "1");
    ensureLetterScroll();
    requestAnimationFrame(function () {
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      var show = r.height > 4 && r.bottom > vh * 0.1 && r.top < vh * 0.82;
      letterScrollState.set(el, show);
      if (!show && wrap.children.length >= 4) {
        runLetterWave(wrap.children, false, true);
      }
    });
    watchLetterOut(el);
  }

  function ensureLetterScroll() {
    if (letterScrollBound) return;
    letterScrollBound = true;
    var busyEls = new WeakMap();
    var raf = 0;

    function headingVisible(el) {
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      if (r.height < 4) return false;
      return r.bottom > vh * 0.1 && r.top < vh * 0.82;
    }

    function spansFor(el) {
      var wrap = el.querySelector("[data-ainf-letter-wrap]");
      if (wrap) return wrap.querySelectorAll(".ainf-letter");
      return letterLeaves(el);
    }

    function tick() {
      raf = 0;
      document.querySelectorAll("h1, h2, h3").forEach(function (el) {
        if (!document.contains(el)) return;
        if (bootOwnsHeading(el)) return;
        var wrap = el.querySelector("[data-ainf-letter-wrap]");
        if (!wrap && !hasLetterAnimation(el)) return;
        var spans = spansFor(el);
        if (!spans || spans.length < 4) return;
        if (el.getAttribute("data-ainf-letter-armed") !== "1") {
          // Auto-arm live headings so remounts never miss scroll out
          var shown = 0;
          for (var s = 0; s < spans.length; s++) {
            try {
              if (parseFloat(getComputedStyle(spans[s]).opacity) > 0.35) shown += 1;
            } catch (_) {}
          }
          if (shown < 3 && !wrap) return;
          el.setAttribute("data-ainf-letter-armed", "1");
        }
        if (busyEls.get(el)) return;
        var show = headingVisible(el);
        var prev = letterScrollState.get(el);
        if (typeof prev !== "boolean") {
          var shown0 = 0;
          for (var v = 0; v < spans.length; v++) {
            try {
              if (parseFloat(getComputedStyle(spans[v]).opacity) > 0.35) shown0 += 1;
            } catch (_) {}
          }
          // Remount while scrolled away: letters are on but heading is off — play out once
          if (!show && shown0 >= Math.max(4, Math.floor(spans.length * 0.35))) {
            letterScrollState.set(el, false);
            busyEls.set(el, true);
            var wait0 = runLetterWave(spans, false, true);
            window.setTimeout(function () {
              busyEls.set(el, false);
            }, wait0);
            return;
          }
          letterScrollState.set(el, show);
          return;
        }
        if (prev === show) return;
        letterScrollState.set(el, show);
        busyEls.set(el, true);
        var wait = runLetterWave(spans, show, !show);
        window.setTimeout(function () {
          busyEls.set(el, false);
        }, wait);
      });
    }

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  function watchLetterOut(el) {
    if (!el || bootOwnsHeading(el)) return;
    ensureLetterScroll();
    var tries = 0;
    function arm() {
      tries += 1;
      var wrap = el.querySelector("[data-ainf-letter-wrap]");
      var spans = wrap ? wrap.querySelectorAll(".ainf-letter") : letterLeaves(el);
      var shown = 0;
      for (var i = 0; i < spans.length; i++) {
        try {
          if (parseFloat(getComputedStyle(spans[i]).opacity) > 0.35) shown += 1;
        } catch (_) {}
      }
      if (spans.length >= 4 && shown >= Math.min(6, Math.max(3, Math.floor(spans.length * 0.4)))) {
        el.setAttribute("data-ainf-letter-armed", "1");
        letterScrollState.set(el, true);
        return;
      }
      if (tries < 48) window.setTimeout(arm, 90);
      else {
        el.setAttribute("data-ainf-letter-armed", "1");
        letterScrollState.set(el, true);
      }
    }
    window.setTimeout(arm, 160);
  }

  function watchEnglishLetterOut() {
    if (state.lang !== "en") return;
    document.querySelectorAll("h1, h2").forEach(function (el) {
      if (!hasLetterAnimation(el)) return;
      if (bootOwnsHeading(el)) return;
      if (el.querySelector("[data-ainf-letter-wrap]")) return;
      watchLetterOut(el);
    });
  }

  function replaceAnimatedHeading(el, text) {
    if (!el || !text) return;
    if (el.closest && el.closest("#ainf-site-footer")) {
      el.textContent = text;
      return;
    }
    if (
      normalize(textIgnoringGhost(el)) === normalize(text) &&
      hasLetterAnimation(el) &&
      (state.lang === "en" || !looksLatinLetters(el))
    ) {
      return;
    }
    if (state.lang !== "en" && /^H[1-4]$/.test(el.tagName)) {
      playLetterIn(el, text);
      return;
    }
    if (fillLetterSpans(el, text)) return;
    if (/^H[1-4]$/.test(el.tagName)) return;
    if (state.lang === "en") {
      var now = normalize(el.textContent);
      if (now !== "Ghar Pahunch" && now !== "Zila Sahyog") return;
    }
    var colorSpan =
      el.querySelector('span[style*="--framer-text-color"]') ||
      el.querySelector("span.framer-text");
    if (!colorSpan) return;
    var wrapper = colorSpan.cloneNode(false);
    wrapper.textContent = text;
    el.textContent = "";
    el.appendChild(wrapper);
  }

  function setTextPreserveIcon(el, next) {
    var ico = el.querySelector("svg, img, .ainf-cta-ico");
    if (ico) {
      var nodes = [];
      for (var i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === 3) nodes.push(el.childNodes[i]);
      }
      if (nodes.length) {
        nodes[0].textContent = " " + next;
        for (var j = 1; j < nodes.length; j++) nodes[j].textContent = "";
        return;
      }
    }
    if (el.children.length > 0) {
      var target = el.querySelector("p.framer-text, span.framer-text, p, span") || el;
      if (target === el) replaceAnimatedHeading(el, next);
      else target.textContent = next;
      return;
    }
    el.textContent = next;
  }

  function textIgnoringGhost(el) {
    if (!el) return "";
    var out = "";
    function walk(node) {
      if (!node) return;
      if (node.nodeType === 1 && node.classList && node.classList.contains("ainf-hero-ghost")) return;
      if (node.nodeType === 3) {
        out += node.nodeValue || "";
        return;
      }
      var kids = node.childNodes || [];
      for (var i = 0; i < kids.length; i++) walk(kids[i]);
    }
    walk(el);
    return out.replace(/[\u200b]/g, "");
  }

  function looksLatinLetters(el) {
    var leaves = letterLeaves(el);
    var sample = "";
    for (var i = 0; i < Math.min(10, leaves.length); i++) sample += leaves[i].textContent || "";
    return /[A-Za-z]/.test(sample);
  }

  function stampKey(el, text) {
    var stamped = el.getAttribute("data-ainf-i18n");
    if (stamped) return stamped;
    var key = resolveEnglishKey(text);
    if (key) el.setAttribute("data-ainf-i18n", key);
    return key;
  }

  function applyHeadings(lang) {
    document.querySelectorAll("h1, h2, h3, h4").forEach(function (el) {
      if (inSwitcher(el)) return;
      var key = stampKey(el, textIgnoringGhost(el) || el.textContent);
      if (!key) return;
      var next = translateKey(key, lang);
      if (normalize(textIgnoringGhost(el)) === normalize(next)) return;
      replaceAnimatedHeading(el, next);
    });
  }

  function applyRichTextContainers(lang) {
    document
      .querySelectorAll('[data-framer-component-type="RichTextContainer"]')
      .forEach(function (container) {
        if (inSwitcher(container)) return;
        var link = container.querySelector("a.framer-text, a");
        var paragraph = container.querySelector("p.framer-text, p");
        var target = paragraph || link;
        if (link && paragraph) {
          var lt = normalize(link.textContent);
          var pt = normalize(paragraph.textContent);
          if (pt.length >= lt.length) target = paragraph;
          else target = link;
        }
        if (!target) return;
        if (container.querySelector("h1, h2, h3, h4")) return;
        var key = stampKey(target, target.textContent) || stampKey(container, container.textContent);
        if (!key) return;
        var next = translateKey(key, lang);
        if (normalize(target.textContent) === normalize(next)) return;
        if (hasLetterAnimation(target) || hasLetterAnimation(container)) {
          replaceAnimatedHeading(target, next);
        } else {
          target.textContent = next;
        }
      });
  }

  function applyPlainAnchors(lang) {
    document.querySelectorAll("a").forEach(function (anchor) {
      if (inSwitcher(anchor)) return;
      if (anchor.classList.contains("ainf-brand")) return;
      if (anchor.classList.contains("ainf-ft-logo")) return;
      if (anchor.classList.contains("ainf-cta")) return;
      if (anchor.classList.contains("ainf-account") && anchor.classList.contains("is-in")) return;
      var key = stampKey(anchor, anchor.textContent);
      if (!key) return;
      var next = translateKey(key, lang);
      if (normalize(anchor.textContent) === normalize(next)) return;
      setTextPreserveIcon(anchor, next);
    });
  }

  function applySharedChrome(lang) {
    document.querySelectorAll("#ainf-global-nav a[data-ainf-i18n], #ainf-site-footer a[data-ainf-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-ainf-i18n");
      var next = translateKey(key, lang);
      if (!next) return;
      if (el.classList.contains("ainf-cta")) return;
      if (el.classList.contains("ainf-account") && el.classList.contains("is-in")) return;
      if (normalize(el.textContent) !== normalize(next)) el.textContent = next;
    });
    document.querySelectorAll("#ainf-global-nav .ainf-cta").forEach(function (el) {
      var key = stampKey(el, "Support AINF") || "Support AINF";
      var next = translateKey(key, lang);
      var full = el.querySelector(".ainf-cta-full");
      var short = el.querySelector(".ainf-cta-short");
      if (full) full.textContent = next || "Support AINF";
      if (short) short.textContent = translateKey("Support", lang) || "Support";
      else if (!full) setTextPreserveIcon(el, next);
    });
    document.querySelectorAll("#ainf-global-nav .ainf-links a").forEach(function (el) {
      var key = stampKey(el, el.textContent);
      if (!key) return;
      var next = translateKey(key, lang);
      if (normalize(el.textContent) !== normalize(next)) el.textContent = next;
    });
    document.querySelectorAll(".ainf-desk-name[data-ainf-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-ainf-i18n");
      var next = translateKey(key, lang);
      if (next) el.textContent = next;
    });
  }

  function applyDuplicateParagraphs(lang) {
    document.querySelectorAll("a, button").forEach(function (el) {
      if (inSwitcher(el)) return;
      var ps = el.querySelectorAll(":scope > p");
      if (ps.length < 2) return;
      var key = resolveEnglishKey(ps[0].textContent);
      if (!key) return;
      var next = translateKey(key, lang);
      ps.forEach(function (p) {
        p.textContent = next;
      });
    });
  }

  function parseRgb(color) {
    if (!color) return null;
    var m = String(color).match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3] };
  }

  function luminance(rgb) {
    return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  }

  function opaqueRgb(el) {
    if (!el) return null;
    var bg = getComputedStyle(el).backgroundColor;
    if (!bg || bg === "transparent" || /rgba?\([^)]+,\s*0\s*\)/.test(bg)) return null;
    var rgb = parseRgb(bg);
    if (!rgb) return null;
    if (rgb.r < 8 && rgb.g < 8 && rgb.b < 8) return null;
    return rgb;
  }

  function isTinyAccent(el) {
    try {
      var box = el.getBoundingClientRect();
      if (box.width && box.height && box.width <= 18 && box.height <= 18) return true;
    } catch (err) {}
    return false;
  }

  function buttonBgColor(anchor) {
    var own = opaqueRgb(anchor);
    if (own) return own;
    var kids = anchor.children || [];
    for (var i = 0; i < kids.length; i++) {
      if (isTinyAccent(kids[i])) continue;
      var rgb = opaqueRgb(kids[i]);
      if (rgb) return rgb;
    }
    return { r: 255, g: 255, b: 255 };
  }

  function paintCtaColor(el, color) {
    if (!el) return;
    el.style.setProperty("color", color, "important");
    el.style.setProperty("-webkit-text-fill-color", color, "important");
    el.style.setProperty("font-weight", "400", "important");
    el.style.setProperty("font-style", "normal", "important");
    el.style.setProperty("--framer-font-weight", "400");
    el.style.setProperty("--framer-text-color", color);
    el.style.setProperty("--extracted-r6o4lv", color);
    el.style.setProperty("--framer-link-text-color", color);
  }

  function applyFramerButtons(lang) {
    document
      .querySelectorAll('a[data-framer-name="Desktop"], a[data-framer-name="Tablet"], a[data-framer-name="Mobile-Close"]')
      .forEach(function (anchor) {
        if (inSwitcher(anchor)) return;
        var containers = anchor.querySelectorAll('[data-framer-component-type="RichTextContainer"]');
        if (!containers.length) return;
        var key = resolveEnglishKey(containers[0].textContent);
        if (!key) return;
        var next = translateKey(key, lang);
        containers.forEach(function (container, idx) {
          var textTarget = container.querySelector("p, span") || container;
          if (normalize(textTarget.textContent) !== normalize(next)) {
            textTarget.textContent = next;
          }
          if (idx > 0) {
            container.style.setProperty("display", "none", "important");
            container.setAttribute("aria-hidden", "true");
          }
        });
        var ps = anchor.querySelectorAll("p");
        for (var i = 1; i < ps.length; i++) {
          ps[i].style.setProperty("display", "none", "important");
        }
      });
  }

  function looksLikeGreenPill(el) {
    if (!el || !el.getBoundingClientRect) return false;
    if (el.closest && el.closest("#ainf-lang-switcher, #ainf-lang-switcher-mobile")) return false;
    var h = el.offsetHeight;
    var w = el.offsetWidth;
    if (!h || !w || h < 28 || h > 88 || w < 48) return false;
    var s = getComputedStyle(el);
    var radius = parseFloat(s.borderTopLeftRadius) || 0;
    if (radius < 14 && !/999|1000|50%/.test(s.borderRadius || "")) return false;
    var rgb = opaqueRgb(el);
    if (!rgb) return false;
    return rgb.g >= 90 && rgb.g > rgb.r + 20 && rgb.g > rgb.b && rgb.r < 150;
  }

  function collectPillButtons() {
    var list = [];
    function add(el) {
      if (!el || list.indexOf(el) >= 0) return;
      list.push(el);
    }
    document
      .querySelectorAll(
        'a[data-framer-name="Desktop"], a[data-framer-name="Tablet"], a[data-framer-name="Mobile-Close"], [data-framer-name="Primary btn"], #ainf-global-nav .ainf-cta'
      )
      .forEach(add);
    document.querySelectorAll("a, button").forEach(function (el) {
      if (looksLikeGreenPill(el)) add(el);
    });
    return list;
  }

  function forceCtaContrast() {
    collectPillButtons().forEach(function (anchor) {
      var bg = buttonBgColor(anchor);
      var isLight = !bg || luminance(bg) > 0.72;
      if (looksLikeGreenPill(anchor) || (anchor.getAttribute && anchor.getAttribute("data-framer-name") === "Primary btn")) {
        isLight = false;
      }
      if (anchor.classList && anchor.classList.contains("ainf-cta")) isLight = false;
      var color = isLight ? "rgb(34, 34, 34)" : "#ffffff";
      anchor.classList.toggle("ainf-cta-on-light", isLight);
      anchor.classList.toggle("ainf-cta-on-dark", !isLight);
      paintCtaColor(anchor, color);
      anchor
        .querySelectorAll('[data-framer-component-type="RichTextContainer"], p, span')
        .forEach(function (el) {
          paintCtaColor(el, color);
        });
    });
  }

  function applyLeafTextNodes(lang) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("h1, h2, h3, h4")) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-framer-component-type="RichTextContainer"]')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.tagName === "A" && parent.children.length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest('span[style*="inline-block"], [data-ainf-letter-wrap]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    var node;
    while ((node = walker.nextNode())) {
      var raw = node.textContent;
      var trimmed = normalize(raw);
      if (!trimmed || trimmed.length < 2) continue;
      var next = translateText(trimmed, lang);
      if (!next || normalize(raw) === normalize(next)) continue;
      node.textContent = raw.replace(trimmed, next);
    }
  }

  function applyAttributes(lang) {
    var attrs = ["placeholder", "aria-label", "title", "alt"];
    document.querySelectorAll("*").forEach(function (el) {
      if (inSwitcher(el)) return;
      attrs.forEach(function (attr) {
        var val = el.getAttribute(attr);
        if (!val) return;
        var next = translateText(val, lang);
        if (next && normalize(val) !== normalize(next)) {
          el.setAttribute(attr, next);
        }
      });
    });
  }

  function applyBlockCopy(lang) {
    document.querySelectorAll("p, li, h1, h2, h3, h4").forEach(function (el) {
      if (inSwitcher(el)) return;
      if (el.closest && el.closest("#ainf-global-nav .ainf-brand, a.ainf-brand, a.ainf-ft-logo, .ainf-brand-text")) return;
      if (/^H[1-4]$/.test(el.tagName)) {
        var headingKey = stampKey(el, textIgnoringGhost(el) || el.textContent);
        if (!headingKey) return;
        replaceAnimatedHeading(el, translateKey(headingKey, lang));
        return;
      }
      var key = stampKey(el, el.textContent);
      if (!key) return;
      var next = translateKey(key, lang);
      if (normalize(el.textContent) === normalize(next)) return;
      if (hasLetterAnimation(el)) {
        fillLetterSpans(el, next);
      } else if (el.childElementCount && el.querySelector("p, span.framer-text")) {
        var inner = el.querySelector("p.framer-text, span.framer-text, p, span") || el;
        if (hasLetterAnimation(inner) || inner.closest("h1, h2, h3, h4")) return;
        inner.textContent = next;
      } else {
        el.textContent = next;
      }
    });
  }

  function resetLetterMotion() {
    window.__ainfLetterPlayed = {};
    document.querySelectorAll("[data-ainf-letter-armed], [data-ainf-letter-io]").forEach(function (el) {
      el.removeAttribute("data-ainf-letter-armed");
      el.removeAttribute("data-ainf-letter-io");
    });
  }

  function applyLanguage(lang, fromObserver) {
    if (!state.dict) {
      state.lang = lang;
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (_) {}
      return;
    }
    if (state.applying) return;
    var switched = !fromObserver && state.lang && state.lang !== lang;
    if (!fromObserver) state.lang = lang;
    if (switched) resetLetterMotion();
    state.applying = true;
    try {
      applyMeta(lang);
      applySharedChrome(lang);
      updateSwitcherButtons(lang);
      applyHeadings(lang);
      applyRichTextContainers(lang);
      applyBlockCopy(lang);
      applyPlainAnchors(lang);
      applyFramerButtons(lang);
      applyDuplicateParagraphs(lang);
      if (lang !== "en") {
        applyLeafTextNodes(lang);
        applyAttributes(lang);
      }
      if (!fromObserver) forceCtaContrast();
      if (lang === "en" && !fromObserver) {
        window.setTimeout(watchEnglishLetterOut, 2100);
      }
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (_) {}
    } finally {
      state.applying = false;
    }
  }

  var LANG_META = {
    en: { glyph: "EN", label: "English", code: "EN" },
    bn: { glyph: "অ", label: "বাংলা", code: "অ" },
    hi: { glyph: "अ", label: "हिंदी", code: "अ" },
  };

  function globeSvg() {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">' +
      '<circle cx="12" cy="12" r="9"></circle>' +
      '<path d="M3 12h18"></path>' +
      '<path d="M12 3c2.5 2.8 3.8 5.8 3.8 9s-1.3 6.2-3.8 9c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3z"></path>' +
      "</svg>"
    );
  }

  function menuIsOpen() {
    return !!document.querySelector('[id^="' + SWITCHER_ID + '"].is-open');
  }

  function chevronSvg() {
    return (
      '<svg class="ainf-lang-chevron" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">' +
      '<path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"></path>' +
      "</svg>"
    );
  }

  function updateSwitcherButtons(lang) {
    document.querySelectorAll('[id^="' + SWITCHER_ID + '"]').forEach(function (root) {
      root.setAttribute("data-lang", lang);
      var code = root.querySelector(".ainf-lang-code");
      if (code) code.textContent = LANG_META[lang] ? LANG_META[lang].code : "EN";
      root.querySelectorAll(".ainf-lang-option").forEach(function (btn) {
        btn.classList.toggle("is-active", btn.getAttribute("data-lang") === lang);
      });
      var trigger = root.querySelector(".ainf-lang-trigger");
      if (trigger) trigger.setAttribute("aria-expanded", root.classList.contains("is-open") ? "true" : "false");
    });
  }

  function closeAllMenus() {
    document.querySelectorAll('[id^="' + SWITCHER_ID + '"]').forEach(function (root) {
      root.classList.remove("is-open");
      var trigger = root.querySelector(".ainf-lang-trigger");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }

  function createSwitcherShell(kind) {
    var root = document.createElement("div");
    root.id = kind === "mobile" ? SWITCHER_ID + "-mobile" : SWITCHER_ID;
    root.setAttribute("data-ainf-lang-nav", kind);
    root.setAttribute("data-lang", state.lang || "en");

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "ainf-lang-trigger";
    trigger.setAttribute("aria-label", "Change language");
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML =
      globeSvg() +
      '<span class="ainf-lang-code">EN</span>' +
      chevronSvg();

    var menu = document.createElement("div");
    menu.className = "ainf-lang-menu";
    menu.setAttribute("role", "menu");

    ["en", "bn", "hi"].forEach(function (id) {
      var meta = LANG_META[id];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ainf-lang-option";
      btn.setAttribute("data-lang", id);
      btn.setAttribute("role", "menuitem");
      btn.innerHTML =
        '<span class="ainf-lang-glyph">' +
        meta.glyph +
        '</span><span class="ainf-lang-option-label">' +
        meta.label +
        "</span>";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeAllMenus();
        if (id === "en" || state.dict) {
          applyLanguage(id, false);
          return;
        }
        state.lang = id;
        try {
          localStorage.setItem(STORAGE_KEY, id);
        } catch (_) {}
        loadTranslations();
      });
      menu.appendChild(btn);
    });

    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var willOpen = !root.classList.contains("is-open");
      closeAllMenus();
      if (willOpen) {
        root.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });

    // Keep clicks inside menu from bubbling to document
    menu.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    root.addEventListener("mousedown", function (e) {
      e.stopPropagation();
    });

    root.appendChild(trigger);
    root.appendChild(menu);
    return root;
  }

  function isVisible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function mountSwitchers() {
    // Prefer shared AINF pill navbar (identical on all pages)
    if (window.__ainfEnsureSiteNav) {
      try {
        window.__ainfEnsureSiteNav();
      } catch (_) {}
    }
    var sharedRight = document.querySelector(
      "#ainf-global-nav .ainf-right, #ainf-global-nav [data-ainf-nav-right]"
    );
    if (sharedRight) {
      var existing = document.getElementById(SWITCHER_ID);
      if (existing && existing.parentElement !== sharedRight) {
        // Move fallback / misplaced switcher into the pill next to Support AINF
        existing.style.position = "";
        existing.style.top = "";
        existing.style.right = "";
        existing.style.zIndex = "";
        var ctaMove = sharedRight.querySelector(".ainf-cta");
        if (ctaMove) sharedRight.insertBefore(existing, ctaMove);
        else sharedRight.appendChild(existing);
      } else if (!existing) {
        var sharedSwitcher = createSwitcherShell("desktop");
        var cta = sharedRight.querySelector(".ainf-cta");
        if (cta) sharedRight.insertBefore(sharedSwitcher, cta);
        else sharedRight.appendChild(sharedSwitcher);
      }
    }

    var navBlocks = Array.prototype.slice.call(
      document.querySelectorAll('[data-framer-name="Nav"]')
    );
    var desktopNav =
      navBlocks.find(isVisible) ||
      navBlocks[0] ||
      document.querySelector('[data-framer-name="Navigation"]');

    // Only mount into Framer nav if shared pill is not present
    if (!document.getElementById("ainf-global-nav") && desktopNav && !document.getElementById(SWITCHER_ID)) {
      var desktop = createSwitcherShell("desktop");
      var donateWrap = Array.prototype.slice.call(desktopNav.children).find(function (child) {
        return !!child.querySelector('a[data-framer-name="Desktop"][href*="donate"]');
      });
      if (!donateWrap) {
        donateWrap = Array.prototype.slice.call(desktopNav.children).find(function (child) {
          var a = child.querySelector('a[data-framer-name="Desktop"]');
          return !!a && !child.querySelector('[data-framer-name="Nav Links"]');
        });
      }
      if (donateWrap) {
        desktopNav.insertBefore(desktop, donateWrap);
      } else {
        desktopNav.appendChild(desktop);
      }
    }

    // Absolute fallback so language always remains available
    if (!document.getElementById(SWITCHER_ID)) {
      var fallback = createSwitcherShell("desktop");
      fallback.style.position = "fixed";
      fallback.style.top = "18px";
      fallback.style.right = "18px";
      fallback.style.zIndex = "10000";
      (document.body || document.documentElement).appendChild(fallback);
    }

    var menus = document.querySelectorAll(
      '[data-framer-name="Menu Items"], [data-framer-name="Quick links"]'
    );
    var mobileHost = menus[0] || document.querySelector('[data-framer-name="Menu"]');
    if (mobileHost && !document.getElementById(SWITCHER_ID + "-mobile")) {
      var mobile = createSwitcherShell("mobile");
      mobileHost.insertBefore(mobile, mobileHost.firstChild);
    }

    updateSwitcherButtons(state.lang);
  }

  function hideFramerBadge() {
    document
      .querySelectorAll(
        'a[href*="framer.com/r/badge"], a[href*="utm_campaign=freeplanbadge"], a.__framer-badge, .__framer-badge, [data-framer-badge], #__framer-badge-container'
      )
      .forEach(function (el) {
        el.style.setProperty("display", "none", "important");
        el.setAttribute("aria-hidden", "true");
      });

    document.querySelectorAll("a").forEach(function (a) {
      var text = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (/^Made in Framer$/i.test(text) || /Create a free website with Framer/i.test(text)) {
        a.style.setProperty("display", "none", "important");
        var parent = a.parentElement;
        if (parent && parent !== document.body && parent.children.length <= 2) {
          parent.style.setProperty("display", "none", "important");
        }
      }
    });
  }

  if (!window.__ainfLangOutsideClick) {
    window.__ainfLangOutsideClick = true;
    document.addEventListener(
      "click",
      function (e) {
        if (e.target && e.target.closest && e.target.closest('[id^="' + SWITCHER_ID + '"]')) return;
        closeAllMenus();
      },
      true
    );
  }

  function scheduleApply(fromObserver) {
    if (menuIsOpen()) return;
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(function () {
      if (menuIsOpen()) return;
      mountSwitchers();
      hideFramerBadge();
      applyLanguage(state.lang, fromObserver);
    }, fromObserver ? 160 : 0);
  }

  function attachObserver() {
    if (state.observer) return;
    state.observer = new MutationObserver(function () {
      if (state.applying || menuIsOpen()) return;
      if (!document.getElementById(SWITCHER_ID)) mountSwitchers();
      if (state.lang === "en") return;
      var heading = document.querySelector("h1, h2");
      if (heading && looksLatinLetters(heading)) {
        applyHeadings(state.lang);
        return;
      }
      scheduleApply(true);
    });
    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    setTimeout(function () {
      if (state.observer) state.observer.disconnect();
      state.observer = null;
    }, state.lang === "en" ? 4200 : 9000);
  }

  function readQueryLang() {
    try {
      var params = new URLSearchParams(location.search || "");
      var q = (params.get("lang") || "").toLowerCase();
      if (q === "bn" || q === "hi" || q === "en") return q;
    } catch (_) {}
    return null;
  }

  function readStoredLang() {
    var fromQuery = readQueryLang();
    if (fromQuery) {
      try {
        localStorage.setItem(STORAGE_KEY, fromQuery);
      } catch (_) {}
      return fromQuery;
    }
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "bn" || saved === "hi" || saved === "en") return saved;
    } catch (_) {}
    return "en";
  }

  function loadTranslations() {
    fetch("/i18n/home-strings.json?v=20260924e")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load translations");
        return res.json();
      })
      .then(function (json) {
        state.dict = json;
        buildReverseMaps(json.strings || {});
        state.lang = readStoredLang();
        if (state.lang !== "en") {
          document.documentElement.setAttribute("lang", state.lang === "hi" ? "hi" : "bn");
        }
        mountSwitchers();
        hideFramerBadge();
        var start = function () {
          attachObserver();
          applyLanguage(state.lang, false);
          document.documentElement.classList.remove("ainf-i18n-wait");
          setTimeout(function () {
            window.__ainfLettersDone = true;
            applyLanguage(state.lang, false);
            if (state.lang === "en") watchEnglishLetterOut();
          }, 2200);
          if (state.lang !== "en") {
            [900, 1600, 2500, 3400].forEach(function (ms) {
              setTimeout(function () {
                applyLanguage(state.lang, false);
              }, ms);
            });
          }
        };
        start();
        [400, 1400, 2800].forEach(function (ms) {
          setTimeout(function () {
            mountSwitchers();
            applyMeta(state.lang);
          }, ms);
        });
      })
      .catch(function (err) {
        console.warn("[ainf-i18n]", err);
      });
  }

  window.__ainfReapplyLang = function () {
    if (!state.dict || !state.lang || state.lang === "en" || state.applying) return;
    applyLanguage(state.lang, true);
  };

  function boot() {
    state.lang = readStoredLang();
    mountSwitchers();
    hideFramerBadge();
    document.documentElement.classList.remove("ainf-i18n-wait");
    if (state.lang === "en") {
      window.__ainfLettersDone = true;
      watchEnglishLetterOut();
      return;
    }
    loadTranslations();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
