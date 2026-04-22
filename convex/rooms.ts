import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    // Hide soft-deleted rooms from all management UIs. Historical bookings
    // and invoices still reference them by ID.
    return rooms.filter((r) => !r.deletedAt);
  },
});

export const listActive = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rooms
      .filter((r) => r.isActive && !r.deletedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const get = query({
  args: { id: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    pricingMode: v.union(v.literal("day_based"), v.literal("hourly")),
    // Day-based pricing
    fullDayRate: v.optional(v.number()),
    halfDayRate: v.optional(v.number()),
    // Hourly pricing
    hourlyRate: v.optional(v.number()),
    sessionDurationMinutes: v.optional(v.number()),
    availableDays: v.optional(v.array(v.number())), // 0=Sun..6=Sat
    availabilityStart: v.optional(v.string()),
    availabilityEnd: v.optional(v.string()),
    amenities: v.array(v.string()),
    cancellationPolicy: v.union(
      v.literal("always_free"),
      v.literal("bill_if_late")
    ),
    cancellationDeadlineHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate based on pricing mode
    if (args.pricingMode === "day_based") {
      if (!args.fullDayRate || !args.halfDayRate) {
        throw new Error(
          "Full day rate and half day rate are required for day-based pricing"
        );
      }
    } else {
      if (!args.hourlyRate) {
        throw new Error("Hourly rate is required for hourly pricing");
      }
      if (!args.availabilityStart || !args.availabilityEnd) {
        throw new Error(
          "Availability hours are required for hourly pricing"
        );
      }
      if (args.availabilityStart >= args.availabilityEnd) {
        throw new Error("Availability start must be before end");
      }
    }

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Subscription-tier room limit. Starter = 1 active room, Professional /
    // Enterprise = unlimited.
    const org = await ctx.db.get(args.orgId);
    const tier = (org as { subscriptionTier?: string } | null)?.subscriptionTier ?? "basic";
    const tierLimit =
      tier === "basic" ? 1 : 0; // 0 = unlimited
    const activeCount = rooms.filter(
      (r) => r.isActive && !(r as { deletedAt?: number }).deletedAt
    ).length;
    if (tierLimit > 0 && activeCount >= tierLimit) {
      throw new Error(
        `Your current plan is limited to ${tierLimit} room${tierLimit === 1 ? "" : "s"}. Upgrade to add more.`
      );
    }

    return await ctx.db.insert("rooms", {
      ...args,
      isActive: true,
      sortOrder: rooms.length,
    });
  },
});

/**
 * Soft-delete a room. The room must be inactive first. The row is kept so
 * historical bookings / invoices that reference it continue to resolve
 * correctly. New rooms may be created later with the same name — they're a
 * separate record.
 */
export const remove = mutation({
  args: { id: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.id);
    if (!room) throw new Error("Room not found");
    if (room.deletedAt) return; // already removed
    if (room.isActive) {
      throw new Error(
        "Please deactivate the room before deleting it. An active room cannot be deleted."
      );
    }
    await ctx.db.patch(args.id, { deletedAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    id: v.id("rooms"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    pricingMode: v.optional(
      v.union(v.literal("day_based"), v.literal("hourly"))
    ),
    fullDayRate: v.optional(v.number()),
    halfDayRate: v.optional(v.number()),
    hourlyRate: v.optional(v.number()),
    sessionDurationMinutes: v.optional(v.number()),
    availableDays: v.optional(v.array(v.number())),
    availabilityStart: v.optional(v.string()),
    availabilityEnd: v.optional(v.string()),
    amenities: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    cancellationPolicy: v.optional(
      v.union(v.literal("always_free"), v.literal("bill_if_late"))
    ),
    cancellationDeadlineHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    await ctx.db.patch(id, filteredUpdates);
  },
});
