# 🌸 Blossom Budget

A personal budgeting web app with live bank connectivity (Plaid), spending
analytics, budgets & goals, recurring-charge detection, net worth tracking,
and scheduled email reports.

Built with **Next.js (App Router) · TypeScript · Tailwind CSS · PostgreSQL ·
Prisma · NextAuth · Plaid · Resend · Recharts**.

## Features

- **Bank sync** — connect accounts via Plaid Link; transactions and balances
  sync automatically, with re-auth prompts when a login expires
- **Spending dashboard** — balances, month-over-month spend, top categories,
  trends charts, personalized insights from your own history
- **Budgets & goals** — per-category budgets (weekly or monthly), savings /
  spending-limit / debt-payoff goals with progress bars and 80%/100% alerts
- **Recurring detection** — finds subscriptions & bills, flags price increases
- **Net worth** — aggregated across Plaid accounts + manual assets/liabilities,
  with weekly snapshots and a trend chart
- **Search, filters & tags** — full transaction search, combinable filters,
  custom tags like `tax-deductible`
- **Email reports** — opt-in weekly/monthly summaries via Resend + cron
- **Data export** — CSV export with filters, monthly PDF summary
- **PWA** — installable, mobile-first responsive design

## Local setup

Prereqs: Node 20+, Docker (or any Postgres 15+), a [Plaid sandbox account](https://dashboard.plaid.com/signup) (free).

```bash
git clone https://github.com/nandinitiw/blossom-budget.git
cd blossom-budget
npm install

# Start a local Postgres (or point DATABASE_URL at your own)
docker run -d --name blossom-postgres \
  -e POSTGRES_PASSWORD=blossom_dev -e POSTGRES_USER=blossom \
  -e POSTGRES_DB=blossom_budget -p 5433:5432 postgres:16

# Configure environment
cp .env.example .env
# then fill in: NEXTAUTH_SECRET (openssl rand -base64 32),
# ENCRYPTION_KEY (openssl rand -hex 32), CRON_SECRET (openssl rand -hex 24),
# PLAID_CLIENT_ID / PLAID_SECRET (sandbox keys), RESEND_API_KEY (optional locally)

npm run db:migrate   # apply Prisma migrations
npm run dev          # http://localhost:3000
```

In Plaid **sandbox**, connect any bank in Plaid Link with credentials
`user_good` / `pass_good`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run test` | Vitest unit tests |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:studio` | Prisma Studio (DB browser) |

## Architecture

```
src/
  app/                # Next.js App Router
    (auth)/           # login, signup, forgot/reset password
    (app)/            # authenticated app: dashboard, transactions, budgets,
                      # goals, recurring, net worth, settings, onboarding
    api/              # route handlers (auth, plaid, crud, cron, export)
  lib/                # domain logic: plaid sync, categorization, budgets,
                      # recurring detection, net worth, insights, email
  components/         # shared UI
prisma/               # schema + migrations
.github/workflows/    # CI: lint, typecheck, tests
```

Key design points:

- **Plaid access tokens are AES-256-GCM encrypted at rest** (`src/lib/crypto.ts`);
  all Plaid calls happen server-side only.
- **Transaction sync** uses Plaid's `/transactions/sync` cursor API, triggered
  by Vercel Cron (and on-demand after connecting).
- **Categorization**: Plaid's category → app category mapping, overridden by
  per-merchant rules that are learned from the user's manual recategorizations.
- **Email reports** are idempotent via the `EmailLog` unique constraint on
  `(user, type, periodKey)`.
- Auth uses **JWT sessions** (HttpOnly cookies) with bcrypt password hashes and
  rate-limited auth endpoints; password reset uses single-use, hashed, expiring
  tokens.

## Deployment (Vercel)

1. Create a managed Postgres database (Neon, Supabase, or Vercel Postgres).
2. Import this repo in Vercel; set all env vars from `.env.example`
   (`APP_URL` and `NEXTAUTH_URL` = your production URL).
3. `npx prisma migrate deploy` against the production DB (or add it to the
   build command).
4. Vercel Cron is configured in `vercel.json` (transaction sync, net worth
   snapshots, email reports). Set `CRON_SECRET` so only Vercel can call them.

### Moving Plaid from sandbox to production

Plaid's free **Trial** plan allows up to 10 live Items. To go live: request
Production access in the Plaid Dashboard (company/use-case questionnaire,
~1–2 days), complete their security attestation, then switch `PLAID_ENV=production`
and use your production secret. The app warns in Settings and logs when you
approach the 10-Item trial cap.
