import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireStaff, requireSuperAdmin } from "./authz";

/**
 * Internal — called from other mutations to record an activity event.
 */
export const log = internalMutation({
  args: {
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    actorName: v.string(),
    actorRole: v.string(),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    targetName: v.optional(v.string()),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activityLogs", args);
  },
});

// Internal audit writer. Actor identity is supplied by the calling server
// function (which derives it from the authenticated user) — never trusted from
// a raw client, so audit entries can't be forged. `log` above is equivalent;
// both are internal-only.
export const record = internalMutation({
  args: {
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    actorName: v.string(),
    actorRole: v.string(),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    targetName: v.optional(v.string()),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activityLogs", args);
  },
});

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // The audit log is an owner/manager-only surface.
    await requireStaff(ctx, args.orgId);
    const rows = await ctx.db
      .query("activityLogs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(args.limit ?? 200);
    return rows;
  },
});

export const listAll = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const rows = await ctx.db
      .query("activityLogs")
      .order("desc")
      .take(args.limit ?? 500);

    const orgIds = Array.from(new Set(rows.map((r) => r.orgId)));
    const orgs = await Promise.all(orgIds.map((id) => ctx.db.get(id)));
    const orgMap = new Map(orgs.filter(Boolean).map((o) => [o!._id, o!.name]));

    return rows.map((r) => ({
      ...r,
      orgName: orgMap.get(r.orgId) ?? "Unknown",
    }));
  },
});
