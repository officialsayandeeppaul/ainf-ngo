import { CONTENT_ALTS, FIELD_OK, FIELD_PHOTOS, FIELD_POOL, PEOPLE_PHOTOS } from "./field-photos";

/**
 * Inline <head> script that keeps Framer's re-renders from swapping photos.
 *
 * The served HTML no longer matches Framer's page modules (content, headings,
 * and photos were rewritten after export), so hydration falls back to a client
 * render of most sections. That render rebuilds every <img> from the modules:
 * Hopper stock photos and framerusercontent.com originals, which then flashed
 * on screen until a debounced fix-up pass swapped them back, and were
 * downloaded for nothing.
 *
 * The guard intercepts the moment an image URL is set on an <img> (attribute
 * or property). A foreign URL is never applied. Once the element is in the
 * document, it gets what the served HTML showed in the same slot (same alt
 * text, same position among visible images with that alt), so a re-render
 * paints exactly what was already on screen. Portraits follow the name on the
 * card, and tabbed mission/story images follow their title, matching
 * ainf-page-boot.js.
 *
 * `snapshot` must run once the served images are final and before Framer
 * starts; ainf-page-boot.js calls window.__ainfImgSnap() as its first
 * statement, which is after stylesheets load (deferred scripts wait for them)
 * and before any module script.
 */

type GuardConfig = {
  own: string;
  map: Record<string, string>;
  pool: string[];
  content: string[];
  people: Record<string, string>;
  desks: Record<string, string>;
};

type Pick = { src: string; srcset: string; sizes: string };

/* The body below is serialized with Function#toString, so it must stay
   self-contained ES5: no imports, closures over module scope, or helpers. */
function ainfImageGuard(cfg: GuardConfig) {
  var W = window as any;
  var D = document;
  if (W.__ainfImgGuard || !W.HTMLImageElement || !W.MutationObserver) return;
  W.__ainfImgGuard = 1;

  var EMPTY = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  var REMOTE = /framerusercontent\.com\/images\//;
  // Framer's modules also point at self-hosted stock copies in any folder
  // (home-hero/, home-fourth/, ...), so everything under /assets/img/ is
  // foreign except our own photos, marks, and local icons.
  var OWN = new RegExp(cfg.own);
  /** Images a page chose itself (project photos from Postgres), never replaced. */
  var ownUrls: Record<string, 1> = {};
  var THEMED = /^(?:Cause Image|Blog Image|Missions Image)$/;
  // Team cards carry no names (the walk up would find someone else's), so
  // only testimonials are matched by name; team photos replay their slot.
  var PEOPLE_KEYS = /^Testimonial Image$/;
  var mapKeys = Object.keys(cfg.map);
  var names = Object.keys(cfg.people);
  var proto = W.HTMLImageElement.prototype;
  var rawSet = Element.prototype.setAttribute;
  var rawRemove = Element.prototype.removeAttribute;
  var srcProp = Object.getOwnPropertyDescriptor(proto, "src");
  var srcsetProp = Object.getOwnPropertyDescriptor(proto, "srcset");
  var picks: Record<string, Pick[]> | null = null;
  var queue: any[] = [];
  var writing = false;

  function mapped(value: string) {
    for (var i = 0; i < mapKeys.length; i++) if (value.indexOf(mapKeys[i]) >= 0) return cfg.map[mapKeys[i]];
    return "";
  }

  function foreign(value: unknown) {
    if (value == null) return false;
    var text = String(value);
    if (!text || text.indexOf("data:") === 0) return false;
    var parts = text.split(",");
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (ownUrls[part.trim().split(" ")[0].split("?")[0]]) continue;
      if (REMOTE.test(part)) return true;
      if (part.indexOf("/assets/img/") >= 0 && !OWN.test(part)) return true;
    }
    return false;
  }

  function put(img: Element, name: string, value: string) {
    writing = true;
    try {
      if (value) rawSet.call(img, name, value);
      else rawRemove.call(img, name);
    } finally {
      writing = false;
    }
  }

  /** Slot key: the alt text, or for unlabelled images the nearest named Framer layer. */
  function keyOf(img: any): string {
    if (img.__ainfKey == null) {
      var alt = img.getAttribute("alt") || "";
      var layer = alt ? null : img.closest("[data-framer-name]");
      img.__ainfKey = alt || (layer ? "@" + layer.getAttribute("data-framer-name") : "");
    }
    return img.__ainfKey;
  }

  function shown(img: Element) {
    return img.getClientRects().length > 0;
  }

  function hash(text: string) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return h < 0 ? -h : h;
  }

  /** The one portrait named on this card, if exactly one known name is in it. */
  function personFor(img: Element) {
    var node = img.parentElement;
    for (var depth = 0; node && depth < 10; depth++) {
      var text = node.textContent || "";
      if (text.length > 4000) return "";
      var found = "";
      for (var i = 0; i < names.length; i++) {
        if (text.indexOf(names[i]) < 0) continue;
        if (found) return "";
        found = cfg.people[names[i]];
      }
      if (found) return found;
      node = node.parentElement;
    }
    return "";
  }

  /** deskFromText() in ainf-page-boot.js. */
  function deskOf(text: string) {
    var t = text.toLowerCase();
    var desk = "";
    if (/shiksha|classroom|every child|school supplies|education/.test(t)) desk = "shiksha";
    else if (/swasthya|health camp|care closer|medical care|medical-aid|healthcare/.test(t)) desk = "swasthya";
    else if (/rozgar|skill|employer|jobs, not|food & nutrition|daily-meal/.test(t)) desk = "rozgar";
    else if (/nari|women|suraksha|empowerment/.test(t)) desk = "nari";
    else if (/janajati|kheti|hamlet|tribal/.test(t)) desk = "kheti";
    else if (/clean-water|jerrycan|drinking water/.test(t)) desk = "water";
    else if (/donation|changing lives|kit/.test(t)) desk = "kit";
    else if (/communit|together|winter/.test(t)) desk = "hamlet";
    else if (/volunteer|sevak|join-as/.test(t)) desk = "swasthya";
    return desk ? cfg.desks[desk] || "" : "";
  }

  /**
   * Mirrors deskFromText(nearestTitleOnly(img)) in ainf-page-boot.js. A card's
   * own link decides first, and its title is looked for inside that link only:
   * walking up past the card found whichever heading came first, which
   * depended on how far Framer had rendered.
   */
  function deskFor(img: Element) {
    var link = img.closest("a[href]");
    var byLink = link ? deskOf(link.getAttribute("href") || "") : "";
    if (byLink) return byLink;
    var node: Element | null = link || img;
    for (var i = 0; i < 6 && node; i++) {
      var title = node.querySelector('[data-framer-name="Cause Title"], h2, h3, h4');
      if (title) return deskOf(title.textContent || "");
      if (node === link) break;
      node = node.parentElement;
    }
    return "";
  }

  /** Photos a page script assigned to specific Framer originals (by id). */
  var extra: Record<string, string> = {};

  function extraFor(value: string) {
    for (var id in extra) if (value.indexOf(id) >= 0) return extra[id];
    return "";
  }

  /** Rules that win over the served slot: portraits by name, mission/story photos by explicit map or title. */
  function ruleFor(img: Element, want: { src?: string; srcset?: string }) {
    var key = keyOf(img);
    if (PEOPLE_KEYS.test(key) || cfg.people[key]) return personFor(img);
    if (THEMED.test(key)) return extraFor(want.src || "") || extraFor(want.srcset || "") || deskFor(img);
    return "";
  }

  function settle(img: any, ordinal: number) {
    var want = img.__ainfWant || {};
    img.__ainfWant = null;
    img.__ainfQueued = 0;
    var key = keyOf(img);
    var direct = ruleFor(img, want);
    if (direct) {
      put(img, "srcset", "");
      put(img, "src", direct);
      return;
    }
    var list = picks && picks[key];
    if (list && list.length && ordinal >= 0) {
      var pick = list[ordinal % list.length];
      // sizes before srcset: with srcset first, Chrome can pick a candidate
      // against the wrong sizes (a wider file, a second download, a late LCP).
      put(img, "sizes", pick.srcset ? pick.sizes : "");
      put(img, "srcset", pick.srcset);
      put(img, "src", pick.src);
      return;
    }
    var fallback = mapped(want.src || "") || mapped(want.srcset || "");
    if (!fallback && cfg.content.indexOf(key) >= 0) {
      fallback = cfg.pool[hash(want.src || want.srcset || key) % cfg.pool.length];
    }
    if (fallback) {
      put(img, "srcset", "");
      put(img, "src", fallback);
      return;
    }
    if (want.srcset) put(img, "srcset", want.srcset);
    if (want.src) put(img, "src", want.src);
  }

  function flush() {
    if (!picks || !queue.length) return;
    var live = 0;
    for (var i = 0; i < queue.length; i++) if (queue[i].isConnected) live++;
    if (!live) return;
    // Ordinals first, writes after: interleaving them would force a layout per image.
    var counts: Record<string, number> = {};
    var order: any[] = [];
    var all = D.images;
    for (var j = 0; j < all.length; j++) {
      var img: any = all[j];
      var key = keyOf(img);
      var visible = shown(img);
      if (!key || !visible) {
        if (img.__ainfQueued) order.push([img, -1]);
        continue;
      }
      var n = counts[key] || 0;
      counts[key] = n + 1;
      if (img.__ainfQueued) order.push([img, n]);
    }
    var rest: any[] = [];
    for (var q = 0; q < queue.length; q++) if (!queue[q].isConnected) rest.push(queue[q]);
    queue = rest.length > 400 ? rest.slice(rest.length - 400) : rest;
    for (var k = 0; k < order.length; k++) settle(order[k][0], order[k][1]);
  }

  function hold(img: any, name: string, value: string) {
    var want = img.__ainfWant || (img.__ainfWant = {});
    want[name] = value;
    if (name === "src") put(img, "src", EMPTY);
    if (!img.__ainfQueued) {
      img.__ainfQueued = 1;
      queue.push(img);
    }
    if (picks && img.isConnected) flush();
  }

  /** Later fixes by our own scripts to a served image become that slot's pick. */
  function track(img: any, name: string, value: string | null) {
    var pick = img.__ainfPick;
    if (!pick || writing) return;
    if (name === "src") pick.src = value || "";
    else if (name === "srcset") pick.srcset = value || "";
    else if (name === "sizes") pick.sizes = value || "";
  }

  Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
    if ((name === "src" || name === "srcset") && this.localName === "img" && !writing) {
      if (foreign(value)) return hold(this, name, String(value));
      track(this, name, String(value));
    } else if (name === "sizes" && this.localName === "img") {
      track(this, name, String(value));
    }
    return rawSet.call(this, name, value);
  };
  Element.prototype.removeAttribute = function (this: Element, name: string) {
    if ((name === "srcset" || name === "sizes") && this.localName === "img") track(this, name, "");
    return rawRemove.call(this, name);
  };
  if (srcProp && srcProp.set && srcProp.get) {
    Object.defineProperty(proto, "src", {
      configurable: true,
      enumerable: srcProp.enumerable,
      get: srcProp.get,
      set: function (this: Element, value: string) {
        if (!writing && foreign(value)) return hold(this, "src", String(value));
        if (!writing) track(this, "src", String(value));
        srcProp!.set!.call(this, value);
      },
    });
  }
  if (srcsetProp && srcsetProp.set && srcsetProp.get) {
    Object.defineProperty(proto, "srcset", {
      configurable: true,
      enumerable: srcsetProp.enumerable,
      get: srcsetProp.get,
      set: function (this: Element, value: string) {
        if (!writing && foreign(value)) return hold(this, "srcset", String(value));
        if (!writing) track(this, "srcset", String(value));
        srcsetProp!.set!.call(this, value);
      },
    });
  }

  function snapshot() {
    if (picks) return;
    var map: Record<string, Pick[]> = {};
    var all = D.images;
    for (var i = 0; i < all.length; i++) {
      var img: any = all[i];
      if (img.__ainfQueued) continue;
      var key = keyOf(img);
      var src = img.getAttribute("src") || "";
      if (!key || !src || src.indexOf("data:") === 0 || !shown(img)) continue;
      var pick: Pick = { src: src, srcset: img.getAttribute("srcset") || "", sizes: img.getAttribute("sizes") || "" };
      img.__ainfPick = pick;
      (map[key] || (map[key] = [])).push(pick);
    }
    picks = map;
    flush();
  }

  W.__ainfImgSnap = snapshot;
  W.__ainfImgRules = {
    /** Page scripts register { framerImageId: photo } for originals they own. */
    map: function (photos: Record<string, string>) {
      for (var id in photos) extra[id] = photos[id];
    },
    own: function (urls: string[]) {
      for (var i = 0; i < urls.length; i++) if (urls[i]) ownUrls[String(urls[i]).split("?")[0]] = 1;
    },
    /** Used by scripts/bake-page-photos.mjs to give served portraits the same rule. */
    person: personFor,
  };
  D.addEventListener("DOMContentLoaded", snapshot);
  new W.MutationObserver(function () {
    if (queue.length) flush();
  }).observe(D.documentElement, { childList: true, subtree: true });
}

export function imageGuardScript(): string {
  const config: GuardConfig = {
    own: `${FIELD_OK.source}|theainf-|ainf-seal|ainf-card|\\/assets\\/img\\/projects\\/|\\/media\\/projects\\/|\\/assets\\/img\\/[^"?#]+\\.svg(?:$|[?#])`,
    map: FIELD_PHOTOS,
    pool: FIELD_POOL,
    content: CONTENT_ALTS,
    people: PEOPLE_PHOTOS,
    // Same desk photos as VILLAGE_PHOTOS in ainf-page-boot.js.
    desks: {
      shiksha: "/assets/img/hero-third/518fb7f61a5e6510.webp",
      swasthya: "/assets/img/hero-third/4a27119994acc349.webp",
      rozgar: "/assets/img/home-sixth/ce25dc676c029d0e.webp",
      nari: "/assets/img/hero-third/1b892b571234582c.webp",
      kheti: "/assets/img/hero-third/97kub697kub697ku.webp",
      hamlet: "/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp",
      kit: "/assets/img/hero-third/1b0ac308d87a6dbd.webp",
      water: "/assets/img/hero-third/571e61ddc71daaf0.webp",
      care: "/assets/img/home-sixth/395d6ceebb97e0ae.webp",
    },
  };
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `<script id="ainf-img-guard">(${ainfImageGuard.toString()})(${json});</script>`;
}
