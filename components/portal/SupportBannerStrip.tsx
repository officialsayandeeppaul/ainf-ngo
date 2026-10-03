import Link from "next/link";
import { LiveCountdown } from "@/components/portal/LiveCountdown";
import type { SupportBannerView } from "@/lib/support-banner";

/** Live support campaign strip shown under the portal header when enabled. */
export function SupportBannerStrip({ banner }: { banner: SupportBannerView }) {
  const tip = [banner.headline, banner.message].filter(Boolean).join(" — ");

  return (
    <aside className="pt-support-strip" aria-label="Support campaign">
      <div className="pt-support-strip__inner">
        <div className="pt-support-strip__copy" title={tip || undefined}>
          {banner.headline ? <p className="pt-support-strip__title">{banner.headline}</p> : null}
          {banner.message ? <p className="pt-support-strip__text">{banner.message}</p> : null}
        </div>
        {banner.endsAt ? <LiveCountdown endsAt={banner.endsAt} compact /> : null}
        <Link href={banner.ctaHref} className="pt-btn pt-btn--primary pt-btn--sm pt-btn--pop">
          {banner.ctaLabel}
        </Link>
      </div>
    </aside>
  );
}
