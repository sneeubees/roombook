import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import {
  InvoiceDocument,
  type InvoiceData,
} from "@/lib/pdf/invoice-template";
import { format } from "date-fns";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoiceId = id as Id<"invoices">;

  try {
    // Fetch invoice
    const invoice = await convex.query(api.invoices.get, { id: invoiceId });
    if (!invoice) {
      return new Response("Invoice not found", { status: 404 });
    }

    // Fetch line items
    const lineItems = await convex.query(api.invoices.getLineItems, {
      invoiceId,
    });

    // Fetch organization (scan listAll since invoices store orgId only)
    const allOrgs = await convex.query(api.organizations.listAll);
    const orgData = allOrgs.find((o) => o._id === invoice.orgId);

    // Fetch user by id
    const userData = await convex.query(api.users.getById, {
      id: invoice.userId,
    });

    if (!orgData) {
      return new Response("Organization not found", { status: 404 });
    }

    const invoiceData: InvoiceData = {
      orgName: orgData.name,
      orgAddress: orgData.address,
      orgPhone: orgData.phone,
      orgEmail: orgData.email,
      orgVatNumber: orgData.vatNumber,
      bankName: orgData.bankingDetails?.bankName,
      accountNumber: orgData.bankingDetails?.accountNumber,
      branchCode: orgData.bankingDetails?.branchCode,
      accountType: orgData.bankingDetails?.accountType,
      customerName: userData?.fullName ?? "Unknown",
      customerEmail: userData?.email ?? "",
      customerPhone: userData?.phone,
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
      React.createElement(InvoiceDocument, { data: invoiceData }) as any
    );

    const uint8 = new Uint8Array(pdfBuffer);
    return new Response(uint8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new Response("Failed to generate PDF", { status: 500 });
  }
}
