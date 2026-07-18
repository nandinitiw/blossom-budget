import type { NextConfig } from "next";

// Content-Security-Policy tuned to allow what the app actually uses:
// - Next.js runtime + Recharts inline styles → 'unsafe-inline' (style) and
//   inline bootstrap scripts. 'unsafe-eval' is included to avoid breaking the
//   Plaid Link SDK, which we can't fully exercise in CI.
// - Plaid Link loads its SDK from cdn.plaid.com, opens *.plaid.com in an
//   iframe, and calls *.plaid.com.
// - Merchant logos come from arbitrary https hosts, so img-src allows https:.
// It still blocks the high-value stuff: framing (clickjacking), base-uri
// hijacking, form-action exfiltration, plugins, and non-allowlisted origins.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.plaid.com",
  "frame-src https://*.plaid.com https://cdn.plaid.com",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
