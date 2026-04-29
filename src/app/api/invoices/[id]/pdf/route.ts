import { Id } from "../../../../../../convex/_generated/dataModel";
import { buildInvoicePdf } from "@/lib/pdf/build-invoice-pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoiceId = id as Id<"invoices">;

  try {
    const pdf = await buildInvoicePdf(invoiceId);
    if (!pdf) return new Response("Invoice not found", { status: 404 });

    const uint8 = new Uint8Array(pdf.buffer);
    return new Response(uint8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new Response("Failed to generate PDF", { status: 500 });
  }
}
