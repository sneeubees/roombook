"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";

export function AdminCoAdminsClient() {
  const users = useQuery(api.users.listAll);
  const me = useQuery(api.users.currentUser);
  const setSuperAdmin = useMutation(api.users.setSuperAdmin);
  const [search, setSearch] = useState("");

  const superAdmins = useMemo(
    () => (users ?? []).filter((u) => u.isSuperAdmin),
    [users],
  );

  const filtered = useMemo(() => {
    if (!users) return undefined;
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term),
    );
  }, [users, search]);

  async function toggle(
    user: NonNullable<typeof users>[number],
    next: boolean,
  ) {
    try {
      await setSuperAdmin({ targetUserId: user._id, isSuperAdmin: next });
      toast.success(
        next
          ? `${user.fullName || user.email} is now a Super Admin`
          : `${user.fullName || user.email} is no longer a Super Admin`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update role",
      );
    }
  }

  if (users === undefined) {
    return <div className="text-sm text-stone-400">Loading co-admins…</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <ShieldCheck className="h-5 w-5 text-emerald-300" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">
              {superAdmins.length} super admin
              {superAdmins.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-stone-400">
              Super admins can co-manage the whole platform — approve
              organizations, set pricing and grant this role to others.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {superAdmins.length === 0 ? (
            <p className="text-sm text-stone-500">
              No super admins configured yet.
            </p>
          ) : (
            superAdmins.map((u) => (
              <span
                key={u._id}
                className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100"
              >
                {u.fullName || u.email}
                {me && u._id === me._id ? " (you)" : ""}
              </span>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">All users</p>
            <p className="text-xs text-stone-400">
              {users.length} user{users.length === 1 ? "" : "s"} on the platform.
            </p>
          </div>
          <input
            type="search"
            placeholder="Search name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-stone-500 outline-none focus:border-emerald-400/60 lg:w-72"
          />
        </div>

        {filtered && filtered.length === 0 ? (
          <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-8 text-sm text-stone-400">
            No users match your search.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[32px] border border-white/10 bg-white/[0.03]">
            <table className="min-w-full text-sm text-stone-300">
              <thead className="bg-black/30 text-xs uppercase tracking-[0.18em] text-stone-500">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Profile</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(filtered ?? []).map((u) => {
                  const isSelf = me ? u._id === me._id : false;
                  return (
                    <tr
                      key={u._id}
                      className="border-t border-white/5 transition hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {u.fullName || "—"}
                        {isSelf ? (
                          <span className="ml-2 text-[11px] text-stone-500">
                            (you)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-stone-400">{u.email}</td>
                      <td className="px-4 py-3 text-stone-500">
                        {u.phone || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                            u.isSuperAdmin
                              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                              : "border-white/10 bg-white/5 text-stone-300",
                          )}
                        >
                          {u.isSuperAdmin ? "Super Admin" : "User"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                            u.isProfileComplete
                              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                              : "border-amber-400/30 bg-amber-500/10 text-amber-200",
                          )}
                        >
                          {u.isProfileComplete ? "Complete" : "Incomplete"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => toggle(u, !u.isSuperAdmin)}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-semibold transition",
                              u.isSuperAdmin
                                ? "border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                                : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400 hover:bg-emerald-500/15",
                            )}
                          >
                            {u.isSuperAdmin ? "Revoke admin" : "Make super admin"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
