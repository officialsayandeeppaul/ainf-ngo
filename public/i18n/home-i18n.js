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
    return (text || "").replace(/\s+/g, " ").trim();
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
    var tag = node.parentElement.tagName;
    return tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "SVG";
  }

  function hasLetterAnimation(el) {
    return !!el.querySelector('span[style*="inline-block"]');
  }

  function buildReverseMaps(strings) {
    state.reverse = { bn: {}, hi: {} };
    Object.keys(strings).forEach(function (key) {
      var entry = strings[key];
      if (entry.bn) state.reverse.bn[entry.bn] = key;
      if (entry.hi) state.reverse.hi[entry.hi] = key;
    });
  }

  function resolveEnglishKey(text) {
    var t = dedupeRepeated(text);
    if (!t || !state.dict) return null;
    if (state.dict.strings[t]) return t;
    if (state.reverse.bn[t]) return state.reverse.bn[t];
    if (state.reverse.hi[t]) return state.reverse.hi[t];
    return null;
  }

  function translateKey(key, lang) {
    if (!key) return null;
    if (lang === "en") return key;
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
    if (path === "/contact-us" || path.endsWith("/contact-us")) return "contact";
    if (path === "/" || path === "") return "home";
    return "home";
  }

  function applyMeta(lang) {
    if (!state.dict) return;
    var pageKey = detectPageKey();
    var pageMeta =
      (state.dict.pages && state.dict.pages[pageKey]) ||
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
    if (title) document.title = title;

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

  function replaceAnimatedHeading(el, text) {
    if (!el || normalize(el.textContent) === normalize(text)) return;
    var colorSpan =
      el.querySelector('span[style*="--framer-text-color"]') ||
      el.querySelector("span.framer-text");
    if (!colorSpan) {
      el.textContent = text;
      return;
    }
    var wrapper = colorSpan.cloneNode(false);
    wrapper.textContent = text;
    el.textContent = "";
    el.appendChild(wrapper);
  }

  function applyHeadings(lang) {
    document.querySelectorAll("h1, h2, h3").forEach(function (el) {
      if (inSwitcher(el)) return;
      var key = resolveEnglishKey(el.textContent);
      if (!key) return;
      var next = translateKey(key, lang);
      if (hasLetterAnimation(el)) {
        replaceAnimatedHeading(el, next);
      } else if (el.children.length > 0) {
        var target = el.querySelector("p.framer-text, span.framer-text, p, span") || el;
        if (target === el) replaceAnimatedHeading(el, next);
        else target.textContent = next;
      } else {
        el.textContent = next;
      }
    });
  }

  function applyRichTextContainers(lang) {
    document
      .querySelectorAll('[data-framer-component-type="RichTextContainer"]')
      .forEach(function (container) {
        if (inSwitcher(container)) return;
        var link = container.querySelector("a.framer-text, a");
        var paragraph = container.querySelector("p.framer-text, p");
        var target = link || paragraph;
        if (!target || hasLetterAnimation(target)) return;
        var key = resolveEnglishKey(target.textContent);
        if (!key) return;
        var next = translateKey(key, lang);
        if (normalize(target.textContent) === normalize(next)) return;
        target.textContent = next;
      });
  }

  function applyPlainAnchors(lang) {
    document.querySelectorAll("a").forEach(function (anchor) {
      if (inSwitcher(anchor)) return;
      if (anchor.querySelector('[data-framer-component-type="RichTextContainer"]')) return;
      if (anchor.children.length > 0) return;
      var key = resolveEnglishKey(anchor.textContent);
      if (!key) return;
      var next = translateKey(key, lang);
      if (normalize(anchor.textContent) !== normalize(next)) {
        anchor.textContent = next;
      }
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

  function buttonBgColor(anchor) {
    var el = anchor;
    for (var i = 0; i < 4 && el; i++) {
      var bg = getComputedStyle(el).backgroundColor;
      var rgb = parseRgb(bg);
      if (rgb && !(rgb.r === 0 && rgb.g === 0 && rgb.b === 0 && /rgba\(/.test(bg) === false && bg.indexOf("0)") >= 0)) {
        // skip fully transparent
        if (/rgba?\([^)]+,\s*0\)/.test(bg)) {
          el = el.parentElement;
          continue;
        }
        if (rgb.r + rgb.g + rgb.b > 0 || bg.indexOf("255") >= 0 || bg.indexOf("57") >= 0) {
          return rgb;
        }
      }
      // also check first solid child overlay used by Framer buttons
      var child = el.querySelector && el.querySelector(":scope > div");
      if (child) {
        var cbg = getComputedStyle(child).backgroundColor;
        var crgb = parseRgb(cbg);
        if (crgb && !/rgba?\([^)]+,\s*0\)/.test(cbg)) return crgb;
      }
      el = el.parentElement;
    }
    return parseRgb(getComputedStyle(anchor).backgroundColor);
  }

  function paintCtaColor(el, color) {
    if (!el) return;
    el.style.setProperty("color", color, "important");
    el.style.setProperty("-webkit-text-fill-color", color, "important");
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
        containers.forEach(function (container) {
          var textTarget = container.querySelector("p, span") || container;
          if (normalize(textTarget.textContent) !== normalize(next)) {
            textTarget.textContent = next;
          }
        });
      });
  }

  function forceCtaContrast() {
    document
      .querySelectorAll('a[data-framer-name="Desktop"], a[data-framer-name="Tablet"], a[data-framer-name="Mobile-Close"]')
      .forEach(function (anchor) {
        var bg = buttonBgColor(anchor);
        var isLight = !bg || luminance(bg) > 0.72;
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
        if (parent.closest("h1, h2, h3")) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-framer-component-type="RichTextContainer"]')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.tagName === "A" && parent.children.length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest('span[style*="inline-block"]')) return NodeFilter.FILTER_REJECT;
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

  function applyLanguage(lang, fromObserver) {
    if (!state.dict || state.applying) return;
    if (!fromObserver) state.lang = lang;
    state.applying = true;
    try {
      applyMeta(lang);
      applyHeadings(lang);
      applyRichTextContainers(lang);
      applyPlainAnchors(lang);
      applyFramerButtons(lang);
      applyDuplicateParagraphs(lang);
      applyLeafTextNodes(lang);
      applyAttributes(lang);
      forceCtaContrast();
      updateSwitcherButtons(lang);
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
        applyLanguage(id, false);
        closeAllMenus();
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
      hideFramerBadge();
      scheduleApply(true);
    });
    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function readStoredLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "bn" || saved === "hi" || saved === "en") return saved;
    } catch (_) {}
    return "en";
  }

  function boot() {
    fetch("/i18n/home-strings.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load translations");
        return res.json();
      })
      .then(function (json) {
        state.dict = json;
        buildReverseMaps(json.strings || {});
        state.lang = readStoredLang();
        mountSwitchers();
        hideFramerBadge();
        attachObserver();
        [300, 800, 1600, 3000].forEach(function (ms) {
          setTimeout(function () {
            if (menuIsOpen()) return;
            mountSwitchers();
            hideFramerBadge();
            applyLanguage(state.lang, false);
          }, ms);
        });
      })
      .catch(function (err) {
        console.warn("[ainf-i18n]", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
