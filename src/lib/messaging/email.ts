// Thin wrapper over Resend's API. Server-only.

import { Resend } from "resend";

let client: Resend | null = null;

function getClient() {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  client = new Resend(key);
  return client;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  /** Plain text body — auto-wrapped into a minimal HTML email so it renders
   *  reasonably in any client. */
  body: string;
};

export type SendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

function bodyToHtml(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #18181b;">
<div style="max-width: 560px; margin: 0 auto; padding: 24px;">
<div style="white-space: pre-wrap;">${escaped}</div>
<div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e4e4e7; font-size: 12px; color: #71717a;">Novo Horizonte · Português Língua de Acolhimento</div>
</div></body></html>`;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const fromAddress = process.env.EMAIL_FROM ?? "noreply@nhorizonte.pt";
  const fromName = process.env.EMAIL_FROM_NAME ?? "Novo Horizonte";
  const from = `${fromName} <${fromAddress}>`;

  try {
    const resend = getClient();
    const { data, error } = await resend.emails.send({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.body,
      html: bodyToHtml(input.body),
    });
    if (error || !data?.id) {
      return { ok: false, error: error?.message ?? "Unknown Resend error" };
    }
    return { ok: true, messageId: data.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
