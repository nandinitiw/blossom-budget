import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    // No API key configured (e.g. local dev) — log instead of failing hard
    console.warn(`[email] RESEND_API_KEY not set; skipping "${opts.subject}" to ${opts.to}`);
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Blossom Budget <onboarding@resend.dev>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function passwordResetEmailHtml(resetUrl: string): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1F1B24">
    <h1 style="color:#D4537E;font-size:22px;margin-bottom:8px">Reset your password</h1>
    <p style="line-height:1.6">We received a request to reset your Blossom Budget password. This link expires in 1 hour.</p>
    <p style="margin:28px 0">
      <a href="${resetUrl}" style="background:#D4537E;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Reset password</a>
    </p>
    <p style="color:#8B8494;font-size:13px;line-height:1.6">If you didn't request this, you can safely ignore this email — your password won't change.</p>
  </div>`;
}
