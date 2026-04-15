import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
  },
});

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getLineItems = query({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoiceLineItems")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .collect();
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("invoices"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("void")
    ),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.status === "paid") {
      updates.paidAt = Date.now();
    }
    if (args.status === "sent") {
      updates.sentAt = Date.now();
    }
    await ctx.db.patch(args.id, updates);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const setPdfStorageId = mutation({
  args: {
    id: v.id("invoices"),
    pdfStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { pdfStorageId: args.pdfStorageId });
  },
});

export const getPdfUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Manual invoice generation trigger
export const generateNow = action({
  args: {
    orgId: v.id("organizations"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<number> => {
    const org: any = await ctx.runQuery(internal.invoiceGenerationHelpers.getOrgById, {
      orgId: args.orgId,
    });
    if (!org) throw new Error("Organization not found");

    let startStr: string;
    let endStr: string;

    if (args.startDate && args.endDate) {
      // Manual mode — use provided dates
      startStr = args.startDate;
      endStr = args.endDate;
    } else {
      // Auto mode — calculate from invoiceDayOfMonth
      const today = new Date();
      const invoiceDay = org.invoiceDayOfMonth ?? 1;

      // Period end = most recent invoiceDay (or today if today is invoiceDay)
      let pEnd = new Date(today.getFullYear(), today.getMonth(), invoiceDay);
      if (pEnd > today) {
        pEnd = new Date(today.getFullYear(), today.getMonth() - 1, invoiceDay);
      }

      // Period start = day after previous invoiceDay
      const pStart = new Date(pEnd.getFullYear(), pEnd.getMonth() - 1, invoiceDay + 1);

      startStr = pStart.toISOString().split("T")[0];
      endStr = pEnd.toISOString().split("T")[0];
    }

    const allBookings: any[] = await ctx.runQuery(
      internal.invoiceGenerationHelpers.getBillableBookings,
      { orgId: args.orgId, startDate: startStr, endDate: endStr }
    );

    if (allBookings.length === 0) {
      throw new Error(`No billable bookings found for period ${startStr} to ${endStr}`);
    }

    // Group by user
    const byUser = new Map<string, { userName: string; bookings: any[] }>();
    for (const b of allBookings) {
      const existing = byUser.get(b.userId) ?? { userName: b.userName, bookings: [] as any[] };
      existing.bookings.push(b);
      byUser.set(b.userId, existing);
    }

    let count = 0;
    let seq = 1;
    const pEnd = new Date(endStr);

    for (const [userId, data] of byUser) {
      const subtotal = data.bookings.reduce((s: number, b: any) => s + b.rateApplied, 0);
      const taxAmount = Math.round(subtotal * org.vatRate);
      const total = subtotal + taxAmount;
      const invoiceNumber = `${org.invoicePrefix}-${pEnd.getFullYear()}-${String(pEnd.getMonth() + 1).padStart(2, "0")}-${String(seq).padStart(3, "0")}`;

      await ctx.runMutation(
        internal.invoiceGenerationHelpers.createInvoiceWithLineItems,
        {
          orgId: org._id,
          userId,
          invoiceNumber,
          periodStart: startStr,
          periodEnd: endStr,
          subtotal,
          taxRate: org.vatRate,
          taxAmount,
          total,
          bookings: data.bookings.map((b: any) => {
            let durationMinutes: number | undefined;
            if (b.slotType === "session" && b.startTime && b.endTime) {
              const [sh, sm] = b.startTime.split(":").map(Number);
              const [eh, em] = b.endTime.split(":").map(Number);
              durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
            }
            return {
              bookingId: b._id,
              roomName: b.roomName ?? "Unknown Room",
              date: b.date,
              slotType: b.slotType,
              startTime: b.startTime,
              endTime: b.endTime,
              durationMinutes,
              rate: b.rateApplied,
              amount: b.rateApplied,
            };
          }),
        }
      );
      seq++;
      count++;
    }

    return count;
  },
});
