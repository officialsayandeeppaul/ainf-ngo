import type { Metadata } from "next";
import Link from "next/link";
import { isDatabaseConfigured } from "@/lib/env";
import { formatDay } from "@/lib/format-date";
import { lookupMembershipCard } from "@/lib/membership-card";
import { cardVerifyCopy } from "@/lib/membership-card-art";

export const metadata: Metadata = { title: "Membership check" };
export const dynamic = "force-dynamic";

export default async function CardVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  type VerifyView = Awaited<ReturnType<typeof lookupMembershipCard>>;
  const unknown: VerifyView = {
    kind: "unknown",
    live: false,
    name: null,
    designation: null,
    badge: null,
    validUntil: null,
    card: null,
    regNo: null,
    photoUrl: null,
    frontSvg: null,
    frontUrl: null,
    dbError: false,
  };
  let result: VerifyView = unknown;
  if (!isDatabaseConfigured) {
    result = { ...unknown, dbError: true };
  } else {
    result = await lookupMembershipCard(c);
  }

  const lookupFailed = Boolean(result.dbError);
  const copy = lookupFailed
    ? {
        title: "Check temporarily unavailable",
        body: "The membership database did not respond in time. Refresh in a moment — your card code was not rejected.",
      }
    : cardVerifyCopy(result.kind);
  const stateClass = lookupFailed
    ? "is-unknown"
    : result.live
      ? "is-live"
      : result.kind === "unknown"
        ? "is-unknown"
        : "is-out";
  const mark = lookupFailed
    ? "RETRY"
    : result.live
      ? "VERIFIED"
      : result.kind === "unknown"
        ? "INVALID"
        : "INACTIVE";
  const marks = Array.from({ length: 12 }, () => mark);
  const showCard = Boolean(result.frontSvg) && !lookupFailed;

  return (
    <div className={`pt-card-verify ${stateClass}`}>
      <div className="pt-card-verify__mark" aria-hidden="true">
        {marks.map((word, index) => (
          <span key={`${word}-${index}`}>{word}</span>
        ))}
      </div>

      <main className="pt-card-verify__stage">
        <div className={`pt-card-verify__frame ${stateClass}`}>
          {showCard ? (
            <div
              className="pt-card-verify__svg"
              dangerouslySetInnerHTML={{ __html: result.frontSvg! }}
              role="img"
              aria-label="AINF membership ID card"
            />
          ) : null}

          <section className="pt-card-verify__result" aria-live="polite">
            <div>
              <h1 className="pt-card-verify__status">{copy.title}</h1>
              <p className="pt-card-verify__lede">{copy.body}</p>
            </div>
            {!lookupFailed && result.name ? (
              <ul className="pt-card-verify__chips">
                <li>
                  <span>Name</span>
                  {result.name}
                </li>
                <li>
                  <span>Regd. No.</span>
                  {result.regNo ?? "—"}
                </li>
                <li>
                  <span>Valid until</span>
                  {result.validUntil ? formatDay(result.validUntil) : "—"}
                </li>
              </ul>
            ) : null}
          </section>
        </div>

        <p className="pt-card-verify__note">
          Only a live paid membership counts. Expired or unknown cards fail this check.
        </p>
        <nav className="pt-card-verify__links" aria-label="AINF">
          <Link href="/account/membership">Member portal</Link>
          <Link href="/">AINF home</Link>
        </nav>
      </main>
    </div>
  );
}
