const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function money(n: number | string, opts?: { whole?: boolean }): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return (opts?.whole ? usdWhole : usd).format(v);
}

/** Plaid convention: positive amount = money out. Render spending as -$x. */
export function signedMoney(amount: number | string): string {
  const v = typeof amount === "string" ? parseFloat(amount) : amount;
  return v > 0 ? `−${usd.format(v)}` : `+${usd.format(-v)}`;
}

export function shortDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function fullDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}
