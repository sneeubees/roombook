import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

async function ownerEmailForOrg(
  ctx: { db: { get: (id: any) => Promise<any> } },
  org: { ownerUserId?: any; email?: string } | null
): Promise<string | undefined> {
  if (!org) return undefined;
  if (org.ownerUserId) {
    const owner = await ctx.db.get(org.ownerUserId);
    const e = (owner as { email?: string } | null)?.email;
    if (e) return e;
  }
  return org.email || undefined;
}

/**
 * All staff email addresses for an org: the owner + every active manager.
 * Used as BCC on booking confirmations / cancellations so management has
 * visibility on bookings made by their team.
 */
async function staffEmailsForOrg(
  ctx: any,
  orgId: any,
  excludeUserId?: any
): Promise<string[]> {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .collect();
  const staffIds = memberships
    .filter(
      (m: any) =>
        (m.role === "owner" || m.role === "manager") &&
        (!excludeUserId || m.userId !== excludeUserId)
    )
    .map((m: any) => m.userId);
  const emails: string[] = [];
  for (const id of staffIds) {
    const u = await ctx.db.get(id);
    const e = (u as { email?: string } | null)?.email;
    if (e) emails.push(e);
  }
  return emails;
}

export const getBookingWithDetails = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return null;

    const room = await ctx.db.get(booking.roomId);
    const org = await ctx.db.get(booking.orgId);
    const user = await ctx.db.get(booking.userId);
    const ownerEmail = await ownerEmailForOrg(ctx, org);
    const userEmail =
      (user as { email?: string } | null)?.email ?? "";
    const staffEmails = await staffEmailsForOrg(ctx, booking.orgId);
    // Don't BCC the booker if they are themselves an owner / manager —
    // they already got the email as `to`.
    const bcc = staffEmails.filter((e) => e && e !== userEmail);

    return {
      ...booking,
      roomName: room?.name ?? "Unknown Room",
      orgName: org?.name ?? "Unknown Organization",
      userEmail,
      ownerEmail,
      staffBcc: bcc,
    };
  },
});

export const getInvoiceWithDetails = internalQuery({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;

    const org = await ctx.db.get(invoice.orgId);
    const user = await ctx.db.get(invoice.userId);
    const profile = user
      ? await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", invoice.userId))
          .unique()
      : null;
    const ownerEmail = await ownerEmailForOrg(ctx, org);

    return {
      ...invoice,
      orgName: org?.name ?? "Unknown Organization",
      userEmail: (user as { email?: string } | null)?.email ?? "",
      userName:
        profile?.fullName ??
        (user as { name?: string } | null)?.name ??
        "Unknown",
      ownerEmail,
    };
  },
});

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    return {
      _id: user._id,
      email: (user as { email?: string }).email ?? "",
      fullName:
        profile?.fullName ?? (user as { name?: string }).name ?? "",
    };
  },
});

export const getInvitationWithDetails = internalQuery({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) return null;
    const org = await ctx.db.get(invitation.orgId);
    const inviter = await ctx.db.get(invitation.invitedBy);
    const inviterProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", invitation.invitedBy))
      .unique();
    const ownerEmail = await ownerEmailForOrg(ctx, org);
    return {
      ...invitation,
      orgName: org?.name ?? "",
      inviterName:
        inviterProfile?.fullName ??
        (inviter as { name?: string } | null)?.name ??
        (inviter as { email?: string } | null)?.email ??
        undefined,
      ownerEmail,
    };
  },
});

export const getVerifiedDomainsForOrg = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const domains = await ctx.db.query("domains").collect();
    return domains.filter((d) => d.orgId === args.orgId);
  },
});

export const getOrgOwnerEmail = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    return ownerEmailForOrg(ctx, org);
  },
});
