import { sendEmail } from "@/lib/email/send";
import { bookingConfirmationHtml } from "@/lib/email/templates/booking-confirmation";
import { bookingCancellationHtml } from "@/lib/email/templates/booking-cancellation";
import { invoiceReadyHtml } from "@/lib/email/templates/invoice-ready";
import { waitlistAvailableHtml } from "@/lib/email/templates/waitlist-available";
import { InvoiceDocument, type InvoiceData } from "@/lib/pdf/invoice-template";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

/**
 * Dev-only: one-shot endpoint to fire every email template at a single
 * address so the layout and wording can be reviewed. Guarded by a query
 * token so a random scraper can't spam mail through it.
 *
 *   GET /api/email/test?token=roombook-test
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== "roombook-test") {
    return new Response("Forbidden", { status: 403 });
  }

  const to = url.searchParams.get("to") ?? "johan@thewebjockeys.co.za";

  const results: Record<string, boolean> = {};

  // 1. Booking confirmation
  results.booking_confirmation = await sendEmail({
    to,
    subject: "[TEST] Booking Confirmed - Consulting Room on 2026-04-24",
    replyTo: "owner@example.co.za",
    html: bookingConfirmationHtml({
      userName: "Esther Envisions",
      roomName: "Consulting Room",
      date: "Friday, 24 April 2026",
      slot: "09:00 - 10:00",
      rate: "R 250.00",
      orgName: "PhysioCare Practice",
      description: "John Smith — initial consultation",
    }),
  });

  // 2. Booking cancellation
  results.booking_cancellation = await sendEmail({
    to,
    subject: "[TEST] Booking Cancelled - Consulting Room on 2026-04-24",
    replyTo: "owner@example.co.za",
    html: bookingCancellationHtml({
      userName: "Esther Envisions",
      roomName: "Consulting Room",
      date: "Friday, 24 April 2026",
      slot: "09:00 - 10:00",
      cancelledBy: "The Practice Owner",
      reason: "Room unavailable due to maintenance.",
      isBillable: false,
      orgName: "PhysioCare Practice",
    }),
  });

  // 3. Waitlist available (now "Notify when cancelled")
  results.waitlist_available = await sendEmail({
    to,
    subject: "[TEST] Room Available - Consulting Room on 2026-04-24",
    replyTo: "owner@example.co.za",
    html: waitlistAvailableHtml({
      userName: "Esther Envisions",
      roomName: "Consulting Room",
      date: "Friday, 24 April 2026",
      slot: "09:00 - 10:00",
      orgName: "PhysioCare Practice",
      bookingUrl: "https://roombook.co.za/calendar",
    }),
  });

  // 4. Invoice ready — with a real PDF attached
  const sampleInvoice: InvoiceData = {
    orgName: "PhysioCare Practice",
    orgAddress: "12 Long Street, Cape Town, 8001",
    orgPhone: "021 555 1234",
    orgEmail: "billing@physiocare.co.za",
    orgVatNumber: "4123456789",
    bankName: "Standard Bank",
    accountNumber: "123456789",
    branchCode: "051001",
    accountType: "Current",
    customerName: "Esther Envisions",
    customerEmail: to,
    customerPhone: "082 555 7788",
    customerCompanyName: "Envisions Consulting (Pty) Ltd",
    customerBillingAddress: "45 Main Road, Claremont, 7708",
    customerVatNumber: "4987654321",
    invoiceNumber: "INV-2026-04-001",
    invoiceDate: "24 April 2026",
    periodStart: "2 Mar 2026",
    periodEnd: "1 Apr 2026",
    dueDate: "15 April 2026",
    status: "draft",
    vatEnabled: true,
    taxRate: 0.15,
    // VAT-inclusive example: R 1 150 total = R 1 000 subtotal + R 150 VAT
    subtotal: 100000,
    taxAmount: 15000,
    total: 115000,
    lineItems: [
      {
        date: "4 Mar 2026",
        roomName: "Consulting Room",
        slotType: "session",
        startTime: "09:00",
        endTime: "10:00",
        durationMinutes: 60,
        rate: 25000,
        amount: 25000,
      },
      {
        date: "11 Mar 2026",
        roomName: "Consulting Room",
        slotType: "session",
        startTime: "09:00",
        endTime: "10:00",
        durationMinutes: 60,
        rate: 25000,
        amount: 25000,
      },
      {
        date: "18 Mar 2026",
        roomName: "Consulting Room",
        slotType: "session",
        startTime: "09:00",
        endTime: "11:00",
        durationMinutes: 120,
        rate: 50000,
        amount: 50000,
      },
      {
        date: "25 Mar 2026",
        roomName: "Physio Studio",
        slotType: "am",
        rate: 70000,
        amount: 15000, // discount override demo
      },
    ],
  };

  const pdfBuffer = await renderToBuffer(
    React.createElement(InvoiceDocument, { data: sampleInvoice }) as any
  );

  results.invoice_ready = await sendEmail({
    to,
    subject: `[TEST] Invoice ${sampleInvoice.invoiceNumber} - ${sampleInvoice.orgName}`,
    replyTo: sampleInvoice.orgEmail,
    html: invoiceReadyHtml({
      userName: sampleInvoice.customerName,
      invoiceNumber: sampleInvoice.invoiceNumber,
      period: `${sampleInvoice.periodStart} - ${sampleInvoice.periodEnd}`,
      total: "R 1 150.00",
      orgName: sampleInvoice.orgName,
      downloadUrl: "https://roombook.co.za/api/invoices/test/pdf",
    }),
    attachments: [
      {
        filename: `${sampleInvoice.invoiceNumber}.pdf`,
        content: Buffer.from(pdfBuffer),
        contentType: "application/pdf",
      },
    ],
  });

  return new Response(
    JSON.stringify({ to, results }, null, 2),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
