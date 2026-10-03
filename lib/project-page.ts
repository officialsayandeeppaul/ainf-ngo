import { serveFramerPage } from "@/lib/framer-page";
import { listPublicFieldProjects, type FieldProjectView } from "@/lib/field-projects";
import type { ProjectDetail } from "@/lib/project-detail";

const FIELD_POOL = [
  "/assets/img/hero-third/518fb7f61a5e6510.webp",
  "/assets/img/hero-third/4a27119994acc349.webp",
  "/assets/img/hero-third/1b892b571234582c.webp",
  "/assets/img/hero-third/97kub697kub697ku.webp",
  "/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp",
  "/assets/img/hero-third/1b0ac308d87a6dbd.webp",
  "/assets/img/hero-third/571e61ddc71daaf0.webp",
  "/assets/img/home-sixth/ce25dc676c029d0e.webp",
  "/assets/img/home-sixth/395d6ceebb97e0ae.webp",
  "/assets/img/home-sixth/83d7f3cef733d28c.webp",
  "/assets/img/7d52ebcc5c881e07.webp",
  "/assets/img/46ca7b057fe54d13.webp",
  "/assets/img/1d477190300d27a6.webp",
  "/assets/img/7fb7552621c79350.webp",
];

const FIELD_OK =
  /518fb7f61a5e6510|4a27119994acc349|ce25dc676c029d0e|1b892b571234582c|97kub697kub697ku|9fzzlw9fzzlw9fzz|1b0ac308d87a6dbd|571e61ddc71daaf0|395d6ceebb97e0ae|home-sixth\/83d7f3cef733d28c|7d52ebcc5c881e07|46ca7b057fe54d13|1d477190300d27a6|7fb7552621c79350|\/people\/(?:imran-ansari|amit-hazra|birsa-murmu|ravi-hembram)/;

const TEXTURE =
  /96690a270973a763|65e4fe3b71103bc2|f9ae4aecce078de6|2d263d6ae10cc7bd|a95af15c9096fc0a|50cf5ee624cdbe60|d0fdea8216d62e05|dedab43eef2285e1|a344bac9b35c5dea|2dd60ec5f37c748d|562ef86697f4a6b5|e0861057/;

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function splitMoney(label: string) {
  const match = label.trim().match(/^([^\d]*)(\d[\d,]*)(.*)$/);
  if (!match) return { symbol: "", num: label.trim(), suffix: "" };
  return { symbol: match[1], num: match[2], suffix: match[3] };
}

function replaceText(html: string, from: string, to: string) {
  if (!from || from === to) return html;
  let next = html.split(from).join(to);
  const raw = unescapeHtml(from);
  const rawTo = unescapeHtml(to);
  if (raw !== from) next = next.split(raw).join(rawTo);
  return next;
}

function patchMoney(html: string, name: string, label: string) {
  const parts = splitMoney(label);
  const re = new RegExp(
    `(data-framer-name="${name}"[\\s\\S]*?<p\\b[^>]*>)[^<]*(</p>[\\s\\S]*?<p\\b[^>]*>)[^<]*(</p>[\\s\\S]*?<p\\b[^>]*>)[^<]*(</p>)`,
    "g"
  );
  return html.replace(
    re,
    `$1${esc(parts.symbol)}$2${esc(parts.num)}$3${esc(parts.suffix)}$4`
  );
}

function patchImages(html: string, hero: string, extras: string[]) {
  let card = 0;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\.svg(?:\?|")/i.test(tag) || /alt="(?:Back Arrow|Next Arrow|Logo|AINF)/i.test(tag)) return tag;
    const src = (/src="([^"]+)"/i.exec(tag) || [])[1] || "";
    if (!src || src.startsWith("data:")) return tag;
    const base = src.split("?")[0];
    if (TEXTURE.test(base)) {
      return tag.replace(/\s+srcset="[^"]*"/gi, "").replace(/\s+sizes="[^"]*"/gi, "");
    }
    const banner = /fetchpriority="high"/i.test(tag);
    if (banner) {
      return tag.replace(/\s+srcset="[^"]*"/gi, "").replace(/\s+sizes="[^"]*"/gi, "");
    }
    const indian = FIELD_OK.test(base);
    const srcset = /\ssrcset="/i.test(tag);
    if (indian && !srcset) return tag;
    const use = indian ? base : extras[card++ % extras.length];
    let next = tag.replace(/\s+srcset="[^"]*"/gi, "").replace(/\s+sizes="[^"]*"/gi, "");
    const busted = `${use.split("?")[0]}?ainf=20260927c`;
    next = /\ssrc="/i.test(next)
      ? next.replace(/\ssrc="[^"]*"/i, ` src="${busted}"`)
      : next.replace(/<img\b/i, `<img src="${busted}"`);
    if (!/data-ainf-cms=/.test(next)) next = next.replace(/<img\b/i, `<img data-ainf-cms="1"`);
    return next;
  });
}

function patchCopy(html: string, detail: ProjectDetail) {
  const rules: Array<[RegExp, string]> = [
    [/^How This Work$/i, detail.howEyebrow],
    [/simple breakdown of the process/i, detail.howIntro],
    [/structured training workshops/i, detail.howParagraphs[0]],
    [/ongoing mentorship sessions/i, detail.howParagraphs[1]],
    [/To ensure real outcomes/i, detail.howParagraphs[2]],
    [/^Our Mission$/i, detail.missionEyebrow],
    [/Our mission is to/i, detail.missionTitle],
    [/nutritious meals/i, detail.missionPoints[0]],
    [/local partners to deliver/i, detail.missionPoints[1]],
    [/urgent cases first/i, detail.missionPoints[2]],
    [/^Impact \/ Results$/i, detail.impactTitle],
    [/patients treated/i, detail.impactPoints[0]],
    [/health camps organized/i, detail.impactPoints[1]],
    [/volunteers involved/i, detail.impactPoints[2]],
    [/donations used for program/i, detail.impactPoints[3]],
  ];
  let next = html.replace(/<(p|h2|h3)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag: string, attrs: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const hit = rules.find(([re]) => re.test(text));
    if (!hit) return full;
    const clean = attrs.replace(/\s*data-ainf-cms="1"/g, "");
    return `<${tag}${clean} data-ainf-cms="1">${esc(hit[1])}</${tag}>`;
  });
  const exact: Array<[string, string]> = [
    [
      "We conduct structured training workshops designed to equip participants with practical, job-ready skills that match current market needs. These workshops focus on both technical abilities and essential soft skills, helping individuals build confidence and competence for the workplace.",
      detail.howParagraphs[0],
    ],
    [
      "Alongside training, we provide ongoing mentorship sessions where participants receive guidance, career advice, and personalized support from experienced professionals. This mentorship helps them set clear goals, overcome challenges, and stay motivated throughout their learning journey.",
      detail.howParagraphs[1],
    ],
    [
      "To ensure real outcomes, we actively connect participants with employment and internship opportunities through our network of local businesses, organizations, and partners. By bridging the gap between training and employment, the project empowers individuals to achieve sustainable livelihoods and long-term independence.",
      detail.howParagraphs[2],
    ],
    ["1,800+ patients treated", detail.impactPoints[0]],
    ["25+ health camps organized", detail.impactPoints[1]],
    ["120 volunteers involved", detail.impactPoints[2]],
    ["100% donations used for program", detail.impactPoints[3]],
    ["How This Work", detail.howEyebrow],
    ["Impact / Results", detail.impactTitle],
  ];
  for (const [from, to] of exact) next = replaceText(next, from, esc(to));
  return next;
}

function patchRegionImages(html: string, startId: string, image: string) {
  const marker = `id="${startId}"`;
  const start = html.indexOf(marker);
  if (start < 0 || !image) return html;
  const nextId = html.slice(start + marker.length).search(/\sid="[a-z0-9-]+"/i);
  const end = nextId >= 0 ? start + marker.length + nextId : Math.min(html.length, start + 24000);
  const busted = `${image.split("?")[0]}?ainf=20260927c`;
  const slice = html.slice(start, end).replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\.svg(?:\?|")/i.test(tag) || /Arrow/i.test(tag)) return tag;
    let next = tag.replace(/\s+srcset="[^"]*"/gi, "").replace(/\s+sizes="[^"]*"/gi, "");
    next = /\ssrc="/i.test(next) ? next.replace(/\ssrc="[^"]*"/i, ` src="${busted}"`) : next;
    if (!/data-ainf-cms=/.test(next)) next = next.replace(/<img\b/i, `<img data-ainf-cms="1"`);
    return next;
  });
  return html.slice(0, start) + slice + html.slice(end);
}

function lockScript(project: FieldProjectView) {
  const payload = JSON.stringify({
    title: project.title,
    summary: project.summary,
    imageUrl: project.imageUrl.split("?")[0],
    raisedLabel: project.raisedLabel,
    goalLabel: project.goalLabel,
    detail: project.detail,
  }).replace(/</g, "\\u003c");
  return `<script id="ainf-project-lock">(function(){var p=${payload};var d=p.detail||{};function plain(el){return (el.textContent||"").replace(/\\s+/g," ").trim();}function setText(el,value){if(!el||!value)return;if(plain(el)!==value)el.textContent=value;el.setAttribute("data-ainf-cms","1");}function paintImages(root,url){if(!root||!url)return;root.querySelectorAll("img").forEach(function(img){var src=img.getAttribute("src")||"";if(/\\.svg($|\\?)/i.test(src)||/arrow/i.test(img.getAttribute("alt")||""))return;img.removeAttribute("srcset");img.removeAttribute("sizes");if(src.split("?")[0]!==url)img.src=url+"?ainf=20260927c";img.setAttribute("data-ainf-cms","1");});}function paint(){document.querySelectorAll("h1").forEach(function(h){if(h.closest&&h.closest("#ainf-global-nav,#ainf-site-footer"))return;setText(h,p.title);});var how=document.getElementById("how-this-work");if(how){var ps=[].slice.call(how.querySelectorAll("p"));if(ps.length>=7){setText(ps[0],d.howEyebrow);setText(ps[1],d.howIntro);setText(ps[2],d.howEyebrow);setText(ps[3],d.howIntro);setText(ps[4],d.howParagraphs[0]);setText(ps[5],d.howParagraphs[1]);setText(ps[6],d.howParagraphs[2]);}else if(ps.length>=5){setText(ps[0],d.howEyebrow);setText(ps[1],d.howIntro);setText(ps[2],d.howParagraphs[0]);setText(ps[3],d.howParagraphs[1]);setText(ps[4],d.howParagraphs[2]);}}var mission=document.getElementById("our-mission");if(mission){var head=mission.querySelector("h2,h3");setText(head,d.missionTitle);var point=0;[].slice.call(mission.querySelectorAll("p")).forEach(function(el){var t=plain(el);if(/^\\d{2}$/.test(t))return;if(t===d.missionEyebrow||t==="Our Mission"||(t.length<18&&(d.missionPoints||[]).indexOf(t)<0)){setText(el,d.missionEyebrow);return;}setText(el,(d.missionPoints||[])[point%3]);point++;if(point>3){var row=el.closest&&el.closest('[data-framer-name^="Point"]');if(row)row.style.setProperty("display","none","important");}});paintImages(mission,d.missionImage);}var impact=document.getElementById("impact");if(impact){var bullet=0;[].slice.call(impact.querySelectorAll("p")).forEach(function(el){var t=plain(el);if(!t||/image gallery/i.test(t))return;if((d.impactPoints||[]).indexOf(t)>=0){setText(el,(d.impactPoints||[])[bullet%4]);bullet++;return;}if(t===d.impactTitle||t==="Impact / Results"||t.length<22){setText(el,d.impactTitle);return;}setText(el,(d.impactPoints||[])[bullet%4]);bullet++;});paintImages(impact,d.galleryImage);}document.querySelectorAll('[data-framer-name="Hero Section"],[data-framer-name="Hero Sectiion"]').forEach(function(hero){var blurb=null;hero.querySelectorAll("p").forEach(function(el){if(blurb)return;if(el.closest&&el.closest('[data-framer-name="raised"],[data-framer-name="goal"]'))return;if(plain(el).length>24)blurb=el;});setText(blurb,p.summary);});}paint();var n=0;var timer=setInterval(function(){paint();if(++n>24)clearInterval(timer);},700);function arm(){if(!document.body)return;new MutationObserver(function(){paint();}).observe(document.body,{childList:true,subtree:true,characterData:true});}if(document.body)arm();else document.addEventListener("DOMContentLoaded",arm);})();</script>`;
}

/** Title, summary, amounts, and photos from the saved project, including Framer's hydration data. */
export function patchProjectHtml(html: string, project: FieldProjectView) {
  const title = esc(project.title);
  const summary = esc(project.summary);
  const hero = project.imageUrl.split("?")[0];
  const extras = FIELD_POOL.filter((url) => url !== hero);
  const oldTitles = [
    ...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi),
  ]
    .map((match) => match[1].replace(/<[^>]+>/g, "").trim())
    .filter((text) => text && unescapeHtml(text) !== project.title);
  const oldSummaries = [
    ...html.matchAll(/<\/h1>([\s\S]*?<p\b[^>]*>)([\s\S]*?)<\/p>/gi),
  ]
    .map((match) => match[2].replace(/<[^>]+>/g, "").trim())
    .filter((text) => text && unescapeHtml(text) !== project.summary && text.length > 24 && text.length < 280);

  let next = html;
  for (const oldTitle of [...new Set(oldTitles)]) next = replaceText(next, oldTitle, title);
  for (const oldSummary of [...new Set(oldSummaries)]) next = replaceText(next, oldSummary, summary);

  next = next.replace(/<h1\b([^>]*)>[\s\S]*?<\/h1>/gi, (_full, attrs: string) => {
    const clean = attrs.replace(/\s*data-ainf-cms="1"/g, "");
    return `<h1${clean} data-ainf-cms="1">${title}</h1>`;
  });
  next = next.replace(
    /(<\/h1>[\s\S]*?<p\b)([^>]*)(>)[\s\S]*?(<\/p>)/gi,
    (_full, start: string, attrs: string, end: string, close: string) => {
      const clean = attrs.replace(/\s*data-ainf-cms="1"/g, "");
      return `${start}${clean} data-ainf-cms="1"${end}${summary}${close}`;
    }
  );
  next = patchMoney(next, "raised", project.raisedLabel);
  next = patchMoney(next, "goal", project.goalLabel);
  next = patchImages(next, hero, extras);

  const raisedNum = parseInt(splitMoney(project.raisedLabel).num.replace(/,/g, ""), 10);
  const goalNum = parseInt(splitMoney(project.goalLabel).num.replace(/,/g, ""), 10);
  if (Number.isFinite(raisedNum) && Number.isFinite(goalNum)) {
    const slugAt = next.indexOf(`"${project.slug}"`);
    if (slugAt >= 0) {
      const head = next.slice(0, slugAt);
      const tail = next.slice(slugAt).replace(
        /(\{"type":22,"value":23\},"number",)\d+(,\{"type":22,"value":25\},)\d+/,
        `$1${raisedNum}$2${goalNum}`
      );
      next = head + tail;
    }
  }

  let photo = 0;
  const photos = [hero, ...extras];
  next = next.replace(/https:\/\/framerusercontent\.com\/images\/[^"\s]+/g, (url) => {
    if (/width=2304|width=3072/.test(url)) return url;
    return photos[photo++ % photos.length];
  });
  next = next.replace(/<title>[^<]*<\/title>/i, `<title>${title} | theainf.in</title>`);
  next = next.replace(
    /<meta property="og:title" content="[^"]*">/i,
    `<meta property="og:title" content="${title}">`
  );
  next = next.replace(
    /<meta name="twitter:title" content="[^"]*">/i,
    `<meta name="twitter:title" content="${title}">`
  );
  if (project.detail) {
    next = patchCopy(next, project.detail);
    next = patchRegionImages(next, "our-mission", project.detail.missionImage);
    next = patchRegionImages(next, "impact", project.detail.galleryImage);
  }
  if (next.includes("</body>")) next = next.replace("</body>", `${lockScript(project)}</body>`);
  return next;
}

export async function serveProjectPage(pageId: string, slug: string) {
  const projects = await listPublicFieldProjects();
  const project = projects.find((row) => row.slug === slug);
  if (!project) return serveFramerPage(pageId);
  return serveFramerPage(pageId, (html) => patchProjectHtml(html, project));
}
