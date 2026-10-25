import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assetVersion, runtimeAssetScript, versionAssetRefs, versionedUrl } from "@/lib/asset-version";

const hashOf = (rel: string) =>
  createHash("sha1").update(readFileSync(path.join(process.cwd(), "public", rel))).digest("hex").slice(0, 10);

describe("asset versions", () => {
  it("derive from file contents", () => {
    expect(assetVersion("/assets/js/ainf-page-boot.js")).toBe(hashOf("/assets/js/ainf-page-boot.js"));
    expect(versionedUrl("/i18n/home-strings.json")).toBe(`/i18n/home-strings.json?v=${hashOf("/i18n/home-strings.json")}`);
  });

  it("replace hand-kept versions on script and stylesheet references", () => {
    const html =
      '<script src="/assets/js/ainf-site-nav.js?v=20261003d" defer></script>' +
      '<link rel="stylesheet" href="/assets/css/home.css">' +
      '<link rel="stylesheet" href="/i18n/home-i18n.css">';
    const out = versionAssetRefs(html);
    expect(out).toContain(`src="/assets/js/ainf-site-nav.js?v=${hashOf("/assets/js/ainf-site-nav.js")}"`);
    expect(out).toContain(`href="/assets/css/home.css?v=${hashOf("/assets/css/home.css")}"`);
    expect(out).toContain(`href="/i18n/home-i18n.css?v=${hashOf("/i18n/home-i18n.css")}"`);
    expect(out).not.toContain("20261003d");
  });

  it("leave unknown files and other URLs alone", () => {
    const html = '<script src="/assets/js/missing.js?v=1"></script><img src="/assets/img/a.webp"><a href="/assets/css/x">';
    expect(versionAssetRefs(html)).toBe(html);
  });

  it("publish the files scripts load themselves", () => {
    const script = runtimeAssetScript();
    const map = JSON.parse(script.replace(/^<script id="ainf-asset-v">window.__ainfAssetV=/, "").replace(/;<\/script>$/, ""));
    expect(map["/assets/js/ainf-projects-theme.js"]).toBe(hashOf("/assets/js/ainf-projects-theme.js"));
    expect(map["/i18n/home-strings.json"]).toBe(hashOf("/i18n/home-strings.json"));
  });
});
