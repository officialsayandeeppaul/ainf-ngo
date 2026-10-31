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
    const map = JSON.parse(/^<script id="ainf-asset-v">window\.__ainfAssetV=(\{[^;]*\});/.exec(script)![1]);
    expect(map["/assets/js/ainf-projects-theme.js"]).toBe(hashOf("/assets/js/ainf-projects-theme.js"));
    expect(map["/i18n/home-strings.json"]).toBe(hashOf("/i18n/home-strings.json"));
  });

  it("start the strings download early only for Hindi or Bengali visitors", () => {
    const script = runtimeAssetScript();
    const start = (lang: string) => {
      const win: Record<string, unknown> = {};
      const fetched: string[] = [];
      const removed: string[] = [];
      const timers: Array<() => void> = [];
      const body = script.replace(/^<script id="ainf-asset-v">/, "").replace(/<\/script>$/, "");
      new Function("window", "document", "fetch", "setTimeout", body)(
        win,
        { documentElement: { lang, classList: { remove: (c: string) => removed.push(c) } } },
        (url: string) => {
          fetched.push(url);
          return Promise.resolve({ ok: true, json: () => ({}) });
        },
        (fn: () => void) => timers.push(fn)
      );
      timers.forEach((fn) => fn());
      return { fetched, removed, started: Boolean(win.__ainfStrings) };
    };

    const hi = start("hi");
    expect(hi.fetched).toEqual([`/i18n/home-strings.json?v=${hashOf("/i18n/home-strings.json")}`]);
    expect(hi.started).toBe(true);
    expect(hi.removed).toEqual(["ainf-i18n-wait"]);
    expect(start("bn").fetched).toHaveLength(1);
    expect(start("en")).toEqual({ fetched: [], removed: [], started: false });
  });
});
