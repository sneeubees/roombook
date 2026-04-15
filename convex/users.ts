import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByClerkUserIds = query({
  args: { clerkUserIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const users = [];
    for (const id of args.clerkUserIds) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", id))
        .unique();
      if (user) users.push(user);
    }
    return users;
  },
});

export const getByClerkUserId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) =>
        q.eq("clerkUserId", args.clerkUserId)
      )
      .unique();
  },
});

export const upsert = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    fullName: v.string(),
    phone: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) =>
        q.eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (existing) {
      // Only update email and image from Clerk; keep locally-edited name/phone
      const updates: Record<string, unknown> = {
        email: args.email,
        imageUrl: args.imageUrl,
      };
      // Only set name/phone if user hasn't completed their profile yet
      if (!existing.isProfileComplete) {
        updates.fullName = args.fullName;
        updates.phone = args.phone;
      }
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    return await ctx.db.insert("users", args);
  },
});

export const updateProfile = mutation({
  args: {
    clerkUserId: v.string(),
    fullName: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) =>
        q.eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      fullName: args.fullName,
      phone: args.phone,
      isProfileComplete: true,
    });
  },
});

export const remove = mutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) =>
        q.eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (user) {
      await ctx.db.delete(user._id);
    }
  },
});

export const generateCalendarToken = mutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) =>
        q.eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (!user) throw new Error("User not found");

    // Generate a random token
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    const token = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");

    await ctx.db.patch(user._id, { calendarToken: token });
    return token;
  },
});

export const getByCalendarToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // Scan all users for the token (small table, fine for this use case)
    const users = await ctx.db.query("users").collect();
    return users.find((u) => u.calendarToken === args.token) ?? null;
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const setSuperAdmin = mutation({
  args: {
    clerkUserId: v.string(),
    isSuperAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) =>
        q.eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { isSuperAdmin: args.isSuperAdmin });
  },
});
