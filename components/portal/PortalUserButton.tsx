"use client";

import dynamic from "next/dynamic";
import { useUser } from "@clerk/nextjs";

function AvatarSkeleton() {
  return <span className="pt-skel pt-skel--circle" style={{ width: 40, height: 40 }} aria-hidden="true" />;
}

/**
 * Clerk's UserButton paints different markup on the server than in the browser.
 * Keep it client-only so the dashboard never hydrates against ClerkHostRenderer.
 */
const ClerkUserButton = dynamic(() => import("@clerk/nextjs").then((mod) => mod.UserButton), {
  ssr: false,
  loading: AvatarSkeleton,
});

export function PortalUserButton() {
  const { user, isLoaded } = useUser();
  const themeMark = isLoaded && !!user && !user.hasImage;

  return (
    <span className={themeMark ? "pt-user-theme-avatar" : undefined}>
      <ClerkUserButton
        userProfileMode="modal"
        appearance={{
          variables: { colorPrimary: "#1c7d48" },
          elements: {
            userButtonPopoverCard: {
              zIndex: 10060,
              pointerEvents: "auto",
            },
            userButtonPopoverActions: {
              pointerEvents: "auto",
            },
          },
        }}
      />
    </span>
  );
}
