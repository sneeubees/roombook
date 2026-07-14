"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import { formatZAR, TIERS, type SubscriptionTier } from "@/lib/tiers";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
      <p className="text-xs uppercase tracking-[0.32em] text-stone-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

const TIER_ORDER: SubscriptionTier[] = ["basic", "professional", "enterprise"];

export function AdminOverviewClient() {
  const organizations = useQuery(api.organizations.listAll);
  const users = useQuery(api.users.listAll);
  const pricing = useQuery(api.pricing.current);
  const approveOrg = useMutation(api.organizations.approve);

  const stats = useMemo(() => {
    if (!organizations || !users || !pricing) return null;

    const statusCounts = { active: 0, pending_approval: 0, suspended: 0 };
    const tierCounts: Record<SubscriptionTier, number> = {
      basic: 0,
      professional: 0,
      enterprise: 0,
    };
    const priceByTier: Record<SubscriptionTier, number> = {
      basic: pricing.basicMonthlyCents,
      professional: pricing.professionalMonthlyCents,
      enterprise: pricing.enterpriseMonthlyCents,
    };

    let mrrCents = 0;
    for (const org of organizations) {
      const status = (org.status ?? "active") as keyof typeof statusCounts;
      if (status in statusCounts) statusCounts[status] += 1;
      const tier = (org.subscriptionTier ?? "basic") as SubscriptionTier;
      tierCounts[tier] += 1;
      if (status === "active") mrrCents += priceByTier[tier] ?? 0;
    }

    return {
      totalOrgs: organizations.length,
      statusCounts,
      tierCounts,
      totalUsers: users.length,
      superAdmins: users.filter((u) => u.isSuperAdmin).length,
      mrrCents,
    };
  }, [organizations, users, pricing]);

  const pendingOrgs = useMemo(
    () =>
      (organizations ?? []).filter(
        (o) => (o.status ?? "active") === "pending_approval",
      ),
    [organizations],
  );

  if (!stats) {
    return <div className="text-sm text-stone-400">Loading admin overview…</div>;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Organizations" value={stats.totalOrgs} />
        <StatCard
          label="Active"
          value={stats.statusCounts.active}
          hint={`${stats.statusCounts.pending_approval} pending · ${stats.statusCounts.suspended} suspended`}
        />
        <StatCard label="Users" value={stats.totalUsers} />
        <StatCard label="Super admins" value={stats.superAdmins} />
        <StatCard
          label="Pending approvals"
          value={stats.statusCounts.pending_approval}
        />
        <StatCard label="Suspended" value={stats.statusCounts.suspended} />
        <StatCard
          label="Estimated MRR"
          value={formatZAR(stats.mrrCents)}
          hint="Active orgs × current tier price"
        />
        <StatCard
          label="Paying tiers"
          value={stats.tierCounts.professional + stats.tierCounts.enterprise}
          hint={`${stats.tierCounts.basic} on ${TIERS.basic.label}`}
        />
      </section>

      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm text-stone-400">Tier distribution</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {TIER_ORDER.map((tier) => (
            <div
              key={tier}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">
                {TIERS[tier].label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {stats.tierCounts[tier]}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {formatZAR(
                  tier === "basic"
                    ? pricing!.basicMonthlyCents
                    : tier === "professional"
                      ? pricing!.professionalMonthlyCents
                      : pricing!.enterpriseMonthlyCents,
                )}
                /mo
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-emerald-500/30 bg-emerald-500/[0.04] p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-emerald-200">Pending approvals</p>
          <Link
            href="/admin/organizations"
            className="text-xs uppercase tracking-[0.28em] text-emerald-300/80 hover:text-emerald-200"
          >
            View all
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {pendingOrgs.length === 0 ? (
            <p className="text-sm text-stone-500">
              No organizations are waiting for approval.
            </p>
          ) : (
            pendingOrgs.map((org) => (
              <div
                key={org._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div>
                  <p className="text-base font-medium text-white">{org.name}</p>
                  <p className="text-sm text-stone-400">
                    {TIERS[(org.subscriptionTier ?? "basic") as SubscriptionTier].label}
                    {" · "}
                    {new Date(org._creationTime).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
                  onClick={async () => {
                    await approveOrg({ id: org._id });
                    toast.success(`${org.name} approved`);
                  }}
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
