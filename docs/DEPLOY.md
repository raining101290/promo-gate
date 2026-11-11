# Deploying Hosting.com Perks

Target: **Vercel** (app, region `sin1` Singapore) + **Neon** or **Supabase** Postgres (Singapore) +
**Cloudflare R2** (receipt photos) + a Bangladeshi SMS gateway. A Dockerfile is included for a VPS
instead (see the end).

Singapore is the closest region with first-class support on all three; app ↔ DB in the same region
matters more than app ↔ user (one user round trip, several DB round trips per request).

---

## 1. Environment variables

Set these in Vercel → Project → Settings → Environment Variables (Production, and Preview with
separate values). Never reuse dev secrets.

| Variable | Required | Value / notes |
|---|---|---|
| `APP_URL` | yes | `https://perks.hosting.com`. Used in SMS/email links and the standee QR. Set **before** printing standees. |
| `SESSION_SECRET` | yes | `openssl rand -base64 48`. Also keys the OTP hashes; rotating it logs everyone out and invalidates codes already sent. |
| `DATABASE_URL` | yes | **Pooled** URL. Neon: the `-pooler` host. Supabase: Supavisor port **6543**, `?pgbouncer=true`. |
| `DIRECT_DATABASE_URL` | yes | **Direct** URL (Neon non-pooler host / Supabase port 5432). Only migrations and admin scripts use it. |
| `DB_POOL_MAX` | no | Connections per serverless instance. Default `5`. |
| `CRON_SECRET` | yes | `openssl rand -hex 24`. Vercel Cron sends it automatically. |
| `OTP_CHANNELS` | no | `EMAIL` (default): login codes by email only. `EMAIL,SMS` lets customers choose SMS too (needs a working SMS gateway). |
| `SMS_DRIVER` | yes | `bulksmsbd`, or `off` while there is no SMS gateway (branch alerts and customer SMS are then skipped; customers still get emails). |
| `SMS_API_KEY`, `SMS_SENDER_ID` | yes | From the BulkSMSBD panel (sender ID e.g. `Hosting.com`). See §6. |
| `SMS_API_URL` | no | Default `https://bulksmsbd.net/api/smsapi` (always HTTPS: the key is in the request). |
| `SMS_LOW_BALANCE` | no | Credit (taka) below which Admin → SMS shows a warning. Default `200`. |
| `EMAIL_DRIVER` | yes | `resend`. Login codes are email-only (`OTP_CHANNELS=EMAIL`), so **nobody can log in without it**. |
| `RESEND_API_KEY` | yes | Resend → API Keys. Use a **Sending access** key restricted to the sending domain. |
| `EMAIL_FROM` | yes | e.g. `Hosting.com Perks <perks@mail.hosting.com>`. The domain must be **verified** in Resend (see §6b). |
| `EMAIL_REPLY_TO` | no | Where customer replies go, e.g. `support@hosting.com`. |
| `STORAGE_DRIVER` | yes | `s3` |
| `STORAGE_BUCKET` | yes | e.g. `perks-receipts` |
| `STORAGE_ENDPOINT` | yes | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `STORAGE_REGION` | yes | `auto` |
| `STORAGE_FORCE_PATH_STYLE` | yes | `true` (keeps the CSP origin a single host) |
| `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | yes | R2 API token scoped to **this bucket**, Object Read & Write. |
| `STORAGE_SIGNED_URL_TTL` | no | Staff receipt link lifetime, seconds. Default `300`. |
| `CLIENT_IP_HEADER` | no | Leave empty on Vercel (platform sets `x-forwarded-for`). |
| `CSP_STORAGE_ORIGIN` | no | Only if a CDN/custom domain fronts the bucket. |

`NODE_ENV=production` is set by Vercel: it turns on `Secure` cookies and HSTS, and makes the
console/file/local drivers refuse to start (so a missing variable fails loudly instead of logging OTPs).

## 2. Database (Neon or Supabase, Singapore)

**Neon**: create the project in **AWS Asia Pacific (Singapore)**. Copy both connection strings
(pooled → `DATABASE_URL`, direct → `DIRECT_DATABASE_URL`).
**Supabase**: create in **Southeast Asia (Singapore)**. Project Settings → Database: transaction pooler
(6543) → `DATABASE_URL`; direct (5432) → `DIRECT_DATABASE_URL`.

### Migrations

Run from a trusted machine or CI, **never** from the Vercel build (a failed build would leave the DB
half-migrated with the old app still serving):

```bash
DIRECT_DATABASE_URL='postgresql://…direct…' DATABASE_URL="$DIRECT_DATABASE_URL" npm run db:deploy   # = prisma migrate deploy
```

Deploy order for schema changes: **migrate first, then deploy the app**. Migrations here are
additive; if you ever write a destructive one, ship it in two releases (stop using the column, then drop it).

`npm run db:migrate` / `prisma migrate reset` / `npm run db:seed` are development commands. `prisma/seed.ts`
refuses to run with `NODE_ENV=production`.

### First admin (production seed)

```bash
DATABASE_URL='…direct…' ADMIN_EMAIL=you@hosting.com ADMIN_NAME="Your Name" npm run db:seed-admin
```

Creates the first ADMIN only (no demo data) and prints a one-time password; they must choose their
own password at first sign-in. It does nothing if an admin already exists.

All other staff are managed in the app: **Admin → Staff** (add with a one-time password, change role,
deactivate, reset password). `npm run staff:create` remains as a CLI fallback.

## 3. Cloudflare R2

1. Create bucket `perks-receipts` (location hint: **Asia Pacific**). Keep it **private** (no public bucket URL, no custom domain needed).
2. R2 → Manage API tokens → create a token with **Object Read & Write** on this bucket only.
3. Bucket → Settings → **CORS policy** (browsers upload directly with presigned PUTs):

```json
[
  {
    "AllowedOrigins": ["https://perks.hosting.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

Add Preview deployment origins separately if you test uploads there. The CSP picks up the bucket
origin automatically from `STORAGE_ENDPOINT`.

## 4. Vercel

1. Import the repo. Framework: Next.js. Build command `npm run build`; install `npm ci` (its
   postinstall runs `prisma generate` and copies the QR-scanner wasm into `public/vendor`).
2. `vercel.json` pins functions to **`sin1`** and registers the cron.
3. Set the env vars (§1), run migrations (§2), deploy.
4. Smoke test:
   ```bash
   curl -s https://perks.hosting.com/api/health          # {"ok":true,"db":"ok",...}
   curl -sI https://perks.hosting.com/login | grep -iE 'content-security-policy|strict-transport'
   ```
   Then: log in as admin, create a partner + branch (note the PIN), print the standee, and do one real
   redemption end to end with a test invoice.

## 5. Cron (voucher expiry + reminders)

`vercel.json` schedules `/api/cron/expire-vouchers` hourly; Vercel sends `Authorization: Bearer $CRON_SECRET`.

- **Vercel Hobby** only runs crons once per day (the hourly schedule is rounded). That is acceptable
  (expired vouchers are already refused at redeem time; the job only updates status and sends
  reminders), or use Pro, or schedule it from GitHub Actions:

```yaml
# .github/workflows/cron.yml
on: { schedule: [{ cron: "7 * * * *" }], workflow_dispatch: {} }
jobs:
  expire:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://perks.hosting.com/api/cron/expire-vouchers
```

The job is idempotent and reminders are claimed before sending, so overlapping or repeated runs are safe.
Details and a system-cron line: `docs/OPERATIONS.md`.

## 6. SMS gateway: sender ID approval (Bangladesh)

- A **masking sender ID** (customers see `HOSTINGCOM` instead of a number) must be approved before use.
  In Bangladesh the gateway/aggregator submits it to the mobile operators under BTRC rules; expect
  **several working days to a few weeks**. Typical paperwork: trade license, a company letter on letterhead, NID of the
  signatory, and sample message texts. **Start this first**: it is usually the longest lead-time item.
- Until approved, send from the gateway's **non-masking** number (OTPs work but look less trustworthy).
- Register our message templates with the gateway if it requires it: OTP, branch confirmation,
  receipt reminder, expiry reminder (texts in `src/lib/sms-text.ts`, all ASCII ≤160 chars = 1 segment).
- Ask for the **transactional/OTP route**, not promotional: promotional routes can be blocked by
  DND/quiet-hour rules, and OTPs must arrive at the café counter any time.
- Gateway: **BulkSMSBD** (`BulkSmsBdDriver` in `src/server/providers/sms.ts`). Fields `api_key`, `type=text`,
  `number` as `8801…`, `senderid`, `message`; success is `response_code` 202, every other code is mapped to a
  readable error (permanent errors such as 1001/1007/1032 are not retried). Credit is shown on **Admin → SMS**.
- ⚠ **IP whitelist.** BulkSMSBD only accepts sends from whitelisted server IPs (code `1032` otherwise). Whitelist
  the production server's **public outbound IP** in the BulkSMSBD panel. Vercel functions have no fixed outbound IP
  unless your plan includes Vercel **Static IPs**; otherwise send from the Docker/VPS deployment (fixed IP), or ask
  BulkSMSBD to lift the IP restriction for this API key. Login by SMS does not work until this is done.
- Verify from the server itself: `npm run sms:test` (credit) then `npm run sms:test -- 01XXXXXXXXX` (one real SMS).
  Watch Admin → SMS for FAILED rows after launch.
- Budget alert: set a low-balance alert at the gateway; failed sends are retried twice, then logged.

## 6b. Email (Resend)

1. Resend → **Domains** → add a sending subdomain such as `mail.hosting.com` (a subdomain keeps Perks' sending
   reputation separate from staff mail). Region: closest available to Bangladesh.
2. Add the DNS records Resend shows (SPF `TXT`, DKIM `TXT`/`CNAME`, MX for bounces) at the DNS host, wait for **Verified**.
   Also add a DMARC record for the domain if hosting.com doesn't have one (`v=DMARC1; p=none; rua=mailto:...` to start).
3. Resend → **API Keys** → create a key with **Sending access**, limited to that domain → `RESEND_API_KEY`.
4. Test from a trusted machine: `npm run email:test -- you@hosting.com`. Until the domain is verified, Resend only
   delivers to your own Resend login address (error 403 otherwise).
5. After launch, failed sends show in the server logs as `[email] failed ...` and in Resend → **Emails / Logs**.
   Login codes are mostly opened within a minute: if customers report missing codes, check spam placement and DMARC.

## 7. Backups

| What | How | Schedule | Retention |
|---|---|---|---|
| Postgres, point-in-time | Neon history / Supabase PITR (plan feature; enable it) | continuous | 7 days minimum |
| Postgres, logical copy | `pg_dump --format=custom` of the **direct** URL → separate R2 bucket `perks-backups` (different API token) | nightly 03:00 Dhaka | 30 daily + 12 monthly |
| Receipt photos (R2) | `rclone sync` to a second bucket/account | weekly | keep until the redemption's settlement is ≥ 2 years old |
| Restore drill | restore the latest dump into a scratch Neon branch, run `/api/health`, spot-check a settlement total | quarterly | — |

Accounting data (redemptions, settlements, audit log) must stay restorable: settlements are the
basis of partner payments. Customer deletion only scrubs PII; it never removes those rows.

## 8. Ongoing checks

- CI (`.github/workflows/ci.yml`) must pass: typecheck, lint, `check:auth`, unit + E2E tests, production build.
- Watch: `/api/health` (uptime monitor, 1 min), `SmsLog` FAILED rate, the "No receipt 24h+" tab, and fraud badges.
- Rotate `SESSION_SECRET`, `CRON_SECRET` and the R2/SMS keys if a laptop or CI secret leaks.

---

## Alternative: VPS with Docker

```bash
docker build -t perks .
docker build -t perks-migrate --target migrate .
docker run --rm --env-file .env.production perks-migrate          # prisma migrate deploy (direct URL)
docker run -d --name perks -p 127.0.0.1:3000:3000 --env-file .env.production --restart unless-stopped perks
```

- Put nginx/Caddy in front for TLS, set `proxy_set_header X-Real-IP $remote_addr;` and
  `CLIENT_IP_HEADER=x-real-ip` (IP rate limits depend on it).
- `DATABASE_URL` can be the direct URL with a larger `DB_POOL_MAX` (e.g. 10) on a long-running server.
- Cron: the system-cron line in `docs/OPERATIONS.md`.
- The image has a `HEALTHCHECK` on `/api/health`.
