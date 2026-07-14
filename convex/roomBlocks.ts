import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMembership, requireStaff } from "./authz";

export const listByOrg = query({
  args: {
    orgId: v.id("organizations"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.orgId);
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
    startDate: v.string(),
    endDate: v.string(),
    slotType: v.union(
      v.literal("full_day"),
      v.literal("am"),
      v.literal("pm"),
      v.literal("time_range")
    ),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Only staff may block rooms.
    const { userId: blockedBy } = await requireStaff(ctx, args.orgId);

    // The room must belong to the org being blocked.
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (room.orgId !== args.orgId) {
      throw new Error("Room does not belong to this organisation");
    }

    if (args.slotType === "time_range") {
      if (!args.startTime || !args.endTime) {
        throw new Error("Start time and end time are required for time range blocks");
      }
      if (args.startTime >= args.endTime) {
        throw new Error("Start time must be before end time");
      }
    }

    return await ctx.db.insert("roomBlocks", { ...args, blockedBy });
  },
});

export const remove = mutation({
  args: { id: v.id("roomBlocks") },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.id);
    if (!block) throw new Error("Block not found");
    await requireStaff(ctx, block.orgId);
    await ctx.db.delete(args.id);
  },
});
