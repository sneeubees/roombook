interface WaitlistAvailableProps {
  userName: string;
  roomName: string;
  date: string;
  slot: string;
  orgName: string;
  bookingUrl: string;
}

export function waitlistAvailableHtml(props: WaitlistAvailableProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px;">
    <h2 style="margin: 0 0 8px; color: #16a34a;">Room Available!</h2>
    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">Hi ${props.userName}, a slot you were waiting for has opened up.</p>

    <div style="background: #f0fdf4; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
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
      </table>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${props.bookingUrl}" style="display: inline-block; background: #16a34a; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
        Book Now
      </a>
    </div>

    <p style="margin: 0 0 8px; font-size: 12px; color: #9ca3af; text-align: center;">
      First come, first served. Book quickly before someone else does!
    </p>
    <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
      ${props.orgName} | Powered by RoomBook
    </p>
  </div>
</body>
</html>`;
}
