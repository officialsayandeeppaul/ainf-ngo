/* Keep AINF navbar links after Framer hydrates (Projects was vanishing). */
(function () {
  if (window.__ainfNavPersistBooted) return;
  window.__ainfNavPersistBooted = true;

  var LABEL_FIX = {
    Diary: "Stories",
    "Reach Us": "Contact",
  };

  function norm(t) {
    return (t || "").replace(/\s+/g, " ").trim();
  }

  function fixLabels(root) {
    (root || document).querySelectorAll("a").forEach(function (a) {
      var t = norm(a.textContent);
      if (LABEL_FIX[t]) {
        if (a.childNodes.length === 1 && a.firstChild.nodeType === 3) {
          a.textContent = LABEL_FIX[t];
        } else {
          var p = a.querySelector("p, span");
          if (p && norm(p.textContent) === t) p.textContent = LABEL_FIX[t];
          else a.textContent = LABEL_FIX[t];
        }
      }
    });
  }

  function findNavHosts() {
    var hosts = Array.prototype.slice.call(
      document.querySelectorAll('[data-framer-name="Nav Links"]')
    );
    var menus = Array.prototype.slice.call(
      document.querySelectorAll('[data-framer-name="Menu Items"], [data-framer-name="Quick links"]')
    );
    return hosts.concat(menus);
  }

  function linkIsProjects(a) {
    var href = (a.getAttribute("href") || "").replace(location.origin, "");
    var t = norm(a.textContent);
    return t === "Projects" || /(^|\/)projects\/?(\?|#|$)/.test(href);
  }

  function ensureProjectsInHost(host) {
    var anchors = Array.prototype.slice.call(host.querySelectorAll("a"));
    if (anchors.some(linkIsProjects)) return;

    var missions = anchors.find(function (a) {
      return norm(a.textContent) === "Missions" || /causes/i.test(a.getAttribute("href") || "");
    });
    if (!missions) return;

    var container =
      missions.closest('[data-framer-component-type="RichTextContainer"]') ||
      missions.closest("li") ||
      missions.parentElement;
    if (!container || !container.parentNode) return;

    var clone = container.cloneNode(true);
    clone.setAttribute("data-ainf-projects-link", "1");
    var link = clone.querySelector("a");
    if (!link) return;
    link.setAttribute("href", "/projects");
    link.removeAttribute("data-framer-page-link-current");
    // plain text replace
    var textNode = link.querySelector("p, span") || link;
    if (textNode === link && link.childNodes.length && link.querySelector("*")) {
      // nested rich text
      var inner = link.querySelector("p.framer-text, span.framer-text, p, span");
      if (inner) inner.textContent = "Projects";
      else link.textContent = "Projects";
    } else {
      textNode.textContent = "Projects";
    }

    if (container.nextSibling) {
      container.parentNode.insertBefore(clone, container.nextSibling);
    } else {
      container.parentNode.appendChild(clone);
    }
  }

  function sync() {
    if (document.body && document.body.classList.contains("ainf-projects-skin")) {
      // /projects pages use the floating AINF nav — skip Framer nav edits
      return;
    }
    fixLabels(document);
    findNavHosts().forEach(ensureProjectsInHost);
    // second pass after insert
    fixLabels(document);
  }

  function start() {
    sync();
    var i = 0;
    var timer = setInterval(function () {
      sync();
      i += 1;
      if (i > 50) clearInterval(timer); // ~10s covers Framer hydrate
    }, 200);

    var mo = new MutationObserver(function () {
      if (window.__ainfNavPersistQuiet) return;
      window.__ainfNavPersistQuiet = true;
      try {
        sync();
      } finally {
        setTimeout(function () {
          window.__ainfNavPersistQuiet = false;
        }, 50);
      }
    });
    if (document.body) {
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
  window.addEventListener("load", sync);
})();
