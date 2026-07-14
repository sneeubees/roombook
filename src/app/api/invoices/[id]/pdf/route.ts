import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { buildInvoicePdf } from "@/lib/pdf/build-invoice-pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoiceId = id as Id<"invoices">;

  // Authenticate the caller. The PDF builder forwards this token to Convex,
  // which authorizes per-invoice access (a booker may fetch only their own
  // invoice; staff/owner any in their org). Without a token we cannot
  // authorize, so refuse rather than leak bank details + client PII.
  const token = await convexAuthNextjsToken();
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const pdf = await buildInvoicePdf(invoiceId, { token });
    if (!pdf) return new Response("Invoice not found", { status: 404 });

    const uint8 = new Uint8Array(pdf.buffer);
    return new Response(uint8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    // A thrown authorization error from Convex lands here — treat as forbidden
    // rather than a server error so we don't leak whether the invoice exists.
    console.error("PDF generation error:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Not authorised") || message.includes("authorized")) {
      return new Response("Forbidden", { status: 403 });
    }
    return new Response("Failed to generate PDF", { status: 500 });
  }
}
