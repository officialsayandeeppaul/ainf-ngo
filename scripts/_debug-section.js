const fs = require("fs");

function decode(source) {
  const marker = 'const HTML = "';
  const start = source.indexOf(marker) + marker.length;
  let i = start;
  let raw = "";
  while (i < source.length) {
    if (source[i] === "\\" && i + 1 < source.length) {
      raw += source[i] + source[i + 1];
      i += 2;
      continue;
    }
    if (source[i] === '"') break;
    raw += source[i];
  }
  // fix loop - I broke i++ above. redo properly:
  return null;
}

function decodeFile(file) {
  const source = fs.readFileSync(file, "utf8");
  const marker = 'const HTML = "';
  let i = source.indexOf(marker) + marker.length;
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
const backup = decodeFile("app/route.ts.hopper-backup");

const a = html.indexOf("One Signature Can");
const b = html.indexOf("Seven Focus Areas");
console.log("section span", a, b, b - a);

const section = html.slice(a, b);
const plain = section.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
console.log("plain texts:", plain.match(/\|[^|]{2,80}\|/g)?.slice(0, 40));

// Compare ticker text between backup and current
function tickerTexts(h) {
  const texts = [];
  for (const m of h.matchAll(/ticker-item[\s\S]*?<\/li>/g)) {
    const t = m[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (t.length > 40) texts.push(t.slice(0, 100));
    if (texts.length >= 5) break;
  }
  return texts;
}
console.log("\ncurrent ticker texts with content:", tickerTexts(html));
console.log("backup ticker texts with content:", tickerTexts(backup));

// Count text nodes in ticker area
const tickA = html.indexOf("ticker-item");
const tickArea = html.slice(tickA, tickA + 50000);
const backupTick = backup.slice(backup.indexOf("ticker-item"), backup.indexOf("ticker-item") + 50000);
console.log("\ncurrent ticker area has Lorem/text?", /[A-Za-z]{4,}/.test(tickArea.replace(/framer|svg|class|style|aria|token|rgb|flex|width|height|content|transform|relative|position/g, "")));
console.log("p tags in ticker current", (tickArea.match(/<p /g) || []).length);
console.log("p tags in ticker backup", (backupTick.match(/<p /g) || []).length);
console.log("backup sample p", backupTick.match(/<p [^>]*>[\s\S]{0,80}<\/p>/)?.[0]);
console.log("current sample p", tickArea.match(/<p [^>]*>[\s\S]{0,80}<\/p>/)?.[0]);
