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
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<number> => {
    const org: any = await ctx.runQuery(internal.invoiceGenerationHelpers.getOrgById, {
      orgId: args.orgId,
    });
    if (!org) throw new Error("Organization not found");

    const today = new Date();

    // Try previous month first
    const periodEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
    let startStr = periodStart.toISOString().split("T")[0];
    let endStr = periodEnd.toISOString().split("T")[0];

    let allBookings: any[] = await ctx.runQuery(
      internal.invoiceGenerationHelpers.getBillableBookings,
      { orgId: args.orgId, startDate: startStr, endDate: endStr }
    );

    // If no previous month bookings, try current month
    if (allBookings.length === 0) {
      const cmStart = new Date(today.getFullYear(), today.getMonth(), 1);
      startStr = cmStart.toISOString().split("T")[0];
      endStr = today.toISOString().split("T")[0];

      allBookings = await ctx.runQuery(
        internal.invoiceGenerationHelpers.getBillableBookings,
        { orgId: args.orgId, startDate: startStr, endDate: endStr }
      );

      if (allBookings.length === 0) {
        throw new Error("No billable bookings found for invoice generation");
      }
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
