const fs = require("fs");

function decodeFile(file) {
  const source = fs.readFileSync(file, "utf8");
  let i = source.indexOf('const HTML = "') + 14;
  let raw = "";
  while (i < source.length) {
    if (source[i] === "\\" && i + 1 < source.length) {
      raw += source[i] + source[i + 1];
      i += 2;
      continue;
    }
    if (source[i] === '"') break;
    raw += source[i];
    i++;
  }
  let html = raw;
  for (let p = 0; p < 5; p++) {
    let out = "";
    for (let j = 0; j < html.length; ) {
      if (html[j] === "\\" && j + 1 < html.length) {
        const n = html[j + 1];
        const map = { n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\" };
        if (map[n] !== undefined) {
          out += map[n];
          j += 2;
          continue;
        }
        out += n;
        j += 2;
        continue;
      }
      out += html[j++];
    }
    if (out === html) break;
    html = out;
  }
  return html;
}

const html = decodeFile("app/route.ts");

// Find help cards
for (const name of [
  "Give to a Desk",
  "Join as Field Sevak",
  "Adopt a Desk",
  "Make a Donation",
  "Become a Volunteer",
  "Sponsor a Cause",
]) {
  const i = html.indexOf(name);
  console.log(name, i);
  if (i > 0) {
    const block = html.slice(i - 1200, i + 100);
    const masks = block.match(/-webkit-mask:url\("data:image\/svg\+xml,[^"]{0,200}/g);
    const classes = [...block.matchAll(/class="([^"]*framer-[^"]*)"/g)].map((m) => m[1]);
    console.log("  classes near", classes.slice(-8));
    // find empty icon divs
    const icons = block.match(/data-framer-name="[^"]*[Ii]con[^"]*"[^>]*>[\s\S]{0,200}/g);
    console.log("  icon markup", icons && icons[0]?.slice(0, 180));
  }
}

// All classes that have mask:url with data svg - check if quotes are broken
const maskRules = [...html.matchAll(/\.([a-zA-Z0-9_-]+)\{[^}]*-webkit-mask:url\("data:image\/svg\+xml,([\s\S]*?)"\)[^}]*\}/g)];
console.log("\nmask rules found", maskRules.length);
let broken = 0;
for (const m of maskRules) {
  const payload = m[2];
  // If payload contains unencoded " before the closing, it's broken
  // Actually the capture stops at first " so if SVG has display="block" the capture is truncated
  if (payload.includes("<svg") && !payload.includes("</svg>")) {
    broken++;
    if (broken <= 5) console.log("BROKEN mask class", m[1], "payload start", payload.slice(0, 80));
  }
}
console.log("broken mask rules", broken, "of", maskRules.length);

// Check %22 encoded masks (good)
const encoded = [...html.matchAll(/-webkit-mask:url\("data:image\/svg\+xml,%3Csvg/g)].length;
const encoded2 = [...html.matchAll(/-webkit-mask:url\('data:image\/svg\+xml,<svg/g)].length;
console.log("encoded %3Csvg masks", encoded, "single-quote masks", encoded2);
