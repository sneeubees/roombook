import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

async function getMembershipFor(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  userId: Id<"users">
) {
  return ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
}

// Org + role for the current user (picks the first membership if many).
export const currentOrg = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (memberships.length === 0) return null;
    // Prefer an owner membership; otherwise the first.
    const preferred =
      memberships.find((m) => m.role === "owner") ?? memberships[0];
    const org = await ctx.db.get(preferred.orgId);
    if (!org) return null;
    return { org, membership: preferred };
  },
});

export const listMembershipsByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const listMyMemberships = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const enriched = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.orgId);
      if (org) enriched.push({ ...m, org });
    }
    return enriched;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Enforce unique slug.
    const bySlug = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (bySlug) throw new Error("That organisation slug is already in use");

    const orgId = await ctx.db.insert("organizations", {
      ...args,
      invoiceDayOfMonth: 1,
      invoicePrefix: "INV",
      currency: "ZAR",
      timezone: "Africa/Johannesburg",
      vatRate: 0.15,
      subscriptionTier: "basic" as const,
      // Self-serve signups are active immediately. A super admin can still
      // suspend an org from the admin panel.
      status: "active" as const,
      ownerUserId: userId,
    });

    await ctx.db.insert("memberships", {
      orgId,
      userId,
      role: "owner",
    });

    return orgId;
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
    invoicesEnabled: v.optional(v.boolean()),
    invoiceMode: v.optional(v.union(v.literal("auto"), v.literal("manual"))),
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

export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveLogoAndGetUrl = mutation({
  args: { orgId: v.id("organizations"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (url) {
      await ctx.db.patch(args.orgId, { logoUrl: url });
    }
    return url;
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

// Remove a member from an organisation. Owner membership cannot be removed
// unless the org is being deleted.
export const removeMember = mutation({
  args: { orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("Not authenticated");
    const actor = await getMembershipFor(ctx, args.orgId, actorId);
    if (!actor || (actor.role !== "owner" && actor.role !== "manager")) {
      throw new Error("Only owner or manager can remove members");
    }
    const target = await getMembershipFor(ctx, args.orgId, args.userId);
    if (!target) throw new Error("Member not found");
    if (target.role === "owner") {
      throw new Error("The owner cannot be removed");
    }
    await ctx.db.delete(target._id);
  },
});

export const updateMemberRole = mutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("manager"),
      v.literal("booker")
    ),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("Not authenticated");

    // Super admins bypass membership checks and can set any role.
    const actorProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", actorId))
      .unique();
    const isSuperAdmin = actorProfile?.isSuperAdmin === true;

    if (!isSuperAdmin) {
      const actor = await getMembershipFor(ctx, args.orgId, actorId);
      if (!actor || actor.role !== "owner") {
        throw new Error("Only the owner or a super admin can change member roles");
      }
      if (args.role === "owner") {
        throw new Error(
          "Only a super admin can transfer ownership (each org has one owner)"
        );
      }
    }

    const target = await getMembershipFor(ctx, args.orgId, args.userId);
    if (!target) throw new Error("Member not found in this organisation");

    // Owner transfer — demote any existing owner to manager first.
    if (args.role === "owner") {
      const existingOwner = await ctx.db
        .query("memberships")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect()
        .then((rows) => rows.find((r) => r.role === "owner"));
      if (existingOwner && existingOwner._id !== target._id) {
        await ctx.db.patch(existingOwner._id, { role: "manager" });
      }
      await ctx.db.patch(args.orgId, { ownerUserId: args.userId });
    }

    await ctx.db.patch(target._id, { role: args.role });
  },
});

// Super-admin helper: find a user by email, create a membership in the given
// org with the given role (used by the admin panel to attach a user to any
// org without going through the invite flow).
export const addMemberByEmail = mutation({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("manager"),
      v.literal("booker")
    ),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("Not authenticated");
    const actorProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", actorId))
      .unique();
    if (!actorProfile?.isSuperAdmin) {
      throw new Error("Super admin only");
    }

    const users = await ctx.db.query("users").collect();
    const user = users.find(
      (u) => (u as { email?: string }).email === args.email
    );
    if (!user) throw new Error(`No user with email ${args.email}`);

    const existing = await getMembershipFor(ctx, args.orgId, user._id);
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
      return existing._id;
    }
    return await ctx.db.insert("memberships", {
      orgId: args.orgId,
      userId: user._id,
      role: args.role,
    });
  },
});
