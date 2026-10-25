import { describe, expect, it } from "vitest";
import { applyProjectCopy } from "@/lib/project-copy";

describe("applyProjectCopy", () => {
  it("swaps template sentences for the AINF copy", () => {
    const html = '<h1 class="t">Projects That Create Real Change</h1>';
    expect(applyProjectCopy(html)).toBe('<h1 class="t">Projects on the Ground</h1>');
  });

  it("rewrites a testimonial run word by word and keeps Framer's animated spans", () => {
    const word = "display:inline-block;opacity:0.001;filter:blur(10px)";
    const run = (style: string, words: string[]) =>
      `<span class="framer-text" style="${style}">${words.map((w) => `<span style="${word}">${w}</span>`).join(" ")}</span>`;
    const html =
      '<h2 class="framer-text">' +
      run("--framer-text-color:grey", ["We’ve", "seen", "lives", "change", "when", "people", "come", "together,"]) +
      run("--framer-text-color:black", ["One", "meal,", "one", "family,", "one", "step", "at", "a", "time."]) +
      "</h2>";
    const out = applyProjectCopy(html);
    expect(out).toBe(
      '<h2 class="framer-text">' +
        run("--framer-text-color:grey", ["We’ve", "seen", "lives", "change", "when", "help", "reaches", "the", "hamlet,"]) +
        run("--framer-text-color:black", ["one", "camp,", "one", "meal,", "one", "family", "at", "a", "time."]) +
        "</h2>"
    );
  });

  it("never flattens animated text into plain text", () => {
    const html =
      '<p class="q"><span style="display:inline-block">Introduction</span></p>' +
      '<h2><span style="display:inline-block">Hear</span> from those who&#39;ve seen the impact.</h2>';
    expect(applyProjectCopy(html)).toBe(html);
  });

  it("leaves database copy and unrelated text alone", () => {
    const html = '<h1 data-ainf-cms="1">Projects That Create Real Change</h1><p>Projects That Create Real Change, today</p>';
    expect(applyProjectCopy(html)).toBe(html);
  });

  it("rebrands visible text but not scripts, styles, or attributes", () => {
    const html =
      '<p title="Ostra">Volunteer at Ostra</p><script>var s="Ostra";</script><style>.a>b{content:"Oxira"}</style><span>@Oxira 2026</span>';
    const out = applyProjectCopy(html);
    expect(out).toContain('<p title="Ostra">Volunteer at AINF</p>');
    expect(out).toContain('<script>var s="Ostra";</script>');
    expect(out).toContain('<style>.a>b{content:"Oxira"}</style>');
    expect(out).toContain("<span>© 2026 theainf</span>");
  });

  it("does not reach across nested blocks", () => {
    const html = "<li><p>Introduction</p></li>";
    expect(applyProjectCopy(html)).toBe("<li><p>About this work</p></li>");
  });
});
