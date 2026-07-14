import { AdminShell } from "@/components/admin-shell";
import { AdminOverviewClient } from "@/components/admin-overview-client";

export default function AdminOverviewPage() {
  return (
    <AdminShell
      title="Overview"
      description="High-level platform health, tier mix and pending approvals."
    >
      <AdminOverviewClient />
    </AdminShell>
  );
}
