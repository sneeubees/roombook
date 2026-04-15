import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://roombook.co.za";

export const sendBookingConfirmation = internalAction({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.runQuery(internal.emailHelpers.getBookingWithDetails, {
      bookingId: args.bookingId,
    });
    if (!booking) return;

    const slot =
      booking.slotType === "session" && booking.startTime && booking.endTime
        ? `${booking.startTime} - ${booking.endTime}`
        : booking.slotType === "full_day"
          ? "Full Day"
          : booking.slotType.toUpperCase();

    try {
      await fetch(`${APP_URL}/api/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "booking_confirmation",
          data: {
            email: booking.userEmail,
            userName: booking.userName,
            roomName: booking.roomName,
            date: booking.date,
            slot,
            rate: `R ${(booking.rateApplied / 100).toFixed(2)}`,
            orgName: booking.orgName,
            description: booking.description,
          },
        }),
      });
    } catch (e) {
      console.error("Failed to send booking confirmation email:", e);
    }
  },
});

export const sendBookingCancellation = internalAction({
  args: {
    bookingId: v.id("bookings"),
    cancelledByName: v.string(),
    reason: v.optional(v.string()),
    isBillable: v.boolean(),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.runQuery(internal.emailHelpers.getBookingWithDetails, {
      bookingId: args.bookingId,
    });
    if (!booking) return;

    const slot =
      booking.slotType === "session" && booking.startTime && booking.endTime
        ? `${booking.startTime} - ${booking.endTime}`
        : booking.slotType === "full_day"
          ? "Full Day"
          : booking.slotType.toUpperCase();

    // Email the booker
    try {
      await fetch(`${APP_URL}/api/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "booking_cancellation",
          data: {
            email: booking.userEmail,
            userName: booking.userName,
            roomName: booking.roomName,
            date: booking.date,
            slot,
            cancelledBy: args.cancelledByName,
            reason: args.reason,
            isBillable: args.isBillable,
            orgName: booking.orgName,
          },
        }),
      });
    } catch (e) {
      console.error("Failed to send cancellation email:", e);
    }
  },
});

export const sendInvoiceEmail = internalAction({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.runQuery(internal.emailHelpers.getInvoiceWithDetails, {
      invoiceId: args.invoiceId,
    });
    if (!invoice) return;

    try {
      await fetch(`${APP_URL}/api/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "invoice_ready",
          data: {
            email: invoice.userEmail,
            userName: invoice.userName,
            invoiceNumber: invoice.invoiceNumber,
            period: `${invoice.periodStart} - ${invoice.periodEnd}`,
            total: `R ${(invoice.total / 100).toFixed(2)}`,
            orgName: invoice.orgName,
            downloadUrl: `${APP_URL}/api/invoices/${args.invoiceId}/pdf`,
          },
        }),
      });
    } catch (e) {
      console.error("Failed to send invoice email:", e);
    }
  },
});

export const sendWaitlistNotification = internalAction({
  args: {
    userId: v.string(),
    roomName: v.string(),
    date: v.string(),
    slot: v.string(),
    orgName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.emailHelpers.getUserByClerkId, {
      clerkUserId: args.userId,
    });
    if (!user) return;

    try {
      await fetch(`${APP_URL}/api/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "waitlist_available",
          data: {
            email: user.email,
            userName: user.fullName,
            roomName: args.roomName,
            date: args.date,
            slot: args.slot,
            orgName: args.orgName,
            bookingUrl: `${APP_URL}/calendar`,
          },
        }),
      });
    } catch (e) {
      console.error("Failed to send waitlist notification email:", e);
    }
  },
});
