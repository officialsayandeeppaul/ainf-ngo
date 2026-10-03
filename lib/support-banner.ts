import { supportBannerDelegate } from "@/lib/db";

export type SupportBannerView = {
  enabled: boolean;
  headline: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  endsAt: string | null;
  updatedAt: string;
};

const DEFAULTS = {
  id: "singleton" as const,
  enabled: false,
  headline: "",
  message: "",
  ctaLabel: "Support AINF",
  ctaHref: "/donate-now",
  endsAt: null as Date | null,
};

export async function getSupportBanner() {
  const delegate = supportBannerDelegate() as unknown as {
    findUnique: (args: { where: { id: string } }) => Promise<{
      id: string;
      enabled: boolean;
      headline: string;
      message: string;
      ctaLabel: string;
      ctaHref: string;
      endsAt: Date | null;
      updatedAt: Date;
      updatedByUserId: string | null;
    } | null>;
  } | null;
  if (!delegate) {
    return { ...DEFAULTS, updatedAt: new Date(), updatedByUserId: null };
  }
  const row = await delegate.findUnique({ where: { id: "singleton" } });
  if (row) return row;
  return { ...DEFAULTS, updatedAt: new Date(), updatedByUserId: null };
}

export function toSupportBannerView(row: {
  enabled: boolean;
  headline: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  endsAt: Date | null;
  updatedAt: Date;
}): SupportBannerView {
  return {
    enabled: row.enabled,
    headline: row.headline,
    message: row.message,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Public payload — only when enabled and (no end / still running). */
export async function getPublicSupportBanner(): Promise<SupportBannerView | null> {
  const row = await getSupportBanner();
  if (!row.enabled) return null;
  if (!row.headline.trim() && !row.message.trim()) return null;
  if (row.endsAt && row.endsAt.getTime() <= Date.now()) return null;
  return toSupportBannerView(row);
}
