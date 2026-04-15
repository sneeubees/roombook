import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const blocks = await ctx.db
      .query("roomBlocks")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    if (args.startDate && args.endDate) {
      return blocks.filter(
        (b) => b.endDate >= args.startDate! && b.startDate <= args.endDate!
      );
    }

    return blocks;
  },
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    roomId: v.id("rooms"),
    blockedBy: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    slotType: v.union(
      v.literal("full_day"),
      v.literal("am"),
      v.literal("pm"),
      v.literal("time_range")
    ),
    startTime: v.optional(v.string()), // "HH:mm" for time_range
    endTime: v.optional(v.string()), // "HH:mm" for time_range
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.slotType === "time_range") {
      if (!args.startTime || !args.endTime) {
        throw new Error(
          "Start time and end time are required for time range blocks"
        );
      }
      if (args.startTime >= args.endTime) {
        throw new Error("Start time must be before end time");
      }
    }

    return await ctx.db.insert("roomBlocks", args);
  },
});

export const remove = mutation({
  args: { id: v.id("roomBlocks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
