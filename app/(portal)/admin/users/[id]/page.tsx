import { redirect } from "next/navigation";

export const metadata = { title: "CRM dossier" };

export default async function AdminUserDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/crm/${id}`);
}
