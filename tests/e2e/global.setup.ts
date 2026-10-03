import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

/**
 * Obtains a Clerk testing token so the portal specs can bypass bot protection.
 * Only registered as a project when Clerk keys are present.
 */
setup("configure Clerk testing", async () => {
  await clerkSetup();
});
