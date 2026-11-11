# Hosting.com Perks

Promotion app: hosting.com customers submit a paid invoice; support issues a single-use, expiring QR voucher,
redeemed at partner cafés in Bangladesh (customer scans the branch QR, enters the bill, cashier types the
branch PIN on the customer's phone; the café records it as POS payment type "Hosting.com Voucher").

## Actors
- **customer**: OTP login (email or SMS). Submits invoices, holds vouchers, redeems, uploads receipts.
- **support**: reviews OfferRequests and verifies redemption receipts.
- **finance**: builds Settlements per partner and marks them paid.
- **admin**: manages campaigns, partners, branches, PINs and staff users.
- Coffee shop staff have **no accounts**. Their only touchpoint is the branch PIN.

## Core flow
1. Customer submits invoice number + email + phone -> `OfferRequest` (PENDING).
2. Support approves or rejects. On approve, a `Voucher` is issued from a `Campaign`.
3. Customer logs in with OTP and sees active vouchers.
4. Customer scans the branch QR (`/r/[branchCode]`), enters the bill amount, and the cashier enters
   the branch PIN -> `Redemption` created, voucher marked REDEEMED, SMS sent to the branch.
5. Customer uploads a receipt photo. 6. Support verifies; finance settles per partner and marks it PAID.

## Domain rules
- Voucher: FIXED (min(value, bill)) or PERCENT (min(floor(bill*bp/10000), cap, bill)); minBill enforced.
- Redeem = `services/redemptions.ts` (preview/confirm): one tx, branch row `FOR SHARE`, `transitionVoucher`
  ACTIVE->REDEEMED with guards. 5 wrong PINs/15 min -> `Voucher.pinLockedUntil`. Discount: `computeDiscount`.
- Branch PINs: server-generated (`services/branches.ts`), bcrypt-hashed, shown once; rate-limit attempts.
- Only active branches of ACTIVE-contract partners redeem: use `findRedeemableBranch()`. `branchCode` is immutable.
- Settlements (`services/settlements.ts`): draft attaches VERIFIED+unsettled redemptions (partner row locked,
  conditional attach). Creator can't approve (four-eyes). PAID is immutable. All via `transitionSettlement`.

## Stack
Next.js 15 App Router, TS strict, Postgres, Prisma 7, Tailwind, shadcn/ui, Zod, jose, qrcode, S3. Tests: Vitest + Playwright.

## Money and time
- Money is **integer paisa** (1 BDT = 100). No floats/`Decimal`. Format at the edge (`formatBDT` in `lib/money.ts`).
- Percentages are stored as integer basis points (e.g. 15% = 1500). Round with an explicit rule.
- All timestamps are stored in **UTC**. Display them in **Asia/Dhaka** via helpers in `src/lib/time.ts`.
  Never call `toLocaleString()` without an explicit timeZone.

## Folder layout
```
src/
  app/
    (customer)/          # customer pages: mobile-first
    (staff)/admin/       # support/finance/admin pages: desktop-first tables
    r/[branchCode]/      # redemption entry (target of the printed branch QR)
  server/
    db.ts                # Prisma client singleton (import { db } from "@/server/db")
    auth/                # jose sessions, OTP, role guards
    services/            # ALL business logic (*.ts)
    providers/           # SMS, email, storage interfaces + drivers
  lib/                   # pure, shared utils (money, time, zod schemas)
  components/            # UI components (shadcn/ui new-york style in components/ui)
  generated/prisma/      # generated Prisma client (gitignored; never edit)
prisma/                  # schema.prisma, migrations, seed.ts
prisma7.config.ts        # Prisma 7 config (schema path, seed cmd, DATABASE_URL)
```

## Prisma 7 notes
- Pinned to 7.10.x. npm `latest` is Prisma 8 RC, so always install `prisma@7` / `@prisma/client@7`.
- Generator `prisma-client` -> `src/generated/prisma`; import `@/generated/prisma/client`; needs `PrismaPg` adapter.
- Config lives in `prisma7.config.ts` (the 7.10+ name). The datasource URL is set there, not in the schema.
- `DateTime` columns are `timestamp` WITHOUT time zone holding UTC. In raw SQL, convert with
  `("col" at time zone 'UTC') at time zone 'Asia/Dhaka'`; a single `at time zone` shifts the wrong way.

## Auth
- Customer: OTP (`services/otp.ts`), cookie `perks_session`, 30 days. Staff: bcrypt
  password (`/api/admin/login`), separate cookie `perks_staff_session`, 12 h. Edge-safe JWT code in
  `server/auth/token.ts` (used by middleware); cookies in `server/auth/session.ts`.
- Staff authz: `requireStaff(PERMISSIONS.x)` in route handlers (`withStaff` -> 401/403 JSON),
  `requireStaffPage` in pages. Re-reads StaffUser (active, role, `sessionVersion` vs JWT `sv`,
  `mustChangePassword`) every call. Staff admin: `/admin/staff`, `services/staff.ts` (last-admin guard).
- Public forms never modify an existing Customer's email/phone (prevents OTP takeover). OTPs go only to
  a contact the customer already owns. IP rate limits use `src/server/rate-limit.ts` (DB-backed).
- Vouchers snapshot campaign terms (`offerType/value/maxDiscount/minBill/faceValue`); always read terms
  from the voucher. Budgets sum `faceValue`. Approval locks Campaign row, then OfferRequest row.

## Architecture conventions
- **Business logic lives in `src/server/services/*.ts`.** Server actions and route handlers stay
  thin: parse input, resolve the session, call one service, map the result to a response.
- **Every mutation validates input with Zod and checks the caller's role** (`requireStaff`). Never trust
  client-supplied ids for ownership; re-check them in the service.
- **Single entry point per state machine.** All state changes to `Voucher`, `Redemption` and
  `Settlement` go through one service function each (e.g. `transitionVoucher`,
  `transitionRedemption`, `transitionSettlement`), inside a Prisma `$transaction`. No other code
  writes those status fields.
- Side effects fire only after commit (redeem: `after(notifyRedemption)`). SMS only via `sendSms()`: retries,
  one SmsLog row per attempt, ASCII <=160 chars (`lib/sms-text.ts`). Redemption status: `transitionRedemption`.
- **External providers sit behind interfaces** in `src/server/providers`
  (`SmsProvider`, `EmailProvider`, `StorageProvider`). Each has a console/local driver for dev,
  selected by env var. Services depend on the interface, never on a vendor SDK.
- Server-only modules import `"server-only"`. Client components never import from `src/server`.
- Zod schemas shared by forms and actions live in `src/lib/schemas`.

## UI conventions
- Customer pages **mobile-first** (~360px, big taps); staff pages desktop-first shadcn tables. Staff help `/admin/help` = `src/lib/help/articles.ts`; update with behaviour changes (`tests/unit/help.test.ts`).

## Security
- OTPs are short-lived, hashed, attempt-limited and single-use.
- Receipts: browser PUTs to a presigned URL (type+length signed); server sniffs magic bytes; staff view only
  via `/api/admin/redemptions/[id]/receipt` (audited, short-lived URL). Local driver = HMAC-signed URLs.
- Never log OTPs, PINs, tokens, full phones or raw error objects (log `err.message`). Print: `@page` in mm.
- Rate limits: only via `limit(policy, subject)` with policies in `RATE_LIMITS` (`src/server/rate-limit.ts`).
- Customer pages/routes use `getCustomerSession()` (DB-checked, not deleted), never the bare JWT.
- Never select `pinHash`/`smsPhone` for pages; staff queries use `omit: { pinHash: true }`.
- CSP: per-request nonce in `src/middleware.ts` (no unsafe-eval in prod; Zod runs jitless). New
  `api/**` routes must pass `npm run check:auth`. Cron + deploy notes: `docs/OPERATIONS.md`.

## Commands
- `db:up`/`db:down` (Postgres 16, host port **5434**), `db:migrate -- --name <n>`, `db:generate`, `db:seed` (prints staff passwords)
- `dev`, `build`, `typecheck`, `lint`. Seed: staff `admin|support|finance@perks.local`, PIN `1234`, `/r/bean-gulshan`.
- `test:db:up` (Postgres :5435, `_test`) then `test` / `test:e2e` (both RESET it). CI `.github/workflows/ci.yml` (deploys main to cPanel: `deploy/cpanel/`, `docs/DEPLOY-CPANEL.md`).

## Definition of done
A task is done only when ALL of these hold:
1. `npm run typecheck` passes.
2. `npm run lint` passes.
3. The feature has been exercised once end-to-end (UI, HTTP call, or script against the dev DB with
   console providers), and the output is shown (logs, response, console SMS/email, or DB rows).
