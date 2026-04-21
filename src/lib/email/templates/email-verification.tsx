interface EmailVerificationProps {
  code: string;
  orgName?: string;
  expiresIn?: string; // e.g. "15 minutes"
}

export function emailVerificationHtml(props: EmailVerificationProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px;">
    <h2 style="margin: 0 0 8px; color: #111;">Verify your email</h2>
    <p style="margin: 0 0 24px; color: #4b5563; font-size: 14px; line-height: 1.5;">
      Enter the verification code below to finish setting up your account${props.orgName ? ` with <strong>${props.orgName}</strong>` : ""}.
    </p>

    <div style="text-align: center; background: #f3f4f6; border-radius: 6px; padding: 24px; margin-bottom: 24px;">
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #111;">
        ${props.code}
      </div>
    </div>

    <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">
      This code expires in ${props.expiresIn ?? "15 minutes"}.
    </p>
    <p style="margin: 0; color: #6b7280; font-size: 12px;">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;
}
