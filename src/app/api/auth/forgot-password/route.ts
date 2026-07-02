import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail, passwordResetEmailHtml } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const rl = rateLimit(`forgot:${clientIp(req)}`, { limit: 5, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  // Always return 200 so the endpoint can't be used to enumerate accounts
  const genericOk = NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });
  if (!parsed.success) return genericOk;

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user) return genericOk;

  // Store only a hash of the token; the raw token goes in the email link
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60_000), // 1 hour
    },
  });

  const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${rawToken}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your Blossom Budget password",
    html: passwordResetEmailHtml(resetUrl),
  });
  if (process.env.NODE_ENV === "development") {
    console.log(`[dev] Password reset link: ${resetUrl}`);
  }

  return genericOk;
}
