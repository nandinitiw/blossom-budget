"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/transactions", label: "Transactions", icon: "🧾" },
  { href: "/budgets", label: "Budgets", icon: "🎯" },
  { href: "/goals", label: "Goals", icon: "🌱" },
  { href: "/recurring", label: "Recurring", icon: "🔁" },
  { href: "/net-worth", label: "Net Worth", icon: "📈" },
  { href: "/accounts", label: "Accounts", icon: "🏦" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

// Highest-traffic views get a slot in the mobile bottom bar
const MOBILE_ITEMS = NAV_ITEMS.filter((i) =>
  ["/dashboard", "/transactions", "/budgets", "/goals", "/settings"].includes(i.href)
);

export function AppNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <>
      {/* Desktop / tablet sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 border-r border-lavender-light bg-white min-h-dvh sticky top-0">
        <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5">
          <span className="text-2xl">🌸</span>
          <span className="font-bold">
            Blossom <span className="text-blossom">Budget</span>
          </span>
        </Link>
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-lavender-light text-lavender-dark"
                  : "text-muted hover:bg-lavender-light/60 hover:text-ink"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mx-3 mb-5 rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-blossom-light/40 hover:text-blossom-dark transition-colors"
        >
          Sign out
        </button>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-lavender-light flex justify-around py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {MOBILE_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[11px] font-medium ${
              isActive(item.href) ? "text-blossom" : "text-muted"
            }`}
          >
            <span className="text-lg" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
