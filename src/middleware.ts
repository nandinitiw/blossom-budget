export { default } from "next-auth/middleware";

// Everything under these routes requires a session; unauthenticated users
// are redirected to /login (configured via authOptions.pages).
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/budgets/:path*",
    "/goals/:path*",
    "/recurring/:path*",
    "/net-worth/:path*",
    "/accounts/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
  ],
};
