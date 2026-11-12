# Hosting.com Coffee Campaign

Hosting.com customers who pay an invoice get a free or discounted coffee at partner cafés in Bangladesh.
Support checks the invoice and issues a single-use, expiring voucher. The customer redeems it at the counter by
scanning the café's QR standee, and the café is paid back later by finance.

## How it works

1. **Request.** The customer submits their invoice number, email and phone.
2. **Approval.** Support approves or rejects the request. On approval a voucher is issued from the active campaign.
3. **Login.** The customer logs in with a one-time code (email or SMS) and sees their vouchers.
4. **Redeem.** At the café the customer scans the branch QR (`/r/<branchCode>`) and enters the bill amount. The
   cashier types the branch PIN on the customer's phone. The voucher is marked used and the branch gets an SMS.
   The café records it as POS payment type "Hosting.com Voucher".
5. **Receipt.** The customer uploads a photo of the café receipt, and support verifies it.
6. **Settlement.** Finance groups verified redemptions per partner into a settlement, a second person approves it,
   and it is marked paid.

## Who uses it

| Role | Signs in with | Does |
| --- | --- | --- |
| Customer | One-time code (email/SMS) | Submits invoices, holds vouchers, redeems, uploads receipts |
| Support | Email + password | Reviews requests, verifies receipts |
| Finance | Email + password | Builds and pays settlements per partner |
| Admin | Email + password | Manages campaigns, partners, branches, PINs and staff |
| Café cashier | No account | Types the branch PIN at redemption |

Staff help is built in at `/admin/help`. The public customer and café guide is at `/guide`.

## Tech stack

Next.js 15 (App Router), TypeScript, PostgreSQL 16, Prisma 7, Tailwind CSS, shadcn/ui, Zod.
Tests use Vitest and Playwright. SMS, email and file storage sit behind drivers that print to the console or
write locally in development.

## Local setup

Requirements: Node.js 22.18 or newer (24 recommended), npm, Docker.

```bash
npm install
cp .env.example .env          # defaults work for local development
npm run db:up                 # Postgres on localhost:5434
npm run db:migrate
npm run db:seed               # prints the staff passwords
npm run dev                   # http://localhost:3000
```

Seed data:

- Staff logins `admin@perks.local`, `support@perks.local` and `finance@perks.local` (passwords are printed by the seed).
- A test café branch at `/r/bean-gulshan` with PIN `1234`.

In development, SMS and email messages are printed in the server console instead of being sent.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test:db:up` | Start the test database (port 5435) |
| `npm test` | Unit and integration tests (resets the test database) |
| `npm run test:e2e` | Playwright end-to-end tests (resets the test database) |
| `npm run db:migrate -- --name <name>` | Create and apply a migration |
| `npm run staff:create` | Create a staff user from the command line |
| `npm run sms:test` / `npm run email:test` | Send a real test message through the configured provider |

## Project layout

```
src/app/(customer)/    customer pages (mobile-first)
src/app/(staff)/admin/ support, finance and admin pages
src/app/r/[branchCode] redemption entry, the target of the printed branch QR
src/server/services/   all business logic
src/server/providers/  SMS, email and storage drivers
src/lib/               shared utilities (money, time, schemas)
prisma/                schema, migrations, seed
tests/                 unit, integration and end-to-end tests
docs/                  deployment and operations guides
```

## Deployment

- [docs/DEPLOY.md](docs/DEPLOY.md): general deployment and environment variables
- [docs/DEPLOY-CPANEL.md](docs/DEPLOY-CPANEL.md): deploying to cPanel
- [docs/OPERATIONS.md](docs/OPERATIONS.md): cron jobs, backups and day-to-day operations
