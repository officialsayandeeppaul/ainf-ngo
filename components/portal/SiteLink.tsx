import type { ComponentProps } from "react";
import Link from "next/link";

/**
 * Paths served by the Framer route handlers (app/route.ts, app/about-us/route.ts, …).
 * They are plain HTML, not React pages, so next/link cannot navigate to them: it
 * first fetches an uncached RSC copy of the whole page (~650 KB, seconds on a cold
 * function), sees HTML, and only then does a full page load. A plain <a> goes
 * straight to the CDN-cached page; the speculation rules in the portal layout
 * prefetch it on hover.
 */
const SITE_ROUTE =
  /^\/(?:$|[?#]|(?:about-us|blogs|causes|contact-us|donate-now|donate|join-as-volunteer|legal-pages|pay|projects)(?:[/?#]|$))/;

export const SITE_PREFETCH_PATHS = [
  "/",
  "/about-us",
  "/blogs",
  "/blogs/*",
  "/causes",
  "/causes/*",
  "/contact-us",
  "/donate-now",
  "/join-as-volunteer",
  "/legal-pages/*",
  "/projects",
  "/projects/*",
];

export function isSiteRoute(href: string) {
  return SITE_ROUTE.test(href) || /^[a-z][a-z0-9+.-]*:/i.test(href);
}

/** Link that uses client navigation for portal pages and a plain anchor for site pages. */
export function SiteLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
  if (isSiteRoute(href)) return <a href={href} {...props} />;
  return <Link href={href} {...props} />;
}
