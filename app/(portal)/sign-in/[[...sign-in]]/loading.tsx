import { PortalShell } from "@/components/portal/PortalNav";
import { AuthSkeleton } from "@/components/portal/AuthSkeleton";

export default function AuthLoading() {
  return (
    <PortalShell role={null}>
      <div className="pt-center">
        <AuthSkeleton label="Loading sign in" />
      </div>
    </PortalShell>
  );
}
