import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const getBookingWithDetails = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return null;

    const room = await ctx.db.get(booking.roomId);
    const org = await ctx.db.get(booking.orgId);
    const user = await ctx.db.get(booking.userId);

    return {
      ...booking,
      roomName: room?.name ?? "Unknown Room",
      orgName: org?.name ?? "Unknown Organization",
      userEmail: (user as { email?: string } | null)?.email ?? "",
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

    return {
      ...invoice,
      orgName: org?.name ?? "Unknown Organization",
      userEmail: (user as { email?: string } | null)?.email ?? "",
      userName:
        profile?.fullName ??
        (user as { name?: string } | null)?.name ??
        "Unknown",
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
