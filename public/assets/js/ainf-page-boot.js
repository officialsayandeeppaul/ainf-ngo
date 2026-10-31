/* Preserve Framer letter animations. Fix mashed copy only when spans are already gone. */
(function () {
  if (window.__ainfPageBootBooted) return;
  window.__ainfPageBootBooted = true;

  // Record the served photos before anything here or in Framer touches them
  // (the image guard in <head> replays them when Framer re-renders a section).
  if (typeof window.__ainfImgSnap === "function") window.__ainfImgSnap();

  document.documentElement.classList.add("ainf-ready");

  // Appends a human countdown to a 429 "too many attempts" message so the
  // user knows when they can retry, instead of guessing.
  function ainfWithRetryWait(message, body) {
    var secs = body && Number(body.retryAfter);
    if (!secs || secs <= 0) return message;
    var mins = Math.ceil(secs / 60);
    var wait = mins >= 1 ? mins + " minute" + (mins === 1 ? "" : "s") : secs + " second" + (secs === 1 ? "" : "s");
    return message + " You can try again in about " + wait + ".";
  }

  // India-only mobile numbers. +91 is fixed (drawn before every phone box by
  // ainf-page-boot.css) and the box keeps ten digits, whatever is typed,
  // pasted or autofilled: "+91 98765 43210" becomes 9876543210. Framer's
  // inputs are React-controlled, so the cleaned value goes through the native
  // setter; assigning .value would update React's tracker and React would put
  // the old value back.
  var AINF_PHONE_FIELD = 'input[type="tel"], input[name="Phone"], input[name="phone"], input[name="Phone Number"]';
  var AINF_VALUE_SETTER = (Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value") || {}).set;

  function ainfMobileDigits(raw) {
    var digits = String(raw || "").replace(/\D/g, "");
    if (digits.length === 12 && digits.slice(0, 2) === "91") digits = digits.slice(2);
    else if (digits.length === 11 && digits.charAt(0) === "0") digits = digits.slice(1);
    return digits.slice(0, 10);
  }

  function ainfMobileOk(raw) {
    return /^[6-9]\d{9}$/.test(ainfMobileDigits(raw));
  }

  // Length caps that match what the server accepts, set when a field is first
  // focused (Framer re-renders drop attributes, focus puts them back).
  function ainfCapField(el) {
    if (el.tagName === "TEXTAREA") {
      if (el.maxLength < 0) el.maxLength = 2000;
      return;
    }
    if (el.tagName !== "INPUT" || el.maxLength >= 0) return;
    var type = (el.type || "text").toLowerCase();
    if (type === "email") el.maxLength = 200;
    else if (type === "text" || type === "search") el.maxLength = /amount/i.test(el.name || "") ? 9 : 80;
  }

  function ainfIsPhone(el) {
    return Boolean(el && el.tagName === "INPUT" && el.matches(AINF_PHONE_FIELD));
  }

  // Number keypad: set on the tap itself (before the keyboard opens) and again
  // on focus and typing, since Framer can swap in a fresh input meanwhile.
  function ainfPreparePhone(el) {
    if (el.getAttribute("inputmode") !== "numeric") el.setAttribute("inputmode", "numeric");
    if (el.getAttribute("autocomplete") !== "tel-national") el.setAttribute("autocomplete", "tel-national");
  }

  document.addEventListener(
    "pointerdown",
    function (event) {
      if (ainfIsPhone(event.target)) ainfPreparePhone(event.target);
    },
    true
  );

  document.addEventListener(
    "focusin",
    function (event) {
      var el = event.target;
      if (!el || !el.tagName) return;
      if (ainfIsPhone(el)) {
        ainfPreparePhone(el);
        return;
      }
      ainfCapField(el);
    },
    true
  );

  document.addEventListener(
    "input",
    function (event) {
      var el = event.target;
      if (!ainfIsPhone(el)) return;
      ainfPreparePhone(el);
      var clean = ainfMobileDigits(el.value);
      if (clean === el.value) return;
      if (AINF_VALUE_SETTER) AINF_VALUE_SETTER.call(el, clean);
      else el.value = clean;
    },
    true
  );

  // Framer hydrates the gift and project forms a moment after load and swaps
  // their inputs, wiping anything typed in that window (the /donate-now form
  // is above the fold, so people do type that early). What a person types is
  // kept in memory only and written back into the new inputs.
  var ainfFormMemory = {};
  var ainfFormWatch = null;
  var AINF_REMEMBER = /^(Name|Email|Phone|Amount|Support AINF Amount|Message)$/;

  function ainfRememberable(el) {
    if (!el || !el.name || !AINF_REMEMBER.test(el.name) || !el.form) return false;
    return Boolean(el.form.querySelector('select[name="Location"], [name="Choose The Cause"]'));
  }

  document.addEventListener(
    "input",
    function (event) {
      if (!event.isTrusted || !ainfRememberable(event.target)) return;
      ainfFormMemory[event.target.name] = event.target.value;
      ainfWatchForms();
    },
    true
  );

  // Started on the first keystroke in a gift form, so pages nobody types on
  // (and their letter-by-letter animations) pay nothing for it.
  function ainfWatchForms() {
    if (ainfFormWatch || !window.MutationObserver) return;
    ainfFormWatch = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (/^(FORM|INPUT|TEXTAREA)$/.test(node.tagName) || (node.firstElementChild && node.querySelector("input[name], textarea[name]"))) {
            ainfRestoreForms();
            return;
          }
        }
      }
    });
    ainfFormWatch.observe(document.documentElement, { childList: true, subtree: true });
  }

  function ainfRestoreForms() {
    var fields = document.querySelectorAll("form input[name], form textarea[name]");
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      var saved = ainfFormMemory[el.name];
      if (!saved || el.value || !ainfRememberable(el)) continue;
      var proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, "value");
      if (setter && setter.set) setter.set.call(el, saved);
      else el.value = saved;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function ainfIsPaused(body) {
    return Boolean(body && body.error === "payments_paused");
  }

  // A checkout answered 409 payments_paused: the server has already saved the
  // visitor's interest, so this window only thanks them and says what happens next.
  function ainfShowInterest(body) {
    var info = (body && body.interest) || {};
    var old = document.getElementById("ainf-interest-modal");
    if (old) old.remove();
    if (!document.getElementById("ainf-interest-style")) {
      var style = document.createElement("style");
      style.id = "ainf-interest-style";
      style.textContent =
        "#ainf-interest-modal{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Onest,Inter,system-ui,sans-serif}" +
        "#ainf-interest-modal .ainf-interest__backdrop{position:absolute;inset:0;background:rgba(16,28,22,.42);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:0;padding:0;cursor:pointer;animation:ainfInterestFade .2s ease-out}" +
        "@keyframes ainfInterestFade{from{opacity:0}to{opacity:1}}" +
        "#ainf-interest-modal .ainf-interest__panel{position:relative;width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;color:#1a1d1b;border-radius:22px;padding:26px 24px 22px;box-shadow:0 24px 64px rgba(16,28,22,.28);animation:ainfInterestIn .22s ease-out}" +
        "#ainf-interest-modal .ainf-interest__mark{width:44px;height:44px;border-radius:50%;background:#e7f6ee;color:#1c7d48;display:flex;align-items:center;justify-content:center;margin:0 0 14px}" +
        "#ainf-interest-modal h2{margin:0 0 8px;font-size:23px;line-height:1.15;font-weight:500;letter-spacing:-.03em}" +
        "#ainf-interest-modal p{margin:0 0 16px;font-size:15px;line-height:1.5;color:#3d4a44}" +
        "#ainf-interest-modal dl{margin:0 0 18px;padding:12px 14px;border-radius:14px;background:#f4f7f5;border:1px solid #e2e7e4;display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:14px}" +
        "#ainf-interest-modal dt{color:#5c6b64}" +
        "#ainf-interest-modal dd{margin:0;color:#1a1d1b;overflow-wrap:anywhere}" +
        "#ainf-interest-modal button.ainf-interest__ok{width:100%;border:0;border-radius:999px;background:#1c7d48;color:#fff;padding:13px 18px;font:inherit;font-size:15px;font-weight:500;cursor:pointer}" +
        "#ainf-interest-modal button.ainf-interest__ok:focus-visible{outline:3px solid rgba(28,125,72,.35);outline-offset:2px}" +
        "@keyframes ainfInterestIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}" +
        "@keyframes ainfInterestUp{from{transform:translateY(100%)}to{transform:none}}" +
        "html.ainf-interest-open,html.ainf-interest-open body{overflow:hidden!important}" +
        "@media (max-width:560px){" +
        "#ainf-interest-modal{align-items:flex-end;padding:0}" +
        "#ainf-interest-modal .ainf-interest__panel{width:100%;max-height:88vh;border-radius:22px 22px 0 0;padding:22px 18px calc(18px + env(safe-area-inset-bottom));animation:ainfInterestUp .26s ease-out}" +
        "#ainf-interest-modal .ainf-interest__mark{width:40px;height:40px;margin-bottom:12px}" +
        "#ainf-interest-modal h2{font-size:21px}" +
        "#ainf-interest-modal p{font-size:14.5px;margin-bottom:14px}" +
        "#ainf-interest-modal dl{grid-template-columns:1fr;gap:2px;padding:12px}" +
        "#ainf-interest-modal dt{font-size:12px;letter-spacing:.02em}" +
        "#ainf-interest-modal dd{margin-bottom:8px;font-size:14.5px}" +
        "#ainf-interest-modal dd:last-child{margin-bottom:0}" +
        "}" +
        "@media (prefers-reduced-motion:reduce){#ainf-interest-modal .ainf-interest__panel{animation:none}}";
      document.head.appendChild(style);
    }

    var previous = document.activeElement;
    var root = document.createElement("div");
    root.id = "ainf-interest-modal";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "ainf-interest-title");
    root.setAttribute("aria-describedby", "ainf-interest-body");

    var backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "ainf-interest__backdrop";
    backdrop.setAttribute("aria-label", "Close");
    backdrop.tabIndex = -1;

    var panel = document.createElement("div");
    panel.className = "ainf-interest__panel";
    var mark = document.createElement("div");
    mark.className = "ainf-interest__mark";
    mark.setAttribute("aria-hidden", "true");
    mark.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var title = document.createElement("h2");
    title.id = "ainf-interest-title";
    title.textContent = (body && body.title) || "Thank you for your interest";
    var text = document.createElement("p");
    text.id = "ainf-interest-body";
    text.textContent =
      (body && body.message) ||
      "We are not taking online payments right now, but we have saved your interest. The AINF team will contact you with a secure payment link.";
    var summary = document.createElement("dl");
    [
      ["Saved", info.what],
      ["Amount", info.amount],
      ["We will write to", info.email]
    ].forEach(function (pair) {
      if (!pair[1]) return;
      var dt = document.createElement("dt");
      dt.textContent = pair[0];
      var dd = document.createElement("dd");
      dd.textContent = pair[1];
      summary.appendChild(dt);
      summary.appendChild(dd);
    });
    var ok = document.createElement("button");
    ok.type = "button";
    ok.className = "ainf-interest__ok";
    ok.textContent = "Got it";

    panel.appendChild(mark);
    panel.appendChild(title);
    panel.appendChild(text);
    if (summary.children.length) panel.appendChild(summary);
    panel.appendChild(ok);
    root.appendChild(backdrop);
    root.appendChild(panel);

    function close() {
      document.removeEventListener("keydown", onKey, true);
      document.documentElement.classList.remove("ainf-interest-open");
      root.remove();
      if (previous && previous.focus) {
        try { previous.focus({ preventScroll: true }); } catch (error) { previous.focus(); }
      }
    }
    function onKey(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      } else if (event.key === "Tab") {
        event.preventDefault();
        ok.focus();
      }
    }
    backdrop.addEventListener("click", close);
    ok.addEventListener("click", close);
    document.addEventListener("keydown", onKey, true);
    ainfScrollbarGap();
    document.documentElement.classList.add("ainf-interest-open");
    document.body.appendChild(root);
    ok.focus({ preventScroll: true });
  }

  document.addEventListener(
    "click",
    function (event) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.target.closest && event.target.closest("#ainf-gift-modal, #ainf-join-modal, #ainf-mission-modal, #ainf-gift-menu-drawer")) return;
      // A project's "Our mission" CTA explains the foundation's mission; it is not a gift button.
      var mission = location.pathname.indexOf("/projects/") === 0 && event.target.closest && event.target.closest('[data-framer-name="btn hover variation"], [data-framer-name="Primary btn"], [data-framer-name="Primary"]');
      if (mission && missionLabel(mission)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openMissionModal(mission);
        return;
      }
      var link = event.target && event.target.closest && event.target.closest("a[href]");
      var url = null;
      var path = "";
      if (link && link.getAttribute("target") !== "_blank") {
        var raw = link.getAttribute("href") || "";
        if (raw && raw.charAt(0) !== "#") {
          try {
            url = new URL(raw, location.href);
          } catch (e) {
            url = null;
          }
        }
      }
      if (url && url.origin === location.origin) {
        path = url.pathname.replace(/\/$/, "") || "/";
        if (path === "/join-as-volunteer" || joinLabel(link)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          beginJoin(link);
          return;
        }
        // Template buttons keep their own link, unless they are a "Support AINF" button.
        if ((link.getAttribute("data-framer-name") === "Primary btn" || link.getAttribute("data-framer-name") === "Primary") && !supportLabel(link)) {
          return;
        }
        if (path === "/donate-now" || supportLabel(link)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          openGiftModal();
          return;
        }
      }
      // Framer's Primary btn is often a styled div rather than a <button>.
      var control =
        event.target.closest &&
        event.target.closest('button, [role="button"], [data-framer-name="Primary btn"], [data-framer-name="btn hover variation"]');
      if (control && supportLabel(control) && !(link && path === "/donate-now")) {
        var hostForm = control.closest && control.closest("form");
        if (!(hostForm && hostForm.querySelector('select[name="Location"]'))) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          openGiftModal();
          return;
        }
      }
      if (!url || url.origin !== location.origin) return;
      if (path.indexOf("/projects/") !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      var next = url.pathname + url.search + url.hash;
      if (location.pathname + location.search + location.hash !== next) window.location.assign(next);
    },
    true
  );

  function joinLabel(link) {
    var text = (link.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    return text.indexOf("join as field sevak") !== -1;
  }

  function supportLabel(link) {
    var text = (link.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    return text.indexOf("support ainf") !== -1;
  }

  function missionLabel(el) {
    return /^our mission$/i.test((el.textContent || "").replace(/\s+/g, " ").trim());
  }

  // /about-us#our-mission: the Mission & Vision block has no id in the Framer
  // export, so it is given one and brought into view under the fixed nav.
  // Framer replaces that block once during hydration (dropping the id and
  // shifting the layout) - under a second on a fast line, 14s or more on a
  // slow one, often well after load. So the spot is re-settled until that
  // replacement has happened and the block has then held still for a second
  // (30s at most), or the visitor scrolls, taps, or presses a key.
  function bootMissionAnchor() {
    if (location.pathname.replace(/\/$/, "") !== "/about-us" || location.hash !== "#our-mission") return;
    var moved = false;
    var started = Date.now();
    var served = null;
    var replacedAt = 0;
    var shiftedAt = started;
    function stop() { moved = true; }
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (type) {
      window.addEventListener(type, stop, { once: true, passive: true });
    });
    function settle() {
      var block = document.getElementById("our-mission") || document.querySelector('[data-framer-name="Mission & Vission"]');
      if (!block) return;
      if (!served) served = block;
      else if (!replacedAt && !served.isConnected) replacedAt = Date.now();
      if (!block.id) block.id = "our-mission";
      var nav = document.getElementById("ainf-global-nav");
      var offset = (nav ? Math.min(140, Math.max(0, nav.getBoundingClientRect().bottom)) : 80) + 20;
      var drift = block.getBoundingClientRect().top - offset;
      if (Math.abs(drift) > 2) {
        shiftedAt = Date.now();
        window.scrollTo(0, Math.max(0, window.pageYOffset + drift));
      }
    }
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    settle();
    var timer = setInterval(function () {
      var now = Date.now();
      var done = replacedAt && now - replacedAt > 1000 && now - shiftedAt > 1000;
      if (moved || done || now - started > 30000) {
        clearInterval(timer);
        return;
      }
      settle();
    }, 150);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootMissionAnchor);
  else bootMissionAnchor();

  var AINF_POPUPS = ["ainf-gift-modal", "ainf-join-modal", "ainf-mission-modal", "ainf-pay-shield"];

  // Measured while the page still shows its scrollbar (0 for overlay
  // scrollbars on phones and macOS); the lock CSS pads the page by it.
  function ainfScrollbarGap() {
    var html = document.documentElement;
    if (html.classList.contains("ainf-modal-lock") || html.classList.contains("ainf-interest-open")) return;
    var gap = Math.max(0, window.innerWidth - html.clientWidth);
    html.style.setProperty("--ainf-scrollbar-gap", gap + "px");
  }

  function ainfAnyPopup() {
    return AINF_POPUPS.some(function (id) {
      var el = document.getElementById(id);
      return el && !el.hidden;
    });
  }

  function lockScroll(on) {
    if (on) {
      ainfScrollbarGap();
      document.documentElement.classList.add("ainf-modal-lock");
      return;
    }
    if (!ainfAnyPopup()) document.documentElement.classList.remove("ainf-modal-lock");
  }

  // Framer's Smooth Scroll (Lenis, on home and /donate-now) turns wheel events
  // into scripted page scrolls that overflow:hidden does not stop, and iOS
  // ignores overflow:hidden for touch. While a pop-up is open, wheel and touch
  // never reach Lenis, and only a scroll area inside the pop-up may move.
  // The lock class also covers a project's pay sheet (Framer's own overlay);
  // the visible-window check covers code elsewhere dropping the class.
  function ainfPopupOpen() {
    var html = document.documentElement;
    return ainfAnyPopup() || html.classList.contains("ainf-modal-lock") || html.classList.contains("ainf-interest-open");
  }

  function ainfCanScroll(target, dy) {
    var el = target && target.nodeType === 1 ? target : target && target.parentElement;
    if (!el || !el.closest || !el.closest("#ainf-gift-modal, #ainf-join-modal, #ainf-mission-modal, #ainf-interest-modal, .ainf-gift-menu__drawer, .ainf-pay-sheet")) return false;
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (el.scrollHeight <= el.clientHeight + 1) continue;
      var overflow = getComputedStyle(el).overflowY;
      if (overflow !== "auto" && overflow !== "scroll") continue;
      if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
    }
    return false;
  }

  var ainfTouchY = 0;
  window.addEventListener("touchstart", function (event) {
    if (event.touches.length === 1) ainfTouchY = event.touches[0].clientY;
  }, { capture: true, passive: true });

  function ainfGuardScroll(event) {
    if (!ainfPopupOpen()) return;
    event.stopPropagation();
    var dy;
    if (event.type === "wheel") {
      dy = event.deltaY;
    } else {
      if (event.touches.length !== 1) {
        event.preventDefault();
        return;
      }
      var y = event.touches[0].clientY;
      dy = ainfTouchY - y;
      ainfTouchY = y;
    }
    if (!ainfCanScroll(event.target, dy)) event.preventDefault();
  }
  window.addEventListener("wheel", ainfGuardScroll, { capture: true, passive: false });
  window.addEventListener("touchmove", ainfGuardScroll, { capture: true, passive: false });

  // "Our mission" on a project page: the foundation's mission, vision and
  // reach (About copy), with this project's own mission line from the page.
  var missionReturn = null;
  var MISSION_COPY = {
    mission: "Help every learner in our blocks reach a classroom, a skill, and a first job — with health, safety, and farm support around them.",
    vision: "Eastern India where a student's postcode does not decide their degree, their job, or their dignity.",
    reach: "We walk with learners and families from Jamtara outward — classrooms, skill labs, health camps, and fair work under one roof."
  };

  function missionProjectLine() {
    var section = document.getElementById("our-mission");
    var line = section && section.querySelector("h2");
    var text = line ? line.textContent.replace(/\s+/g, " ").trim() : "";
    var h1 = document.querySelector("h1");
    return { title: h1 ? h1.textContent.replace(/\s+/g, " ").trim() : "", text: text };
  }

  function openMissionModal(trigger) {
    missionReturn = trigger || document.activeElement;
    var root = document.getElementById("ainf-mission-modal");
    if (!root) {
      root = document.createElement("div");
      root.id = "ainf-mission-modal";
      root.className = "ainf-mission-modal";
      root.hidden = true;
      root.innerHTML =
        '<div class="ainf-mission-modal__card" role="dialog" aria-modal="true" aria-labelledby="ainf-mission-title" tabindex="-1">' +
        '<button type="button" class="ainf-mission-modal__close" data-close aria-label="Close">×</button>' +
        '<p class="ainf-mission-modal__eyebrow">All Indian Nevarlands Foundation</p>' +
        '<h2 id="ainf-mission-title">Our mission</h2>' +
        '<p class="ainf-mission-modal__lead"></p>' +
        '<div class="ainf-mission-modal__project" hidden><p class="ainf-mission-modal__label"></p><p class="ainf-mission-modal__line"></p></div>' +
        '<div class="ainf-mission-modal__grid">' +
        '<div><p class="ainf-mission-modal__label">Our vision</p><p class="ainf-mission-modal__text" data-vision></p></div>' +
        '<div><p class="ainf-mission-modal__label">Where we work</p><p class="ainf-mission-modal__text" data-reach></p></div>' +
        "</div>" +
        '<div class="ainf-mission-modal__actions">' +
        '<button type="button" class="ainf-mission-modal__primary" data-mission-give><span class="ainf-gift-modal__dot" aria-hidden="true"></span>Support AINF</button>' +
        '<a class="ainf-mission-modal__secondary" href="/about-us#our-mission">More about AINF</a>' +
        "</div></div>";
      root.querySelector(".ainf-mission-modal__lead").textContent = MISSION_COPY.mission;
      root.querySelector("[data-vision]").textContent = MISSION_COPY.vision;
      root.querySelector("[data-reach]").textContent = MISSION_COPY.reach;
      document.body.appendChild(root);
      root.addEventListener("click", function (event) {
        if (event.target === root || (event.target.closest && event.target.closest("[data-close]"))) {
          closeMissionModal(true);
          return;
        }
        if (event.target.closest && event.target.closest("[data-mission-give]")) {
          // One window at a time: this one closes before the gift window opens.
          closeMissionModal(false);
          if (missionReturn && missionReturn.focus) missionReturn.focus({ preventScroll: true });
          openGiftModal();
        }
      });
      document.addEventListener("keydown", function (event) {
        if (root.hidden) return;
        if (event.key === "Escape") {
          event.preventDefault();
          closeMissionModal(true);
          return;
        }
        if (event.key !== "Tab") return;
        var items = Array.prototype.slice.call(root.querySelectorAll("a[href], button"));
        var first = items[0];
        var last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === root.firstElementChild)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
    }
    var project = missionProjectLine();
    var box = root.querySelector(".ainf-mission-modal__project");
    box.hidden = !project.text;
    box.querySelector(".ainf-mission-modal__label").textContent = project.title ? "This project · " + project.title : "This project";
    box.querySelector(".ainf-mission-modal__line").textContent = project.text;
    var card = root.querySelector(".ainf-mission-modal__card");
    card.scrollTop = 0;
    root.hidden = false;
    lockScroll(true);
    card.focus({ preventScroll: true });
  }

  function closeMissionModal(restoreFocus) {
    var root = document.getElementById("ainf-mission-modal");
    if (!root || root.hidden) return;
    root.hidden = true;
    lockScroll(false);
    if (restoreFocus && missionReturn && missionReturn.focus) missionReturn.focus({ preventScroll: true });
  }

  var joinReturn = null;
  function beginJoin(trigger) {
    joinReturn = trigger;
    fetch("/api/session/state", { credentials: "same-origin", headers: { accept: "application/json" } })
      .then(function (response) { return response.ok ? response.json() : { signedIn: false }; })
      .catch(function () { return { signedIn: false }; })
      .then(function (state) {
        if (state && state.signedIn) {
          window.location.assign(state.identityReady ? "/account/membership" : "/account/verify");
          return;
        }
        openJoinModal();
      });
  }

  function openJoinModal() {
    var existing = document.getElementById("ainf-join-modal");
    if (existing) {
      existing.hidden = false;
      lockScroll(true);
      var first = existing.querySelector("a, button");
      if (first) first.focus();
      return;
    }
    var root = document.createElement("div");
    root.id = "ainf-join-modal";
    root.className = "ainf-join-modal";
    root.innerHTML =
      '<div class="ainf-join-modal__card" role="dialog" aria-modal="true" aria-labelledby="ainf-join-title">' +
      '<h2 id="ainf-join-title">Account needed</h2>' +
      "<p>Joining as a Field Sevak needs an account, then identity verification, then a membership plan. A donation to AINF does not.</p>" +
      '<div class="ainf-join-modal__actions">' +
      '<a class="ainf-join-modal__primary" href="/sign-in?redirect_url=%2Faccount%2Fmembership">Sign in</a>' +
      '<a href="/sign-up?redirect_url=%2Faccount%2Fmembership">Create account</a>' +
      '<button type="button" data-close>Not now</button>' +
      "</div></div>";
    document.body.appendChild(root);
    var card = root.querySelector(".ainf-join-modal__card");
    var focusables = function () {
      return Array.prototype.slice.call(root.querySelectorAll("a, button"));
    };
    function close() {
      root.hidden = true;
      lockScroll(false);
      if (joinReturn && joinReturn.focus) joinReturn.focus();
    }
    lockScroll(true);
    root.addEventListener("click", function (event) {
      if (event.target === root || (event.target.closest && event.target.closest("[data-close]"))) close();
    });
    document.addEventListener("keydown", function (event) {
      if (root.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      var items = focusables();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    var opener = root.querySelector("a");
    if (opener) opener.focus();
    if (card) card.setAttribute("tabindex", "-1");
  }

  var giftReturn = null;
  var giftBusy = false;
  var giftTargets = [];
  var giftMaxPaise = 10000000;
  var giftLoad = 0;
  var giftLoading = false;
  var giftCauseTouched = false;

  function ensureCheckout() {
    if (!document.getElementById("ainf-razorpay-layer")) {
      var layer = document.createElement("style");
      layer.id = "ainf-razorpay-layer";
      // Never raise .razorpay-backdrop: Razorpay nests it beside the checkout
      // iframe, so a max z-index puts the dim layer over the form and eats clicks.
      layer.textContent = ".razorpay-container{z-index:2147483647!important}" +
        "html.ainf-rzp-open body>*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";
      document.head.appendChild(layer);
    }
    if (document.querySelector('script[data-ainf-razorpay="1"]')) return;
    var checkout = document.createElement("script");
    checkout.src = "https://checkout.razorpay.com/v1/checkout.js";
    checkout.async = true;
    checkout.setAttribute("data-ainf-razorpay", "1");
    document.head.appendChild(checkout);
  }

  // Freeze ONLY our own page containers, by name. We never iterate over
  // Razorpay's elements, so its checkout (classic OR modern v2) can never be
  // frozen by mistake — that was the bug that left the modal visible but dead.
  var AINF_RZP_PAGE_SELECTOR =
    "#__next,#main,#overlay,#template-overlay," +
    "#ainf-global-nav,#ainf-site-footer," +
    "#ainf-gift-modal,.ainf-gift-modal,#ainf-join-modal,.ainf-join-modal," +
    "#ainf-pay-shield,.ainf-pay-sheet,#ainf-gift-menu-drawer";

  function ainfRzpFreeze() {
    document.documentElement.classList.add("ainf-rzp-open");
    var nodes = document.querySelectorAll(AINF_RZP_PAGE_SELECTOR);
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute("inert", "");
      nodes[i].setAttribute("data-ainf-rzp-inert", "1");
    }
  }

  function ainfRzpThaw() {
    document.documentElement.classList.remove("ainf-rzp-open");
    var marked = document.querySelectorAll("[data-ainf-rzp-inert]");
    for (var i = 0; i < marked.length; i++) {
      marked[i].removeAttribute("inert");
      marked[i].removeAttribute("data-ainf-rzp-inert");
    }
  }

  function giftRupees(paise) {
    return (paise / 100).toLocaleString("en-IN");
  }

  function giftNote(root, text, isError) {
    var line = root.querySelector("[data-note]");
    if (!line) return;
    line.hidden = !text;
    line.textContent = text || "";
    line.className = isError ? "ainf-gift-note is-error" : "ainf-gift-note";
  }

  // The message goes under the whole field: for the phone that is the +91 box,
  // not the input inside it.
  function giftFieldHost(el) {
    var box = el.closest && el.closest(".ainf-phone");
    return box ? box.parentElement : el.parentElement;
  }

  function clearGiftFieldError(el) {
    if (!el) return;
    el.removeAttribute("data-gift-error");
    var host = giftFieldHost(el);
    var msg = host && host.querySelector(".ainf-gift-field-error");
    if (msg) msg.remove();
  }

  function setGiftFieldError(el, text) {
    if (!el) return;
    el.setAttribute("data-gift-error", "1");
    var host = giftFieldHost(el);
    if (!host) return;
    var existing = host.querySelector(".ainf-gift-field-error");
    if (existing) { existing.textContent = text; return; }
    var msg = document.createElement("span");
    msg.className = "ainf-gift-field-error";
    msg.textContent = text;
    host.appendChild(msg);
  }

  function validateGiftField(root, el) {
    var n = el.name;
    var v = (el.value || "").trim();
    if (n === "name") {
      if (v.length < 2) { setGiftFieldError(el, "Enter your full name."); return false; }
    } else if (n === "email") {
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setGiftFieldError(el, "Enter a valid email address."); return false; }
    } else if (n === "phone") {
      if (!ainfMobileOk(v)) { setGiftFieldError(el, "Enter your 10-digit mobile number."); return false; }
    } else if (n === "amount") {
      if (v && !/^\d+(\.\d{1,2})?$/.test(v)) { setGiftFieldError(el, "Enter a number, e.g. 500"); return false; }
    }
    clearGiftFieldError(el);
    return true;
  }

  function whenRazorpay(done, fail) {
    if (window.Razorpay) {
      done();
      return;
    }
    ensureCheckout();
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (window.Razorpay) {
        clearInterval(timer);
        done();
      } else if (tries > 80) {
        clearInterval(timer);
        if (fail) fail();
      }
    }, 100);
  }

  function pageGiftHint() {
    var path = (location.pathname || "").replace(/\/$/, "").toLowerCase();
    var slug = path.split("/").filter(Boolean).pop() || "";
    var mission = "";
    if (/education|shiksha|every-child/.test(path)) mission = "shiksha";
    else if (/water|sanitation|janajati|kheti|tribal|farm/.test(path)) mission = "janajati";
    else if (/women|nari|empowerment/.test(path)) mission = "nari-suraksha";
    else if (/health|swasthya|medical/.test(path)) mission = "swasthya";
    else if (/food|nutrition|rozgar|skill|meal/.test(path)) mission = "rozgar";
    return {
      mission: mission,
      project: path.indexOf("/projects/") === 0 ? slug : ""
    };
  }

  function giftPlainTitle(row) {
    if (!row) return "Select Cause";
    var plain = {
      shiksha: "Education — Shiksha",
      swasthya: "Health — Swasthya",
      rozgar: "Work — Rozgar",
      "nari-suraksha": "Women — Nari Suraksha",
      janajati: "Farming & villages — Janajati",
      ainf: "AINF overall"
    };
    if (row.kind === "PROJECT") return row.title;
    return plain[row.slug] || row.title;
  }

  function giftQuery() {
    var hint = pageGiftHint();
    var params = [];
    if (hint.project) params.push("project=" + encodeURIComponent(hint.project));
    if (hint.mission) params.push("mission=" + encodeURIComponent(hint.mission));
    return params.length ? "?" + params.join("&") : "";
  }

  function chooseGiftValue(body) {
    var hint = pageGiftHint();
    var selected = body && body.selected;
    if (hint.project) {
      var project = giftTargets.find(function (row) {
        return row.kind === "PROJECT" && row.slug === hint.project;
      });
      if (project) return project.kind + ":" + project.slug;
    }
    if (hint.mission) {
      var mission = giftTargets.find(function (row) {
        return row.kind === "MISSION" && row.slug === hint.mission;
      });
      if (mission) return mission.kind + ":" + mission.slug;
    }
    if (selected) return selected.kind + ":" + selected.slug;
    var general = giftTargets.find(function (row) { return row.kind === "GENERAL"; });
    return general ? general.kind + ":" + general.slug : "";
  }

  function earlyGiftLabel() {
    var hint = pageGiftHint();
    var plain = {
      shiksha: "Education — Shiksha",
      swasthya: "Health — Swasthya",
      rozgar: "Work — Rozgar",
      "nari-suraksha": "Women — Nari Suraksha",
      janajati: "Farming & villages — Janajati"
    };
    return plain[hint.mission] || "";
  }

  function applyGiver(root, giver, signedIn) {
    if (!giver) return;
    ["name", "email", "phone"].forEach(function (key) {
      var input = root.querySelector('[name="' + key + '"]');
      if (!input || input.value || input.getAttribute("data-ainf-touched") === "1" || !giver[key]) return;
      input.value = giver[key];
    });
    if (signedIn) {
      ["name", "email"].forEach(function (key) {
        var input = root.querySelector('[name="' + key + '"]');
        if (!input || !giver[key]) return;
        input.readOnly = true;
        input.setAttribute("data-gift-locked", "1");
      });
    }
  }

  function loadGiver(root) {
    var nameInput = root.querySelector('[name="name"]');
    var emailInput = root.querySelector('[name="email"]');
    [nameInput, emailInput].forEach(function (el) {
      if (el) el.setAttribute("data-gift-loading", "1");
    });
    fetch("/api/session/state", { credentials: "same-origin", headers: { accept: "application/json" } })
      .then(function (response) { return response.json(); })
      .then(function (state) {
        [nameInput, emailInput].forEach(function (el) {
          if (el) el.removeAttribute("data-gift-loading");
        });
        applyGiver(root, state && state.giver, state && state.signedIn);
        var name = root.querySelector('[name="name"]');
        var amount = root.querySelector('[name="amount"]');
        if (name && name.value && amount && document.activeElement === name) amount.focus();
        else if (name && !name.readOnly) name.focus();
      })
      .catch(function () {
        [nameInput, emailInput].forEach(function (el) {
          if (el) el.removeAttribute("data-gift-loading");
        });
      });
  }

  window.__ainfOpenGiftModal = function () { openGiftModal(); };

  function openGiftModal() {
    ensureCheckout();
    giftReturn = document.activeElement;
    var root = document.getElementById("ainf-gift-modal");
    if (!root) {
      root = document.createElement("div");
      root.id = "ainf-gift-modal";
      root.className = "ainf-gift-modal";
      root.innerHTML =
        '<div class="ainf-gift-modal__card" role="dialog" aria-modal="true" aria-labelledby="ainf-gift-title">' +
        '<button type="button" class="ainf-gift-modal__close" data-close aria-label="Close">×</button>' +
        '<h2 id="ainf-gift-title">Support AINF</h2>' +
        '<p class="ainf-gift-modal__lead">Fill the form below — you’ll receive a receipt once the amount is confirmed.</p>' +
        '<form class="ainf-gift-modal__form" novalidate>' +
        '<div class="ainf-gift-modal__grid">' +
        '<label>Full Name<input name="name" autocomplete="name" maxlength="80" placeholder="Enter Your Name"></label>' +
        '<label>Email ID<input name="email" type="email" autocomplete="email" maxlength="200" placeholder="Enter Your Email"></label>' +
        '<label>Desk / Vertical<div class="ainf-gift-menu">' +
        '<button type="button" class="ainf-gift-menu__trigger" aria-haspopup="listbox" aria-expanded="false">' +
        '<span class="ainf-gift-menu__label is-placeholder">Select Cause</span>' +
        '<span class="ainf-gift-menu__chevron" aria-hidden="true"></span></button>' +
        '<div class="ainf-gift-menu__drawer" id="ainf-gift-menu-drawer" hidden><ul class="ainf-gift-menu__list" role="listbox"></ul></div>' +
        '<input type="hidden" name="cause" value="">' +
        "</div></label>" +
        '<label><span class="ainf-gift-modal__title">Amount (INR)<span class="ainf-refund-star" aria-hidden="true">*</span></span><input name="amount" inputmode="decimal" autocomplete="off" maxlength="9" placeholder="Support AINF Amount"></label>' +
        '<div class="ainf-gift-modal__chips" data-chips></div>' +
        '<label class="ainf-gift-modal__span">Phone<span class="ainf-phone"><input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" pattern="[6-9][0-9]{9}" placeholder="Enter Your Phone"></span></label>' +
        '<label class="ainf-gift-modal__span">Note (optional)<textarea name="note" rows="3" maxlength="500" placeholder="Enter Your Message"></textarea></label>' +
        "</div>" +
        '<p class="ainf-gift-note" data-note hidden></p>' +
        '<button type="submit" class="ainf-gift-modal__submit"><span class="ainf-gift-modal__dot" aria-hidden="true"></span>Support AINF</button>' +
        '<p class="ainf-gift-modal__policy">Donations are non-refundable once paid.</p>' +
        "</form></div>";
      document.body.appendChild(root);
      var card = root.querySelector(".ainf-gift-modal__card");
      var form = root.querySelector("form");
      var causeTrigger = root.querySelector(".ainf-gift-menu__trigger");
      causeTrigger.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var drawer = document.getElementById("ainf-gift-menu-drawer");
        if (drawer && drawer.hidden) openGiftMenu(root);
        else closeGiftMenu(root);
      });
      function close() {
        if (giftBusy) return;
        root.__ainfMenuWanted = false;
        closeGiftMenu(root);
        root.hidden = true;
        lockScroll(false);
        if (giftReturn && giftReturn.focus) giftReturn.focus();
      }
      root.__ainfClose = close;
      root.addEventListener("click", function (event) {
        if (!(event.target.closest && event.target.closest(".ainf-gift-menu"))) closeGiftMenu(root);
        if (event.target === root || (event.target.closest && event.target.closest("[data-close]"))) close();
      });
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        submitGiftModal(root);
      });
      form.querySelector('[name="amount"]').addEventListener("input", function () {
        var v = this.value;
        var cleaned = v.replace(/[^\d.]/g, "").replace(/^(\d*\.?\d{0,2}).*/, "$1");
        if (cleaned !== v) this.value = cleaned;
        clearGiftFieldError(this);
        markGiftChips(root);
      });
      form.querySelector('[name="phone"]').addEventListener("input", function () {
        var v = this.value;
        var cleaned = ainfMobileDigits(v);
        if (cleaned !== v) this.value = cleaned;
        clearGiftFieldError(this);
      });
      form.addEventListener("input", function (event) {
        if (event.target && event.target.name) {
          event.target.setAttribute("data-ainf-touched", "1");
          clearGiftFieldError(event.target);
        }
      });
      form.addEventListener("blur", function (event) {
        var el = event.target;
        if (!el || !el.name) return;
        if (el.getAttribute("data-gift-locked") === "1") return;
        if (el.getAttribute("data-gift-loading") === "1") return;
        if (el.getAttribute("data-ainf-touched") !== "1") return;
        validateGiftField(root, el);
      }, true);
      document.addEventListener("keydown", function (event) {
        if (root.hidden) return;
        if (event.key === "Escape") {
          event.preventDefault();
          var drawer = document.getElementById("ainf-gift-menu-drawer");
          if (drawer && !drawer.hidden) {
            closeGiftMenu(root);
            if (causeTrigger) causeTrigger.focus();
            return;
          }
          close();
          return;
        }
        if (event.key !== "Tab") return;
        var items = Array.prototype.slice.call(root.querySelectorAll("input, textarea, button")).filter(function (el) {
          return el.type !== "hidden" && !(el.closest && el.closest("[hidden]"));
        });
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
      if (card) card.setAttribute("tabindex", "-1");
      window.addEventListener("resize", function () {
        if (!root.hidden) placeGiftMenu(root);
      });
      window.addEventListener("scroll", function () {
        if (!root.hidden) placeGiftMenu(root);
      }, true);
    }
    giftCauseTouched = false;
    root.hidden = false;
    lockScroll(true);
    var lead = root.querySelector(".ainf-gift-modal__lead");
    var early = earlyGiftLabel();
    if (lead) {
      lead.textContent = early
        ? "This donation goes to " + early + ". You can change the cause. A receipt comes after payment."
        : "Fill the form below — you’ll receive a receipt once the amount is confirmed.";
    }
    loadGiftTargets(root);
    loadGiver(root);
    var name = root.querySelector('[name="name"]');
    var amount = root.querySelector('[name="amount"]');
    if (name && name.value && amount) amount.focus();
    else if (name) name.focus();
  }

  function giftRow(root) {
    var input = root.querySelector('input[name="cause"]');
    if (!input || !input.value) return null;
    return giftTargets.find(function (row) { return row.kind + ":" + row.slug === input.value; }) || null;
  }

  function giftDrawer() {
    return document.getElementById("ainf-gift-menu-drawer");
  }

  function placeGiftMenu(root) {
    var trigger = root.querySelector(".ainf-gift-menu__trigger");
    var drawer = giftDrawer();
    if (!trigger || !drawer || drawer.hidden) return;
    var rect = trigger.getBoundingClientRect();
    var gap = 8;
    var width = rect.width;
    var left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    var spaceBelow = window.innerHeight - rect.bottom - gap - 12;
    var spaceAbove = rect.top - gap - 12;
    var openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    var maxHeight = Math.max(140, Math.min(280, openUp ? spaceAbove : spaceBelow));
    drawer.style.left = left + "px";
    drawer.style.width = width + "px";
    drawer.style.maxHeight = maxHeight + "px";
    // Opening upward, sit on the field by the drawer's real height, not its cap,
    // or a short list floats away from the field.
    var height = openUp ? Math.min(maxHeight, drawer.offsetHeight || maxHeight) : 0;
    drawer.style.top = (openUp ? Math.max(8, rect.top - height - gap) : rect.bottom + gap) + "px";
  }

  function closeGiftMenu(root) {
    var drawer = giftDrawer();
    var trigger = root.querySelector(".ainf-gift-menu__trigger");
    if (drawer) drawer.hidden = true;
    if (trigger) {
      trigger.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }
  }

  function openGiftMenu(root) {
    var drawer = giftDrawer();
    var trigger = root.querySelector(".ainf-gift-menu__trigger");
    if (!drawer) return;
    if (!giftTargets.length) {
      // Tapped before the causes arrived (slow line): open as soon as they do.
      root.__ainfMenuWanted = true;
      if (!giftLoading) loadGiftTargets(root);
      return;
    }
    if (drawer.parentElement !== document.body) document.body.appendChild(drawer);
    drawer.hidden = false;
    if (trigger) {
      trigger.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
    }
    placeGiftMenu(root);
  }

  function setGiftCause(root, value) {
    var input = root.querySelector('input[name="cause"]');
    var label = root.querySelector(".ainf-gift-menu__label");
    var row = giftTargets.find(function (item) { return item.kind + ":" + item.slug === value; }) || null;
    if (input) input.value = row ? value : "";
    if (label) {
      label.textContent = row ? giftPlainTitle(row) : (earlyGiftLabel() || "Select Cause");
      label.classList.toggle("is-placeholder", !row && !earlyGiftLabel());
    }
    var scope = giftDrawer() || root;
    scope.querySelectorAll(".ainf-gift-menu__option").forEach(function (button) {
      var on = button.getAttribute("data-value") === (input ? input.value : "");
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function fillGiftMenu(root, want) {
    var list = (giftDrawer() || root).querySelector(".ainf-gift-menu__list");
    if (!list) return;
    list.textContent = "";
    giftTargets.forEach(function (row) {
      var item = document.createElement("li");
      var button = document.createElement("button");
      var value = row.kind + ":" + row.slug;
      button.type = "button";
      button.className = "ainf-gift-menu__option";
      button.setAttribute("role", "option");
      button.setAttribute("data-value", value);
      button.textContent = giftPlainTitle(row);
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        giftCauseTouched = true;
        setGiftCause(root, value);
        closeGiftMenu(root);
        paintGiftModal(root);
        giftNote(root, "", false);
      });
      item.appendChild(button);
      list.appendChild(item);
    });
    setGiftCause(root, want || "");
  }

  function markGiftChips(root) {
    var amount = root.querySelector('[name="amount"]');
    var raw = amount ? Number(amount.value) : NaN;
    var paise = Number.isFinite(raw) ? Math.round(raw * 100) : 0;
    root.querySelectorAll(".ainf-gift-modal__chip").forEach(function (chip) {
      chip.classList.toggle("is-on", Number(chip.getAttribute("data-paise")) === paise);
    });
  }

  function paintGiftModal(root) {
    var row = giftRow(root);
    var amount = root.querySelector('[name="amount"]');
    var chips = root.querySelector("[data-chips]");
    if (amount && row && document.activeElement !== amount) {
      amount.placeholder = "Minimum ₹" + giftRupees(row.minPaise);
    }
    var lead = root.querySelector(".ainf-gift-modal__lead");
    if (lead) {
      lead.textContent = row
        ? "This donation goes to " + giftPlainTitle(row) + ". You can change the cause. A receipt comes after payment."
        : "Fill the form below — you’ll receive a receipt once the amount is confirmed.";
    }
    if (!chips) return;
    chips.textContent = "";
    if (!row || !row.suggestedPaise) return;
    row.suggestedPaise.forEach(function (paise) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ainf-gift-modal__chip";
      chip.setAttribute("data-paise", String(paise));
      chip.textContent = "₹" + giftRupees(paise);
      chip.addEventListener("click", function () {
        if (amount) amount.value = String(paise / 100);
        markGiftChips(root);
        giftNote(root, "", false);
      });
      chips.appendChild(chip);
    });
    markGiftChips(root);
  }

  function loadGiftTargets(root, attempt) {
    attempt = attempt || 1;
    var input = root.querySelector('input[name="cause"]');
    var button = root.querySelector('button[type="submit"]');
    var pending = root.querySelector(".ainf-gift-menu__label");
    var early = earlyGiftLabel();
    if (!giftTargets.length) {
      if (button) button.disabled = true;
      if (pending && !giftCauseTouched) {
        pending.textContent = early || "Loading causes…";
        pending.classList.toggle("is-placeholder", !early);
      }
    } else if (!giftCauseTouched) {
      fillGiftMenu(root, chooseGiftValue({ selected: null }));
      paintGiftModal(root);
    }
    giftNote(root, "", false);
    var token = ++giftLoad;
    giftLoading = true;
    // Two quiet retries (after 1.2 s, then 2.4 s) before telling the visitor.
    function retry() {
      if (attempt >= 3 || root.hidden) return false;
      setTimeout(function () {
        if (token === giftLoad && !root.hidden) loadGiftTargets(root, attempt + 1);
      }, 1200 * attempt);
      return true;
    }
    // It answers in about 0.2 s; one that hangs on a poor line is cut off after
    // 6 s and retried like a failure.
    var abort = typeof AbortController === "function" ? new AbortController() : null;
    var cutoff = abort ? setTimeout(function () { abort.abort(); }, 6000) : 0;
    fetch("/api/donations/targets" + giftQuery(), { headers: { accept: "application/json" }, signal: abort ? abort.signal : undefined })
      .then(function (response) {
        return response.json().then(function (body) { return { ok: response.ok, body: body }; });
      })
      .then(function (result) {
        clearTimeout(cutoff);
        if (token !== giftLoad) return;
        giftLoading = false;
        if (!result.ok) {
          if (result.body && result.body.error !== "payments_paused" && !giftTargets.length && retry()) return;
          if (button) button.disabled = !giftTargets.length;
          if (pending && !giftTargets.length) {
            pending.textContent = "Select Cause";
            pending.classList.add("is-placeholder");
          }
          giftNote(root, (result.body && result.body.message) || "The cause list could not be loaded.", true);
          return;
        }
        giftTargets = result.body.targets || [];
        giftMaxPaise = result.body.maxPaise || giftMaxPaise;
        var current = input && giftCauseTouched ? input.value : "";
        fillGiftMenu(root, current || chooseGiftValue(result.body));
        if (button) button.disabled = false;
        giftNote(root, "", false);
        paintGiftModal(root);
        if (root.__ainfMenuWanted && !root.hidden && giftTargets.length) {
          root.__ainfMenuWanted = false;
          openGiftMenu(root);
        }
      })
      .catch(function () {
        clearTimeout(cutoff);
        if (token !== giftLoad) return;
        giftLoading = false;
        if (!giftTargets.length && retry()) return;
        if (button) button.disabled = !giftTargets.length;
        if (pending && !giftTargets.length) {
          pending.textContent = "Select Cause";
          pending.classList.add("is-placeholder");
        }
        giftNote(root, giftTargets.length ? "" : "The cause list could not be loaded. Tap Desk / Vertical to try again.", true);
      });
  }

  function submitGiftModal(root) {
    if (giftBusy) return;
    var row = giftRow(root);
    var name = root.querySelector('[name="name"]');
    var email = root.querySelector('[name="email"]');
    var phone = root.querySelector('[name="phone"]');
    var amount = root.querySelector('[name="amount"]');
    var button = root.querySelector('button[type="submit"]');
    if (!row) {
      giftNote(root, "Choose a cause from the list.", true);
      var causeTrigger = root.querySelector(".ainf-gift-menu__trigger");
      if (causeTrigger) causeTrigger.focus();
      return;
    }
    var raw = amount ? String(amount.value || "").trim() : "";
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      giftNote(root, "Enter an amount in rupees.", true);
      if (amount) amount.focus();
      return;
    }
    var paise = Math.round(Number(raw) * 100);
    if (paise < row.minPaise) {
      giftNote(root, "The minimum for " + row.title + " is ₹" + giftRupees(row.minPaise) + ".", true);
      if (amount) amount.focus();
      return;
    }
    if (paise > giftMaxPaise) {
      giftNote(root, "The maximum for a donation is ₹" + giftRupees(giftMaxPaise) + ".", true);
      if (amount) amount.focus();
      return;
    }
    if (!name || name.value.trim().length < 2) {
      giftNote(root, "Enter your full name.", true);
      if (name) name.focus();
      return;
    }
    var emailVal = email ? email.value.trim() : "";
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      giftNote(root, "Enter a valid email address.", true);
      if (email) email.focus();
      return;
    }
    if (!phone || !ainfMobileOk(phone.value)) {
      giftNote(root, "Enter your 10-digit mobile number.", true);
      if (phone) phone.focus();
      return;
    }
    giftBusy = true;
    if (button) button.disabled = true;
    giftNote(root, "Opening payment…", false);
    fetch("/api/donations/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: row.kind,
        slug: row.slug,
        amountPaise: paise,
        name: name.value.trim(),
        email: email.value.trim(),
        phone: ainfMobileDigits(phone.value),
        source: "gift-window"
      })
    })
      .then(function (response) {
        return response.json().then(function (body) { return { ok: response.ok, body: body }; });
      })
      .then(function (result) {
        if (ainfIsPaused(result.body)) {
          giftBusy = false;
          if (button) button.disabled = false;
          giftNote(root, "", false);
          // One window at a time: the gift form closes, then the thank-you opens.
          if (typeof root.__ainfClose === "function") root.__ainfClose();
          ainfShowInterest(result.body);
          return;
        }
        if (!result.ok) {
          giftBusy = false;
          if (button) button.disabled = false;
          giftNote(root, ainfWithRetryWait((result.body && result.body.message) || "The donation could not be started.", result.body), true);
          return;
        }
        whenRazorpay(function () {
          var checkoutBox = new window.Razorpay({
            key: result.body.keyId,
            amount: result.body.amountPaise,
            currency: "INR",
            name: "AINF",
            description: result.body.description,
            order_id: result.body.razorpayOrderId,
            prefill: { name: name.value.trim(), email: email.value.trim(), contact: "+91" + ainfMobileDigits(phone.value) },
            handler: function (response) {
              ainfRzpThaw();
              fetch("/api/donations/confirm", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(response)
              })
                .then(function (res) {
                  return res.json().then(function (body) { return { ok: res.ok, body: body }; });
                })
                .then(function (done) {
                  giftBusy = false;
                  if (button) button.disabled = false;
                  if (done.ok && done.body.receiptPath) location.assign(done.body.receiptPath);
                  else giftNote(root, (done.body && done.body.message) || "If money left your account, the receipt will arrive by email.", true);
                })
                .catch(function () {
                  giftBusy = false;
                  if (button) button.disabled = false;
                  giftNote(root, "If money left your account, the receipt will arrive by email.", true);
                });
            },
            modal: {
              ondismiss: function () {
                ainfRzpThaw();
                giftBusy = false;
                if (button) button.disabled = false;
                giftNote(root, "The donation was not taken.", false);
              }
            }
          });
          ainfRzpFreeze();
          checkoutBox.open();
        }, function () {
          giftBusy = false;
          if (button) button.disabled = false;
          giftNote(root, "Payment could not open. Refresh and try again.", true);
        });
      })
      .catch(function () {
        giftBusy = false;
        if (button) button.disabled = false;
        giftNote(root, "The donation could not be started.", true);
      });
  }

  // Project pages ship the Oxira footer. Load the same homepage footer
  // (template + styles) and hide the template one.
  (function loadProjectsFooter() {
    var path = (location.pathname || "/").replace(/\/$/, "") || "/";
    if (path !== "/projects" && path.indexOf("/projects/") !== 0) return;
    document.documentElement.classList.add("ainf-projects-skin", "ainf-shared-footer");
    if (document.body) document.body.classList.add("ainf-projects-skin", "ainf-shared-footer");

    function addCss(href, id) {
      if (document.getElementById(id)) return;
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.id = id;
      document.head.appendChild(link);
    }
    function addJs(src, id, next) {
      if (document.getElementById(id)) {
        if (next) next();
        return;
      }
      var script = document.createElement("script");
      script.src = src;
      script.id = id;
      script.onload = function () {
        if (next) next();
      };
      document.head.appendChild(script);
    }

    // Content versions from the server (window.__ainfAssetV); unversioned
    // URLs still work, they are just revalidated on every view.
    function versioned(url) {
      var v = window.__ainfAssetV && window.__ainfAssetV[url];
      return v ? url + "?v=" + v : url;
    }

    addCss(versioned("/assets/css/ainf-site-footer.css"), "ainf-site-footer-css");
    addCss(versioned("/assets/css/ainf-projects-theme.css"), "ainf-projects-theme-css");
    addJs(versioned("/assets/js/ainf-footer-template.js"), "ainf-footer-template-js", function () {
      addJs(versioned("/assets/js/ainf-site-footer.js"), "ainf-site-footer-js", function () {
        addJs(versioned("/assets/js/ainf-projects-theme.js"), "ainf-projects-theme-js");
      });
    });
  })();

  var TITLE_FIXES = [
    [/^Bringing Hopeto Those WhoNeed It Most\.?$/i, "Building Opportunity Across Jharkhand & West Bengal"],
    [/^Bringing Hopeto Those Who Need It Most\.?$/i, "Building Opportunity Across Jharkhand & West Bengal"],
    [/^Bringing Hope to Those Who Need It Most\.?$/i, "Building Opportunity Across Jharkhand & West Bengal"],
    [/^Educationfor Every Child$/i, "Shiksha Desk — Every Child Deserves a Classroom"],
    [/^Education for Every Child$/i, "Shiksha Desk — Every Child Deserves a Classroom"],
    [/^Food&Nutritionforfamilies$/i, "Rozgar & Skills Desk — Jobs, Not Just Relief"],
    [/^Food & Nutrition for families$/i, "Rozgar & Skills Desk — Jobs, Not Just Relief"],
    [/^Healthcarefor All$/i, "Swasthya Desk — Care Closer to Home"],
    [/^Healthcare for All$/i, "Swasthya Desk — Care Closer to Home"],
    [/^Water&Sanitationforhealth$/i, "Janajati Sahyog & Kheti Desk"],
    [/^Water & Sanitation for health$/i, "Janajati Sahyog & Kheti Desk"],
    [/^Women Empowermentforrise$/i, "Nari Suraksha Desk — Safety First, Dignity Always"],
    [/^Women Empowerment for rise$/i, "Nari Suraksha Desk — Safety First, Dignity Always"],
    [/^ADayinthe Lifeof Our Volunteers$/i, "A Block Day With AINF Field Sevaks"],
    [/^A Day in the Life of Our Volunteers$/i, "A Block Day With AINF Field Sevaks"],
    [/^Simple Waysto Make Impact On Community$/i, "Small Acts, Big Ripple in Your Panchayat"],
    [/^Simple Ways to Make Impact On Community$/i, "Small Acts, Big Ripple in Your Panchayat"],
    [/^Education Can Break Poverty$/i, "Shiksha That Opens the First Door"],
    [/^How Your Donations Are Changing Lives Every Day$/i, "Where Your Rupee Lands — Daily Impact"],
    [/^Building Stronger Communities Together$/i, "Block Teams, Shared Progress"],
    [/^Why Every Volunteer Matters$/i, "Why One Field Sevak Changes a Batch"],
    [/^Insights ThatInspire Change$/i, "Insights That Inspire Change"],
    [/^Insights That Inspire Change$/i, "Insights That Inspire Change"],
    [/^Donate\.Impact\.Transform Lives\.?$/i, "Give With Purpose. See Impact on the Ground."],
    [/^Donate\. Impact\.Transform Lives\.?$/i, "Give With Purpose. See Impact on the Ground."],
    [/^Stand With Studentsin Your District$/i, "Stand With Students in Your District"],
    [/^Terms&Conditions$/i, "Terms & Conditions"],
    [/^From Education to Employment,Opportunity for Every Youth$/i, "From Education to Employment, Opportunity for Every Youth"],
    [/^From Shiksha to Employment,Opportunity for Every Youth$/i, "From Shiksha to Employment, Opportunity for Every Youth"],
  ];

  var QUOTE_FIXES = [
    [
      "gharpahunch",
      "Youth Supported",
    ],
    [
      "zilasahyog",
      "District Support",
    ],
    [
      "weveseenliveschangewhenpeoplecometogetheronemealonefamilyonestepatatime",
      "We've seen paths change when a stipend, a skill kit, and a sevak show up together — one student, one job, one family at a time.",
    ],
    [
      "weveseenpathschangewhenastipendaskillkitandasevakshowuptogetheronestudentonejobonefamilyatatime",
      "We've seen paths change when a stipend, a skill kit, and a sevak show up together — one student, one job, one family at a time.",
    ],
    [
      "theyworkwithrespectandconsistencythesupportreachestherightpeoplewithoutdelays",
      "They work with respect and consistency. Support reaches the right students and families, without delays.",
    ],
    [
      "theteamisorganizedandtransparentwedistributemealsdirectlyandyoucanseeinstantlyhowitworks",
      "The team is organized and transparent. Every rupee is tagged to a desk, and you can see where it lands.",
    ],
    [
      "weareapurposedrivennonprofitorganizationcommittedtocreatingmeaningfulchangeinthelivesofunderservedcommunities",
      "All Indian Nevarlands Foundation walks with learners and families from Jamtara outward — classrooms, skill labs, health camps, and fair work under one roof.",
    ],
    [
      "weareanonprofitorganizationdedicatedtoupliftingcommunitiesthrougheducationhealthcareandsustainablesupport",
      "AINF is a Section 8 non-profit from Nala, Jamtara — education, skills, jobs, healthcare, farming, and tribal welfare across Jharkhand and West Bengal.",
    ],
    [
      "weareapassionatenonprofitorganizationcommittedtomakingameaningfuldifferenceinthelivesofthoseinneed",
      "AINF is a Section 8 non-profit from Jamtara — classrooms, skill labs, and job pathways across Jharkhand and West Bengal.",
    ],
    [
      "joinourcommunityofpassionatevolunteersandhelpuscreaterealimpactwhereitmattersmost",
      "Coach exam batches, host skill weekends, or sit in placement cells with AINF. Even two hours help if one student finds direction.",
    ],
    [
      "therearemanywaysyoucansupportourmissionandhelpuscreatelastingchange",
      "Give to a desk, join as a field sevak, or share theainf.in — every hour and every rupee reaches a student or family in our blocks.",
    ],
    [
      "shareourmissionwithyourfriendsandfamilytohelpusreachmorepeopleandgrowourimpact",
      "Share theainf.in in your group — one forward can connect a youth to coaching or a job lead.",
    ],
    [
      "wevalueyourtrusthereyoullfindhonestanswersabouthowyourdonationsareusedtoempowerlivesandcreatelastingchange",
      "Section 8 rules are clear — read where donations go, which account handles them, and how to volunteer.",
    ],
    [
      "yourfinancialsupporthelpsusprovidefoodeducationhealthcaretothosewhoneedit",
      "Your donation covers stipends, study kits, counselling, and emergency relief — delivered straight to students and families.",
    ],
    [
      "giveyourtimeandskillstosupportourinitiativesanddirectlyimpactlivesinyourcommunity",
      "Coach exam batches, host skill weekends, or sit in placement cells with AINF. Even two hours help if one student finds direction.",
    ],
    [
      "supportaspecificprogramorindividualseeexactlyhowyourcontributionismakingadifference",
      "Pick a Shiksha desk, rozgar cell, nari desk, swasthya van, kheti unit, or janajati desk to adopt.",
    ],
    [
      "supportaspecificprogramseeexactlyhowyourcontributionismakingadifference",
      "Pick a Shiksha desk, rozgar cell, nari desk, swasthya van, kheti unit, or janajati desk to adopt.",
    ],
    [
      "testimonialssharestoriesofgratitudetransformationandpersonalpositiveexperiences",
      "Students, field sevaks, and partners from Asansol to Jamtara — straight talk on learning, landing work, and earning dignity.",
    ],
    [
      "ourmissionistohelppeopleinneed",
      "AINF desks deliver coaching, skills, health camps, and farm support where students and families need them most.",
    ],
    [
      "weprovidenutritiousmealscleanwaterandbasiccaretochildrenandfamilieswhoarestrugglingtomeetdailyneeds",
      "From Jamtara outward we fund study kits, skill labs, swasthya camps, and kheti inputs — tracked rupee by rupee.",
    ],
    [
      "providingnutritiousdailymealstounderprivilegedchildrentofighthungerandmalnutrition",
      "AINF Shiksha Desk keeps students in class with meal support, travel stipends, and study kits in our blocks.",
    ],
    [
      "ainfisasection8nonprofitorganizationdedicatedtoeducationhealthcaresupport",
      "AINF is a Section 8 non-profit — education, skills, healthcare, and dignified livelihoods across Jharkhand and West Bengal.",
    ],
    [
      "throughainfournonprofitcharityfoundationwehavehelpedmorethan100kpeopleinneed",
      "AINF walks with students and families across Jharkhand and West Bengal — coaching, skills, health, and farm support under one roof.",
    ],
    [
      "mealdistributedforpoorfamilies",
      "Coaching batches funded for students in our blocks",
    ],
    [
      "coachingbatchesfundedforstudentsinourblocks",
      "Coaching batches funded for students in our blocks",
    ],
    [
      "weprovidecleandrinkingwaterandimprovedsanitationfacilitiestopromotehealthierlivingconditionsincommunities",
      "Janajati Sahyog & Kheti Desk stands with tribal hamlets — farm inputs, market links, and seasonal planning so kheti income survives a bad monsoon.",
    ],
    [
      "wesupportwomenthroughskilltrainingeducationandopportunitiestohelpthemachievefinancialindependenceandconfidence",
      "Nari Suraksha Desk starts with safety, then livelihood — so girls stay in school and women are heard in the panchayat.",
    ],
    [
      "wesupportwomenthroughskilltrainingeducationandopportunities",
      "Nari Suraksha Desk starts with safety, then livelihood — so girls stay in school and women are heard in the panchayat.",
    ],
    [
      "weensureaccesstoessentialmedicalcareregularhealthcheckupsandawarenessprogramsforunderservedcommunities",
      "Swasthya Desk runs health camps, referrals, and medicines families can actually reach — care closer to home, not a one-off drop.",
    ],
    [
      "weprovideaccesstoqualityeducationschoolsuppliesandmentorshipprogramsforunderprivilegedchildreninneed",
      "AINF Shiksha Desk funds scholarships, study kits, and block-level coaching so fees never block a child from class.",
    ],
    [
      "weprovidenutritiousmealsandfoodsuppliestofamiliesfacingdifficultcircumstances",
      "Rozgar & Skills Desk trains youth, hosts rozgar melas, and connects graduates to employers — dignity from work, not repeated relief.",
    ],
  ];

  function compactKey(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[\u2019']/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function applyQuoteFixes(text) {
    var key = compactKey(text);
    for (var i = 0; i < QUOTE_FIXES.length; i++) {
      if (key === QUOTE_FIXES[i][0] || key.indexOf(QUOTE_FIXES[i][0]) === 0) {
        return QUOTE_FIXES[i][1];
      }
    }
    return text;
  }

  var CATEGORY_FIX = {
    education: "Shiksha",
    healthcare: "Swasthya",
    foodnutrition: "Rozgar & Skills",
    womenempowerment: "Nari Suraksha",
    watersanitation: "Janajati & Kheti",
    involved: "Panchayat",
    volunteer: "Sevak",
    impact: "Blocks",
    community: "Panchayat",
  };

  var BLOG_CARDS = {
    "education-can-break-poverty": {
      cat: "Shiksha",
      title: "Shiksha That Opens the First Door",
    },
    "simple-ways-to-make-impact-on-community": {
      cat: "Panchayat",
      title: "Small Acts, Big Ripple in Your Panchayat",
    },
    "a-day-in-the-life-of-our-volunteers": {
      cat: "Sevak",
      title: "A Block Day With AINF Field Sevaks",
    },
    "building-stronger-communities-together": {
      cat: "Blocks",
      title: "Block Teams, Shared Progress",
    },
    "how-your-donations-are-changing-lives-every-day": {
      cat: "Rupee",
      title: "Where Your Rupee Lands — Daily Impact",
    },
    "why-every-volunteer-matters": {
      cat: "Sevak",
      title: "Why One Field Sevak Changes a Batch",
    },
  };

  var UNIQUE_POOL = [
    "/assets/img/hero-third/518fb7f61a5e6510.webp",
    "/assets/img/hero-third/4a27119994acc349.webp",
    "/assets/img/home-sixth/ce25dc676c029d0e.webp",
    "/assets/img/hero-third/1b892b571234582c.webp",
    "/assets/img/hero-third/97kub697kub697ku.webp",
    "/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp",
    "/assets/img/hero-third/1b0ac308d87a6dbd.webp",
    "/assets/img/hero-third/571e61ddc71daaf0.webp",
    "/assets/img/home-sixth/395d6ceebb97e0ae.webp",
    "/assets/img/home-sixth/83d7f3cef733d28c.webp",
    "/assets/img/7d52ebcc5c881e07.webp",
    "/assets/img/46ca7b057fe54d13.webp",
    "/assets/img/1d477190300d27a6.webp",
    "/assets/img/7fb7552621c79350.webp",
  ];
  var VILLAGE_PHOTOS = {
    shiksha: UNIQUE_POOL[0],
    swasthya: UNIQUE_POOL[1],
    rozgar: UNIQUE_POOL[2],
    nari: UNIQUE_POOL[3],
    kheti: UNIQUE_POOL[4],
    hamlet: UNIQUE_POOL[5],
    kit: UNIQUE_POOL[6],
    water: UNIQUE_POOL[7],
    care: UNIQUE_POOL[8],
  };
  var THEMED_ALTS = /^(Cause Image|Blog Image|Missions Image)$/;
  var CONTENT_ALTS = [
    "Cause Image",
    "Missions Image",
    "Blog Image",
    "Gallery Image",
    "Team Image",
    "Ticker Image",
    "CTA Image",
    "About Image",
    "About Hero Image",
    "Testimonial Image",
    "Join as Field Sevak Image",
    "How you can help image",
    "Statastic Image Left",
    "Statastic Image Right",
    "man in black and white adidas hoodie",
    "shallow focus photography of woman outdoor during day",
    "woman in blue crew neck shirt",
    "two men wearing masks and holding a bag of food",
  ];
  var BANNED_SRC = /1fd7ff27ace510a1|cause-cover-d|0487bff6130e818d|d192de88013602fb|b5b56d9dac67f37b|0a0f47967bab9e6d|9a7dcfc123be0a1d|bfbb8033078ef4ec|5d4f22904b272be4|76cc0f24d728b77e|36be58b3f0aa6698|479af4ed1ca6b4fe|0857298f70c123c5|6c95afd2aa3c890c|e2a751b041c6c192|44e14d52cea980eb|78ea5a23abe80a75|352a75abd7f4e260|b1b56374785c59d9/i;
  var INDIAN_SRC = /518fb7f61a5e6510|4a27119994acc349|ce25dc676c029d0e|1b892b571234582c|97kub697kub697ku|9fzzlw9fzzlw9fzz|1b0ac308d87a6dbd|571e61ddc71daaf0|395d6ceebb97e0ae|83d7f3cef733d28c|7d52ebcc5c881e07|46ca7b057fe54d13|1d477190300d27a6|7fb7552621c79350|imran-ansari|amit-hazra|birsa-murmu|ravi-hembram|667a7de97aa3c5df|0cb36a2e191493c5|58ddd402fa0fc24e|74f91bf4bd093efb/i;
  var TEXTURE_SRC = /96690a270973a763|65e4fe3b71103bc2|f9ae4aecce078de6|2d263d6ae10cc7bd|a95af15c9096fc0a|50cf5ee624cdbe60|d0fdea8216d62e05|dedab43eef2285e1|a344bac9b35c5dea|2dd60ec5f37c748d|562ef86697f4a6b5|124a9e9812a2f717/i;
  var TEAM_POOL = [
    "/assets/img/people/imran-ansari.webp",
    "/assets/img/people/amit-hazra.webp",
    "/assets/img/people/birsa-murmu.webp",
    "/assets/img/people/ravi-hembram.webp",
  ];

  function deskFromText(text) {
    var t = String(text || "").toLowerCase();
    if (/shiksha|classroom|every child|school supplies|education/.test(t)) return "shiksha";
    if (/swasthya|health camp|care closer|medical care|medical-aid|healthcare/.test(t)) return "swasthya";
    if (/rozgar|skill|employer|jobs, not|food & nutrition|daily-meal/.test(t)) return "rozgar";
    if (/nari|women|suraksha|empowerment/.test(t)) return "nari";
    if (/janajati|kheti|hamlet|tribal/.test(t)) return "kheti";
    if (/clean-water|jerrycan|drinking water/.test(t)) return "water";
    if (/donation|changing lives|kit/.test(t)) return "kit";
    if (/communit|together|winter/.test(t)) return "hamlet";
    if (/volunteer|sevak|join-as/.test(t)) return "swasthya";
    return "";
  }

  function swapVillagePhoto(img, url) {
    if (!img || !url) return;
    var current = (img.getAttribute("src") || "").split("?")[0];
    if (img.getAttribute("data-ainf-village") !== url) img.setAttribute("data-ainf-village", url);
    if (current !== url || img.getAttribute("srcset")) {
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      var pic = img.closest && img.closest("picture");
      if (pic) {
        Array.prototype.forEach.call(pic.querySelectorAll("source"), function (source) {
          source.remove();
        });
      }
      // Same URL everywhere (server, guard, here), so a photo is fetched and decoded once.
      if (current !== url) img.src = url;
    }
    img.style.setProperty("object-fit", "cover", "important");
    img.style.setProperty("object-position", "center 18%", "important");
  }

  /**
   * Desk for a themed card, as deskFor() in the image guard decides it: the
   * card's own link first, then a title inside that link (walking up past the
   * card picked whichever heading had rendered first).
   */
  function deskForCard(el) {
    var link = el.closest && el.closest("a[href]");
    var byLink = link ? deskFromText(link.getAttribute("href") || "") : "";
    if (byLink) return byLink;
    var node = link || el;
    for (var i = 0; i < 6 && node; i++) {
      var title = node.querySelector && node.querySelector('[data-framer-name="Cause Title"], h2, h3, h4');
      if (title) return deskFromText(title.textContent || "");
      if (node === link) break;
      node = node.parentElement;
    }
    return "";
  }

  function isProtectedImg(img) {
    if (!img) return true;
    var alt = img.getAttribute("alt") || "";
    var src = img.getAttribute("src") || "";
    if (/Arrow|Logo|AINF home|^AINF$/i.test(alt)) return true;
    if (/theainf-logo|theainf-mark|ainf-seal|\.svg($|\?)/i.test(src)) return true;
    if (/Hero BG|CTA Bg|clouds/i.test(alt)) return true;
    if (img.closest && img.closest("#ainf-global-nav, #ainf-site-footer, [id^='ainf-lang-switcher']")) return true;
    if (img.closest && img.closest(".ainf-brand, .ainf-ft-logo, [data-framer-name='Details Top'], [data-framer-name='Footer Top']")) return true;
    return false;
  }

  var ABOUT_HERO = "/assets/img/home-sixth/83d7f3cef733d28c.webp";

  function lockAboutHero() {
    var path = (location.pathname || "").replace(/\/$/, "");
    if (path !== "/about-us") return;
    if (!document.getElementById("ainf-about-hero-preload")) {
      var link = document.createElement("link");
      link.id = "ainf-about-hero-preload";
      link.rel = "preload";
      link.as = "image";
      link.href = ABOUT_HERO;
      document.head.appendChild(link);
    }
    document.querySelectorAll('img[alt="About Hero Image"]').forEach(function (img) {
      swapVillagePhoto(img, ABOUT_HERO);
    });
    document.querySelectorAll('[data-framer-name="Youth Supported"] h3').forEach(function (el) {
      if ((el.textContent || "").replace(/\s+/g, "") !== "1,000+") el.textContent = "1,000+";
    });
    document.querySelectorAll('[data-framer-name="Volunteer Worldwide"] h3').forEach(function (el) {
      if ((el.textContent || "").replace(/\s+/g, "") !== "300+") el.textContent = "300+";
    });
    var hero = document.querySelector('[data-framer-name="Hero Sectiion"], [data-framer-name="Hero Section"]');
    if (!hero || hero.getAttribute("data-ainf-watch") === "1") return;
    hero.setAttribute("data-ainf-watch", "1");
    new MutationObserver(function () {
      lockAboutHero();
    }).observe(hero, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["src", "srcset"],
    });
  }

  function textHash(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return h < 0 ? -h : h;
  }

  /**
   * The field photo for a foreign image. Chosen from the image itself (its
   * desk, or a hash of the stock photo it replaces), never from its position
   * in a NodeList: positions shift whenever Framer clones a ticker or
   * re-renders a section, which used to rotate every photo on screen.
   */
  function pickVillageUrl(img) {
    var alt = img.getAttribute("alt") || "";
    if (alt === "About Hero Image") return ABOUT_HERO;
    var key = (img.getAttribute("src") || img.getAttribute("srcset") || alt).split("?")[0];
    if (alt === "Team Image") return TEAM_POOL[textHash(key) % TEAM_POOL.length];
    if (THEMED_ALTS.test(alt)) {
      var desk = deskForCard(img);
      if (desk && VILLAGE_PHOTOS[desk]) return VILLAGE_PHOTOS[desk];
    }
    return UNIQUE_POOL[textHash(key) % UNIQUE_POOL.length];
  }

  var PEOPLE_PHOTOS = {
    "Imran Ansari": "/assets/img/people/imran-ansari.webp",
    "Amit Hazra": "/assets/img/people/amit-hazra.webp",
    "Birsa Murmu": "/assets/img/people/birsa-murmu.webp",
    "Ravi Hembram": "/assets/img/people/ravi-hembram.webp",
  };

  function portraitNear(el, name) {
    var node = el;
    for (var i = 0; i < 14 && node; i++) {
      if (node.querySelectorAll) {
        var found = node.querySelectorAll("img");
        for (var k = 0; k < found.length; k++) {
          if (found[k].closest && found[k].closest("#ainf-global-nav, #ainf-site-footer")) continue;
          if ((found[k].getAttribute("alt") || "") === "Testimonial Image" || found[k].getAttribute("data-ainf-person") === name) {
            return found[k];
          }
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  /** Each named card shows that person's portrait. Walks text nodes: the page has thousands of elements. */
  function lockPeoplePhotos() {
    if (!document.body || !document.createTreeWalker) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var value = node.nodeValue;
      if (!value || value.length > 40) continue;
      var name = value.replace(/\s+/g, " ").trim();
      var url = PEOPLE_PHOTOS[name];
      if (!url) continue;
      var el = node.parentElement;
      if (!el || el.children.length) continue;
      if (el.closest && el.closest("#ainf-global-nav, #ainf-site-footer")) continue;
      var img = portraitNear(el, name);
      if (!img) continue;
      swapVillagePhoto(img, url);
      if (img.getAttribute("data-ainf-person") !== name) img.setAttribute("data-ainf-person", name);
      if (img.getAttribute("alt") !== name) img.setAttribute("alt", name);
    }
  }

  function imgSrcBlob(img) {
    return (img.getAttribute("src") || "") + " " + (img.getAttribute("srcset") || "") + " " + (img.currentSrc || "");
  }

  function isFieldPhoto(img) {
    var src = (img.getAttribute("src") || "").split("?")[0];
    if (!src || !INDIAN_SRC.test(src) || BANNED_SRC.test(src) || TEXTURE_SRC.test(src)) return false;
    // home-sixth/83d7… is a field photo; the top-level file of that name is Hopper stock.
    return !(src.indexOf("83d7f3cef733d28c") >= 0 && src.indexOf("home-sixth") < 0);
  }

  function dropSrcset(img) {
    if (img.getAttribute("srcset") == null && img.getAttribute("sizes") == null) return;
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
  }

  /** Gallery and ticker strips stay visible through Framer's entrance animation. */
  function lockGalleryStrip() {
    var nodes = document.querySelectorAll(
      '[data-framer-name="Gallery Image"] img, .ticker-item img, img[alt="Gallery Image"]'
    );
    nodes.forEach(function (img) {
      if (isProtectedImg(img)) return;
      // Portraits in a ticker belong to lockPeoplePhotos.
      if ((img.getAttribute("alt") || "") === "Testimonial Image" || img.getAttribute("data-ainf-person")) return;
      if (!isFieldPhoto(img)) swapVillagePhoto(img, pickVillageUrl(img));
      else dropSrcset(img);
      var src = (img.getAttribute("src") || "").split("?")[0];
      if (img.getAttribute("data-ainf-field") !== src) img.setAttribute("data-ainf-field", src);
      img.style.setProperty("visibility", "visible", "important");
      img.style.setProperty("opacity", "1", "important");
      var wrap = img.closest && img.closest("[data-framer-background-image-wrapper]");
      if (wrap && wrap.style && wrap.style.backgroundImage) wrap.style.backgroundImage = "none";
    });
  }

  /** Content photos that are still Hopper stock get a field photo; field photos are left exactly as they are. */
  function holdContentPhotos() {
    document.querySelectorAll("img").forEach(function (img) {
      if (isProtectedImg(img)) return;
      if (img.closest && img.closest("[data-ainf-bound]")) return;
      var alt = img.getAttribute("alt") || "";
      if (img.getAttribute("data-ainf-cms") === "1" || alt === "Testimonial Image" || img.getAttribute("data-ainf-person")) {
        dropSrcset(img);
        return;
      }
      var content = CONTENT_ALTS.indexOf(alt) >= 0;
      if (!content && !BANNED_SRC.test(imgSrcBlob(img))) return;
      if (content) dropSrcset(img);
      if (isFieldPhoto(img)) return;
      swapVillagePhoto(img, pickVillageUrl(img));
    });
  }

  function paintVillagePhotos() {
    holdContentPhotos();
    lockGalleryStrip();
    lockAboutHero();
    lockPeoplePhotos();
  }

  function writeCategoryLabel(el, next) {
    if (!el || !next) return;
    var p = el.querySelector("p");
    if (!p) {
      while (el.firstChild) el.removeChild(el.firstChild);
      var rich = document.createElement("div");
      rich.className = "framer-14aier1";
      rich.setAttribute("data-framer-component-type", "RichTextContainer");
      p = document.createElement("p");
      p.className = "framer-text framer-styles-preset-19x7ezw";
      p.setAttribute("dir", "auto");
      rich.appendChild(p);
      el.appendChild(rich);
    }
    var now = (p.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    if (now !== next) p.textContent = next;
  }

  function storySlug() {
    var match = (location.pathname || "").match(/\/blogs\/([^/?#]+)/i);
    return match ? match[1] : "";
  }

  function fixCategoryLabels(root) {
    var scope = root || document;
    var slug = storySlug();
    scope.querySelectorAll('[data-framer-name="Category"]').forEach(function (el) {
      if (slug && el.closest && el.closest('[data-framer-name="Hero Sectiion"], [data-framer-name="Hero Section"]')) return;
      if (letterSpanCount(el) >= 4) return;
      var text = plainTextWithBreaks(el);
      var next = CATEGORY_FIX[compactKey(text)];
      if (next && next !== text) writeCategoryLabel(el, next);
    });
  }

  function fixPlainCopy(root, afterLetters) {
    var scope = root || document;
    var nodes = scope.querySelectorAll("p, h1, h2, h3, h4, li, figcaption, blockquote");
    nodes.forEach(function (el) {
      if (el.closest && el.closest("#ainf-global-nav, #ainf-site-footer, [id^='ainf-lang-switcher'], [data-framer-name^='review ']")) return;
      if (letterSpanCount(el) >= 4) return;
      if (/^H[1-4]$/.test(el.tagName)) return;
      var text = plainTextWithBreaks(el);
      if (!text || text.length < 4) return;
      var next = applyQuoteFixes(text);
      if (next && next !== text) el.textContent = next;
    });
  }

  function plainTextWithBreaks(el) {
    var text = "";
    function walk(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        text += node.nodeValue || "";
        return;
      }
      if (node.nodeType === 1 && node.classList && node.classList.contains("ainf-hero-ghost")) return;
      if (node.nodeName === "BR") {
        text += " ";
        return;
      }
      var kids = node.childNodes || [];
      for (var i = 0; i < kids.length; i++) walk(kids[i]);
    }
    walk(el);
    return text.replace(/\s+/g, " ").trim();
  }

  function unmash(text) {
    if (!text) return text;
    var next = text;
    next = next.replace(/([A-Za-z0-9]),([A-Za-z])/g, "$1, $2");
    next = next.replace(/([A-Za-z0-9])&([A-Za-z])/g, "$1 & $2");
    next = next.replace(/([A-Za-z])\.([A-Z])/g, "$1. $2");
    next = next.replace(/([a-z])([A-Z])/g, "$1 $2");
    next = next
      .replace(/Hopeto/g, "Hope to")
      .replace(/WhoNeed/g, "Who Need")
      .replace(/Lifeof/g, "Life of")
      .replace(/Waysto/g, "Ways to")
      .replace(/Studentsin/g, "Students in")
      .replace(/Empowermentfor/gi, "Empowerment for")
      .replace(/Nutritionfor/gi, "Nutrition for")
      .replace(/Sanitationfor/gi, "Sanitation for")
      .replace(/Healthcarefor/gi, "Healthcare for")
      .replace(/Educationfor/gi, "Education for")
      .replace(/ADayinthe/gi, "A Day in the")
      .replace(/forfamilies/gi, "for families")
      .replace(/forrise/gi, "for rise")
      .replace(/forhealth/gi, "for health")
      .replace(/\s+/g, " ")
      .trim();
    return next;
  }

  function applyTitleFixes(text) {
    var next = applyQuoteFixes(text);
    TITLE_FIXES.forEach(function (pair) {
      next = next.replace(pair[0], pair[1]);
    });
    return unmash(next);
  }

  function letterSpanCount(el) {
    if (!el || !el.querySelectorAll) return 0;
    var all = el.querySelectorAll("span[style]");
    var n = 0;
    for (var i = 0; i < all.length; i++) {
      var span = all[i];
      if (span.classList && span.classList.contains("ainf-hero-ghost")) continue;
      if (span.querySelector("span")) continue;
      var style = span.getAttribute("style") || "";
      if (!/inline-block/i.test(style) && !(/transform/i.test(style) && (/opacity/i.test(style) || /blur\(/i.test(style)))) continue;
      if ((span.textContent || "").length > 8) continue;
      n += 1;
    }
    return n;
  }

  function fillHeadingLetters(heading, text) {
    if (!heading || !text) return false;
    var all = heading.querySelectorAll("span[style]");
    var leaves = [];
    for (var i = 0; i < all.length; i++) {
      var span = all[i];
      if (span.classList && span.classList.contains("ainf-hero-ghost")) continue;
      if (span.querySelector("span")) continue;
      var style = span.getAttribute("style") || "";
      if (!/inline-block/i.test(style) && !(/transform/i.test(style) && /opacity/i.test(style))) continue;
      if ((span.textContent || "").length > 8) continue;
      leaves.push(span);
    }
    if (leaves.length < 4) return false;
    var chars = Array.from(String(text));
    for (var j = 0; j < leaves.length; j++) {
      if (j < chars.length) {
        leaves[j].textContent = chars[j] === " " ? "\u00a0" : chars[j];
        leaves[j].style.removeProperty("display");
      } else {
        leaves[j].textContent = "";
        leaves[j].style.setProperty("display", "none", "important");
      }
    }
    if (chars.length > leaves.length) {
      var last = leaves[leaves.length - 1];
      var parent = last.parentNode;
      for (var k = leaves.length; k < chars.length; k++) {
        var clone = last.cloneNode(false);
        clone.textContent = chars[k] === " " ? "\u00a0" : chars[k];
        clone.style.removeProperty("display");
        parent.appendChild(clone);
      }
    }
    return true;
  }

  function lockBlogCards() {
    document.querySelectorAll('a[href*="/blogs/"]').forEach(function (anchor) {
      var href = anchor.getAttribute("href") || "";
      var slug = href.split("/blogs/")[1] || "";
      slug = slug.split(/[?#]/)[0].replace(/^\.\//, "").replace(/\/$/, "");
      var card = BLOG_CARDS[slug];
      if (!card) return;
      var cat = anchor.querySelector('[data-framer-name="Category"]');
      if (cat) writeCategoryLabel(cat, card.cat);
      var heading = anchor.querySelector("h1, h2, h3, h4, h5, h6");
      if (!heading) return;
      var now = (heading.textContent || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (now === card.title) return;
      if (letterSpanCount(heading) >= 4) fillHeadingLetters(heading, card.title);
      else heading.textContent = card.title;
    });
  }

  function fixPlainHeadings(root) {
    var scope = root || document;
    scope.querySelectorAll("h1, h2, h3, h4, h5").forEach(function (heading) {
      // Testimonial slides are Framer text effects with their copy set in the module.
      if (heading.closest && heading.closest('#ainf-global-nav, #ainf-site-footer, [data-framer-name^="review "]')) return;
      if (heading.querySelector && heading.querySelector("[data-ainf-letter-wrap], [data-ainf-word]")) return;
      var text = plainTextWithBreaks(heading);
      if (!text || text.length < 3) return;
      var next = applyTitleFixes(text);
      if (!next || next === text) return;
      if (letterSpanCount(heading) >= 4) {
        fillHeadingLetters(heading, next);
        return;
      }
      if (heading.tagName === "H1") return;
      heading.textContent = next;
    });
  }

  function markBrokenImages() {
    document.querySelectorAll("img").forEach(function (img) {
      if (img.dataset.ainfImgBound) return;
      img.dataset.ainfImgBound = "1";
      img.addEventListener(
        "error",
        function () {
          img.classList.add("ainf-img-broken");
          if (/Hero Image|hero/i.test(img.getAttribute("alt") || "")) {
            img.setAttribute("alt", "");
            img.style.setProperty("display", "none", "important");
          }
        },
        { once: true }
      );
    });
  }

  function lazyBelowFold() {
    var vh = window.innerHeight || 900;
    document.querySelectorAll("img").forEach(function (img) {
      if (img.getAttribute("fetchpriority") === "high") return;
      if (img.closest && img.closest("#ainf-global-nav, .ainf-brand")) return;
      if (img.loading === "lazy") return;
      var top = 0;
      try {
        top = img.getBoundingClientRect().top;
      } catch (e) {
        return;
      }
      if (top > vh * 1.15) {
        img.loading = "lazy";
        img.decoding = "async";
      }
    });
  }

  function holdHeroTitle() {
    return;
    var h1 =
      document.querySelector('[data-framer-name="Hero Sectiion"] h1') ||
      document.querySelector('[data-framer-name="Hero Section"] h1') ||
      document.querySelector("h1");
    if (!h1 || h1.getAttribute("data-ainf-hero-hold") === "1" || h1.getAttribute("data-ainf-letters")) return;
    var spans = h1.querySelectorAll('span[style*="inline-block"], span[style*="translateY"], span[style*="blur"]');
    if (spans.length < 8) {
      var tries = parseInt(h1.getAttribute("data-ainf-hero-tries") || "0", 10);
      if (tries > 14) return;
      h1.setAttribute("data-ainf-hero-tries", String(tries + 1));
      setTimeout(holdHeroTitle, 160);
      return;
    }
    h1.setAttribute("data-ainf-hero-hold", "1");
    if (!h1.style.position) h1.style.position = "relative";
    var ghost = document.createElement("span");
    ghost.className = "ainf-hero-ghost";
    ghost.setAttribute("aria-hidden", "true");
    var raw = "";
    function walkGhost(node) {
      if (!node) return;
      if (node.nodeType === 1 && node.classList && node.classList.contains("ainf-hero-ghost")) return;
      if (node.nodeType === 3) {
        raw += node.nodeValue || "";
        return;
      }
      var kids = node.childNodes || [];
      for (var g = 0; g < kids.length; g++) walkGhost(kids[g]);
    }
    walkGhost(h1);
    raw = raw.replace(/[\u200b]/g, "").replace(/\s+/g, " ").trim();
    if (!raw) raw = (h1.getAttribute("data-ainf-i18n") || "").trim();
    ghost.textContent = unmash(raw);
    h1.insertBefore(ghost, h1.firstChild);
    var gone = false;
    function hide() {
      if (gone) return;
      gone = true;
      ghost.classList.add("is-out");
      setTimeout(function () {
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      }, 400);
    }
    function tick() {
      var live = h1.querySelectorAll(
        "[data-ainf-letter-wrap] .ainf-letter, span[style*='inline-block'], span[style*='translateY']"
      );
      var shown = 0;
      for (var i = 0; i < live.length; i++) {
        try {
          if (parseFloat(getComputedStyle(live[i]).opacity) > 0.35) shown += 1;
        } catch (e) {}
      }
      if (shown > Math.min(8, Math.max(4, Math.floor(live.length * 0.18)))) hide();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    setTimeout(hide, 2800);
  }

  function revealNow() {
    document.documentElement.classList.add("ainf-ready");
    document.documentElement.classList.remove("ainf-booting");
  }

  function spaceHeroText(raw) {
    var t = String(raw || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    if ((t.match(/ /g) || []).length >= 2) return t;
    t = t.replace(/([a-z])([A-Z])/g, "$1 $2");
    t = t.replace(/([.!?])([A-Za-z])/g, "$1 $2");
    t = t.replace(/\s*&\s*/g, " & ");
    return t.replace(/\s+/g, " ").trim();
  }

  function readHeroText(h1) {
    if (h1.querySelector("[data-ainf-word]")) {
      return spaceHeroText(h1.textContent);
    }
    var letters = h1.querySelectorAll('span[style*="inline-block"]');
    if (letters.length >= 8) {
      var raw = "";
      for (var i = 0; i < letters.length; i++) {
        var ch = letters[i].textContent || "";
        raw += !ch || ch === "\u00a0" ? " " : ch;
      }
      return spaceHeroText(raw);
    }
    return spaceHeroText(h1.textContent);
  }

  function waveHeroLetters(h1, on) {
    var list = h1.querySelectorAll(".ainf-letter");
    var n = list.length;
    var step = 18;
    for (var i = 0; i < n; i++) {
      (function (span, delay) {
        setTimeout(function () {
          if (!span.isConnected) return;
          span.style.transition =
            "opacity .55s cubic-bezier(.16,1,.3,1), filter .55s cubic-bezier(.16,1,.3,1), transform .55s cubic-bezier(.16,1,.3,1)";
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
            span.style.filter = "blur(8px)";
            span.style.transform = "translate3d(0,12px,0)";
          }
        }, delay);
      })(list[on ? i : n - 1 - i], i * step);
    }
    return n * step + 520;
  }

  function watchHeroLetters(h1) {
    if (h1.getAttribute("data-ainf-io") === "1") return;
    h1.setAttribute("data-ainf-io", "1");
    var shown = true;
    var busy = false;
    var startY = window.scrollY || 0;
    var ready = false;
    setTimeout(function () {
      ready = true;
      startY = window.scrollY || 0;
    }, 1200);
    if (typeof IntersectionObserver !== "function") return;
    function offscreen(entry) {
      var r = entry.boundingClientRect;
      var vh = window.innerHeight || 800;
      if (r.height < 8) return false;
      if (r.bottom < vh * 0.28) return true;
      if (r.top > vh * 0.88) return true;
      return false;
    }
    var io = new IntersectionObserver(
      function (entries) {
        if (!ready) return;
        if (Math.abs((window.scrollY || 0) - startY) < 32) return;
        entries.forEach(function (entry) {
          var on = !offscreen(entry);
          if (on === shown || busy) return;
          shown = on;
          busy = true;
          var wait = waveHeroLetters(h1, on);
          setTimeout(function () {
            busy = false;
          }, wait);
        });
      },
      { threshold: [0, 0.15, 0.6] }
    );
    h1._ainfScroll = window.scrollY || 0;
    h1._ainfLetterIO = io;
    io.observe(h1);
  }

  /** True when the heading or an ancestor is display:none (one layout read, not a style walk). */
  function heroHidden(h1) {
    return !h1.isConnected || h1.getClientRects().length === 0;
  }

  function pageHeroes() {
    var found = [];
    var seen = [];
    function add(h1) {
      if (!h1 || seen.indexOf(h1) >= 0) return;
      if (h1.closest && h1.closest("#ainf-global-nav, #ainf-site-footer, a")) return;
      seen.push(h1);
      found.push(h1);
    }
    document.querySelectorAll(
      '[data-framer-name="Hero Sectiion"] h1, [data-framer-name="Hero Section"] h1, [data-framer-name="Hero Description"] h1'
    ).forEach(add);
    var main = document.getElementById("main");
    if (main) {
      var all = main.querySelectorAll("h1");
      for (var i = 0; i < all.length; i++) {
        if (all[i].closest && all[i].closest("a, #ainf-global-nav, #ainf-site-footer")) continue;
        if (heroHidden(all[i])) continue;
        add(all[i]);
        break;
      }
    }
    return found;
  }

  function mountHeroLetters() {
    var pathNow = (location.pathname || "/").replace(/\/$/, "") || "/";
    if (pathNow === "/projects") return;
    window.__ainfHeroIn = window.__ainfHeroIn || {};
    var playKey = location.pathname || "/";
    var heads = pageHeroes();
    heads.sort(function (a, b) {
      return (heroHidden(a) ? 1 : 0) - (heroHidden(b) ? 1 : 0);
    });
    heads.forEach(function (h1) {
      if (h1.closest && h1.closest("#ainf-global-nav, #ainf-site-footer")) return;
      var path = (location.pathname || "/").replace(/\/$/, "") || "/";
      window.__ainfHeroSentence = window.__ainfHeroSentence || {};
      var live = readHeroText(h1);
      if (!window.__ainfHeroSentence[path] && live) window.__ainfHeroSentence[path] = live;
      var text = window.__ainfHeroSentence[path] || live;
      if (!text || text.length < 6) return;
      if (window.__ainfHeroIn[playKey]) {
        if (h1.querySelector("[data-ainf-word]") && spaceHeroText(h1.textContent) === text) return;
        h1.textContent = "";
        h1.setAttribute("data-ainf-letters", text);
        h1.setAttribute("data-ainf-done", "1");
        h1.setAttribute("data-ainf-ready", "1");
        text.split(" ").forEach(function (word, wi) {
          if (!word) return;
          var hold = document.createElement("span");
          hold.setAttribute("data-ainf-word", "1");
          for (var c = 0; c < word.length; c++) {
            var span = document.createElement("span");
            span.className = "ainf-letter is-in";
            span.textContent = word.charAt(c);
            span.style.display = "inline-block";
            span.style.opacity = "1";
            span.style.filter = "blur(0px)";
            span.style.transform = "translate3d(0,0,0)";
            hold.appendChild(span);
          }
          h1.appendChild(hold);
          if (wi < text.split(" ").length - 1) h1.appendChild(document.createTextNode(" "));
        });
        document.documentElement.classList.add("ainf-hero-lock");
        return;
      }
      if (h1.getAttribute("data-ainf-letters") === text && h1.querySelector("[data-ainf-word]")) return;
      var animate = !heroHidden(h1);
      if (animate) window.__ainfHeroIn[playKey] = 1;
      if (h1._ainfLetterIO) {
        h1._ainfLetterIO.disconnect();
        h1._ainfLetterIO = null;
      }
      var words = text.split(" ");
      h1.textContent = "";
      h1.setAttribute("data-ainf-letters", text);
      h1.setAttribute("data-ainf-ready", "1");
      h1.removeAttribute("data-ainf-io");
      words.forEach(function (word, wi) {
        if (!word) return;
        var hold = document.createElement("span");
        hold.setAttribute("data-ainf-word", "1");
        for (var c = 0; c < word.length; c++) {
          var span = document.createElement("span");
          span.className = animate ? "ainf-letter is-out" : "ainf-letter is-in";
          span.textContent = word.charAt(c);
          span.style.display = "inline-block";
          span.style.opacity = animate ? "0.001" : "1";
          span.style.filter = animate ? "blur(8px)" : "blur(0px)";
          span.style.transform = animate ? "translate3d(0,12px,0)" : "translate3d(0,0,0)";
          hold.appendChild(span);
        }
        h1.appendChild(hold);
        if (wi < words.length - 1) h1.appendChild(document.createTextNode(" "));
      });
      document.documentElement.classList.add("ainf-hero-lock");
      if (!animate) {
        watchHeroLetters(h1);
        return;
      }
      var count = text.replace(/ /g, "").length;
      var waitIn = count * 16 + 560;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (h1.getAttribute("data-ainf-letters") !== text) return;
          waveHeroLetters(h1, true);
        });
      });
      setTimeout(function () {
        if (!h1.isConnected || h1.getAttribute("data-ainf-letters") !== text) return;
        h1.setAttribute("data-ainf-done", "1");
        window.__ainfHeroDone = true;
        document.documentElement.classList.add("ainf-hero-once");
        watchHeroLetters(h1);
      }, waitIn);
    });
  }

  function settleBlogHeroHeading() {
    var slug = storySlug();
    var card = slug && BLOG_CARDS[slug];
    if (!card) return;
    document.documentElement.classList.add("ainf-blog-title");
    var hero = document.querySelector(
      '[data-framer-name="Hero Sectiion"], [data-framer-name="Hero Section"]'
    );
    if (!hero) return;
    var h1 = hero.querySelector("h1");
    if (h1 && h1.getAttribute("data-ainf-letters") === card.title && h1.querySelector("[data-ainf-word]")) {
      h1.setAttribute("data-ainf-settled", card.title);
    } else if (h1 && spaceHeroText(h1.textContent) !== card.title) {
      h1.textContent = card.title;
      h1.removeAttribute("data-ainf-letters");
      h1.setAttribute("data-ainf-settled", card.title);
    }
    var cat = hero.querySelector('[data-framer-name="Category"]');
    if (cat) {
      writeCategoryLabel(cat, card.cat);
      cat.setAttribute("data-ainf-settled", card.cat);
    }
    var shown = hero.querySelectorAll("[data-framer-appear-id]");
    for (var i = 0; i < shown.length; i++) {
      shown[i].style.removeProperty("opacity");
      shown[i].style.removeProperty("transform");
      shown[i].style.removeProperty("filter");
    }
  }

  // textContent, not innerText: innerText forces a style and layout pass per
  // link, and this runs over every anchor on several passes.
  function fixLinksForLighthouse() {
    document.querySelectorAll("a").forEach(function (a) {
      if (a.__ainfLinkChecked) return;
      a.__ainfLinkChecked = true;
      if (a.closest && a.closest("#ainf-global-nav")) return;
      var href = a.getAttribute("href");
      if (href == null || href === "" || href === "#") {
        var span = document.createElement("span");
        span.className = a.className;
        var name = a.getAttribute("data-framer-name");
        if (name) span.setAttribute("data-framer-name", name);
        span.innerHTML = a.innerHTML;
        if (a.parentNode) a.parentNode.replaceChild(span, a);
        return;
      }
      var label = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (!/^read more(\s+read more)*$/i.test(label)) return;
      var root = a.parentElement;
      var heading = null;
      var depth = 0;
      while (root && depth < 6 && !heading) {
        var found = root.querySelector("h1, h2, h3, h4, h5, h6");
        if (found && !a.contains(found)) heading = found;
        else root = root.parentElement;
        depth += 1;
      }
      var title = heading ? (heading.textContent || "").replace(/\s+/g, " ").trim() : "";
      if (!title) return;
      a.setAttribute("aria-label", title);
      var leaves = a.querySelectorAll("p, span");
      for (var i = 0; i < leaves.length; i++) {
        var leaf = leaves[i];
        if (leaf.querySelector("p, span")) continue;
        if (/^read more$/i.test((leaf.textContent || "").trim())) leaf.textContent = title;
      }
    });
  }

  function paintOnce() {
    markBrokenImages();
    paintVillagePhotos();
    fixCategoryLabels(document);
    lockBlogCards();
    settleBlogHeroHeading();
    mountHeroLetters();
    fixLinksForLighthouse();
  }

  function copyAfterLetters(afterLetters) {
    fixPlainHeadings(document);
    if (afterLetters) fixPlainCopy(document, true);
    fixCategoryLabels(document);
    lockBlogCards();
    settleBlogHeroHeading();
    mountHeroLetters();
    fixLinksForLighthouse();
    paintVillagePhotos();
  }

  function run() {
    bootProjectPayForm();
    paintOnce();
    revealNow();
    lazyBelowFold();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  [600].forEach(function (ms) {
    setTimeout(paintOnce, ms);
  });
  setTimeout(lazyBelowFold, 80);
  setTimeout(function () {
    copyAfterLetters(true);
  }, 1600);

  var moTimer = 0;
  var mo = new MutationObserver(function () {
    if (moTimer) return;
    moTimer = setTimeout(function () {
      moTimer = 0;
      lockGalleryStrip();
      mountHeroLetters();
    }, 180);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  // Framer re-renders whole sections after load. Fixing the copy of each
  // inserted subtree from the observer callback lands before the next paint;
  // on timers alone the result depended on whether Framer had rendered yet,
  // and on a slow phone the module copy (or an invisible hero title) stayed.
  var TEXT_BLOCKS = "h1, h2, h3, h4, h5, h6, p, li";
  function copyRoots(records) {
    var roots = [];
    for (var i = 0; i < records.length; i++) {
      var added = records[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1 || !node.isConnected) continue;
        if (node.closest && node.closest("#ainf-global-nav, #ainf-site-footer, [id^='ainf-lang-switcher'], .ainf-gift-modal")) continue;
        if (node.matches(TEXT_BLOCKS) || (node.firstElementChild && node.querySelector(TEXT_BLOCKS))) roots.push(node);
      }
    }
    return roots.filter(function (root) {
      for (var k = 0; k < roots.length; k++) if (roots[k] !== root && roots[k].contains(root)) return false;
      return true;
    });
  }
  var copySettling = false;
  var copyMo = new MutationObserver(function (records) {
    if (copySettling) return;
    var roots = copyRoots(records);
    if (!roots.length) return;
    copySettling = true;
    try {
      roots.forEach(function (root) {
        fixCategoryLabels(root);
        fixPlainHeadings(root);
        fixPlainCopy(root, true);
      });
      lockBlogCards();
      settleBlogHeroHeading();
      mountHeroLetters();
      fixLinksForLighthouse();
      convertDollarsToRupees();
    } finally {
      copySettling = false;
    }
  });
  copyMo.observe(document.documentElement, { childList: true, subtree: true });

  // Only image changes matter here; text, letter, and style churn used to
  // trigger a full rescan of every image and card on the page.
  function touchesImages(records) {
    for (var i = 0; i < records.length; i++) {
      var record = records[i];
      if (record.type === "attributes") {
        if (record.target.tagName === "IMG") return true;
        continue;
      }
      var added = record.addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        if (node.tagName === "IMG" || (node.firstElementChild && node.querySelector("img"))) return true;
      }
    }
    return false;
  }
  var fieldTimer = 0;
  var fieldMo = new MutationObserver(function (records) {
    if (fieldTimer || !touchesImages(records)) return;
    fieldTimer = setTimeout(function () {
      fieldTimer = 0;
      holdContentPhotos();
      lockGalleryStrip();
      lockPeoplePhotos();
    }, 80);
  });
  fieldMo.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "srcset"],
  });
  setTimeout(function () {
    mo.disconnect();
  }, 6000);
  var faceLocks = 0;
  var faceTimer = setInterval(function () {
    lockGalleryStrip();
    lockAboutHero();
    lockPeoplePhotos();
    bootProjectPayForm();
    faceLocks += 1;
    if (faceLocks > 3) clearInterval(faceTimer);
  }, 800);
  var payMoTimer = 0;
  var payMo = new MutationObserver(function () {
    if (payMoTimer) return;
    payMoTimer = setTimeout(function () {
      payMoTimer = 0;
      if (!document.querySelector('select[name="Choose The Cause"], form')) return;
      bootProjectPayForm();
    }, 80);
  });
  payMo.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", function () {
    placeProjectPaySheet();
  });

  function wireContactForm() {
    if (!/\/contact-us\/?$/i.test(location.pathname || "")) return;
    if (window.__ainfContactBound) return;
    window.__ainfContactBound = true;

    function findContactForm() {
      var emailInput = document.querySelector(
        'form input[name="Email"], form input[name="email"], form input[type="email"][placeholder*="Email" i]'
      );
      return emailInput && emailInput.form ? emailInput.form : null;
    }

    function setNativeValue(el, value) {
      if (!el) return;
      var proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) desc.set.call(el, value);
      else el.value = value;
      el.setAttribute("value", value);
      el.classList.toggle("framer-form-input-empty", !value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function clearContactForm(form) {
      if (!form) return;
      var fields = form.querySelectorAll("input, textarea");
      for (var i = 0; i < fields.length; i++) {
        var el = fields[i];
        var type = (el.getAttribute("type") || "").toLowerCase();
        if (type === "submit" || type === "button" || type === "hidden") continue;
        setNativeValue(el, "");
      }
      try {
        form.reset();
      } catch (e) {
        /* ignore */
      }
      // Framer sometimes restores controlled values — clear again next frames.
      window.requestAnimationFrame(function () {
        for (var j = 0; j < fields.length; j++) {
          var node = fields[j];
          var t = (node.getAttribute("type") || "").toLowerCase();
          if (t === "submit" || t === "button" || t === "hidden") continue;
          setNativeValue(node, "");
        }
      });
    }

    function ensureStatus(form) {
      var status = form.querySelector(".ainf-contact-status");
      if (status) return status;
      status = document.createElement("p");
      status.className = "ainf-contact-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.style.cssText =
        "margin:14px 0 0;font-size:14px;line-height:1.45;color:#0f332b;display:none;font-family:inherit";
      form.appendChild(status);
      return status;
    }

    function readPayload(form) {
      var nameEl = form.querySelector('input[name="Name"], input[name="name"]');
      var emailEl = form.querySelector('input[name="Email"], input[name="email"], input[type="email"]');
      var phoneEl = form.querySelector(
        'input[name="Phone Number"], input[name="phone"], input[type="tel"]'
      );
      var msgEl = form.querySelector('textarea[name="Message"], textarea[name="message"], textarea');
      return {
        name: nameEl ? String(nameEl.value || "").trim() : "",
        email: emailEl ? String(emailEl.value || "").trim() : "",
        phone: phoneEl ? ainfMobileDigits(phoneEl.value) : "",
        message: msgEl ? String(msgEl.value || "").trim() : "",
      };
    }

    var sending = false;

    function handleContactSubmit(form) {
      if (!form || sending) return;
      var status = ensureStatus(form);
      var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      var payload = readPayload(form);

      function show(msg, ok) {
        status.style.display = "block";
        status.style.color = ok ? "#0f332b" : "#8a3b3b";
        status.textContent = msg;
      }

      if (payload.name.length < 2 || !payload.email || payload.message.length < 5) {
        show("Please fill your name, email, and a short message.", false);
        return;
      }
      if (payload.phone && !ainfMobileOk(payload.phone)) {
        show("Enter your 10-digit mobile number.", false);
        return;
      }

      sending = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-busy", "true");
      }
      show("Sending your message…", true);

      fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data || {} };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            show(result.data.message || "Could not send. Please try again.", false);
            return;
          }
          clearContactForm(form);
          show(result.data.message || "Thank you — your message reached AINF.", true);
          // Keep thank-you visible; don't let Framer rewrite the button forever.
          if (submitBtn) {
            var label = submitBtn.querySelector("p, span") || submitBtn;
            if (label && label !== submitBtn) {
              label.setAttribute("data-ainf-thankyou", "1");
            }
          }
        })
        .catch(function () {
          show("Could not reach AINF. Check your connection and try again.", false);
        })
        .finally(function () {
          sending = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute("aria-busy");
          }
        });
    }

    function stopFramer(event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }

    document.addEventListener(
      "submit",
      function (event) {
        var form = event.target;
        if (!form || form.tagName !== "FORM") return;
        if (!form.querySelector('input[name="Email"], input[name="email"], input[type="email"]')) return;
        if (!form.querySelector('input[name="Name"], input[name="name"]')) return;
        stopFramer(event);
        handleContactSubmit(form);
      },
      true
    );

    // Prefer submit for Enter key; clicks go through submit when not prevented.
    // Capture clicks only when Framer swallows submit without firing it.
    document.addEventListener(
      "click",
      function (event) {
        var btn = event.target && event.target.closest
          ? event.target.closest('form[data-ainf-contact] button[type="submit"], form[data-ainf-contact] input[type="submit"]')
          : null;
        if (!btn) return;
        var form = btn.form || (btn.closest && btn.closest("form"));
        if (!form || form.getAttribute("data-ainf-contact") !== "1") return;
        stopFramer(event);
        handleContactSubmit(form);
      },
      true
    );

    // Neutralize Framer's built-in form success ("Thank you") so our API owns the flow.
    var form = findContactForm();
    if (form) {
      form.setAttribute("novalidate", "novalidate");
      form.setAttribute("data-ainf-contact", "1");
      form.setAttribute("autocomplete", "off");
      ensureStatus(form);
    }
  }

  function tryWireContact() {
    wireContactForm();
    setTimeout(wireContactForm, 400);
    setTimeout(wireContactForm, 1200);
    setTimeout(wireContactForm, 2400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tryWireContact);
  else tryWireContact();

  // Framer templates ship dollar amounts. Swap the symbol to rupees on every
  // public page, and keep doing it while Framer hydrates text nodes.
  function convertDollarsToRupees() {
    if (!document.body) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentElement;
      if (!parent || !parent.closest) continue;
      if (parent.closest("#ainf-global-nav, #ainf-support-banner, #ainf-site-footer, script, style")) continue;
      var v = node.nodeValue;
      if (!v || v.indexOf("$") === -1) continue;
      node.nodeValue = v.replace(/US\$/g, "₹").replace(/\$/g, "₹");
    }
  }

  function bootCurrency() {
    convertDollarsToRupees();
    [400, 1200, 2500, 5000, 8000].forEach(function (ms) {
      setTimeout(convertDollarsToRupees, ms);
    });
    var timer = 0;
    var mo = new MutationObserver(function () {
      if (timer) return;
      timer = setTimeout(function () {
        timer = 0;
        convertDollarsToRupees();
      }, 180);
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.body) bootCurrency();
  else document.addEventListener("DOMContentLoaded", bootCurrency);

  function giftPath() {
    return (location.pathname || "/").replace(/\/$/, "") || "/";
  }

  function shown(selector) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      var box = nodes[i].getBoundingClientRect();
      if (box.width > 8 && box.height > 8) return nodes[i];
    }
    return nodes[0] || null;
  }

  function bootProjectPayForm() {
    var forms = document.querySelectorAll("form");
    for (var i = 0; i < forms.length; i++) wireProjectPayForm(forms[i]);
    placeProjectPaySheet();
  }

  function projectBackdrop(sheet) {
    var root = document.getElementById("template-overlay") || document.getElementById("overlay");
    var nodes = root ? root.children : [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node === sheet || node.classList.contains("ainf-pay-sheet")) continue;
      var box = node.getBoundingClientRect();
      if (box.width >= window.innerWidth * 0.85 && box.height >= window.innerHeight * 0.85) return node;
    }
    return document.querySelector(".framer-zfbw2k");
  }

  function hideProjectOverlay(backdrop) {
    if (!backdrop) return false;
    var keys = Object.keys(backdrop);
    var fiberKey = "";
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf("__reactFiber") === 0) fiberKey = keys[i];
    }
    var fiber = fiberKey ? backdrop[fiberKey] : null;
    var guard = 0;
    while (fiber && guard < 40) {
      var hook = fiber.memoizedState;
      var depth = 0;
      while (hook && depth < 12) {
        if (hook.memoizedState === true && hook.queue && typeof hook.queue.dispatch === "function") {
          hook.queue.dispatch(false);
          projectPayShield(false);
          setTimeout(projectPayShield, 320, false);
          return true;
        }
        hook = hook.next;
        depth += 1;
      }
      fiber = fiber.return;
      guard += 1;
    }
    return false;
  }

  function raiseProjectBackdrop(sheet) {
    var backdrop = projectBackdrop(sheet);
    if (!backdrop) return false;
    backdrop.style.setProperty("z-index", "2147483450", "important");
    backdrop.style.setProperty("background", "rgba(16,28,22,0.42)", "important");
    backdrop.style.setProperty("backdrop-filter", "blur(16px)", "important");
    backdrop.style.setProperty("-webkit-backdrop-filter", "blur(16px)", "important");
    if (backdrop.getAttribute("data-ainf-dismiss") !== "1") {
      backdrop.setAttribute("data-ainf-dismiss", "1");
      backdrop.addEventListener("click", function (event) {
        if (event.target !== backdrop) return;
        hideProjectOverlay(backdrop);
      });
    }
    return true;
  }

  function dismissProjectPay() {
    if (document.querySelector(".razorpay-container, .razorpay-backdrop")) return;
    closeProjectCauseMenu();
    var sheet = document.querySelector(".ainf-pay-sheet");
    hideProjectOverlay(projectBackdrop(sheet));
  }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var shield = document.getElementById("ainf-pay-shield");
    if (!shield || shield.hidden) return;
    dismissProjectPay();
  });

  function projectPayShield(on) {
    var shield = document.getElementById("ainf-pay-shield");
    if (!on) {
      if (shield) shield.hidden = true;
      // Releases the page only when no other pop-up (gift, join, mission) is open.
      lockScroll(false);
      ["ainf-global-nav", "ainf-site-footer"].forEach(function (id) {
        var node = document.getElementById(id);
        if (node) node.removeAttribute("inert");
      });
      return;
    }
    if (!shield) {
      shield = document.createElement("div");
      shield.id = "ainf-pay-shield";
      shield.setAttribute("aria-hidden", "true");
      document.body.appendChild(shield);
      shield.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        dismissProjectPay();
      });
    }
    shield.hidden = false;
    lockScroll(true);
    ["ainf-global-nav", "ainf-site-footer"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.setAttribute("inert", "");
    });
  }

  function placeProjectPaySheet() {
    var cause = document.querySelector('form [name="Choose The Cause"]');
    if (!cause) {
      projectPayShield(false);
      return;
    }
    var form = cause.closest("form");
    if (!form) {
      projectPayShield(false);
      return;
    }
    var box = form.getBoundingClientRect();
    if (box.width < 8 || box.height < 8) {
      projectPayShield(false);
      return;
    }
    var fixed = form;
    var node = form;
    while (node && node !== document.body) {
      if (window.getComputedStyle(node).position === "fixed") {
        fixed = node;
        break;
      }
      node = node.parentElement;
    }
    var nav = document.getElementById("ainf-global-nav");
    var navBottom = nav ? nav.getBoundingClientRect().bottom : 80;
    var top = Math.round(navBottom + 16);
    var maxH = Math.max(320, window.innerHeight - top - 16);
    if (!document.getElementById("ainf-pay-scroll-css")) {
      var style = document.createElement("style");
      style.id = "ainf-pay-scroll-css";
      style.textContent =
        ".ainf-pay-sheet{scrollbar-width:none;-ms-overflow-style:none;border-radius:24px}" +
        ".ainf-pay-sheet::-webkit-scrollbar{width:0;height:0;display:none}" +
        "#ainf-pay-shield{position:fixed;inset:0;z-index:2147483400;background:rgba(16,28,22,0.42);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}" +
        "#ainf-pay-shield[hidden]{display:none!important}" +
        "#main form.ainf-pay-form input::placeholder,#main form.ainf-pay-form textarea::placeholder{color:#8d968c!important;-webkit-text-fill-color:#8d968c!important;opacity:1!important}" +
        "#main form.ainf-pay-form [data-ainf-cause-menu]{display:block;width:100%;overflow:visible}" +
        "#main form.ainf-pay-form .ainf-gift-menu__trigger{width:100%!important;box-sizing:border-box!important;height:48px!important;min-height:48px!important;padding:0 16px!important;border:0!important;border-radius:10px!important;background:#fff!important;box-shadow:none!important;overflow:hidden!important}" +
        "#main form.ainf-pay-form .ainf-gift-menu__trigger:hover{border:0!important;background:#fff!important}" +
        "#main form.ainf-pay-form .ainf-gift-menu__trigger:focus,#main form.ainf-pay-form .ainf-gift-menu__trigger.is-open{border:0!important;box-shadow:0 0 0 3px rgba(57,164,107,0.28)!important}";
      document.head.appendChild(style);
    }
    fixed.classList.add("ainf-pay-sheet");
    fixed.style.setProperty("z-index", "2147483500", "important");
    if (raiseProjectBackdrop(fixed)) {
      var shield = document.getElementById("ainf-pay-shield");
      if (shield) shield.hidden = true;
      lockScroll(true);
      ["ainf-global-nav", "ainf-site-footer"].forEach(function (id) {
        var node = document.getElementById(id);
        if (node) node.setAttribute("inert", "");
      });
    } else {
      projectPayShield(true);
    }
    fixed.style.setProperty("top", top + "px", "important");
    fixed.style.setProperty("bottom", "auto", "important");
    fixed.style.setProperty("left", "50%", "important");
    fixed.style.setProperty("right", "auto", "important");
    fixed.style.setProperty("transform", "translateX(-50%)", "important");
    fixed.style.setProperty("width", "min(680px, calc(100vw - 96px))", "important");
    fixed.style.setProperty("max-width", "calc(100vw - 96px)", "important");
    fixed.style.setProperty("height", maxH + "px", "important");
    fixed.style.setProperty("max-height", maxH + "px", "important");
    fixed.style.setProperty("border-radius", "24px", "important");
    fixed.style.setProperty("background", "rgb(246, 250, 240)", "important");
    fixed.style.setProperty("overflow-x", "hidden", "important");
    fixed.style.setProperty("overflow-y", "auto", "important");
    var card = form.parentElement;
    if (card && card !== fixed) {
      card.style.setProperty("justify-content", "flex-start", "important");
      card.style.setProperty("align-items", "center", "important");
      card.style.setProperty("width", "100%", "important");
      card.style.setProperty("max-width", "100%", "important");
      card.style.setProperty("height", "auto", "important");
      card.style.setProperty("max-height", "none", "important");
      card.style.setProperty("overflow", "visible", "important");
      card.style.setProperty("transform", "none", "important");
      card.style.setProperty("border-radius", "24px", "important");
      card.style.setProperty("box-sizing", "border-box", "important");
    }
    form.style.setProperty("transform", "none", "important");
    form.style.setProperty("margin", "0px", "important");
    form.style.setProperty("width", "100%", "important");
    form.style.setProperty("max-width", "100%", "important");
    form.style.setProperty("max-height", "none", "important");
    form.style.setProperty("overflow", "visible", "important");
    form.style.setProperty("border", "none", "important");
    form.style.setProperty("border-radius", "0", "important");
    form.style.setProperty("box-shadow", "none", "important");
    form.style.setProperty("background", "transparent", "important");
    form.style.setProperty("background-color", "transparent", "important");
    form.style.setProperty("padding", "4px 36px 28px", "important");
    form.classList.add("ainf-pay-form");
    form.querySelectorAll("div").forEach(function (panel) {
      if (panel.querySelector("input, select, textarea") && panel.querySelectorAll("input, select, textarea").length > 1) {
        var paint = window.getComputedStyle(panel).backgroundColor;
        if (paint === "rgb(255, 255, 255)" || paint === "rgb(246, 250, 240)") {
          panel.style.setProperty("background", "transparent", "important");
          panel.style.setProperty("background-color", "transparent", "important");
          panel.style.setProperty("box-shadow", "none", "important");
          panel.style.setProperty("border", "none", "important");
          panel.style.setProperty("border-radius", "0", "important");
        }
      }
    });
  }

  function projectFieldBlock(input) {
    var node = input.parentElement;
    var best = node;
    for (var i = 0; i < 8 && node && node.parentElement && node.parentElement !== document.body; i++) {
      var fields = node.querySelectorAll("input, select, textarea");
      if (fields.length !== 1) break;
      best = node;
      node = node.parentElement;
    }
    return best;
  }

  function projectPayNote(form, text) {
    var note = form.querySelector("[data-ainf-pay-note]");
    if (!note) {
      note = document.createElement("p");
      note.setAttribute("data-ainf-pay-note", "1");
      note.style.cssText = "margin:10px 0 0;color:#9b2c2c;font-size:13px;line-height:1.4;";
      var button = form.querySelector('button[type="submit"]');
      if (button && button.parentElement) button.parentElement.insertBefore(note, button);
      else form.appendChild(note);
    }
    note.textContent = text || "";
    note.hidden = !text;
  }

  function addProjectField(form, anchor, label, name, placeholder, inputMode) {
    if (form.querySelector('[name="' + name + '"]')) return;
    var block = projectFieldBlock(anchor);
    if (!block || !block.parentElement) return;
    var clone = block.cloneNode(true);
    var field = clone.querySelector("input, textarea, select");
    if (!field || field.tagName !== "INPUT") return;
    field.name = name;
    field.type = inputMode === "tel" ? "tel" : "text";
    field.placeholder = placeholder;
    field.value = "";
    field.required = true;
    if (inputMode) field.setAttribute("inputmode", inputMode);
    else field.removeAttribute("inputmode");
    var textNode = null;
    var walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    var current;
    while ((current = walker.nextNode())) {
      if ((current.nodeValue || "").trim()) {
        textNode = current;
        break;
      }
    }
    if (textNode) textNode.nodeValue = label;
    block.parentElement.insertBefore(clone, block.nextSibling);
  }

  var projectGiverState = null;
  var projectGiverAsked = false;
  var projectGiverTimer = 0;

  function putProjectValue(input, value) {
    if ((input.value || "") === value) return;
    var proto = input.tagName === "TEXTAREA" ? window.HTMLTextAreaElement : window.HTMLInputElement;
    var desc = Object.getOwnPropertyDescriptor(proto.prototype, "value");
    var tracker = input._valueTracker;
    if (tracker && tracker.setValue) tracker.setValue(input.value || "");
    if (desc && desc.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function writeProjectGiver(form, giver, allowFocus) {
    if (!giver) return;
    var demo = { Name: "james patrick", Email: "ostra@support.com" };
    var fields = {
      Name: giver.name || "",
      Email: giver.email || "",
      Phone: giver.phone || ""
    };
    ["Name", "Email", "Phone"].forEach(function (key) {
      var input = form.querySelector('[name="' + key + '"]');
      if (!input || !fields[key] || input.getAttribute("data-ainf-touched") === "1") return;
      var current = (input.value || "").trim();
      var isDemo = demo[key] && current.toLowerCase() === demo[key];
      if (!current || isDemo || current !== fields[key]) putProjectValue(input, fields[key]);
    });
    var amount = form.querySelector('[name="Amount"]');
    var name = form.querySelector('[name="Name"]');
    if (allowFocus && amount && name && name.value && form.getAttribute("data-ainf-amount-focus") !== "1") {
      form.setAttribute("data-ainf-amount-focus", "1");
      amount.focus();
    }
  }

  function projectGiverPending() {
    if (!projectGiverState) return false;
    var fields = {
      Name: projectGiverState.name || "",
      Email: projectGiverState.email || "",
      Phone: projectGiverState.phone || ""
    };
    var pending = false;
    document.querySelectorAll('form [name="Choose The Cause"]').forEach(function (cause) {
      var form = cause.closest("form");
      if (!form || form.getBoundingClientRect().height < 8) return;
      ["Name", "Email", "Phone"].forEach(function (key) {
        var input = form.querySelector('[name="' + key + '"]');
        if (!input || !fields[key] || input.getAttribute("data-ainf-touched") === "1") return;
        if ((input.value || "").trim() !== fields[key]) pending = true;
      });
    });
    return pending;
  }

  function applyProjectGiver(allowFocus) {
    document.querySelectorAll('form [name="Choose The Cause"]').forEach(function (cause) {
      var form = cause.closest("form");
      if (form) writeProjectGiver(form, projectGiverState, allowFocus);
    });
  }

  function watchProjectGiver() {
    if (!projectGiverState || projectGiverTimer) return;
    projectGiverTimer = setInterval(function () {
      var open = document.querySelector('form [name="Choose The Cause"]');
      if (!open || open.getBoundingClientRect().height < 8) {
        clearInterval(projectGiverTimer);
        projectGiverTimer = 0;
        return;
      }
      applyProjectGiver(false);
      if (!projectGiverPending()) {
        clearInterval(projectGiverTimer);
        projectGiverTimer = 0;
      }
    }, 300);
  }

  function syncProjectGiver() {
    if (projectGiverState) {
      applyProjectGiver(false);
      watchProjectGiver();
    }
    if (projectGiverAsked) return;
    projectGiverAsked = true;
    fetch("/api/session/state", { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } })
      .then(function (response) { return response.json(); })
      .then(function (state) {
        projectGiverState = (state && state.giver) || null;
        if (!projectGiverState && state && state.signedIn) projectGiverAsked = false;
        applyProjectGiver(true);
        if (projectGiverState) watchProjectGiver();
      })
      .catch(function () {
        projectGiverAsked = false;
      });
  }

  window.addEventListener("ainf-session", function () {
    projectGiverAsked = false;
    syncProjectGiver();
  });

  var projectTargetList = null;
  var projectTargetWait = null;

  function loadProjectTargets(done) {
    if (projectTargetList) {
      done(projectTargetList);
      return;
    }
    if (projectTargetWait) {
      projectTargetWait.push(done);
      return;
    }
    projectTargetWait = [done];
    fetch("/api/donations/targets", { headers: { accept: "application/json" } })
      .then(function (response) { return response.json(); })
      .then(function (body) {
        projectTargetList = (body && body.targets) || [];
        var wait = projectTargetWait || [];
        projectTargetWait = null;
        wait.forEach(function (fn) { fn(projectTargetList); });
      })
      .catch(function () {
        projectTargetList = [];
        var wait = projectTargetWait || [];
        projectTargetWait = null;
        wait.forEach(function (fn) { fn(projectTargetList); });
      });
  }

  function projectCauseTarget(targets, causeTitle) {
    var wanted = String(causeTitle || "").trim().toLowerCase();
    var match = null;
    for (var i = 0; i < targets.length; i++) {
      if (String(targets[i].title || "").toLowerCase() === wanted) match = targets[i];
    }
    if (match) return match;
    var desk = {
      "medical aid & health camps": "swasthya",
      "education support drive": "shiksha",
      "daily meal program": "shiksha",
      "clean water initiative": "janajati",
      "winter relief program": "ainf"
    };
    var slug = desk[wanted] || "";
    for (var j = 0; j < targets.length && slug; j++) {
      if (targets[j].slug === slug) return targets[j];
    }
    return null;
  }

  function paintAmountChoices(form) {
    var amount = form.querySelector('[name="Amount"]');
    var cause = form.querySelector('[name="Choose The Cause"]');
    if (!amount || !cause) return;
    var block = projectFieldBlock(amount);
    if (!block || !block.parentElement) return;
    loadProjectTargets(function (targets) {
      var match = projectCauseTarget(targets, cause.value);
      var minRupees = match ? Math.max(200, Math.round(match.minPaise / 100)) : 200;
      var values = [];
      var suggested = (match && match.suggestedPaise) || [];
      suggested.forEach(function (paise) {
        var rupees = Math.round(paise / 100);
        if (rupees >= minRupees && values.indexOf(rupees) === -1) values.push(rupees);
      });
      if (values.indexOf(minRupees) === -1) values.unshift(minRupees);
      values.sort(function (a, b) { return a - b; });
      if (!amount.getAttribute("data-ainf-touched")) amount.placeholder = "From ₹" + minRupees.toLocaleString("en-IN");
      amount.setAttribute("data-ainf-min", String(minRupees));
      var row = form.querySelector("[data-ainf-amount-chips]");
      if (!row) {
        row = document.createElement("div");
        row.setAttribute("data-ainf-amount-chips", "1");
        row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 4px;";
        block.parentElement.insertBefore(row, block.nextSibling);
      }
      var marker = values.join(",");
      if (row.getAttribute("data-ainf-vals") === marker) return;
      row.setAttribute("data-ainf-vals", marker);
      row.textContent = "";
      values.forEach(function (rupees) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.textContent = "₹" + rupees.toLocaleString("en-IN");
        var on = String(amount.value) === String(rupees);
        chip.style.cssText = "border:1px solid #1c7d48;border-radius:999px;padding:6px 14px;font:inherit;cursor:pointer;background:" + (on ? "#1c7d48" : "#fff") + ";color:" + (on ? "#fff" : "#1c7d48") + ";";
        chip.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          amount.value = String(rupees);
          amount.setAttribute("data-ainf-touched", "1");
          projectFieldNote(amount, "");
          row.querySelectorAll("button").forEach(function (button) {
            var picked = button === chip;
            button.style.background = picked ? "#1c7d48" : "#fff";
            button.style.color = picked ? "#fff" : "#1c7d48";
          });
        });
        row.appendChild(chip);
      });
    });
  }

  function projectFieldNote(input, text) {
    if (!input) return;
    var block = projectFieldBlock(input);
    var host = (block && block.parentElement) || input.parentElement || input;
    var note = host.querySelector(":scope > [data-ainf-field-note]");
    if (!note && block && block.nextElementSibling && block.nextElementSibling.hasAttribute("data-ainf-field-note")) {
      note = block.nextElementSibling;
    }
    var box = input.classList && input.classList.contains("ainf-gift-menu__trigger") ? input : input;
    if (!text) {
      if (note) note.hidden = true;
      box.style.removeProperty("border-color");
      return;
    }
    if (!note) {
      note = document.createElement("p");
      note.setAttribute("data-ainf-field-note", "1");
      note.style.cssText = "margin:6px 0 0;color:#9b2c2c;font-size:13px;line-height:1.35;";
      if (block && block.parentElement) block.parentElement.insertBefore(note, block.nextSibling);
      else host.appendChild(note);
    }
    note.hidden = false;
    note.textContent = text;
    box.style.setProperty("border-color", "#9b2c2c", "important");
  }

  function cleanRupees(value) {
    var cleaned = String(value || "").replace(/[^\d.]/g, "");
    var dot = cleaned.indexOf(".");
    if (dot !== -1) cleaned = cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2);
    return cleaned;
  }

  function projectAmountError(amount) {
    var raw = amount ? String(amount.value || "").trim() : "";
    if (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) <= 0) return "Enter the amount in rupees, such as 200.";
    var min = Number((amount && amount.getAttribute("data-ainf-min")) || "200");
    if (Number(raw) < min) return "The minimum is ₹" + min.toLocaleString("en-IN") + ".";
    return "";
  }

  function projectFormIssues(form) {
    var issues = [];
    var amount = form.querySelector('[name="Amount"]');
    var name = form.querySelector('[name="Name"]');
    var email = form.querySelector('[name="Email"]');
    var phone = form.querySelector('[name="Phone"]');
    var cause = form.querySelector('[name="Choose The Cause"]');
    var trigger = form.querySelector("[data-ainf-cause-trigger]");
    var amountError = projectAmountError(amount);
    if (amountError) issues.push({ input: amount, text: amountError });
    if (!name || name.value.trim().length < 2) issues.push({ input: name, text: "Enter your full name." });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) issues.push({ input: email, text: "Enter a valid email." });
    if (!phone || !ainfMobileOk(phone.value)) issues.push({ input: phone, text: "Enter your 10-digit mobile number." });
    if (!cause || !String(cause.value || "").trim()) issues.push({ input: trigger || cause, text: "Choose a cause." });
    return issues;
  }

  function showProjectIssues(form, issues) {
    ["Amount", "Name", "Email", "Phone"].forEach(function (key) {
      var input = form.querySelector('[name="' + key + '"]');
      var hit = null;
      for (var i = 0; i < issues.length; i++) if (issues[i].input === input) hit = issues[i];
      projectFieldNote(input, hit ? hit.text : "");
    });
    var trigger = form.querySelector("[data-ainf-cause-trigger]");
    var causeHit = null;
    for (var j = 0; j < issues.length; j++) if (issues[j].input === trigger) causeHit = issues[j];
    projectFieldNote(trigger, causeHit ? causeHit.text : "");
  }

  var projectCauseDrawer = null;
  var projectCauseOpen = null;

  function closeProjectCauseMenu() {
    if (projectCauseDrawer) projectCauseDrawer.hidden = true;
    if (projectCauseOpen) {
      projectCauseOpen.classList.remove("is-open");
      projectCauseOpen.setAttribute("aria-expanded", "false");
      projectCauseOpen = null;
    }
  }

  function placeProjectCauseMenu(trigger) {
    if (!projectCauseDrawer || !trigger) return;
    var rect = trigger.getBoundingClientRect();
    var gap = 8;
    var spaceBelow = window.innerHeight - rect.bottom - gap - 12;
    var spaceAbove = rect.top - gap - 12;
    var openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    var maxHeight = Math.max(120, Math.min(260, openUp ? spaceAbove : spaceBelow));
    projectCauseDrawer.style.left = Math.min(Math.max(8, rect.left), window.innerWidth - rect.width - 8) + "px";
    projectCauseDrawer.style.width = rect.width + "px";
    projectCauseDrawer.style.maxHeight = maxHeight + "px";
    var height = openUp ? Math.min(maxHeight, projectCauseDrawer.offsetHeight || maxHeight) : 0;
    projectCauseDrawer.style.top = (openUp ? Math.max(8, rect.top - height - gap) : rect.bottom + gap) + "px";
  }

  function mountProjectCauseMenu(form) {
    mountCauseMenu(form, form.querySelector('[name="Choose The Cause"]'));
  }

  // The cause <select> stays in the form (its value is what gets submitted);
  // people pick from the same drawer the gift window uses.
  function mountCauseMenu(form, select) {
    if (!form || !select) return;
    if (!projectCauseDrawer) {
      projectCauseDrawer = document.createElement("div");
      projectCauseDrawer.className = "ainf-gift-menu__drawer";
      projectCauseDrawer.setAttribute("data-ainf-project-cause", "1");
      projectCauseDrawer.hidden = true;
      projectCauseDrawer.style.zIndex = "2147483600";
      projectCauseDrawer.innerHTML = '<ul class="ainf-gift-menu__list" role="listbox"></ul>';
      document.body.appendChild(projectCauseDrawer);
      // While Framer hydrates, a capture listener on <body> stops every click,
      // so the trigger and options are handled here, on document, ahead of it.
      document.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var trigger = target.closest("[data-ainf-cause-trigger]");
        var option = !trigger && target.closest("[data-ainf-project-cause] .ainf-gift-menu__option");
        if (!trigger && !(option && option.__ainfPick)) return;
        event.preventDefault();
        event.stopPropagation();
        if (option) {
          option.__ainfPick();
          return;
        }
        if (projectCauseOpen === trigger && !projectCauseDrawer.hidden) {
          closeProjectCauseMenu();
          return;
        }
        if (!trigger.__ainfSelect) return;
        closeProjectCauseMenu();
        fillProjectCauseList(trigger.__ainfSelect);
        projectCauseDrawer.hidden = false;
        trigger.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        projectCauseOpen = trigger;
        placeProjectCauseMenu(trigger);
      }, true);
      document.addEventListener("click", function (event) {
        if (!projectCauseDrawer || projectCauseDrawer.hidden) return;
        if (event.target.closest && (event.target.closest("[data-ainf-project-cause]") || event.target.closest("[data-ainf-cause-menu]"))) return;
        closeProjectCauseMenu();
      });
      window.addEventListener("resize", closeProjectCauseMenu);
      document.addEventListener("scroll", function (event) {
        if (!projectCauseOpen || !projectCauseDrawer || projectCauseDrawer.hidden) return;
        if (event.target && event.target.closest && event.target.closest("[data-ainf-project-cause]")) return;
        placeProjectCauseMenu(projectCauseOpen);
      }, true);
    }
    var menu = form.querySelector("[data-ainf-cause-menu]");
    if (!menu) {
      menu = document.createElement("div");
      menu.className = "ainf-gift-menu";
      menu.setAttribute("data-ainf-cause-menu", "1");
      menu.innerHTML =
        '<button type="button" class="ainf-gift-menu__trigger" data-ainf-cause-trigger aria-haspopup="listbox" aria-expanded="false">' +
        '<span class="ainf-gift-menu__label"></span><span class="ainf-gift-menu__chevron" aria-hidden="true"></span></button>';
      var shell = select.parentElement;
      var fields = shell ? shell.querySelectorAll("input, textarea, select") : [];
      if (shell && shell !== form && fields.length === 1) {
        shell.insertAdjacentElement("afterend", menu);
        shell.style.setProperty("display", "none", "important");
      } else {
        select.insertAdjacentElement("afterend", menu);
        if (shell && shell !== form) {
          Array.prototype.forEach.call(shell.children, function (child) {
            if (child === menu || child === select) return;
            child.style.setProperty("display", "none", "important");
          });
          shell.style.setProperty("background", "transparent", "important");
          shell.style.setProperty("border", "none", "important");
          shell.style.setProperty("box-shadow", "none", "important");
          shell.style.setProperty("outline", "none", "important");
          shell.style.setProperty("overflow", "visible", "important");
          shell.style.setProperty("padding", "0", "important");
        }
      }
    }
    // Framer may swap the <select> on a re-render; the trigger always points at the live one.
    menu.querySelector("[data-ainf-cause-trigger]").__ainfSelect = select;
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    select.style.setProperty("display", "none", "important");
    var label = menu.querySelector(".ainf-gift-menu__label");
    var current = String(select.value || "").trim();
    var picked = select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
    var text = current ? (picked && picked.textContent.trim()) || current : "Select a cause";
    // Only write on change: the gift form re-mounts from a MutationObserver.
    if (label.textContent !== text) label.textContent = text;
    if (label.classList.contains("is-placeholder") !== !current) label.classList.toggle("is-placeholder", !current);
  }

  function fillProjectCauseList(select) {
    var list = projectCauseDrawer.querySelector(".ainf-gift-menu__list");
    list.textContent = "";
    for (var i = 0; i < select.options.length; i++) addProjectCauseOption(select, select.options[i]);
  }

  function addProjectCauseOption(select, option) {
    if (!option.value) return;
    var list = projectCauseDrawer.querySelector(".ainf-gift-menu__list");
    var item = document.createElement("li");
    var button = document.createElement("button");
    button.type = "button";
    button.className = "ainf-gift-menu__option";
    button.setAttribute("role", "option");
    button.textContent = option.textContent || option.value;
    button.classList.toggle("is-active", option.value === select.value);
    button.setAttribute("aria-selected", option.value === select.value ? "true" : "false");
    // Run by the document-level click handler in mountCauseMenu.
    button.__ainfPick = function () {
      // Remembered so a Framer re-render of the form cannot undo the choice.
      if (select.name === "Location") window.__ainfGiftCause = option.value;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      var form = select.closest("form");
      if (form) mountCauseMenu(form, select);
      projectFieldNote(form && form.querySelector("[data-ainf-cause-trigger]"), "");
      closeProjectCauseMenu();
    };
    item.appendChild(button);
    list.appendChild(item);
  }

  function bindProjectChecks(form) {
    var amount = form.querySelector('[name="Amount"]');
    if (amount && amount.getAttribute("data-ainf-amount-guard") !== "1") {
      amount.setAttribute("data-ainf-amount-guard", "1");
      amount.setAttribute("inputmode", "decimal");
      amount.setAttribute("autocomplete", "off");
      amount.addEventListener("input", function () {
        var next = cleanRupees(amount.value);
        if (amount.value !== next) {
          var tracker = amount._valueTracker;
          if (tracker && tracker.setValue) tracker.setValue(amount.value);
          amount.value = next;
          if (!next) projectFieldNote(amount, "Enter the amount in rupees, such as 200.");
        } else if (/^\d+(\.\d{1,2})?$/.test(next) && Number(next) > 0) {
          projectFieldNote(amount, "");
        }
      });
      amount.addEventListener("blur", function () {
        projectFieldNote(amount, projectAmountError(amount));
      });
    }
    ["Name", "Email", "Phone"].forEach(function (key) {
      var input = form.querySelector('[name="' + key + '"]');
      if (!input || input.getAttribute("data-ainf-check") === "1") return;
      input.setAttribute("data-ainf-check", "1");
      input.addEventListener("blur", function () {
        var issues = projectFormIssues(form).filter(function (issue) { return issue.input === input; });
        projectFieldNote(input, issues.length ? issues[0].text : "");
      });
    });
  }

  function wireProjectPayForm(form) {
    if (!form) return;
    var cause = form.querySelector('[name="Choose The Cause"]');
    var name = form.querySelector('[name="Name"]');
    var email = form.querySelector('[name="Email"]');
    if (!cause || !name || !email) return;
    if (form.getBoundingClientRect().height < 8) return;
    addProjectField(form, email, "Amount (INR)", "Amount", "Amount in rupees", "decimal");
    addProjectField(form, form.querySelector('[name="Amount"]') || email, "Phone", "Phone", "10-digit mobile", "tel");
    paintAmountChoices(form);
    syncProjectGiver();
    var button = form.querySelector('button[type="submit"]');
    if (button && /donation request/i.test(button.textContent || "")) {
      var leaves = button.querySelectorAll("p, span");
      var labeled = false;
      for (var i = 0; i < leaves.length; i++) {
        if (/donation request/i.test(leaves[i].textContent || "")) {
          leaves[i].textContent = "Pay now";
          labeled = true;
        }
      }
      if (!labeled) button.textContent = "Pay now";
    }
    if (!cause.value) {
      var pageSlug = (location.pathname || "").split("/").filter(Boolean).pop() || "";
      for (var o = 0; o < cause.options.length; o++) {
        var title = (cause.options[o].value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (title && (title === pageSlug || title.replace(/-and-/g, "-") === pageSlug)) {
          cause.value = cause.options[o].value;
          break;
        }
      }
    }
    mountProjectCauseMenu(form);
    bindProjectChecks(form);
    relaxProjectForm(form);
    if (form.getAttribute("data-ainf-pay") === "1") return;
    form.setAttribute("data-ainf-pay", "1");
    form.addEventListener("input", function (event) {
      if (!event.isTrusted) return;
      if (event.target && event.target.name) event.target.setAttribute("data-ainf-touched", "1");
    });
    form.addEventListener("change", function (event) {
      if (event.target && event.target.name === "Choose The Cause") paintAmountChoices(form);
    });
    form.addEventListener(
      "submit",
      function (event) {
        event.preventDefault();
        event.stopPropagation();
        payProjectForm(form);
      },
      true
    );
    var payButton = projectPayButton(form);
    if (payButton) {
      payButton.type = "submit";
      payButton.addEventListener(
        "click",
        function (event) {
          event.preventDefault();
          event.stopPropagation();
          payProjectForm(form);
        },
        true
      );
    }
  }

  function projectPayButton(form) {
    var buttons = form.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      if (/pay now/i.test(buttons[i].textContent || "")) return buttons[i];
    }
    return form.querySelector('button[type="submit"]');
  }

  function relaxProjectForm(form) {
    form.noValidate = true;
    form.setAttribute("novalidate", "novalidate");
    form.querySelectorAll("[required]").forEach(function (field) {
      var box = field.getBoundingClientRect();
      if (field.type === "hidden" || box.width < 2 || box.height < 2) field.removeAttribute("required");
    });
  }

  function releaseProjectPay(form) {
    form.removeAttribute("data-ainf-paying");
    var button = projectPayButton(form);
    if (button) button.disabled = false;
  }

  function payProjectForm(form) {
    if (form.getAttribute("data-ainf-paying") === "1") return;
    var name = form.querySelector('[name="Name"]');
    var email = form.querySelector('[name="Email"]');
    var cause = form.querySelector('[name="Choose The Cause"]');
    var amount = form.querySelector('[name="Amount"]');
    var phone = form.querySelector('[name="Phone"]');
    var button = projectPayButton(form);
    var raw = amount ? String(amount.value || "").trim() : "";
    var issues = projectFormIssues(form);
    if (issues.length) {
      showProjectIssues(form, issues);
      projectPayNote(form, issues[0].text);
      if (issues[0].input && issues[0].input.focus) issues[0].input.focus();
      return;
    }
    showProjectIssues(form, []);
    var causeTitle = cause ? String(cause.value || "").trim() : "";
    form.setAttribute("data-ainf-paying", "1");
    if (button) button.disabled = true;
    projectPayNote(form, "Opening payment…");
    ensureCheckout();
    fetch("/api/donations/targets")
      .then(function (response) {
        return response.json().then(function (body) { return { ok: response.ok, body: body }; });
      })
      .then(function (list) {
        var targets = (list.body && list.body.targets) || [];
        var match = projectCauseTarget(targets, causeTitle);
        if (!match) {
          form.removeAttribute("data-ainf-paying");
          if (button) button.disabled = false;
          projectPayNote(form, "That cause is not open for donations yet.");
          return;
        }
        var paise = Math.round(Number(raw) * 100);
        if (paise < match.minPaise) {
          form.removeAttribute("data-ainf-paying");
          if (button) button.disabled = false;
          projectPayNote(form, "The minimum for " + match.title + " is ₹" + giftRupees(match.minPaise) + ".");
          return;
        }
        return fetch("/api/donations/order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: match.kind,
            slug: match.slug,
            amountPaise: paise,
            name: name.value.trim(),
            email: email.value.trim(),
            phone: ainfMobileDigits(phone.value),
            source: "project-page"
          })
        }).then(function (response) {
          return response.json().then(function (body) { return { ok: response.ok, body: body, paise: paise }; });
        });
      })
      .then(function (result) {
        if (!result) return;
        if (ainfIsPaused(result.body)) {
          releaseProjectPay(form);
          projectPayNote(form, "Your interest is saved. We will email you a payment link.");
          ainfShowInterest(result.body);
          return;
        }
        if (!result.ok) {
          form.removeAttribute("data-ainf-paying");
          if (button) button.disabled = false;
          projectPayNote(form, ainfWithRetryWait((result.body && result.body.message) || "The donation could not be started.", result.body));
          return;
        }
        whenRazorpay(function () {
          try {
            var checkoutBox = new window.Razorpay({
              key: result.body.keyId,
              amount: result.body.amountPaise,
              currency: "INR",
              name: "AINF",
              description: result.body.description,
              order_id: result.body.razorpayOrderId,
              prefill: { name: name.value.trim(), email: email.value.trim(), contact: "+91" + ainfMobileDigits(phone.value) },
              theme: { color: "#1c7d48" },
              handler: function (response) {
                ainfRzpThaw();
                fetch("/api/donations/confirm", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(response)
                })
                  .then(function (res) {
                    return res.json().then(function (body) { return { ok: res.ok, body: body }; });
                  })
                  .then(function (done) {
                    releaseProjectPay(form);
                    if (done.ok && done.body.receiptPath) location.assign(done.body.receiptPath);
                    else projectPayNote(form, (done.body && done.body.message) || "If money left your account, the receipt will arrive by email.");
                  })
                  .catch(function () {
                    releaseProjectPay(form);
                    projectPayNote(form, "If money left your account, the receipt will arrive by email.");
                  });
              },
              modal: {
                ondismiss: function () {
                  ainfRzpThaw();
                  releaseProjectPay(form);
                  projectPayNote(form, "");
                }
              }
            });
            checkoutBox.on("payment.failed", function () {
              ainfRzpThaw();
              releaseProjectPay(form);
              projectPayNote(form, "The payment did not go through. You can try again.");
            });
            ainfRzpFreeze();
            checkoutBox.open();
            projectPayNote(form, "");
          } catch (error) {
            ainfRzpThaw();
            releaseProjectPay(form);
            projectPayNote(form, "Payment could not be opened. Try again.");
          }
        }, function () {
          releaseProjectPay(form);
          projectPayNote(form, "Payment could not be opened. Try again.");
        });
      })
      .catch(function () {
        form.removeAttribute("data-ainf-paying");
        if (button) button.disabled = false;
        projectPayNote(form, "The donation could not be started. Try again.");
      });
  }

  // The "Support AINF" Framer form (cause, amount, name, email) appears on
  // /donate-now and on the homepage; both take a real gift.
  function isGiftForm(form) {
    return Boolean(form && form.querySelector && form.querySelector('select[name="Location"]'));
  }

  // A field inside the form that is actually on screen (Framer ships one copy
  // of the form per breakpoint and hides the others).
  function liveGiftField(selector) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      var form = nodes[i].closest && nodes[i].closest("form");
      var box = (form || nodes[i]).getBoundingClientRect();
      if (box.width > 8 && box.height > 8) return nodes[i];
    }
    return nodes[0] || null;
  }

  function bootGiftForm() {
    if (window.__ainfGiftBoot) return;
    if (giftPath() !== "/donate-now" && !document.querySelector('form select[name="Location"]')) return;
    window.__ainfGiftBoot = true;
    // Razorpay's checkout is a heavy script. /donate-now exists to take a gift,
    // so it loads up front; on the homepage it waits until someone uses the form.
    if (giftPath() === "/donate-now") ensureCheckout();
    else {
      var warmCheckout = function (event) {
        if (!event.target || !event.target.closest || !isGiftForm(event.target.closest("form"))) return;
        document.removeEventListener("focusin", warmCheckout, true);
        document.removeEventListener("pointerdown", warmCheckout, true);
        ensureCheckout();
      };
      document.addEventListener("focusin", warmCheckout, true);
      document.addEventListener("pointerdown", warmCheckout, true);
    }

    var targets = [];
    var preferred = "";
    var busy = false;
    var params = new URLSearchParams(location.search);

    function note(text, isError) {
      var button = shown('form button[type="submit"]');
      var host = button && button.parentElement;
      if (!host) {
        var form = document.querySelector("form.framer-et7jxz") || document.querySelector("form");
        host = form;
      }
      if (!host) return;
      var line = document.querySelector("form .ainf-gift-note");
      if (!line) {
        line = document.createElement("p");
        line.className = "ainf-gift-note";
      }
      if (line.parentElement !== host) host.insertBefore(line, button || null);
      line.textContent = text || "";
      line.className = isError ? "ainf-gift-note is-error" : "ainf-gift-note";
    }

    function rupees(paise) {
      return (paise / 100).toLocaleString("en-IN");
    }

    function currentTarget() {
      var select = liveGiftField('select[name="Location"]');
      if (!select) return null;
      return targets.find(function (row) { return row.kind + ":" + row.slug === select.value; }) || null;
    }

    function ensurePhone() {
      document.querySelectorAll('[data-framer-name="Form Inputs"]').forEach(function (block) {
        if (block.querySelector('input[name="Phone"]')) return;
        var amount = block.querySelector('input[name="Support AINF Amount"]');
        var amountLabel = amount && amount.closest && amount.closest("label");
        var causeRow = block.querySelector('[data-framer-name="Cause & Amount"]');
        if (!amountLabel || !causeRow || !causeRow.parentElement) return;
        var wrap = document.createElement("div");
        wrap.setAttribute("data-ainf-phone", "1");
        var label = amountLabel.cloneNode(true);
        var input = label.querySelector("input");
        var title = label.querySelector("p");
        if (!input) return;
        input.name = "Phone";
        input.type = "tel";
        input.placeholder = "Enter Your Phone";
        input.value = "";
        input.removeAttribute("required");
        input.removeAttribute("min");
        if (title) title.textContent = "Phone";
        wrap.appendChild(label);
        var message = block.querySelector('[data-framer-name="Message"]');
        if (message) block.insertBefore(wrap, message);
        else causeRow.insertAdjacentElement("afterend", wrap);
      });
    }

    function unlockSubmit() {
      document.querySelectorAll("form button[type='submit']").forEach(function (button) {
        button.disabled = false;
        button.removeAttribute("disabled");
        button.style.opacity = "1";
        button.style.pointerEvents = "auto";
      });
    }

    function relaxHidden() {
      document.querySelectorAll("form [required]").forEach(function (field) {
        var box = field.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) field.removeAttribute("required");
      });
    }

    function paint() {
      ensurePhone();
      document.querySelectorAll('select[name="Location"]').forEach(function (select) {
        var current = select.value;
        var marker = targets.map(function (row) { return row.kind + ":" + row.slug; }).join("|");
        if (select.getAttribute("data-ainf-opts") !== marker) {
          select.textContent = "";
          var empty = document.createElement("option");
          empty.value = "";
          empty.disabled = true;
          empty.textContent = "Select Cause";
          select.appendChild(empty);
          targets.forEach(function (row) {
            var option = document.createElement("option");
            option.value = row.kind + ":" + row.slug;
            option.textContent = giftPlainTitle(row);
            select.appendChild(option);
          });
          select.setAttribute("data-ainf-opts", marker);
          select.setAttribute("data-ainf-cms", "1");
        }
        // The visitor's pick, else this page's desk; Framer's own value or the
        // browser's default first option is not a choice.
        var want = window.__ainfGiftCause || preferred || current;
        if (want && select.querySelector('option[value="' + want + '"]') && select.value !== want) select.value = want;
        if (targets.length) mountCauseMenu(select.closest("form"), select);
      });
      var row = currentTarget();
      var amount = shown('input[name="Support AINF Amount"]');
      if (row && amount && document.activeElement !== amount) {
        amount.min = String(row.minPaise / 100);
        amount.placeholder = "Minimum ₹" + rupees(row.minPaise);
      }
      relaxHidden();
      unlockSubmit();
    }

    function startGift() {
      if (busy) return;
      var row = currentTarget();
      var name = shown('input[name="Name"]');
      var email = shown('input[name="Email"]');
      var phone = shown('input[name="Phone"]');
      var amount = shown('input[name="Support AINF Amount"]');
      if (!row) {
        note("Choose a cause from the list.", true);
        return;
      }
      var raw = amount ? String(amount.value || "").trim() : "";
      if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
        note("Enter an amount in rupees.", true);
        return;
      }
      var paise = Math.round(Number(raw) * 100);
      if (paise < row.minPaise) {
        note("The minimum for " + row.title + " is ₹" + rupees(row.minPaise) + ".", true);
        return;
      }
      if (!name || name.value.trim().length < 2 || !email || !email.value.trim()) {
        note("Name and email are required.", true);
        return;
      }
      if (!phone || !ainfMobileOk(phone.value)) {
        note("Enter your 10-digit mobile number.", true);
        return;
      }
      busy = true;
      note("Opening payment…", false);
      fetch("/api/donations/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: row.kind,
          slug: row.slug,
          amountPaise: paise,
          name: name.value.trim(),
          email: email.value.trim(),
          phone: ainfMobileDigits(phone.value),
          source: giftPath() === "/donate-now" ? "donate-page" : giftPath() === "/" ? "home-form" : "page-form:" + giftPath()
        })
      })
        .then(function (response) {
          return response.json().then(function (body) { return { ok: response.ok, body: body }; });
        })
        .then(function (result) {
          if (ainfIsPaused(result.body)) {
            busy = false;
            note("Your interest is saved. We will email you a payment link.", false);
            ainfShowInterest(result.body);
            return;
          }
          if (!result.ok) {
            busy = false;
            note(ainfWithRetryWait((result.body && result.body.message) || "The donation could not be started.", result.body), true);
            return;
          }
          // Checkout loads on first use outside /donate-now, so wait for it here.
          whenRazorpay(function () { openGiftCheckout(result); }, function () {
            busy = false;
            note("Payment could not open. Refresh and try again.", true);
          });
        })
        .catch(function () {
          busy = false;
          note("The donation could not be started.", true);
        });
    }

    function openGiftCheckout(result) {
          var name = shown('input[name="Name"]');
          var email = shown('input[name="Email"]');
          var phone = shown('input[name="Phone"]');
          var checkoutBox = new window.Razorpay({
            key: result.body.keyId,
            amount: result.body.amountPaise,
            currency: "INR",
            name: "AINF",
            description: result.body.description,
            order_id: result.body.razorpayOrderId,
            prefill: { name: name.value.trim(), email: email.value.trim(), contact: "+91" + ainfMobileDigits(phone.value) },
            handler: function (response) {
              fetch("/api/donations/confirm", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(response)
              })
                .then(function (res) {
                  return res.json().then(function (body) { return { ok: res.ok, body: body }; });
                })
                .then(function (done) {
                  busy = false;
                  if (done.ok && done.body.receiptPath) location.assign(done.body.receiptPath);
                  else note((done.body && done.body.message) || "If money left your account, the receipt will arrive by email.", true);
                });
            },
            modal: {
              ondismiss: function () {
                busy = false;
                note("The donation was not taken.", false);
              }
            }
          });
          checkoutBox.open();
    }

    document.addEventListener(
      "submit",
      function (event) {
        if (!isGiftForm(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        startGift();
      },
      true
    );
    document.addEventListener(
      "click",
      function (event) {
        var button = event.target && event.target.closest && event.target.closest('button[type="submit"]');
        if (!button || !isGiftForm(button.closest("form"))) return;
        event.preventDefault();
        event.stopPropagation();
        startGift();
      },
      true
    );
    document.addEventListener("change", function (event) {
      if (event.target && event.target.name === "Location") paint();
    });

    // A cause page preselects its own desk, like the gift window does.
    fetch("/api/donations/targets" + (location.search || giftQuery()), { headers: { accept: "application/json" } })
      .then(function (response) { return response.json(); })
      .then(function (body) {
        targets = body.targets || [];
        if (body.selected) preferred = body.selected.kind + ":" + body.selected.slug;
        else if (params.get("mission")) preferred = "MISSION:" + params.get("mission");
        else if (params.get("project")) preferred = "PROJECT:" + params.get("project");
        paint();
      })
      .catch(function () { note("The cause list could not be loaded. Refresh and try again.", true); });

    // A few early passes cover hydration; later re-renders are caught by the
    // observer below (each pass measures the form, so they are not free).
    var ticks = 0;
    var lock = setInterval(function () {
      paint();
      ticks += 1;
      if (ticks >= 6) clearInterval(lock);
    }, 700);

    // Framer hydrates the form a moment after load and drops the drawer we
    // mounted, putting the native <select> back. Re-mount from the observer,
    // which runs before the next paint, so nobody sees or clicks the gap.
    function formNeedsPaint() {
      var selects = document.querySelectorAll('select[name="Location"]');
      for (var i = 0; i < selects.length; i++) {
        var form = selects[i].closest("form");
        if (!form) continue;
        if (!form.querySelector("[data-ainf-cause-menu]")) return true;
        if (selects[i].style.getPropertyValue("display") !== "none") return true;
      }
      return false;
    }
    // Only added subtrees that carry the cause <select> matter. The homepage
    // animates letter by letter, so scanning the document on every mutation
    // cost seconds of main thread; leaf nodes are skipped without a query.
    function addsCauseSelect(records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.tagName === "SELECT") {
            if (node.name === "Location") return true;
            continue;
          }
          if (node.firstElementChild && node.querySelector('select[name="Location"]')) return true;
        }
      }
      return false;
    }
    if (window.MutationObserver) {
      new MutationObserver(function (records) {
        if (targets.length && addsCauseSelect(records) && formNeedsPaint()) paint();
      }).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.body) bootGiftForm();
  else document.addEventListener("DOMContentLoaded", bootGiftForm);
})();
