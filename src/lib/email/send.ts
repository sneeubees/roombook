import nodemailer, { type Transporter } from "nodemailer";

/**
 * Email sender. Uses SMTP when SMTP_HOST is set (preferred). Falls back to
 * Resend if RESEND_API_KEY is set, otherwise logs a stub.
 *
 * Env vars for SMTP:
 *   SMTP_HOST       e.g. smtp-relay.brevo.com / smtp.gmail.com
 *   SMTP_PORT       587 (STARTTLS) or 465 (SSL) — default 587
 *   SMTP_SECURE     "true" for port 465, otherwise "false" — default auto
 *   SMTP_USER       SMTP login
 *   SMTP_PASS       SMTP password / app-password / API key
 *   EMAIL_FROM      From header, e.g. "RoomBook <noreply@roombook.co.za>"
 */

let smtpTransport: Transporter | null = null;
if (process.env.SMTP_HOST) {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure =
    process.env.SMTP_SECURE != null
      ? process.env.SMTP_SECURE === "true"
      : port === 465;
  smtpTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

const FROM_EMAIL =
  process.env.EMAIL_FROM ?? "RoomBook <noreply@roombook.co.za>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  // Preferred path: SMTP via nodemailer.
  if (smtpTransport) {
    try {
      const info = await smtpTransport.sendMail({
        from: FROM_EMAIL,
        to: options.to,
        replyTo: options.replyTo,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: typeof a.content === "string" ? Buffer.from(a.content) : a.content,
          contentType: a.contentType,
        })),
      });
      console.log(
        `[EMAIL SENT via SMTP] To: ${options.to} | Subject: ${options.subject} | MessageID: ${info.messageId}`
      );
      return true;
    } catch (err) {
      console.error("[EMAIL SMTP ERROR]", err);
      return false;
    }
  }

  // Legacy fallback: Resend (if ever wanted again).
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: options.to,
        replyTo: options.replyTo,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: typeof a.content === "string" ? Buffer.from(a.content) : a.content,
          contentType: a.contentType,
        })),
      });
      if (error) {
        console.error("[EMAIL RESEND ERROR]", error);
        return false;
      }
      console.log(`[EMAIL SENT via Resend] To: ${options.to}`);
      return true;
    } catch (err) {
      console.error("[EMAIL RESEND ERROR]", err);
      return false;
    }
  }

  // No provider configured.
  console.log(
    `[EMAIL STUB] To: ${options.to} | Subject: ${options.subject} | No SMTP or Resend configured`
  );
  return false;
}
