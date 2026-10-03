import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

/**
 * Role-gated portal behaviour.
 *
 * Requires three seeded Clerk test users. Set these in .env.local:
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD                (role USER)
 *   E2E_VERIFIED_EMAIL / E2E_VERIFIED_PASSWORD        (role VERIFIED_USER)
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD              (role SUPER_ADMIN)
 *
 * Each block skips rather than fails when its credentials are missing, so the
 * suite stays green on a machine that only has some of them.
 */

type Creds = { email: string; password: string };

function creds(prefix: string): Creds | null {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  return email && password ? { email, password } : null;
}

async function signIn(page: import("@playwright/test").Page, who: Creds) {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    signInParams: { strategy: "password", identifier: who.email, password: who.password },
  });
}

test.describe("standard member", () => {
  const who = creds("E2E_USER");
  test.skip(!who, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this block.");

  test("reaches their own dashboard", async ({ page }) => {
    await signIn(page, who!);
    await page.goto("/account");
    await expect(page.getByText("Your account")).toBeVisible();
  });

  test("is offered verification", async ({ page }) => {
    await signIn(page, who!);
    await page.goto("/account/verify");
    await expect(page.getByRole("heading", { name: /become a verified member/i })).toBeVisible();
  });

  test("cannot reach the admin dashboard", async ({ page }) => {
    await signIn(page, who!);
    await page.goto("/admin");
    // The guard redirects rather than rendering anything privileged.
    await expect(page.locator("body")).not.toContainText("Instance overview");
    expect(new URL(page.url()).pathname).not.toBe("/admin");
  });

  test("cannot mutate another user through the admin API", async ({ page }) => {
    await signIn(page, who!);
    const response = await page.request.patch("/api/admin/users/some-other-id", {
      data: { action: "setRole", role: "SUPER_ADMIN" },
    });
    expect(response.status()).toBe(403);
  });

  test("cannot read the audit log", async ({ page }) => {
    await signIn(page, who!);
    await page.goto("/admin/audit");
    await expect(page.locator("body")).not.toContainText("Audit log");
  });
});

test.describe("verified member", () => {
  const who = creds("E2E_VERIFIED");
  test.skip(!who, "Set E2E_VERIFIED_EMAIL and E2E_VERIFIED_PASSWORD to run this block.");

  test("sees verified standing", async ({ page }) => {
    await signIn(page, who!);
    await page.goto("/account");
    await expect(page.getByText(/verified member/i).first()).toBeVisible();
  });

  test("still cannot reach admin surfaces", async ({ page }) => {
    await signIn(page, who!);
    await page.goto("/admin/users");
    await expect(page.locator("body")).not.toContainText("Manage users");
  });
});

test.describe("super admin", () => {
  const who = creds("E2E_ADMIN");
  test.skip(!who, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this block.");

  test("reaches the admin overview", async ({ page }) => {
    await signIn(page, who!);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /instance overview/i })).toBeVisible();
  });

  test("reaches user management", async ({ page }) => {
    await signIn(page, who!);
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("reaches the CRM portal", async ({ page }) => {
    await signIn(page, who!);
    await page.goto("/admin/crm");
    await expect(page.getByRole("heading", { name: "CRM" })).toBeVisible();
    await expect(page.getByLabel("Search")).toBeVisible();
    await expect(page.getByLabel("Membership")).toBeVisible();
  });

  test("reaches the verification queue", async ({ page }) => {
    await signIn(page, who!);
    await page.goto("/admin/kyc");
    await expect(page.getByRole("heading", { name: /verification queue/i })).toBeVisible();
  });

  test("reaches the audit log", async ({ page }) => {
    await signIn(page, who!);
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: /audit log/i })).toBeVisible();
  });

  test("cannot change their own role", async ({ page }) => {
    await signIn(page, who!);
    await page.goto("/admin/users");
    // Self-mutation is refused server-side; the row renders a notice instead.
    await expect(page.getByText("Your own account").first()).toBeVisible();
  });
});

test.describe("bootstrap gate", () => {
  const who = creds("E2E_USER");
  test.skip(!who, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this block.");

  test("rejects a wrong bootstrap key", async ({ page }) => {
    await signIn(page, who!);
    const response = await page.request.post("/api/admin/bootstrap", {
      data: { key: "definitely-not-the-key" },
    });
    expect(response.status()).not.toBe(200);
    const body = await response.json().catch(() => ({}));
    expect(["invalid_key", "mfa_required", "already_bootstrapped", "rate_limited"]).toContain(
      body.error
    );
  });
});
