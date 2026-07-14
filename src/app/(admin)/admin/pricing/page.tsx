import { AdminShell } from "@/components/admin-shell";
import { AdminPricingClient } from "@/components/admin-pricing-client";

export default function AdminPricingPage() {
  return (
    <AdminShell
      title="Pricing"
      description="Tier prices and Paystack plan codes. Changes apply to new signups; existing subscribers keep their original rate until they cancel and resubscribe."
    >
      <AdminPricingClient />
    </AdminShell>
  );
}
