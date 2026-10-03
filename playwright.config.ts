import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

// Next 16 permits only one dev server per project directory, so the suite
// reuses whatever is already on this port rather than starting a rival one.
const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
);

/**
 * Two projects:
 *  - "public" covers the 25 Framer routes and the shared nav. It needs no
 *    credentials and always runs.
 *  - "portal" covers the authenticated surfaces and is skipped entirely when
 *    Clerk keys are absent, rather than failing with confusing auth errors.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // The Framer pages are 400KB-2MB of HTML each and compile on first request in
  // dev. Too many parallel workers starve the single dev server into timeouts.
  workers: process.env.CI ? 1 : 4,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 120_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 90_000,
    // The first request to an API route pays for a dev-mode compile of Prisma
    // and the Clerk SDK, which alone can run past 20s on a cold cache.
    actionTimeout: 60_000,
  },

  projects: [
    ...(clerkConfigured
      ? [{ name: "setup", testMatch: /global\.setup\.ts/ }]
      : []),
    {
      name: "public",
      testMatch: /public-site\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    ...(clerkConfigured
      ? [
          {
            name: "portal",
            testMatch: /portal\.spec\.ts/,
            dependencies: ["setup"],
            use: { ...devices["Desktop Chrome"] },
          },
        ]
      : []),
  ],

  webServer: {
    // --webpack because Turbopack cannot create junction points on exFAT.
    command: `npx next dev --webpack --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
