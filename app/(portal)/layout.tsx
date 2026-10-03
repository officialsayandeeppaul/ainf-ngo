import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
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

const onest = Onest({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
