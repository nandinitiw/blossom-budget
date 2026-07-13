export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10 bg-gradient-to-br from-lavender-light via-paper to-blossom-light/40">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-3xl">🌸</span>
          <h1 className="text-2xl font-bold mt-2">
            Blossom <span className="text-blossom">Budget</span>
          </h1>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-lavender-light p-8">
          {children}
        </div>
        <p className="text-center text-xs text-muted mt-6">
          <a href="/privacy" className="hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </main>
  );
}
