import { withAuth } from "next-auth/middleware";

// Everything under these routes requires a session; unauthenticated users
// are redirected to our styled /login page (rather than NextAuth's default
// /api/auth/signin). Cookie/secure detection relies on NEXTAUTH_URL being set
// to the https:// production origin.
export default withAuth({
  pages: { signIn: "/login" },
});

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
