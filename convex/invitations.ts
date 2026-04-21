import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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
    email: v.string(),
    role: v.union(v.literal("manager"), v.literal("booker")),
    token: v.string(),
    receiveMonthlyInvoices: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const invitedBy = await getAuthUserId(ctx);
    if (!invitedBy) throw new Error("Not authenticated");

    // Only owner/manager can invite.
    const actorMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", invitedBy)
      )
      .unique();
    if (!actorMembership || actorMembership.role === "booker") {
      throw new Error("Only an owner or manager can invite people");
    }

    // 7 day expiry
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const id = await ctx.db.insert("invitations", {
      orgId: args.orgId,
      invitedBy,
      email: args.email,
      role: args.role,
      token: args.token,
      status: "pending",
      expiresAt,
      receiveMonthlyInvoices: args.receiveMonthlyInvoices,
    });

    const actor = await ctx.db.get(invitedBy);
    await ctx.db.insert("activityLogs", {
      orgId: args.orgId,
      actorId: invitedBy,
      actorName:
        (actor as { name?: string } | null)?.name ??
        (actor as { email?: string } | null)?.email ??
        "Unknown",
      actorRole: actorMembership.role,
      action: "member_invited",
      targetType: "invitation",
      targetId: id,
      targetName: args.email,
      details: { role: args.role },
    });

    return id;
  },
});

// Accept an invite: the signed-in user claims the invitation and a membership
// row is created for them in the invited org.
export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first, then open the invite link again");

    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invitation) throw new Error("Invalid invitation");
    if (invitation.status !== "pending")
      throw new Error("Invitation is no longer valid");
    if (Date.now() > invitation.expiresAt)
      throw new Error("Invitation has expired");

    // Check if user is already a member; if so just mark accepted.
    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", invitation.orgId).eq("userId", userId)
      )
      .unique();
    if (!existingMembership) {
      await ctx.db.insert("memberships", {
        orgId: invitation.orgId,
        userId,
        role: invitation.role,
        receiveMonthlyInvoices: invitation.receiveMonthlyInvoices,
      });
    }

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
