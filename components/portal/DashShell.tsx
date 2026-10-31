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
  verifiedByAdmin,
  children,
}: {
  role: Role | null;
  currentPath?: string;
  userSlot?: React.ReactNode;
  /** The AINF team verified this member: no verification steps to offer. */
  verifiedByAdmin?: boolean;
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
      methods={{ didit: policy.didit, pan: policy.pan, otp: policy.otp, verifiedByAdmin }}
      supportBanner={
        supportBanner ? <SupportBannerStrip banner={supportBanner} /> : null
      }
    >
      {children}
    </PortalShell>
  );
}
