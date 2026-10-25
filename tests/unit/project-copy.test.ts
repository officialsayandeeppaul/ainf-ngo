import { describe, expect, it } from "vitest";
import { applyProjectCopy } from "@/lib/project-copy";

describe("applyProjectCopy", () => {
  it("swaps template sentences for the AINF copy, word-split ones included", () => {
    const html =
      '<h1 class="t">Projects That Create Real Change</h1>' +
      '<p class="q"><span style="display:inline-block">We’ve</span> <span>seen</span> lives change when people come together, One meal, one family, one step at a time.</p>';
    const out = applyProjectCopy(html);
    expect(out).toContain('<h1 class="t">Projects on the Ground</h1>');
    expect(out).toContain(
      '<p class="q">They work with respect and consistency. Support reaches the right students and families in our blocks, without delays.</p>'
    );
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
