import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invitations")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
  },
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    clerkOrgId: v.string(),
    invitedBy: v.string(),
    email: v.string(),
    role: v.union(v.literal("therapist"), v.literal("owner")),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // 7 day expiry
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    return await ctx.db.insert("invitations", {
      ...args,
      status: "pending",
      expiresAt,
    });
  },
});

export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invitation) throw new Error("Invalid invitation");
    if (invitation.status !== "pending")
      throw new Error("Invitation is no longer valid");
    if (Date.now() > invitation.expiresAt)
      throw new Error("Invitation has expired");

    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedAt: Date.now(),
    });

    return invitation;
  },
});

export const revoke = mutation({
  args: { id: v.id("invitations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "revoked" });
  },
});
