import type { Role } from "@prisma/client";
import { getVerificationPolicy } from "@/lib/verification-policy";
import { getPublicSupportBanner } from "@/lib/support-banner";
import { PortalShell } from "./PortalNav";
import { PortalUserButton } from "./PortalUserButton";
import { SupportBannerStrip } from "./SupportBannerStrip";

/** Dashboard chrome with env-aware sidebar links. */
export async function DashShell({
  role,
  currentPath,
  userSlot,
  children,
}: {
  role: Role | null;
  currentPath?: string;
  userSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const policy = getVerificationPolicy();
  const supportBanner = await getPublicSupportBanner();
  return (
    <PortalShell
      role={role}
      currentPath={currentPath}
      userSlot={userSlot ?? <PortalUserButton />}
      variant="dash"
      methods={{ didit: policy.didit, pan: policy.pan, otp: policy.otp }}
      supportBanner={
        supportBanner ? <SupportBannerStrip banner={supportBanner} /> : null
      }
    >
      {children}
    </PortalShell>
  );
}
