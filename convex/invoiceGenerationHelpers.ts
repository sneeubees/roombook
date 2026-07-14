import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Last calendar day (28–31) of the given year / zero-based month.
 */
export function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Billing period that ends on the invoice day of the given run month.
 *
 * The configured `invoiceDay` is CLAMPED to each month's last day, so short
 * months (February, 30-day months) still bill for day-29/30/31 orgs instead
 * of silently skipping. Consecutive run months yield CONTIGUOUS periods with
 * no gaps and no overlaps: a period runs from the day AFTER the previous
 * month's (clamped) invoice day through this month's (clamped) invoice day.
 */
export function billingPeriodForRunMonth(
  invoiceDay: number,
  year: number,
  monthIndex: number
): { periodStart: Date; periodEnd: Date } {
  const endDay = Math.min(invoiceDay, lastDayOfMonth(year, monthIndex));
  const periodEnd = new Date(year, monthIndex, endDay);
  // Day after the previous month's clamped invoice day. Date normalisation
  // rolls the +1 into the first of the current month when the previous month's
  // day was its last (e.g. Feb 28 → Mar 1), keeping periods contiguous.
  const prevEndDay = Math.min(invoiceDay, lastDayOfMonth(year, monthIndex - 1));
  const periodStart = new Date(year, monthIndex - 1, prevEndDay + 1);
  return { periodStart, periodEnd };
}

export const getOrgById = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.orgId);
  },
});

/**
 * Returns the highest trailing sequence number used for invoices in the
 * given org + prefix + YYYY + MM bucket — across ALL invoices, including
 * cancelled ones. Used so regeneration always issues fresh, never-reused
 * invoice numbers within the same period.
 *
 * Invoice number format: `${prefix}-YYYY-MM-NNN`
 */
export const getMaxSeqForMonth = internalQuery({
  args: {
    orgId: v.id("organizations"),
    prefix: v.string(),
    year: v.number(),
    month: v.string(), // zero-padded "01"-"12"
  },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const head = `${args.prefix}-${args.year}-${args.month}-`;
    let max = 0;
    for (const inv of invoices) {
      if (!inv.invoiceNumber.startsWith(head)) continue;
      const tail = inv.invoiceNumber.slice(head.length);
      const n = parseInt(tail, 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return max;
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
    userId: v.id("users"),
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
    // Idempotency + double-bill guard. Look at every non-cancelled invoice
    // already on record for this org + user (cancelled ones are left intact
    // for audit and don't block regeneration).
    const existingForUser = await ctx.db
      .query("invoices")
      .withIndex("by_org_user_period", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId)
      )
      .collect();
    const activeForUser = existingForUser.filter(
      (i) => i.status !== "cancelled"
    );

    // Exact (periodStart, periodEnd) match → this invoice already exists and
    // the call is idempotent. Dedup on the PAIR, not periodStart alone, so a
    // Jul 1–15 invoice no longer blocks a Jul 1–31 run.
    const exact = activeForUser.find(
      (i) =>
        i.periodStart === args.periodStart && i.periodEnd === args.periodEnd
    );
    if (exact) return exact._id;

    // A different-but-overlapping active period → skip rather than silently
    // under- or over-bill. Surface it with a warning so an operator can
    // reconcile (e.g. cancel + regenerate the correct period). Contiguous
    // periods (touching endpoints only) do NOT overlap.
    const overlapping = activeForUser.find(
      (i) => i.periodStart <= args.periodEnd && args.periodStart <= i.periodEnd
    );
    if (overlapping) {
      console.warn(
        `[invoice] Skipping ${args.invoiceNumber} for org=${args.orgId} ` +
          `user=${args.userId} period ${args.periodStart}..${args.periodEnd}: ` +
          `overlaps existing active invoice ${overlapping.invoiceNumber} ` +
          `(${overlapping.periodStart}..${overlapping.periodEnd}).`
      );
      return overlapping._id;
    }

    // Write-time uniqueness guard on the invoice number. Callers compute
    // sequential numbers, but a concurrent manual + cron run could still
    // collide — bump the trailing sequence until the number is free.
    let invoiceNumber = args.invoiceNumber;
    const lastDash = invoiceNumber.lastIndexOf("-");
    const numberHead = invoiceNumber.slice(0, lastDash + 1);
    let seq = parseInt(invoiceNumber.slice(lastDash + 1), 10);
    if (!Number.isNaN(seq)) {
      while (
        await ctx.db
          .query("invoices")
          .withIndex("by_invoiceNumber", (q) =>
            q.eq("invoiceNumber", invoiceNumber)
          )
          .first()
      ) {
        seq += 1;
        invoiceNumber = `${numberHead}${String(seq).padStart(3, "0")}`;
      }
    }

    const invoiceId = await ctx.db.insert("invoices", {
      orgId: args.orgId,
      userId: args.userId,
      invoiceNumber,
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
      message: `Invoice ${invoiceNumber} for R${(args.total / 100).toFixed(2)} has been generated.`,
      metadata: { invoiceId },
      isRead: false,
      emailSent: false,
    });

    // Schedule invoice email — only if the booker hasn't opted out of
    // automatic monthly invoice emails.
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId)
      )
      .unique();
    if (membership?.receiveMonthlyInvoices !== false) {
      await ctx.scheduler.runAfter(0, internal.emailActions.sendInvoiceEmail, {
        invoiceId,
      });
    }

    return invoiceId;
  },
});

/**
 * Mark an invoice as sent once its email has actually been delivered. Called
 * from the invoice-email action (both the cron and the manual path) on a
 * successful send. Only a `draft` invoice advances to `sent`; an invoice that
 * is already paid / overdue / void / cancelled is never downgraded, and an
 * already-sent invoice keeps its original `sentAt`.
 */
export const markInvoiceSent = internalMutation({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return;
    if (invoice.status === "draft") {
      await ctx.db.patch(args.invoiceId, {
        status: "sent",
        sentAt: Date.now(),
      });
    } else if (invoice.status === "sent" && invoice.sentAt === undefined) {
      // Backfill a missing timestamp without changing status.
      await ctx.db.patch(args.invoiceId, { sentAt: Date.now() });
    }
  },
});
