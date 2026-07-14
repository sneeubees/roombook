import { AdminShell } from "@/components/admin-shell";
import { AdminCoAdminsClient } from "@/components/admin-co-admins-client";

export default function AdminCoAdminsPage() {
  return (
    <AdminShell
      title="Co-admins"
      description="Grant or revoke the Super Admin role. Super admins can co-manage the entire platform."
    >
      <AdminCoAdminsClient />
    </AdminShell>
  );
}
