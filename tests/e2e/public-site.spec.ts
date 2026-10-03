import { expect, test, type Page } from "@playwright/test";

/**
 * Regression cover for the marketing site. None of this needs credentials.
 *
 * The point is to prove the auth work did not disturb the 25 Framer HTML
 * routes: they still render, the shared nav still injects, and unauthenticated
 * visitors are redirected off the portal rather than seeing an error.
 *
 * These pages carry 400KB-2MB of Framer HTML plus a long tail of images, so
 * every navigation waits for `domcontentloaded` rather than full `load` — the
 * markup and the boot scripts are what matter here, not the last hero image.
 */

const FRAMER_ROUTES = [
  "/",
  "/about-us",
  "/blogs",
  "/causes",
  "/contact-us",
  "/donate-now",
  "/join-as-volunteer",
  "/legal-pages/terms-conditions",
  "/projects",
  "/projects/clean-water-initiative",
  "/causes/education-for-every-child",
  "/blogs/why-every-volunteer-matters",
];

function visit(page: Page, path: string) {
  return page.goto(path, { waitUntil: "domcontentloaded" });
}

test.describe("Framer marketing routes", () => {
  for (const route of FRAMER_ROUTES) {
    test(`${route} serves HTML`, async ({ page }) => {
      const response = await visit(page, route);
      expect(response?.status(), `${route} should be 200`).toBe(200);
      expect(response?.headers()["content-type"]).toContain("text/html");
      const length = (await page.content()).length;
      expect(length).toBeGreaterThan(50_000);
    });
  }
});

test.describe("configured redirects", () => {
  const redirects: [string, string][] = [
    ["/contact", "/contact-us"],
    ["/privacy", "/legal-pages/terms-conditions"],
    ["/terms-conditions", "/legal-pages/terms-conditions"],
  ];

  for (const [from, to] of redirects) {
    test(`${from} redirects to ${to}`, async ({ page }) => {
      await visit(page, from);
      expect(new URL(page.url()).pathname).toBe(to);
    });
  }
});

test.describe("security headers", () => {
  test("are present on marketing pages", async ({ request }) => {
    // Asserted through the API client: this is purely about response headers,
    // so there is no reason to pay for rendering a 1.4MB page.
    const response = await request.get("/about-us");
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["permissions-policy"]).toContain("microphone=()");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});

test.describe("shared navigation", () => {
  test("injects the account entry point", async ({ page }) => {
    await visit(page, "/");
    const account = page.locator("#ainf-global-nav .ainf-account");
    await expect(account).toBeAttached({ timeout: 30_000 });
    await expect(account).toHaveAttribute("href", "/account");
  });

  test("keeps the donate CTA alongside it", async ({ page }) => {
    await visit(page, "/");
    await expect(page.locator("#ainf-global-nav .ainf-cta")).toBeAttached({ timeout: 30_000 });
  });
});

test.describe("portal access when signed out", () => {
  test("/account never renders member or admin data", async ({ page }) => {
    await visit(page, "/account");
    const body = await page.content();
    // Without Clerk keys this is the setup notice; with them, the sign-in page.
    expect(body).not.toContain("Instance overview");
    expect(body).not.toContain("Manage users");
  });

  test("/admin never renders the admin dashboard", async ({ page }) => {
    await visit(page, "/admin");
    const body = await page.content();
    expect(body).not.toContain("Instance overview");
    expect(body).not.toContain("Verification queue");
  });

  test("membership card check is public", async ({ page }) => {
    await visit(page, "/card/verify?c=not-a-real-token");
    await expect(page.getByRole("heading", { name: /card not recognised|not an active ainf member|active ainf member/i })).toBeVisible();
    await expect(page.getByText(/card not recognised|not an active ainf member/i)).toBeVisible();
  });
});

test.describe("webhook endpoints reject unsigned payloads", () => {
  test("Didit", async ({ request }) => {
    const response = await request.post("/api/webhooks/didit", {
      data: { session_id: "forged", status: "Approved" },
    });
    // 401 when a secret is configured, 503 when it is not. Never 2xx.
    expect([401, 503]).toContain(response.status());
  });

  test("Didit, with a plausible but wrong signature", async ({ request }) => {
    const response = await request.post("/api/webhooks/didit", {
      headers: {
        "x-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-signature-v2": "a".repeat(64),
      },
      data: { session_id: "forged", status: "Approved", webhook_type: "status.updated" },
    });
    expect([401, 503]).toContain(response.status());
  });

  test("Clerk", async ({ request }) => {
    const response = await request.post("/api/webhooks/clerk", {
      data: { type: "user.created", data: { id: "forged" } },
    });
    expect([400, 503]).toContain(response.status());
  });

  test("Razorpay", async ({ request }) => {
    const response = await request.post("/api/webhooks/razorpay", {
      data: { event: "payment.captured", payload: { payment: { entity: { id: "forged" } } } },
    });
    expect([401, 503]).toContain(response.status());
  });
});

test.describe("contact form API", () => {
  test("rejects empty payloads", async ({ request }) => {
    const response = await request.post("/api/contact", {
      data: { name: "A", email: "bad", message: "hi" },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_input");
  });

  test("admin message routes refuse anonymous callers", async ({ request }) => {
    const response = await request.patch("/api/admin/messages/anyone", {
      data: { action: "markReviewed" },
      maxRedirects: 0,
    });
    expect([301, 302, 307, 308, 401, 403, 503]).toContain(response.status());
  });
});

test.describe("authenticated endpoints when signed out", () => {
  const endpoints = [
    { method: "post" as const, path: "/api/kyc/session", data: {} },
    { method: "post" as const, path: "/api/kyc/pan", data: { pan: "ABCDE1234F", name: "A", dob: "01-01-1990" } },
    { method: "post" as const, path: "/api/admin/bootstrap", data: { key: "guess" } },
    { method: "post" as const, path: "/api/membership/order", data: { tierId: "x", interval: "MONTHLY" } },
    { method: "post" as const, path: "/api/membership/quotes", data: { interval: "MONTHLY" } },
    { method: "post" as const, path: "/api/membership/cancel", data: { immediate: false } },
  ];

  // 401 unauthenticated, 403 forbidden, 3xx to sign-in, or 503 when the
  // instance has no Clerk/database keys. Never a 2xx, and never a bare 500 —
  // an unconfigured install must fail deliberately, not by crashing.
  const REFUSED = [301, 302, 307, 308, 401, 403, 503];

  for (const endpoint of endpoints) {
    test(`${endpoint.path} refuses anonymous callers`, async ({ request }) => {
      const response = await request[endpoint.method](endpoint.path, {
        data: endpoint.data,
        maxRedirects: 0,
      });
      expect(REFUSED).toContain(response.status());
    });
  }

  test("admin user mutation refuses anonymous callers", async ({ request }) => {
    const response = await request.patch("/api/admin/users/anyone", {
      data: { action: "setRole", role: "SUPER_ADMIN" },
      maxRedirects: 0,
    });
    expect(REFUSED).toContain(response.status());
  });

  test("admin membership cancel refuses anonymous callers", async ({ request }) => {
    const response = await request.post("/api/admin/users/anyone/membership", {
      data: { immediate: true },
      maxRedirects: 0,
    });
    expect(REFUSED).toContain(response.status());
  });

  test("CRM pages refuse anonymous callers", async ({ request }) => {
    const list = await request.get("/admin/crm", { maxRedirects: 0 });
    expect(REFUSED).toContain(list.status());
    const dossier = await request.get("/admin/crm/anyone", { maxRedirects: 0 });
    expect(REFUSED).toContain(dossier.status());
  });
});
