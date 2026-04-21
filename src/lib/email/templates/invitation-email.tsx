interface InvitationEmailProps {
  orgName: string;
  inviterName?: string;
  role: string; // "manager" | "booker"
  inviteUrl: string;
  expiresOn: string; // human-readable date
}

export function invitationEmailHtml(props: InvitationEmailProps): string {
  const roleLabel = props.role === "manager" ? "Manager" : "Booker";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px;">
    <h2 style="margin: 0 0 8px; color: #111;">You've been invited to ${props.orgName}</h2>
    <p style="margin: 0 0 20px; color: #4b5563; font-size: 14px; line-height: 1.5;">
      ${props.inviterName ? `${props.inviterName} has ` : ""}invited you to join
      <strong>${props.orgName}</strong> as a <strong>${roleLabel}</strong>.
    </p>

    <p style="margin: 0 0 24px; color: #4b5563; font-size: 14px; line-height: 1.5;">
      Click the button below to accept the invitation and set up your account.
    </p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${props.inviteUrl}"
         style="display: inline-block; background: #111; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Accept invitation
      </a>
    </div>

    <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">
      Or copy this link into your browser:
    </p>
    <p style="margin: 0 0 24px; color: #111; font-size: 12px; word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px;">
      ${props.inviteUrl}
    </p>

    <p style="margin: 0; color: #6b7280; font-size: 12px;">
      This invitation expires on <strong>${props.expiresOn}</strong>.
    </p>
  </div>
</body>
</html>`;
}
