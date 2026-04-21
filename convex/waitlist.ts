import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("waitlist")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const join = mutation({
  args: {
    orgId: v.id("organizations"),
    roomId: v.id("rooms"),
    date: v.string(),
    slotType: v.union(
      v.literal("full_day"),
      v.literal("am"),
      v.literal("pm"),
      v.literal("session")
    ),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_room_date_slot", (q) =>
        q.eq("roomId", args.roomId).eq("date", args.date).eq("slotType", args.slotType)
      )
      .collect();

    const alreadyWaiting = existing.find(
      (w) => w.userId === userId && w.status === "waiting"
    );
    if (alreadyWaiting) throw new Error("Already on the waitlist for this slot");

    return await ctx.db.insert("waitlist", {
      ...args,
      userId,
      status: "waiting",
    });
  },
});

export const markBooked = mutation({
  args: { id: v.id("waitlist") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "booked" });
  },
});
