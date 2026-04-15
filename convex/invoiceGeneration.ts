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

      // Calculate billing period (previous month)
      const periodEnd = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of prev month
      const periodStart = new Date(
        periodEnd.getFullYear(),
        periodEnd.getMonth(),
        1
      ); // First day of prev month

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

      // Group by user
      const byUser = new Map<
        string,
        { userName: string; bookings: typeof bookings }
      >();
      for (const booking of bookings) {
        const existing = byUser.get(booking.userId) ?? {
          userName: booking.userName,
          bookings: [],
        };
        existing.bookings.push(booking);
        byUser.set(booking.userId, existing);
      }

      // Generate invoice for each user
      let invoiceSeq = 1;
      for (const [userId, data] of byUser) {
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
