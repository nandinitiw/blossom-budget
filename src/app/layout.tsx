import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Blossom Budget", template: "%s · Blossom Budget" },
  description:
    "Personal budgeting with live bank sync, goals, and spending insights.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#D4537E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} font-sans antialiased min-h-dvh`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
