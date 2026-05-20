interface CancellationRequestProps {
  requesterName: string;
  bookingUserName: string;
  roomName: string;
  date: string;
  slot: string;
  orgName: string;
  reason?: string;
  bookingUrl: string;
}

export function cancellationRequestHtml(
  props: CancellationRequestProps
): string {
  const onBehalfBlock =
    props.requesterName === props.bookingUserName
      ? ""
      : `<tr>
          <td style="padding: 4px 0; color: #6b7280;">For booker</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 600;">${props.bookingUserName}</td>
        </tr>`;

  const reasonBlock = props.reason
    ? `<div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 12px; margin-bottom: 24px; font-size: 13px; color: #78350f;">
        <strong>Reason:</strong> ${props.reason}
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px;">
    <h2 style="margin: 0 0 8px; color: #111;">Cancellation requested</h2>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
      <strong>${props.requesterName}</strong> has asked to cancel a booking. The booking is still active — open the dashboard to review and cancel it if appropriate.
    </p>

    <div style="background: #f3f4f6; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
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
        ${onBehalfBlock}
      </table>
    </div>

    ${reasonBlock}

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${props.bookingUrl}" style="display: inline-block; background: #111; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
        Review booking
      </a>
    </div>

    <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
      ${props.orgName} | Powered by RoomBook
    </p>
  </div>
</body>
</html>`;
}
