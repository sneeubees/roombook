import { v } from "convex/values";
import { internalQuery, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";

/**
 * Shared authorization helpers.
 *
 * Convex `query` / `mutation` / `action` are public internet endpoints — any
 * client that knows the deployment URL can call them. Every data-bearing
 * function must therefore derive the caller's identity server-side (never trust
 * a client-supplied userId) and check membership / role before returning or
 * mutating tenant data.
 *
 * All helpers take a `QueryCtx`, so both queries and mutations can use them
 * (a `MutationCtx` is assignable to `QueryCtx`).
 */

export type MembershipDoc = Doc<"memberships">;

export type AuthzResult = {
  userId: Id<"users">;
  /** The caller's membership in the org, or null when they pass via super admin. */
  membership: MembershipDoc | null;
  isSuperAdmin: boolean;
};

/** Returns the authenticated userId or throws. */
export async function requireUser(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/** True if the given user's profile is flagged as a super admin. */
export async function isSuperAdminUser(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<boolean> {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return profile?.isSuperAdmin === true;
}

/** The caller's membership row for an org (or null). */
export async function getMembership(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">
): Promise<MembershipDoc | null> {
  return ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
}

/** Requires the caller to be a super admin. Returns their userId. */
export async function requireSuperAdmin(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  if (!(await isSuperAdminUser(ctx, userId))) {
    throw new Error("Super admin access required");
  }
  return userId;
}

/**
 * Requires the caller to be a member of `orgId` (any role), or a super admin.
 * Super admins pass with `membership: null`.
 */
export async function requireMembership(
  ctx: QueryCtx,
  orgId: Id<"organizations">
): Promise<AuthzResult> {
  const userId = await requireUser(ctx);
  const membership = await getMembership(ctx, orgId, userId);
  if (membership) return { userId, membership, isSuperAdmin: false };
  if (await isSuperAdminUser(ctx, userId)) {
    return { userId, membership: null, isSuperAdmin: true };
  }
  throw new Error("You are not a member of this organisation");
}

/**
 * Requires the caller to be an owner or manager of `orgId`, or a super admin.
 */
export async function requireStaff(
  ctx: QueryCtx,
  orgId: Id<"organizations">
): Promise<AuthzResult> {
  const userId = await requireUser(ctx);
  const membership = await getMembership(ctx, orgId, userId);
  if (
    membership &&
    (membership.role === "owner" || membership.role === "manager")
  ) {
    return { userId, membership, isSuperAdmin: false };
  }
  if (await isSuperAdminUser(ctx, userId)) {
    return { userId, membership, isSuperAdmin: true };
  }
  throw new Error("Owner or manager access required");
}

/** Requires the caller to be the owner of `orgId`, or a super admin. */
export async function requireOwner(
  ctx: QueryCtx,
  orgId: Id<"organizations">
): Promise<AuthzResult> {
  const userId = await requireUser(ctx);
  const membership = await getMembership(ctx, orgId, userId);
  if (membership && membership.role === "owner") {
    return { userId, membership, isSuperAdmin: false };
  }
  if (await isSuperAdminUser(ctx, userId)) {
    return { userId, membership, isSuperAdmin: true };
  }
  throw new Error("Owner access required");
}

/** Convenience: is this authz result staff-level (owner/manager/super admin)? */
export function isStaffResult(result: AuthzResult): boolean {
  return (
    result.isSuperAdmin ||
    result.membership?.role === "owner" ||
    result.membership?.role === "manager"
  );
}

/**
 * Internal gate used by public `action`s (which have no `ctx.db`). The action
 * calls this via `ctx.runQuery`; the caller's auth identity propagates, so the
 * check still runs against the real signed-in user.
 */
export const assertOrgAccess = internalQuery({
  args: {
    orgId: v.id("organizations"),
    level: v.union(
      v.literal("member"),
      v.literal("staff"),
      v.literal("owner")
    ),
  },
  handler: async (ctx, args) => {
    if (args.level === "owner") {
      await requireOwner(ctx, args.orgId);
    } else if (args.level === "staff") {
      await requireStaff(ctx, args.orgId);
    } else {
      await requireMembership(ctx, args.orgId);
    }
    return null;
  },
});

/** Internal gate for super-admin-only `action`s (called via ctx.runQuery). */
export const assertSuperAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return null;
  },
});
