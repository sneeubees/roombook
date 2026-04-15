import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM ?? "RoomBook <noreply@roombook.co.za>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (!resend) {
    console.log(`[EMAIL STUB] To: ${options.to} | Subject: ${options.subject}`);
    console.log(`[EMAIL STUB] No RESEND_API_KEY set — email not sent`);
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: typeof a.content === "string" ? Buffer.from(a.content) : a.content,
        contentType: a.contentType,
      })),
    });

    if (error) {
      console.error("[EMAIL ERROR]", error);
      return false;
    }

    console.log(`[EMAIL SENT] To: ${options.to} | Subject: ${options.subject}`);
    return true;
  } catch (err) {
    console.error("[EMAIL ERROR]", err);
    return false;
  }
}
