import { NextResponse } from "next/server";
import { sendScheduledEmails } from "@/lib/reports";

export const maxDuration = 300;

// Daily cron (see vercel.json); sendScheduledEmails decides which users are
// due (weekly on Mondays, monthly on the 1st) and EmailLog prevents dupes.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendScheduledEmails();
  return NextResponse.json({ ok: true, ...result });
}
