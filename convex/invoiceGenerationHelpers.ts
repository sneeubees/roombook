import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

export const getOrgById = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.orgId);
  },
});

export const getAllOrgs = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organizations").collect();
  },
});

export const getBillableBookings = internalQuery({
  args: {
    orgId: v.id("organizations"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_org_date", (q) => q.eq("orgId", args.orgId))
      .collect();

    const billable = bookings.filter(
      (b) =>
        b.date >= args.startDate &&
        b.date <= args.endDate &&
        b.isBillable
    );

    // Enrich with room names
    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const roomMap = new Map(rooms.map((r) => [r._id, r.name]));

    return billable.map((b) => ({
      ...b,
      roomName: roomMap.get(b.roomId) ?? "Unknown Room",
    }));
  },
});

export const createInvoiceWithLineItems = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.string(),
    invoiceNumber: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    subtotal: v.number(),
    taxRate: v.number(),
    taxAmount: v.number(),
    total: v.number(),
    bookings: v.array(
      v.object({
        bookingId: v.id("bookings"),
        roomName: v.string(),
        date: v.string(),
        slotType: v.union(
          v.literal("full_day"),
          v.literal("am"),
          v.literal("pm"),
          v.literal("session")
        ),
        startTime: v.optional(v.string()),
        endTime: v.optional(v.string()),
        durationMinutes: v.optional(v.number()),
        description: v.optional(v.string()),
        bookedByName: v.optional(v.string()),
        rate: v.number(),
        amount: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Check if invoice already exists for this period
    const existing = await ctx.db
      .query("invoices")
      .withIndex("by_org_user_period", (q) =>
        q
          .eq("orgId", args.orgId)
          .eq("userId", args.userId)
          .eq("periodStart", args.periodStart)
      )
      .unique();

    if (existing) return existing._id;

    const invoiceId = await ctx.db.insert("invoices", {
      orgId: args.orgId,
      userId: args.userId,
      invoiceNumber: args.invoiceNumber,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      subtotal: args.subtotal,
      taxRate: args.taxRate,
      taxAmount: args.taxAmount,
      total: args.total,
      status: "draft",
    });

    // Insert line items
    for (const item of args.bookings) {
      await ctx.db.insert("invoiceLineItems", {
        invoiceId,
        bookingId: item.bookingId,
        roomName: item.roomName,
        date: item.date,
        slotType: item.slotType,
        startTime: item.startTime,
        endTime: item.endTime,
        durationMinutes: item.durationMinutes,
        description: item.description,
        bookedByName: item.bookedByName,
        rate: item.rate,
        amount: item.amount,
      });
    }

    // Create notification for booker
    await ctx.db.insert("notifications", {
      userId: args.userId,
      orgId: args.orgId,
      type: "invoice_generated",
      title: "New Invoice",
      message: `Invoice ${args.invoiceNumber} for R${(args.total / 100).toFixed(2)} has been generated.`,
      metadata: { invoiceId },
      isRead: false,
      emailSent: false,
    });

    // Schedule invoice email
    await ctx.scheduler.runAfter(0, internal.emailActions.sendInvoiceEmail, {
      invoiceId,
    });

    return invoiceId;
  },
});
