import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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

export const record = mutation({
  args: {
    orgId: v.id("organizations"),
    actorName: v.string(),
    actorRole: v.string(),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    targetName: v.optional(v.string()),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("Not authenticated");
    await ctx.db.insert("activityLogs", {
      ...args,
      actorId,
    });
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

    const orgIds = Array.from(new Set(rows.map((r) => r.orgId)));
    const orgs = await Promise.all(orgIds.map((id) => ctx.db.get(id)));
    const orgMap = new Map(orgs.filter(Boolean).map((o) => [o!._id, o!.name]));

    return rows.map((r) => ({
      ...r,
      orgName: orgMap.get(r.orgId) ?? "Unknown",
    }));
  },
});
