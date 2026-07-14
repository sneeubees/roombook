import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { InvoiceDocument, type InvoiceData } from "@/lib/pdf/invoice-template";
import { format } from "date-fns";

/**
 * Build the invoice PDF for an invoice id. Used by:
 *  - GET /api/invoices/[id]/pdf  (download) — passes the signed-in user's token
 *  - POST /api/email/send  (attaches the PDF to invoice_ready emails) — passes
 *    the shared server secret, since there is no signed-in user
 *
 * All invoice data is fetched via the single authorized `invoices.getForPdf`
 * query, which enforces access with the caller's identity (a booker may fetch
 * only their own invoice; staff/owner/super admin any in their org) or the
 * server secret. Returns null if the invoice cannot be loaded or the caller is
 * not authorized (callers decide whether to fail loudly or fall back to a link).
 */
export async function buildInvoicePdf(
  invoiceId: Id<"invoices">,
  auth?: { token?: string; serverSecret?: string }
): Promise<{ buffer: Buffer; invoiceNumber: string } | null> {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (auth?.token) {
    convex.setAuth(auth.token);
  }

  const data = await convex.query(api.invoices.getForPdf, {
    invoiceId,
    serverSecret: auth?.serverSecret,
  });
  if (!data) return null;

  const { invoice, lineItems, org, booker } = data;
  const vatEnabled = org.vatEnabled !== false;

  const invoiceData: InvoiceData = {
    orgName: org.name,
    orgLogoUrl: org.logoUrl,
    orgAddress: org.address,
    orgPhone: org.phone,
    orgEmail: org.email,
    orgVatNumber: org.vatNumber,
    bankName: org.bankingDetails?.bankName,
    accountNumber: org.bankingDetails?.accountNumber,
    branchCode: org.bankingDetails?.branchCode,
    accountType: org.bankingDetails?.accountType,
    customerName: booker.fullName ?? "Unknown",
    customerEmail: booker.email ?? "",
    customerPhone: booker.billingContactNumber ?? booker.phone,
    customerCompanyName: booker.billingCompanyName,
    customerBillingAddress: booker.billingAddress,
    customerVatNumber: booker.billingVatNumber,
    vatEnabled,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: format(new Date(), "d MMMM yyyy"),
    periodStart: format(new Date(invoice.periodStart), "d MMM yyyy"),
    periodEnd: format(new Date(invoice.periodEnd), "d MMM yyyy"),
    dueDate: invoice.dueDate
      ? format(new Date(invoice.dueDate), "d MMM yyyy")
      : undefined,
    status: invoice.status,
    subtotal: invoice.subtotal,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    lineItems: lineItems.map((item) => ({
      date: format(new Date(item.date), "d MMM yyyy"),
      roomName: item.roomName,
      slotType: item.slotType,
      startTime: item.startTime ?? undefined,
      endTime: item.endTime ?? undefined,
      durationMinutes: item.durationMinutes ?? undefined,
      rate: item.rate,
      amount: item.amount,
    })),
  };

  const pdfBuffer = await renderToBuffer(
    React.createElement(InvoiceDocument, { data: invoiceData }) as never
  );

  return {
    buffer: Buffer.from(pdfBuffer),
    invoiceNumber: invoice.invoiceNumber,
  };
}
