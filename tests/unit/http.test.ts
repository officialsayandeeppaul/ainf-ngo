import { describe, expect, it } from "vitest";
import { noStore } from "@/lib/http";

describe("noStore", () => {
  it("marks responses uncacheable", async () => {
    const handler = noStore(async () => Response.json({ ok: true }));
    const response = await handler();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("keeps a policy the handler chose", async () => {
    const handler = noStore(async () => Response.json({}, { headers: { "cache-control": "public, s-maxage=30" } }));
    expect((await handler()).headers.get("cache-control")).toBe("public, s-maxage=30");
  });

  it("passes arguments through and tolerates immutable redirect headers", async () => {
    const handler = noStore(async (request: Request) => Response.redirect(new URL("/sign-in", request.url), 307));
    const response = await handler(new Request("https://example.org/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.org/sign-in");
  });
});
