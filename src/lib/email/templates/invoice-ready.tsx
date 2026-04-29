interface InvoiceReadyProps {
  userName: string;
  invoiceNumber: string;
  period: string;
  total: string;
  orgName: string;
  /**
   * Kept as an optional fallback link in case PDF generation failed and we
   * fell back to a download URL. Normal flow attaches the PDF directly.
   */
  downloadUrl?: string;
  hasAttachment?: boolean;
}

export function invoiceReadyHtml(props: InvoiceReadyProps): string {
  const ctaBlock = props.hasAttachment
    ? `<div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px; margin-bottom: 24px; text-align: center; font-size: 13px; color: #065f46;">
        Your invoice PDF is attached to this email.
      </div>`
    : props.downloadUrl
      ? `<div style="text-align: center; margin-bottom: 24px;">
          <a href="${props.downloadUrl}" style="display: inline-block; background: #111; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
            Download Invoice PDF
          </a>
        </div>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px;">
    <h2 style="margin: 0 0 8px; color: #111;">Invoice Ready</h2>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">Hi ${props.userName}, your invoice for the period is ready.</p>

    <div style="background: #f3f4f6; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Invoice #</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${props.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Period</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${props.period}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Total</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600; font-size: 16px;">${props.total}</td>
        </tr>
      </table>
    </div>

    ${ctaBlock}

    <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
      ${props.orgName} | Powered by RoomBook
    </p>
  </div>
</body>
</html>`;
}
