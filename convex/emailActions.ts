import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://roombook.co.za";

// Shared secret authenticating this server-to-server call to the Next.js mail
// relay (/api/email/send). Must match INTERNAL_API_SECRET in the Next env.
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

export const sendBookingConfirmation = internalAction({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const booking: any = await ctx.runQuery(internal.emailHelpers.getBookingWithDetails, {
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
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          type: "booking_confirmation",
          data: {
            email: booking.userEmail,
            bcc: booking.staffBcc,
            replyTo: booking.ownerEmail,
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
    const booking: any = await ctx.runQuery(internal.emailHelpers.getBookingWithDetails, {
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
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          type: "booking_cancellation",
          data: {
            email: booking.userEmail,
            bcc: booking.staffBcc,
            replyTo: booking.ownerEmail,
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

export const sendCancellationRequest = internalAction({
  args: {
    bookingId: v.id("bookings"),
    requestedByUserId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const detail: any = await ctx.runQuery(
      internal.emailHelpers.getCancellationRequestDetails,
      {
        bookingId: args.bookingId,
        requestedByUserId: args.requestedByUserId,
      }
    );
    if (!detail) return;
    if (!detail.staffEmails || detail.staffEmails.length === 0) return;

    const slot =
      detail.slotType === "session" && detail.startTime && detail.endTime
        ? `${detail.startTime} - ${detail.endTime}`
        : detail.slotType === "full_day"
          ? "Full Day"
          : (detail.slotType as string).toUpperCase();

    // Send to the first staff email as "to" and the rest as bcc — keeps a
    // clean Resend / SMTP audit while still hitting every manager + owner.
    const [primary, ...rest] = detail.staffEmails as string[];
    try {
      await fetch(`${APP_URL}/api/email/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          type: "cancellation_request",
          data: {
            email: primary,
            bcc: rest,
            replyTo: detail.requesterEmail || detail.ownerEmail,
            requesterName: detail.requesterName,
            bookingUserName: detail.bookingUserName,
            roomName: detail.roomName,
            date: detail.date,
            slot,
            orgName: detail.orgName,
            reason: args.reason,
            bookingUrl: `${APP_URL}/bookings`,
          },
        }),
      });
    } catch (e) {
      console.error("Failed to send cancellation request email:", e);
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

    let res: Response;
    try {
      res = await fetch(`${APP_URL}/api/email/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          type: "invoice_ready",
          data: {
            email: invoice.userEmail,
            replyTo: invoice.ownerEmail,
            userName: invoice.userName,
            invoiceNumber: invoice.invoiceNumber,
            period: `${invoice.periodStart} - ${invoice.periodEnd}`,
            total: `R ${(invoice.total / 100).toFixed(2)}`,
            orgName: invoice.orgName,
            // The Next.js email-send route uses this to render and attach
            // the PDF. The downloadUrl is kept as a graceful fallback.
            invoiceId: args.invoiceId,
            downloadUrl: `${APP_URL}/api/invoices/${args.invoiceId}/pdf`,
          },
        }),
      });
    } catch (e) {
      // Network / relay failure — do NOT mark the invoice sent. Re-throw so the
      // manual path (emailInvoices) records it as failed instead of "sent".
      console.error("Failed to send invoice email:", e);
      throw new Error(
        `Invoice email send failed (network) for ${args.invoiceId}`
      );
    }

    if (!res.ok) {
      // The relay returns a non-2xx status when the underlying send failed (or
      // it is unauthorised / misconfigured). Treat as failure — don't mark sent.
      console.error(
        `Failed to send invoice email for ${args.invoiceId}: HTTP ${res.status}`
      );
      throw new Error(
        `Invoice email send failed (HTTP ${res.status}) for ${args.invoiceId}`
      );
    }

    // Delivered — advance the invoice to "sent" and stamp sentAt. Idempotent
    // and never downgrades a paid / overdue / void / cancelled invoice. Applies
    // to both the auto (cron) and manual (emailInvoices) send paths.
    await ctx.runMutation(internal.invoiceGenerationHelpers.markInvoiceSent, {
      invoiceId: args.invoiceId,
    });
  },
});

export const sendInvitationEmail = internalAction({
  args: {
    invitationId: v.id("invitations"),
  },
  handler: async (ctx, args) => {
    const invitation: any = await ctx.runQuery(
      internal.emailHelpers.getInvitationWithDetails,
      { invitationId: args.invitationId }
    );
    if (!invitation) return;

    // Prefer a verified white-label domain; fallback to the app URL.
    const domains: any[] = await ctx.runQuery(internal.emailHelpers.getVerifiedDomainsForOrg, {
      orgId: invitation.orgId,
    });
    const verifiedDomain = domains.find((d) => d.isVerified);
    const origin = verifiedDomain ? `https://${verifiedDomain.domain}` : APP_URL;
    const inviteUrl = `${origin}/invite/${invitation.token}`;
    const expiresOn = new Date(invitation.expiresAt).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    try {
      await fetch(`${APP_URL}/api/email/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          type: "invitation",
          data: {
            email: invitation.email,
            replyTo: invitation.ownerEmail,
            orgName: invitation.orgName,
            inviterName: invitation.inviterName,
            role: invitation.role,
            inviteUrl,
            expiresOn,
          },
        }),
      });
    } catch (e) {
      console.error("Failed to send invitation email:", e);
    }
  },
});

export const sendWaitlistNotification = internalAction({
  args: {
    userId: v.union(v.id("users"), v.string()),
    orgId: v.optional(v.id("organizations")),
    roomName: v.string(),
    date: v.string(),
    slot: v.string(),
    orgName: v.string(),
  },
  handler: async (ctx, args) => {
    // Waitlist may be notified with an Id or the "org_owners" broadcast marker.
    if (typeof args.userId === "string" && !args.userId.startsWith("jn")) {
      // Broadcast / non-id marker — skip.
      return;
    }
    const user: any = await ctx.runQuery(internal.emailHelpers.getUserById, {
      userId: args.userId as any,
    });
    if (!user) return;

    let ownerEmail: string | undefined;
    if (args.orgId) {
      const r: any = await ctx.runQuery(internal.emailHelpers.getOrgOwnerEmail, {
        orgId: args.orgId,
      });
      ownerEmail = r ?? undefined;
    }

    try {
      await fetch(`${APP_URL}/api/email/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          type: "waitlist_available",
          data: {
            email: user.email,
            replyTo: ownerEmail,
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
