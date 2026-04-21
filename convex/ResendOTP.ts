import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendAPI } from "resend";
import { alphabet, generateRandomString } from "oslo/crypto";

function verificationHtml(code: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px;">
    <h2 style="margin: 0 0 8px; color: #111;">Verify your email</h2>
    <p style="margin: 0 0 24px; color: #4b5563; font-size: 14px; line-height: 1.5;">
      Enter the verification code below to finish setting up your account.
    </p>
    <div style="text-align: center; background: #f3f4f6; border-radius: 6px; padding: 24px; margin-bottom: 24px;">
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #111;">
        ${code}
      </div>
    </div>
    <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">
      This code expires in 15 minutes.
    </p>
    <p style="margin: 0; color: #6b7280; font-size: 12px;">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;
}

/**
 * Convex Auth email-OTP provider backed by Resend. Generates a 6-digit
 * numeric code and emails it through Resend using the already-configured
 * sending domain.
 */
export const ResendOTP = Email({
  id: "resend-otp",
  apiKey: process.env.RESEND_API_KEY,
  maxAge: 60 * 15, // 15 minutes
  async generateVerificationToken() {
    return generateRandomString(6, alphabet("0-9"));
  },
  async sendVerificationRequest({ identifier, provider, token }) {
    if (!provider.apiKey) {
      console.warn("[ResendOTP] RESEND_API_KEY missing; skipping send");
      return;
    }
    const resend = new ResendAPI(provider.apiKey);
    const from = process.env.EMAIL_FROM ?? "RoomBook <noreply@roombook.co.za>";
    const { error } = await resend.emails.send({
      from,
      to: [identifier],
      subject: "Your verification code",
      html: verificationHtml(token),
    });
    if (error) {
      console.error("[ResendOTP] send error:", error);
      throw new Error("Could not send verification email");
    }
  },
});
