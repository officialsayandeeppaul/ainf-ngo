import type { Metadata } from "next";
import { isClerkConfigured } from "@/lib/env";
import { safeSignInReturn } from "@/lib/donation-rules";
import { PortalShell } from "@/components/portal/PortalNav";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { AuthMethod } from "@/components/portal/AuthMethod";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  if (!isClerkConfigured) {
    return (
      <SetupNotice
        feature="Clerk authentication"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]}
        hint="Run `clerk auth login` then `clerk init` to populate these automatically."
      />
    );
  }

  const params = await searchParams;
  const next = safeSignInReturn(params.redirect_url);

  return (
    <PortalShell role={null}>
      <div className="pt-center">
        <div className="pt-auth">
          <AuthMethod initialMode="sign-in" next={next} />
        </div>
      </div>
    </PortalShell>
  );
}
