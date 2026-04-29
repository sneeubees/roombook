import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { InvoiceDocument, type InvoiceData } from "@/lib/pdf/invoice-template";
import { format } from "date-fns";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Build the invoice PDF for an invoice id. Used by:
 *  - GET /api/invoices/[id]/pdf  (download)
 *  - POST /api/email/send  (attaches the PDF to invoice_ready emails)
 *
 * Returns null if the invoice or its org cannot be loaded so callers can
 * decide whether to fail loudly or fall back to a link.
 */
export async function buildInvoicePdf(
  invoiceId: Id<"invoices">
): Promise<{ buffer: Buffer; invoiceNumber: string } | null> {
  const invoice = await convex.query(api.invoices.get, { id: invoiceId });
  if (!invoice) return null;

  const lineItems = await convex.query(api.invoices.getLineItems, {
    invoiceId,
  });

  const allOrgs = await convex.query(api.organizations.listAll);
  const orgData = allOrgs.find((o) => o._id === invoice.orgId);
  if (!orgData) return null;

  const userData = await convex.query(api.users.getById, {
    id: invoice.userId,
  });

  const vatEnabled = orgData.vatEnabled !== false;
  const u = userData as
    | (typeof userData & {
        billingCompanyName?: string;
        billingAddress?: string;
        billingContactNumber?: string;
        billingVatNumber?: string;
      })
    | null;

  const invoiceData: InvoiceData = {
    orgName: orgData.name,
    orgLogoUrl: orgData.logoUrl,
    orgAddress: orgData.address,
    orgPhone: orgData.phone,
    orgEmail: orgData.email,
    orgVatNumber: orgData.vatNumber,
    bankName: orgData.bankingDetails?.bankName,
    accountNumber: orgData.bankingDetails?.accountNumber,
    branchCode: orgData.bankingDetails?.branchCode,
    accountType: orgData.bankingDetails?.accountType,
    customerName: u?.fullName ?? "Unknown",
    customerEmail: u?.email ?? "",
    customerPhone: u?.billingContactNumber ?? u?.phone,
    customerCompanyName: u?.billingCompanyName,
    customerBillingAddress: u?.billingAddress,
    customerVatNumber: u?.billingVatNumber,
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
