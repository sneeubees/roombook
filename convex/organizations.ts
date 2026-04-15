import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByClerkOrgId = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
  },
});

export const create = mutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("organizations", {
      ...args,
      invoiceDayOfMonth: 1,
      invoicePrefix: "INV",
      currency: "ZAR",
      timezone: "Africa/Johannesburg",
      vatRate: 0.15,
      subscriptionTier: "basic" as const,
      status: "pending_approval" as const,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    invoiceDayOfMonth: v.optional(v.number()),
    invoicePrefix: v.optional(v.string()),
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    vatRate: v.optional(v.number()),
    staffLabel: v.optional(v.string()),
    calendarTheme: v.optional(v.string()),
    darkMode: v.optional(v.boolean()),
    showBookerNames: v.optional(v.boolean()),
    showBookerContact: v.optional(v.boolean()),
    subscriptionTier: v.optional(
      v.union(
        v.literal("basic"),
        v.literal("professional"),
        v.literal("enterprise")
      )
    ),
    bankingDetails: v.optional(
      v.object({
        bankName: v.string(),
        accountNumber: v.string(),
        branchCode: v.string(),
        accountType: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    await ctx.db.patch(id, filteredUpdates);
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organizations").collect();
  },
});

export const approve = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "active" });
  },
});

export const suspend = mutation({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "suspended" });
  },
});
