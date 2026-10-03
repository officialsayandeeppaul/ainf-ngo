import { KycBadge } from "./StatusBadge";
import type { UserVerificationSummary } from "@/lib/verification-summary";

export function VerifyMethodStack({
  summary,
  compact = false,
}: {
  summary: UserVerificationSummary;
  compact?: boolean;
}) {
  return (
    <div className={`pt-methods${compact ? " pt-methods--compact" : ""}`}>
      <div className="pt-methods__head">
        <KycBadge status={summary.kycStatus} />
        <span className="pt-methods__count">
          {summary.methodsPassed} method{summary.methodsPassed === 1 ? "" : "s"} · {summary.totalAttempts}{" "}
          check{summary.totalAttempts === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="pt-methods__chips">
        {summary.methods.map((method) => (
          <li key={method.id} className={`pt-method pt-method--${method.tone}`}>
            <span className="pt-method__name">{method.label}</span>
            <span className="pt-method__line">{method.headline}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
