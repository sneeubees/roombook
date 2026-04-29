import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

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
  args: { userId: v.id("users") },
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
      v.literal("void"),
      v.literal("cancelled")
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
    if (args.status === "cancelled") {
      updates.cancelledAt = Date.now();
    }
    await ctx.db.patch(args.id, updates);
  },
});

// List payment runs (months) and whether invoices were generated for each.
// Used by the regenerate dialog. Returns runs going back 12 months + the upcoming run.
export const listPaymentRuns = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) return [];
    const invoiceDay = org.invoiceDayOfMonth ?? 1;

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Build the last 13 runs (current + 12 past).
    const runs: Array<{
      key: string; // "YYYY-MM" identifier for the run's END month
      runDate: string; // YYYY-MM-DD — the invoice day for that run
      periodStart: string;
      periodEnd: string;
      label: string; // "April 2026"
      activeInvoiceCount: number;
      cancelledInvoiceCount: number;
      totalInvoiceCount: number;
      isFuture: boolean; // true if runDate > today (generation disabled)
    }> = [];

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    for (let offset = 0; offset < 13; offset++) {
      const runMonth = new Date(today.getFullYear(), today.getMonth() - offset + 1, 1);
      // runDate = invoiceDay of (runMonth-1); no, we use runMonth itself.
      // Convention: "April 2026 run" fires on invoiceDay of April 2026.
      const year = runMonth.getFullYear();
      const month = runMonth.getMonth();
      const pEnd = new Date(year, month, invoiceDay);
      let pStart: Date;
      if (invoiceDay >= 28) {
        pStart = new Date(pEnd.getFullYear(), pEnd.getMonth(), 1);
      } else {
        pStart = new Date(pEnd.getFullYear(), pEnd.getMonth() - 1, invoiceDay + 1);
      }
      const startStr = pStart.toISOString().split("T")[0];
      const endStr = pEnd.toISOString().split("T")[0];
      const key = `${pEnd.getFullYear()}-${String(pEnd.getMonth() + 1).padStart(2, "0")}`;

      const matching = invoices.filter(
        (i) => i.periodStart === startStr && i.periodEnd === endStr
      );
      const active = matching.filter((i) => i.status !== "cancelled");
      const cancelled = matching.filter((i) => i.status === "cancelled");

      runs.push({
        key,
        runDate: endStr,
        periodStart: startStr,
        periodEnd: endStr,
        label: pEnd.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
        activeInvoiceCount: active.length,
        cancelledInvoiceCount: cancelled.length,
        totalInvoiceCount: matching.length,
        isFuture: endStr > todayStr,
      });
    }
    return runs;
  },
});

// Cancel all non-cancelled invoices for a given period (used before regeneration).
export const cancelForPeriod = mutation({
  args: {
    orgId: v.id("organizations"),
    periodStart: v.string(),
    periodEnd: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const target = invoices.filter(
      (i) =>
        i.periodStart === args.periodStart &&
        i.periodEnd === args.periodEnd &&
        i.status !== "cancelled"
    );
    for (const inv of target) {
      await ctx.db.patch(inv._id, {
        status: "cancelled",
        cancelledAt: Date.now(),
        cancelledReason: args.reason ?? "Regenerated",
      });
    }
    return target.length;
  },
});

// Permanently delete a cancelled invoice (and its line items). This is a
// hard delete — only allowed once the invoice is in a "cancelled" state so
// active / paid invoices can never be quietly dropped from the audit trail.
// Owner of the org or super-admin only.
export const deleteCancelled = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("Not authenticated");

    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "cancelled") {
      throw new Error("Only cancelled invoices can be deleted");
    }

    // Authorisation — owner of the invoice's org or super-admin.
    const actorProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", actorId))
      .unique();
    const isSuperAdmin = actorProfile?.isSuperAdmin === true;

    if (!isSuperAdmin) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_org_user", (q) =>
          q.eq("orgId", invoice.orgId).eq("userId", actorId)
        )
        .unique();
      if (!membership || membership.role !== "owner") {
        throw new Error("Only the owner can delete cancelled invoices");
      }
    }

    // Drop the line items first.
    const lineItems = await ctx.db
      .query("invoiceLineItems")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.id))
      .collect();
    for (const li of lineItems) {
      await ctx.db.delete(li._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Regenerate invoices for a specific payment run.
// If active invoices exist for that period, they are cancelled first and new
// invoice numbers are issued. Cancelled records are preserved for audit.
export const regenerateForPeriod = action({
  args: {
    orgId: v.id("organizations"),
    periodStart: v.string(),
    periodEnd: v.string(),
  },
  handler: async (ctx, args): Promise<{ cancelled: number; created: number }> => {
    const cancelled: number = await ctx.runMutation(api.invoices.cancelForPeriod, {
      orgId: args.orgId,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      reason: "Regenerated",
    });
    let created = 0;
    try {
      created = await ctx.runAction(api.invoices.generateNow, {
        orgId: args.orgId,
        startDate: args.periodStart,
        endDate: args.periodEnd,
      });
    } catch (err) {
      // Period may have no billable bookings — that's OK, return 0 created.
      if (err instanceof Error && err.message.startsWith("No billable bookings")) {
        created = 0;
      } else {
        throw err;
      }
    }
    return { cancelled, created };
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

// Send the latest non-cancelled invoice to one booker (or every booker who
// has one). Ignores the "Email Monthly Invoices" opt-out — this is a manual
// owner-initiated action.
export const emailInvoices = action({
  args: {
    orgId: v.id("organizations"),
    // If omitted, emails every booker who has a non-cancelled invoice.
    userId: v.optional(v.id("users")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ sent: number; skipped: number }> => {
    const invoices: any[] = await ctx.runQuery(api.invoices.listByOrg, {
      orgId: args.orgId,
    });
    const active = invoices.filter((i) => i.status !== "cancelled");

    // Group by userId → pick the most recent (by periodEnd) invoice per user.
    const latestPerUser = new Map<string, any>();
    for (const inv of active) {
      if (args.userId && inv.userId !== args.userId) continue;
      const existing = latestPerUser.get(inv.userId);
      if (!existing || inv.periodEnd > existing.periodEnd) {
        latestPerUser.set(inv.userId, inv);
      }
    }

    let sent = 0;
    let skipped = 0;
    for (const inv of latestPerUser.values()) {
      try {
        await ctx.runAction(internal.emailActions.sendInvoiceEmail, {
          invoiceId: inv._id,
        });
        sent++;
      } catch (err) {
        console.error("Failed to send invoice email:", err);
        skipped++;
      }
    }
    return { sent, skipped };
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
      // Period end = invoiceDay of current (or most recent) month
      // Period start = invoiceDay+1 of previous month
      // Exception: if invoiceDay >= 28, start wraps to 1st of current month
      const today = new Date();
      const invoiceDay = org.invoiceDayOfMonth ?? 1;

      // Period end = most recent invoiceDay
      let pEnd = new Date(today.getFullYear(), today.getMonth(), invoiceDay);
      if (pEnd > today) {
        pEnd = new Date(today.getFullYear(), today.getMonth() - 1, invoiceDay);
      }

      // Period start: day after invoiceDay of the month before pEnd
      let pStart: Date;
      if (invoiceDay >= 28) {
        // Wraps: start from 1st of the same month as pEnd
        pStart = new Date(pEnd.getFullYear(), pEnd.getMonth(), 1);
      } else {
        // Normal: start from invoiceDay+1 of previous month
        pStart = new Date(pEnd.getFullYear(), pEnd.getMonth() - 1, invoiceDay + 1);
      }

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

    const byUser = new Map<string, { userId: any; userName: string; bookings: any[] }>();
    for (const b of allBookings) {
      const key = b.userId as unknown as string;
      const existing = byUser.get(key) ?? {
        userId: b.userId,
        userName: b.userName,
        bookings: [] as any[],
      };
      existing.bookings.push(b);
      byUser.set(key, existing);
    }

    let count = 0;
    const pEnd = new Date(endStr);

    // Start the sequence past whatever is already in the books for this
    // prefix + year + month so regenerated invoices always get fresh,
    // never-reused numbers (cancelled invoices count too).
    const yyyy = pEnd.getFullYear();
    const mm = String(pEnd.getMonth() + 1).padStart(2, "0");
    const maxSeq: number = await ctx.runQuery(
      internal.invoiceGenerationHelpers.getMaxSeqForMonth,
      { orgId: org._id, prefix: org.invoicePrefix, year: yyyy, month: mm }
    );
    let seq = maxSeq + 1;

    // Rates are treated as VAT-inclusive. When VAT is enabled, split the
    // total into subtotal + tax so the invoice shows both lines. When VAT
    // is disabled, taxAmount = 0 and subtotal = total.
    const vatEnabled = org.vatEnabled !== false;
    const vatRate = vatEnabled ? org.vatRate : 0;

    for (const [, data] of byUser) {
      const userId = data.userId;
      const total = data.bookings.reduce((s: number, b: any) => s + b.rateApplied, 0);
      const taxAmount = vatEnabled ? Math.round(total * (vatRate / (1 + vatRate))) : 0;
      const subtotal = total - taxAmount;
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
          taxRate: vatRate,
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
              description: b.description,
              bookedByName: b.bookedByName,
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
