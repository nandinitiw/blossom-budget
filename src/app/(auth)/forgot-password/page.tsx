"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-lavender-light text-2xl mb-4">
          📬
        </div>
        <h2 className="text-lg font-semibold mb-2">Check your email</h2>
        <p className="text-sm text-muted">
          If an account exists for <span className="font-medium">{email}</span>,
          we&apos;ve sent a password reset link. It expires in 1 hour.
        </p>
        <Link
          href="/login"
          className="inline-block mt-6 text-sm text-blossom font-medium hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-2">Reset your password</h2>
      <p className="text-sm text-muted mb-6">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-lavender-light px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blossom/50"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blossom hover:bg-blossom-dark text-white font-semibold py-2.5 transition-colors disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="text-sm text-muted mt-6 text-center">
        <Link href="/login" className="text-blossom font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
