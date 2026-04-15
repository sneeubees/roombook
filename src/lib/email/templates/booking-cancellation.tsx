interface BookingCancellationProps {
  userName: string;
  roomName: string;
  date: string;
  slot: string;
  cancelledBy: string;
  reason?: string;
  isBillable: boolean;
  orgName: string;
}

export function bookingCancellationHtml(props: BookingCancellationProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px;">
    <h2 style="margin: 0 0 8px; color: #dc2626;">Booking Cancelled</h2>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">Hi ${props.userName}, a booking has been cancelled.</p>

    <div style="background: #fef2f2; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Room</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${props.roomName}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Date</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${props.date}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Slot</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${props.slot}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Cancelled By</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${props.cancelledBy}</td>
        </tr>
        ${props.reason ? `<tr>
          <td style="padding: 4px 0; color: #6b7280;">Reason</td>
          <td style="padding: 4px 0; text-align: right;">${props.reason}</td>
        </tr>` : ""}
      </table>
    </div>

    ${props.isBillable ? `<p style="margin: 0 0 24px; color: #dc2626; font-size: 13px; font-weight: 600;">
      Note: This was a late cancellation and will still be billed.
    </p>` : ""}

    <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
      ${props.orgName} | Powered by RoomBook
    </p>
  </div>
</body>
</html>`;
}
