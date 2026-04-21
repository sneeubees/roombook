import { sendEmail } from "@/lib/email/send";
import { bookingConfirmationHtml } from "@/lib/email/templates/booking-confirmation";
import { bookingCancellationHtml } from "@/lib/email/templates/booking-cancellation";
import { invoiceReadyHtml } from "@/lib/email/templates/invoice-ready";
import { waitlistAvailableHtml } from "@/lib/email/templates/waitlist-available";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body;

    let subject: string;
    let html: string;
    let to: string = data.email;

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

      case "invoice_ready":
        subject = `Invoice ${data.invoiceNumber} - ${data.orgName}`;
        html = invoiceReadyHtml({
          userName: data.userName,
          invoiceNumber: data.invoiceNumber,
          period: data.period,
          total: data.total,
          orgName: data.orgName,
          downloadUrl: data.downloadUrl,
        });
        break;

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

      default:
        return new Response(JSON.stringify({ error: "Unknown email type" }), {
          status: 400,
        });
    }

    const replyTo: string | undefined = data.replyTo;
    const success = await sendEmail({ to, subject, html, replyTo });

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
