"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-3">🥀</p>
        <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
        <p className="text-sm text-muted mb-5">
          {process.env.NODE_ENV === "development"
            ? error.message
            : "An unexpected error occurred. Your data is safe — try again."}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-blossom hover:bg-blossom-dark text-white font-semibold px-5 py-2.5 transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
