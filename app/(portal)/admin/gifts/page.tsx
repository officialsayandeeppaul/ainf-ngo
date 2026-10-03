import type { Metadata } from "next";
import { DonationStatus } from "@prisma/client";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { formatDayTime } from "@/lib/format-date";
import { formatInr } from "@/lib/membership";
import { DashShell } from "@/components/portal/DashShell";
import { GiftsAdmin } from "@/components/portal/GiftsAdmin";
import { SetupNotice } from "@/components/portal/SetupNotice";

export const metadata: Metadata = { title: "Gifts" };
export const dynamic = "force-dynamic";

export default async function AdminGiftsPage() {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The portal"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }

  const { role } = await requirePageSuperAdmin("/admin/gifts");
  const [settings, missions, donations, paid] = await Promise.all([
    db.donationSettings.findUnique({ where: { id: "singleton" } }),
    db.donationMission.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }] }),
    db.donation.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.donation.aggregate({ where: { status: DonationStatus.PAID }, _sum: { amountPaise: true } }),
  ]);

  return (
    <DashShell role={role} currentPath="/admin/gifts">
      <main className="pt-main">
        <h1 className="pt-title">Gifts</h1>
        <p className="pt-subtitle">
          Set the minimum, choose which missions accept a gift, and return a paid gift in full. Project gifts are switched on inside each project.
        </p>
        <GiftsAdmin
          initialSettings={{
            minPaise: settings?.minPaise ?? 20000,
            maxPaise: settings?.maxPaise ?? 10000000,
            suggestedPaise: settings?.suggestedPaise?.length ? settings.suggestedPaise : [20000, 50000, 100000, 250000],
          }}
          initialMissions={missions.map((mission) => ({
            id: mission.id,
            slug: mission.slug,
            title: mission.title,
            published: mission.published,
            sortOrder: mission.sortOrder,
            minPaise: mission.minPaise,
          }))}
          initialRows={donations.map((row) => ({
            id: row.id,
            when: formatDayTime(row.paidAt ?? row.createdAt),
            name: row.donorName,
            email: row.donorEmail,
            target: row.targetTitle,
            amount: formatInr(row.amountPaise),
            status: row.status,
            emailed: Boolean(row.receiptEmailedAt),
          }))}
          paidTotal={formatInr(paid._sum.amountPaise ?? 0)}
        />
      </main>
    </DashShell>
  );
}
