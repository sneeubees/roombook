import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  billingPeriodForRunMonth,
  lastDayOfMonth,
} from "./invoiceGenerationHelpers";

export const generateInvoices = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all organizations
    const orgs = await ctx.runQuery(internal.invoiceGenerationHelpers.getAllOrgs);

    const today = new Date();
    const dayOfMonth = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();

    for (const org of orgs) {
      if (org.invoiceMode === "manual") continue; // Skip auto-gen for manual orgs
      if (org.invoicesEnabled === false) continue; // Skip if invoicing disabled

      // Clamp the configured invoice day to THIS month's last day so a day
      // 29/30/31 org still fires in short months (Feb, 30-day months) instead
      // of skipping a whole month's billing.
      const invoiceDay = org.invoiceDayOfMonth;
      const effectiveDay = Math.min(invoiceDay, lastDayOfMonth(year, month));
      if (effectiveDay !== dayOfMonth) continue;

      // Contiguous period: day after the previous month's (clamped) invoice
      // day through this month's (clamped) invoice day. No gaps, no overlaps.
      const { periodStart, periodEnd } = billingPeriodForRunMonth(
        invoiceDay,
        year,
        month
      );

      const periodStartStr = periodStart.toISOString().split("T")[0];
      const periodEndStr = periodEnd.toISOString().split("T")[0];

      // Get all confirmed + billable bookings for the period
      const bookings = await ctx.runQuery(
        internal.invoiceGenerationHelpers.getBillableBookings,
        {
          orgId: org._id,
          startDate: periodStartStr,
          endDate: periodEndStr,
        }
      );

      // Group by user (Convex Id values stringify uniquely, so we key by string
      // and re-use the first booking's userId as the canonical Id<"users">).
      const byUser = new Map<
        string,
        { userId: any; userName: string; bookings: typeof bookings }
      >();
      for (const booking of bookings) {
        const key = booking.userId as unknown as string;
        const existing = byUser.get(key) ?? {
          userId: booking.userId,
          userName: booking.userName,
          bookings: [],
        };
        existing.bookings.push(booking);
        byUser.set(key, existing);
      }

      // Rates are VAT-inclusive. Split the total when VAT is enabled.
      const vatEnabled = org.vatEnabled !== false;
      const vatRate = vatEnabled ? org.vatRate : 0;

      // Continue the sequence past whatever is already in the books for this
      // prefix + year + month (cancelled invoices count too) so cron numbers
      // never collide with manually generated ones.
      const yyyy = periodEnd.getFullYear();
      const mm = String(periodEnd.getMonth() + 1).padStart(2, "0");
      const maxSeq = await ctx.runQuery(
        internal.invoiceGenerationHelpers.getMaxSeqForMonth,
        { orgId: org._id, prefix: org.invoicePrefix, year: yyyy, month: mm }
      );

      // Generate invoice for each user
      let invoiceSeq = maxSeq + 1;
      for (const [, data] of byUser) {
        const userId = data.userId;
        const total = data.bookings.reduce(
          (sum: number, b: any) => sum + b.rateApplied,
          0
        );
        const taxAmount = vatEnabled
          ? Math.round(total * (vatRate / (1 + vatRate)))
          : 0;
        const subtotal = total - taxAmount;

        const invoiceNumber = `${org.invoicePrefix}-${periodEnd.getFullYear()}-${String(periodEnd.getMonth() + 1).padStart(2, "0")}-${String(invoiceSeq).padStart(3, "0")}`;

        await ctx.runMutation(
          internal.invoiceGenerationHelpers.createInvoiceWithLineItems,
          {
            orgId: org._id,
            userId,
            invoiceNumber,
            periodStart: periodStartStr,
            periodEnd: periodEndStr,
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

        invoiceSeq++;
      }
    }
  },
});
