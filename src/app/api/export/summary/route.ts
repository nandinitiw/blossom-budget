import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { monthRange, prevMonthRange } from "@/lib/dates";
import { totalSpend, spendingByCategory } from "@/lib/spending";
import { getBudgetsWithProgress } from "@/lib/budgets";
import { getGoalsWithProgress } from "@/lib/goals";
import { money } from "@/lib/format";
import { format, subMonths } from "date-fns";

const PINK = rgb(0.831, 0.325, 0.494); // #D4537E
const LAVENDER = rgb(0.373, 0.341, 0.741); // #5F57BD
const INK = rgb(0.122, 0.106, 0.141);
const MUTED = rgb(0.431, 0.408, 0.475);

// Monthly summary PDF. ?month=2026-06 (defaults to the previous month —
// the most recent *complete* month).
export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const monthParam = new URL(req.url).searchParams.get("month");
  const base = monthParam ? new Date(`${monthParam}-15T00:00:00Z`) : subMonths(new Date(), 1);
  const range = monthRange(base);
  const prevRange = prevMonthRange(base);
  const label = format(range.start, "MMMM yyyy");

  const [user, total, prevTotal, byCat, budgets, goals] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    totalSpend(userId, range),
    totalSpend(userId, prevRange),
    spendingByCategory(userId, range),
    getBudgetsWithProgress(userId, range.start),
    getGoalsWithProgress(userId),
  ]);

  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 740;

  const text = (
    str: string,
    opts: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}
  ) => {
    page.drawText(str, {
      x: opts.x ?? 56,
      y,
      size: opts.size ?? 11,
      font: opts.bold ? fontBold : font,
      color: opts.color ?? INK,
    });
  };

  text("Blossom Budget", { size: 20, bold: true, color: PINK });
  y -= 20;
  text(`Monthly summary — ${label}`, { size: 13, color: MUTED });
  if (user?.name) {
    y -= 16;
    text(`Prepared for ${user.name}`, { size: 10, color: MUTED });
  }

  y -= 36;
  text("Total spending", { size: 12, bold: true, color: LAVENDER });
  y -= 20;
  text(money(total), { size: 22, bold: true, color: PINK });
  if (prevTotal > 0) {
    const delta = Math.round(((total - prevTotal) / prevTotal) * 100);
    y -= 16;
    text(
      `${delta >= 0 ? "+" : ""}${delta}% vs ${format(prevRange.start, "MMMM")} (${money(prevTotal)})`,
      { size: 10, color: MUTED }
    );
  }

  y -= 32;
  text("Spending by category", { size: 12, bold: true, color: LAVENDER });
  y -= 18;
  for (const c of byCat.slice(0, 14)) {
    text(c.name, { size: 10.5 });
    text(money(c.amount), { x: 420, size: 10.5, bold: true });
    y -= 15;
    if (y < 120) break;
  }

  if (budgets.length > 0 && y > 180) {
    y -= 18;
    text("Budgets", { size: 12, bold: true, color: LAVENDER });
    y -= 18;
    for (const b of budgets.slice(0, 8)) {
      const flag = b.status === "exceeded" ? "  — OVER" : b.status === "warning" ? "  — 80%+" : "";
      text(`${b.categoryName}: ${money(b.spent)} of ${money(b.amount)} (${b.pct}%)${flag}`, {
        size: 10.5,
        color: b.status === "exceeded" ? PINK : INK,
      });
      y -= 15;
      if (y < 120) break;
    }
  }

  if (goals.length > 0 && y > 160) {
    y -= 18;
    text("Goals", { size: 12, bold: true, color: LAVENDER });
    y -= 18;
    for (const g of goals.slice(0, 6)) {
      text(
        `${g.name}: ${money(g.progress.current)} of ${money(g.progress.target)} (${g.progress.pct}%)`,
        { size: 10.5 }
      );
      y -= 15;
      if (y < 90) break;
    }
  }

  page.drawText(`Generated ${format(new Date(), "MMM d, yyyy")} · blossom-budget`, {
    x: 56,
    y: 48,
    size: 8.5,
    font,
    color: MUTED,
  });

  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="blossom-summary-${format(range.start, "yyyy-MM")}.pdf"`,
    },
  });
}
