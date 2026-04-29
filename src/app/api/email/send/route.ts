import { sendEmail } from "@/lib/email/send";
import { bookingConfirmationHtml } from "@/lib/email/templates/booking-confirmation";
import { bookingCancellationHtml } from "@/lib/email/templates/booking-cancellation";
import { invoiceReadyHtml } from "@/lib/email/templates/invoice-ready";
import { waitlistAvailableHtml } from "@/lib/email/templates/waitlist-available";
import { invitationEmailHtml } from "@/lib/email/templates/invitation-email";
import { emailVerificationHtml } from "@/lib/email/templates/email-verification";
import { buildInvoicePdf } from "@/lib/pdf/build-invoice-pdf";
import type { Id } from "../../../../../convex/_generated/dataModel";

type Attachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body;

    let subject: string;
    let html: string;
    let to: string = data.email;
    let attachments: Attachment[] | undefined;

    switch (type) {
      case "booking_confirmation":
        subject = `Booking Confirmed - ${data.roomName} on ${data.date}`;
        html = bookingConfirmationHtml({
          userName: data.userName,
          roomName: data.roomName,
          date: data.date,
          slot: data.slot,
          rate: data.rate,
          orgName: data.orgName,
          description: data.description,
        });
        break;

      case "booking_cancellation":
        subject = `Booking Cancelled - ${data.roomName} on ${data.date}`;
        html = bookingCancellationHtml({
          userName: data.userName,
          roomName: data.roomName,
          date: data.date,
          slot: data.slot,
          cancelledBy: data.cancelledBy,
          reason: data.reason,
          isBillable: data.isBillable,
          orgName: data.orgName,
        });
        break;

      case "invoice_ready": {
        subject = `Invoice ${data.invoiceNumber} - ${data.orgName}`;

        // Generate the PDF and attach it. Fall back to the download link in
        // the email if rendering fails so the recipient still has a way to
        // get the invoice.
        let hasAttachment = false;
        if (data.invoiceId) {
          try {
            const pdf = await buildInvoicePdf(data.invoiceId as Id<"invoices">);
            if (pdf) {
              attachments = [
                {
                  filename: `${pdf.invoiceNumber}.pdf`,
                  content: pdf.buffer,
                  contentType: "application/pdf",
                },
              ];
              hasAttachment = true;
            }
          } catch (err) {
            console.error(
              "[INVOICE EMAIL] PDF render failed, falling back to link",
              err
            );
          }
        }

        html = invoiceReadyHtml({
          userName: data.userName,
          invoiceNumber: data.invoiceNumber,
          period: data.period,
          total: data.total,
          orgName: data.orgName,
          downloadUrl: hasAttachment ? undefined : data.downloadUrl,
          hasAttachment,
        });
        break;
      }

      case "waitlist_available":
        subject = `Room Available - ${data.roomName} on ${data.date}`;
        html = waitlistAvailableHtml({
          userName: data.userName,
          roomName: data.roomName,
          date: data.date,
          slot: data.slot,
          orgName: data.orgName,
          bookingUrl: data.bookingUrl,
        });
        break;

      case "invitation":
        subject = `You've been invited to ${data.orgName}`;
        html = invitationEmailHtml({
          orgName: data.orgName,
          inviterName: data.inviterName,
          role: data.role,
          inviteUrl: data.inviteUrl,
          expiresOn: data.expiresOn,
        });
        break;

      case "email_verification":
        subject = "Your verification code";
        html = emailVerificationHtml({
          code: data.code,
          orgName: data.orgName,
          expiresIn: data.expiresIn,
        });
        break;

      default:
        return new Response(JSON.stringify({ error: "Unknown email type" }), {
          status: 400,
        });
    }

    const replyTo: string | undefined = data.replyTo;
    const success = await sendEmail({
      to,
      subject,
      html,
      replyTo,
      attachments,
    });

    return new Response(JSON.stringify({ success }), {
      status: success ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[EMAIL API ERROR]", error);
    return new Response(JSON.stringify({ error: "Failed to send email" }), {
      status: 500,
    });
  }
}
