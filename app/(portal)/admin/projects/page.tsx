import type { Metadata } from "next";
import { requirePageSuperAdmin } from "@/lib/auth/guard";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { listFieldProjects, FIELD_PROJECT_DEFAULTS } from "@/lib/field-projects";
import { DashShell } from "@/components/portal/DashShell";
import { SetupNotice } from "@/components/portal/SetupNotice";
import { FieldProjectsEditor } from "@/components/portal/FieldProjectsEditor";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  if (!isClerkConfigured || !isDatabaseConfigured) {
    return (
      <SetupNotice
        feature="The portal"
        keys={["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"]}
      />
    );
  }

  const { role } = await requirePageSuperAdmin();
  const projects = (await listFieldProjects()) ?? FIELD_PROJECT_DEFAULTS;

  return (
    <DashShell role={role} currentPath="/admin/projects">
      <main className="pt-main">
        <h1 className="pt-title">Projects</h1>
        <p className="pt-subtitle">
          Pick a project, change the title, summary, amounts, or photo, then save. The public card and its page use what you save here.
        </p>
        <FieldProjectsEditor initial={projects} />
      </main>
    </DashShell>
  );
}
