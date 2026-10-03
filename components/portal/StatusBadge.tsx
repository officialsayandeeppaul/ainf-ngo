import { KycStatus, PanStatus, UserStatus } from "@prisma/client";

type Tone = "neutral" | "success" | "danger" | "warning" | "info";

const KYC_PRESENTATION: Record<KycStatus, { label: string; tone: Tone }> = {
  NOT_STARTED: { label: "Not started", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  IN_REVIEW: { label: "In review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  ABANDONED: { label: "Abandoned", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "warning" },
};

const PAN_PRESENTATION: Record<PanStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "info" },
  VERIFIED: { label: "Verified", tone: "success" },
  MISMATCH: { label: "Name/DOB mismatch", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
};

const USER_PRESENTATION: Record<UserStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  SUSPENDED: { label: "Suspended", tone: "warning" },
  BANNED: { label: "Banned", tone: "danger" },
};

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`pt-badge pt-badge--${tone}`}>
      <span className="pt-badge__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export const KycBadge = ({ status }: { status: KycStatus }) => (
  <Badge {...KYC_PRESENTATION[status]} />
);

export const PanBadge = ({ status }: { status: PanStatus }) => (
  <Badge {...PAN_PRESENTATION[status]} />
);

export const UserStatusBadge = ({ status }: { status: UserStatus }) => (
  <Badge {...USER_PRESENTATION[status]} />
);

export { KYC_PRESENTATION, PAN_PRESENTATION };
