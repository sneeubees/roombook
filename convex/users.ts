import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// ------------------------------------------------------------------
// Convex Auth owns the `users` table (email, name, image, emailVerified).
// We keep extra profile fields in `userProfiles` keyed by userId.
// ------------------------------------------------------------------

async function getOrCreateProfile(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("userProfiles", { userId });
  return (await ctx.db.get(id))!;
}

async function getProfile(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

// Hydrated user = Convex Auth users row + userProfiles row.
export async function hydrateUser(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<
  | {
      _id: Id<"users">;
      email: string;
      fullName: string;
      phone?: string;
      imageUrl?: string;
      isProfileComplete?: boolean;
      isSuperAdmin?: boolean;
      calendarToken?: string;
      _creationTime: number;
    }
  | null
> {
  const u = await ctx.db.get(userId);
  if (!u) return null;
  const p = await getProfile(ctx, userId);
  return {
    _id: u._id,
    email: (u as { email?: string }).email ?? "",
    fullName: p?.fullName ?? (u as { name?: string }).name ?? "",
    phone: p?.phone,
    imageUrl: p?.imageUrl ?? (u as { image?: string }).image,
    isProfileComplete: p?.isProfileComplete,
    isSuperAdmin: p?.isSuperAdmin,
    calendarToken: p?.calendarToken,
    _creationTime: u._creationTime,
  };
}

// ---------------- Queries ----------------

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await hydrateUser(ctx, userId);
  },
});

export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await hydrateUser(ctx, args.id);
  },
});

export const listByIds = query({
  args: { ids: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const results = [];
    for (const id of args.ids) {
      const hydrated = await hydrateUser(ctx, id);
      if (hydrated) results.push(hydrated);
    }
    return results;
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const hydrated = [];
    for (const u of users) {
      const p = await getProfile(ctx, u._id);
      hydrated.push({
        _id: u._id,
        email: (u as { email?: string }).email ?? "",
        fullName: p?.fullName ?? (u as { name?: string }).name ?? "",
        phone: p?.phone,
        imageUrl: p?.imageUrl ?? (u as { image?: string }).image,
        isProfileComplete: p?.isProfileComplete,
        isSuperAdmin: p?.isSuperAdmin,
        _creationTime: u._creationTime,
      });
    }
    return hydrated;
  },
});

export const getByCalendarToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_calendarToken", (q) => q.eq("calendarToken", args.token))
      .unique();
    if (!profile) return null;
    return await hydrateUser(ctx, profile.userId);
  },
});

// ---------------- Mutations ----------------

export const updateProfile = mutation({
  args: {
    fullName: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await getOrCreateProfile(ctx, userId);
    await ctx.db.patch(profile._id, {
      fullName: args.fullName,
      phone: args.phone,
      isProfileComplete: true,
    });
  },
});

export const generateCalendarToken = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await getOrCreateProfile(ctx, userId);
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    const token = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
    await ctx.db.patch(profile._id, { calendarToken: token });
    return token;
  },
});

export const setSuperAdmin = mutation({
  args: {
    targetUserId: v.id("users"),
    isSuperAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Only an existing super admin may flip this.
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("Not authenticated");
    const actorProfile = await getProfile(ctx, actorId);
    if (!actorProfile?.isSuperAdmin) {
      throw new Error("Only a super admin can grant this role");
    }
    const profile = await getOrCreateProfile(ctx, args.targetUserId);
    await ctx.db.patch(profile._id, { isSuperAdmin: args.isSuperAdmin });
  },
});

// Used internally during bootstrap — flags the very first user as super admin
// if no super admin exists yet. Idempotent.
export const claimFirstSuperAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existingSupers = await ctx.db.query("userProfiles").collect();
    if (existingSupers.some((p) => p.isSuperAdmin)) return { granted: false };
    const profile = await getOrCreateProfile(ctx, userId);
    await ctx.db.patch(profile._id, { isSuperAdmin: true });
    return { granted: true };
  },
});
