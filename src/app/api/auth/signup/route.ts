import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { seedDefaultCategories } from "@/lib/categories";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const rl = rateLimit(`signup:${clientIp(req)}`, { limit: 10, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide a name, valid email, and password of at least 8 characters." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: { email, name: parsed.data.name, passwordHash },
    });
    await seedDefaultCategories(user.id);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    // Most likely a missing/unreachable database or un-migrated schema.
    // Log the real cause server-side; return a clean message to the client.
    console.error("[signup] failed:", err);
    return NextResponse.json(
      { error: "We couldn't create your account. Please try again shortly." },
      { status: 500 }
    );
  }
}
