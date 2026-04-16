import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

/**
 * Internal — called from other mutations to record an activity event.
 */
export const log = internalMutation({
  args: {
    orgId: v.id("organizations"),
    actorId: v.string(),
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

/**
 * Public mutation used by the client (e.g., room creation/edit) to log activity.
 * The client passes actor info since we don't have Convex-side auth context
 * of Clerk roles here.
 */
export const record = mutation({
  args: {
    orgId: v.id("organizations"),
    actorId: v.string(),
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
    const rows = await ctx.db
      .query("activityLogs")
      .order("desc")
      .take(args.limit ?? 500);

    // Enrich with org names
    const orgIds = Array.from(new Set(rows.map((r) => r.orgId)));
    const orgs = await Promise.all(orgIds.map((id) => ctx.db.get(id)));
    const orgMap = new Map(orgs.filter(Boolean).map((o) => [o!._id, o!.name]));

    return rows.map((r) => ({
      ...r,
      orgName: orgMap.get(r.orgId) ?? "Unknown",
    }));
  },
});
