import type { Metadata } from "next";
import { requirePageAuth } from "@/lib/auth/guard";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { OKR_PAGE_SIZE, okrProgress, paginateOkrs } from "@/lib/okr";
import { DashShell } from "@/components/portal/DashShell";
import { Pagination } from "@/components/portal/Pagination";
import { SetupNotice } from "@/components/portal/SetupNotice";

export const metadata: Metadata = { title: "OKRs" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  on_track: "On track",
  at_risk: "At risk",
  done: "Done",
} as const;

const STATUS_TONE = {
  on_track: "success",
  at_risk: "warning",
  done: "neutral",
} as const;

export default async function OkrPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!isClerkConfigured) {
    return (
      <SetupNotice
        feature="Clerk authentication"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]}
      />
    );
  }
  if (!isDatabaseConfigured) {
    return <SetupNotice feature="The account database" keys={["DATABASE_URL", "DIRECT_URL"]} />;
  }

  const { role } = await requirePageAuth("/account/okr");
  const params = await searchParams;
  const requested = Math.max(1, Number(params.page ?? "1") || 1);
  const { page, pages, total, items } = paginateOkrs(requested, OKR_PAGE_SIZE);

  return (
    <DashShell role={role} currentPath="/account/okr">
      <main className="pt-main">
        <h1 className="pt-title">OKRs</h1>
        <p className="pt-subtitle">
          Objectives and key results for this cycle. Long lists stay paged so rows never overflow
          the page.
        </p>

        <div className="pt-verify-stack">
          {items.map((okr) => {
            const progress = okrProgress(okr);
            return (
              <section className="pt-card" key={okr.id}>
                <div className="pt-card__head" style={{ padding: 0, border: 0, marginBottom: 12 }}>
                  <div>
                    <p className="pt-hint" style={{ margin: "0 0 4px" }}>
                      {okr.cycle} · {okr.owner}
                    </p>
                    <h2 className="pt-section-title" style={{ margin: 0 }}>
                      {okr.objective}
                    </h2>
                  </div>
                  <span className={`pt-badge pt-badge--${STATUS_TONE[okr.status]}`}>
                    {STATUS_LABEL[okr.status]}
                  </span>
                </div>
                <div className="pt-progress__track" aria-hidden="true">
                  <div className="pt-progress__fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="pt-hint">{progress}% of key results</p>
                <ul className="pt-list" style={{ marginTop: 12 }}>
                  {okr.keyResults.map((kr) => (
                    <li key={kr.label}>
                      {kr.label} — {kr.current}
                      {kr.unit} / {kr.target}
                      {kr.unit}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <Pagination
          page={page}
          pages={pages}
          total={total}
          pageSize={OKR_PAGE_SIZE}
          hrefFor={(next) => `/account/okr?page=${next}`}
        />
        <p className="pt-hint" style={{ marginTop: 10 }}>
          {total} objectives · {OKR_PAGE_SIZE} per page
        </p>
      </main>
    </DashShell>
  );
}
