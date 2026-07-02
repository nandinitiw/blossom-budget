import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-3">🌸</p>
        <h1 className="text-xl font-bold mb-2">Page not found</h1>
        <p className="text-sm text-muted mb-5">
          This page doesn&apos;t exist — maybe it wilted.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-blossom hover:bg-blossom-dark text-white font-semibold px-5 py-2.5 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
