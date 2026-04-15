import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const getBookingWithDetails = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return null;

    const room = await ctx.db.get(booking.roomId);
    const org = await ctx.db.get(booking.orgId);

    // Get user email from users table
    const users = await ctx.db.query("users").collect();
    const user = users.find((u) => u.clerkUserId === booking.userId);

    return {
      ...booking,
      roomName: room?.name ?? "Unknown Room",
      orgName: org?.name ?? "Unknown Organization",
      userEmail: user?.email ?? "",
    };
  },
});

export const getInvoiceWithDetails = internalQuery({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;

    const org = await ctx.db.get(invoice.orgId);

    const users = await ctx.db.query("users").collect();
    const user = users.find((u) => u.clerkUserId === invoice.userId);

    return {
      ...invoice,
      orgName: org?.name ?? "Unknown Organization",
      userEmail: user?.email ?? "",
      userName: user?.fullName ?? "Unknown",
    };
  },
});

export const getUserByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
  },
});
