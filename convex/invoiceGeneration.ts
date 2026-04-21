import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const generateInvoices = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all organizations
    const orgs = await ctx.runQuery(internal.invoiceGenerationHelpers.getAllOrgs);

    const today = new Date();
    const dayOfMonth = today.getDate();

    for (const org of orgs) {
      if (org.invoiceDayOfMonth !== dayOfMonth) continue;
      if (org.invoiceMode === "manual") continue; // Skip auto-gen for manual orgs
      if (org.invoicesEnabled === false) continue; // Skip if invoicing disabled

      // Calculate billing period based on invoiceDay
      const invoiceDay = org.invoiceDayOfMonth;
      const periodEnd = new Date(today.getFullYear(), today.getMonth(), invoiceDay);

      let periodStart: Date;
      if (invoiceDay >= 28) {
        periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
      } else {
        periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, invoiceDay + 1);
      }

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

      // Generate invoice for each user
      let invoiceSeq = 1;
      for (const [, data] of byUser) {
        const userId = data.userId;
        const subtotal = data.bookings.reduce(
          (sum: number, b: any) => sum + b.rateApplied,
          0
        );
        const taxAmount = Math.round(subtotal * org.vatRate);
        const total = subtotal + taxAmount;

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
