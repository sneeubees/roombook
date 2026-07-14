"use client";

import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { TIERS, type SubscriptionTier } from "@/lib/tiers";

const STATUS_FILTERS = [
  "all",
  "active",
  "pending_approval",
  "suspended",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "pending_approval":
      return "border-sky-400/30 bg-sky-500/10 text-sky-200";
    case "suspended":
      return "border-rose-400/30 bg-rose-500/10 text-rose-200";
    default:
      return "border-white/10 bg-white/5 text-stone-300";
  }
}

type UserRow = {
  _id: Id<"users">;
  email: string;
  fullName: string;
  phone?: string;
  isProfileComplete?: boolean;
  isSuperAdmin?: boolean;
  _creationTime: number;
};

export function AdminOrganizationsClient() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Id<"organizations"> | null>(null);

  const organizations = useQuery(api.organizations.listAll);
  const users = useQuery(api.users.listAll);
  const approveOrg = useMutation(api.organizations.approve);
  const suspendOrg = useMutation(api.organizations.suspend);
  const setTier = useMutation(api.organizations.setTier);

  const usersById = useMemo(() => {
    const map = new Map<Id<"users">, UserRow>();
    for (const u of users ?? []) map.set(u._id, u);
    return map;
  }, [users]);

  const filtered = useMemo(() => {
    if (!organizations) return undefined;
    const term = search.trim().toLowerCase();
    return organizations.filter((org) => {
      const status = org.status ?? "active";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!term) return true;
      return (
        org.name.toLowerCase().includes(term) ||
        (org.email ?? "").toLowerCase().includes(term) ||
        (org.slug ?? "").toLowerCase().includes(term)
      );
    });
  }, [organizations, statusFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition",
                statusFilter === status
                  ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
                  : "border-white/10 bg-white/[0.03] text-stone-400 hover:text-white",
              )}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search name, owner email or slug"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-stone-500 outline-none focus:border-emerald-400/60 lg:w-72"
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-400">
        Showing{" "}
        <span className="text-white">{filtered?.length ?? 0}</span> of{" "}
        <span className="text-white">{organizations?.length ?? 0}</span>{" "}
        organizations
      </div>

      {filtered === undefined ? (
        <div className="text-sm text-stone-400">Loading organizations…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 text-sm text-stone-400">
          No organizations match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[32px] border border-white/10 bg-white/[0.03]">
          <table className="min-w-full text-sm text-stone-300">
            <thead className="bg-black/30 text-xs uppercase tracking-[0.18em] text-stone-500">
              <tr>
                <th className="px-4 py-3 text-left">Organization</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Tier</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((org) => {
                const status = org.status ?? "active";
                const tier = (org.subscriptionTier ?? "basic") as SubscriptionTier;
                const isExpanded = expanded === org._id;
                return (
                  <Fragment key={org._id}>
                    <tr className="border-t border-white/5 transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded(isExpanded ? null : org._id)
                          }
                          className="flex items-center gap-2 text-left font-medium text-white hover:text-emerald-200"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
                          )}
                          <span>
                            {org.name}
                            {org.email ? (
                              <span className="block text-xs font-normal text-stone-500">
                                {org.email}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                            statusBadgeClass(status),
                          )}
                        >
                          {status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-emerald-400/60"
                          value={tier}
                          onChange={async (event) => {
                            const next = event.target.value as SubscriptionTier;
                            try {
                              await setTier({ orgId: org._id, tier: next });
                              toast.success(
                                `${org.name} moved to ${TIERS[next].label}`,
                              );
                            } catch (err) {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to change tier",
                              );
                            }
                          }}
                        >
                          {(
                            ["basic", "professional", "enterprise"] as const
                          ).map((t) => (
                            <option key={t} value={t}>
                              {TIERS[t].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {new Date(org._creationTime).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {status !== "active" ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await approveOrg({ id: org._id });
                                toast.success(`${org.name} activated`);
                              }}
                              className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/15"
                            >
                              Activate
                            </button>
                          ) : null}
                          {status !== "suspended" ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await suspendOrg({ id: org._id });
                                toast.success(`${org.name} suspended`);
                              }}
                              className="rounded-full border border-rose-500/40 px-3 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10"
                            >
                              Suspend
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="bg-black/20">
                        <td colSpan={5} className="px-4 py-4">
                          <OrgMembersPanel
                            orgId={org._id}
                            usersById={usersById}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrgMembersPanel({
  orgId,
  usersById,
}: {
  orgId: Id<"organizations">;
  usersById: Map<Id<"users">, UserRow>;
}) {
  const memberships = useQuery(api.organizations.listMembershipsByOrg, {
    orgId,
  });
  const updateMemberRole = useMutation(api.organizations.updateMemberRole);

  if (memberships === undefined) {
    return <p className="text-xs text-stone-500">Loading members…</p>;
  }

  if (memberships.length === 0) {
    return <p className="text-xs text-stone-500">No members in this org yet.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
        Members
      </p>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="min-w-full text-sm text-stone-300">
          <thead className="bg-black/30 text-xs uppercase tracking-[0.18em] text-stone-500">
            <tr>
              <th className="px-4 py-2 text-left">Member</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Role</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((m) => {
              const u = usersById.get(m.userId);
              return (
                <tr key={m._id} className="border-t border-white/5">
                  <td className="px-4 py-2 font-medium text-white">
                    {u?.fullName || "—"}
                  </td>
                  <td className="px-4 py-2 text-stone-400">
                    {u?.email ?? m.userId}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-emerald-400/60"
                      value={m.role}
                      onChange={async (event) => {
                        const role = event.target.value as
                          | "owner"
                          | "manager"
                          | "booker";
                        if (role === m.role) return;
                        try {
                          await updateMemberRole({
                            orgId,
                            userId: m.userId,
                            role,
                          });
                          toast.success(
                            `${u?.fullName || u?.email || "User"} is now ${role}`,
                          );
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Failed to update role",
                          );
                        }
                      }}
                    >
                      <option value="owner">owner</option>
                      <option value="manager">manager</option>
                      <option value="booker">booker</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
