import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Blossom Budget collects, uses, and protects your data.",
};

// Public route (not covered by the auth middleware matcher) so it can be
// linked from Plaid Link and the sign-in screen.
export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-dvh bg-paper px-5 py-12">
      <article className="mx-auto max-w-2xl">
        <div className="mb-8">
          <Link href="/login" className="text-sm text-lavender-dark hover:underline">
            ← Back to Blossom Budget
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-1">
          Privacy <span className="text-blossom">Policy</span>
        </h1>
        <p className="text-sm text-muted mb-8">Last updated: July 4, 2026</p>

        <div className="space-y-6 text-[15px] leading-relaxed text-ink">
          <p>
            Blossom Budget (&ldquo;the app&rdquo;) is a personal budgeting
            application operated by an individual for personal use. This policy
            explains what data the app collects, how it is used, and how it is
            protected.
          </p>

          <section>
            <h2 className="text-lg font-semibold mb-2">Information we collect</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Account information</strong> you provide when you
                register: your name, email address, and a securely hashed
                password.
              </li>
              <li>
                <strong>Financial information</strong> retrieved through{" "}
                <a
                  href="https://plaid.com"
                  className="text-lavender-dark underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Plaid
                </a>{" "}
                when you connect a bank: account names and balances, and
                transaction details (amount, date, merchant, and category). We
                never see or store your bank login credentials — those are
                handled entirely by Plaid.
              </li>
              <li>
                <strong>Data you create in the app</strong>: budgets, goals,
                tags, notes, categories, and any manually entered assets or
                liabilities.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">How we use it</h2>
            <p>
              Your data is used solely to provide the app&rsquo;s features to
              you — showing balances and transactions, tracking budgets and
              goals, detecting recurring charges, calculating net worth, and
              (if you opt in) emailing you spending summaries. Your financial
              data is <strong>not</strong> used for advertising, sold, or shared
              with third parties for their own purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Plaid</h2>
            <p>
              The app uses Plaid to connect to your financial institutions. By
              connecting an account you also agree to Plaid&rsquo;s handling of
              your data as described in the{" "}
              <a
                href="https://plaid.com/legal/#end-user-privacy-policy"
                className="text-lavender-dark underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Plaid End User Privacy Policy
              </a>
              . Plaid access tokens are encrypted before storage and are never
              exposed to the browser.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">How we protect it</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>All traffic is served over HTTPS (TLS 1.2 or higher).</li>
              <li>
                Data is stored in a managed PostgreSQL database that encrypts
                data at rest; Plaid access tokens are additionally encrypted at
                the application layer using AES-256-GCM.
              </li>
              <li>
                Access to the app requires authentication, and each
                account&rsquo;s data is isolated from every other account.
              </li>
              <li>
                Credentials and secrets are stored in encrypted environment
                variables, never in source code.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              Data retention &amp; deletion
            </h2>
            <p>
              You can disconnect a financial institution at any time from the
              Accounts page; doing so removes that institution&rsquo;s accounts
              and transactions from the app. To delete your account and all
              associated data entirely, email the address below and the request
              will be honored.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Contact</h2>
            <p>
              Questions or data requests:{" "}
              <a
                href="mailto:nandini.t543@gmail.com"
                className="text-lavender-dark underline"
              >
                nandini.t543@gmail.com
              </a>
            </p>
          </section>

          <p className="text-sm text-muted pt-4 border-t border-lavender-light">
            Blossom Budget is a personal, non-commercial project. This policy may
            be updated as the app changes; the &ldquo;last updated&rdquo; date
            above reflects the current version.
          </p>
        </div>
      </article>
    </main>
  );
}
