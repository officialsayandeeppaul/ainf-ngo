import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/env";
import "./portal.css";

/**
 * Root layout for the React portal.
 *
 * This lives inside the (portal) route group rather than at app/layout.tsx so
 * it cannot interact with app/route.ts or any of the 24 other Framer HTML route
 * handlers — those are route handlers, which ignore layouts entirely, and
 * keeping the layout scoped to the group makes that separation explicit.
 */

// Self-hosted rather than next/font/google: Google Fonts intermittently serves
// an extensionless kit URL that crashes the bundled @next/font loader on
// Vercel (vercel/next.js#99114) — self-hosting removes the build-time fetch
// entirely. The single file is Onest's variable font (latin subset); each
// weight below points at the same file, matching what Google's own CSS did.
const onest = localFont({
  src: [
    { path: "./fonts/onest-variable-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/onest-variable-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/onest-variable-latin.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-onest",
});

export const metadata: Metadata = {
  title: {
    default: "Account · AINF",
    template: "%s · AINF",
  },
  description:
    "Sign in to your AINF account to manage your profile, complete identity verification, and access member services.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#39a46b",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en" className={onest.variable}>
      <body className="ainf-portal">{children}</body>
    </html>
  );

  // ClerkProvider throws without a publishable key. Rendering the tree without
  // it lets the portal show a precise setup message instead of a stack trace.
  if (!isClerkConfigured) return body;

  return (
    <ClerkProvider
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/account"
      signUpFallbackRedirectUrl="/account"
      appearance={{
        variables: {
          colorPrimary: "#39a46b",
          borderRadius: "10px",
          fontFamily: "Onest, Inter, system-ui, sans-serif",
        },
      }}
    >
      {body}
    </ClerkProvider>
  );
}
