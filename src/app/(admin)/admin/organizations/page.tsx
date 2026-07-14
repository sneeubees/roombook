import { AdminShell } from "@/components/admin-shell";
import { AdminOrganizationsClient } from "@/components/admin-organizations-client";

export default function AdminOrganizationsPage() {
  return (
    <AdminShell
      title="Organizations"
      description="Every business on the platform with status, tier and members. Approve, suspend or change a tier."
    >
      <AdminOrganizationsClient />
    </AdminShell>
  );
}
