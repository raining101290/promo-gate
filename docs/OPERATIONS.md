# Operations

## Voucher expiry + reminder job

`GET|POST /api/cron/expire-vouchers` (see `src/server/services/voucher-expiry.ts`):

- marks ACTIVE vouchers past `expiresAt` as EXPIRED (audited as `voucher.expired_batch`);
- sends one "expires in 3 days" SMS per voucher (claimed via `Voucher.reminderSentAt` before sending,
  so overlapping runs never double-send; vouchers whose whole validity is ≤ 3 days are skipped).

- retries Upmind redemption callbacks that are due (see docs/UPMIND-INTEGRATION.md).

It is idempotent: run it hourly. It needs `CRON_SECRET` (16+ chars) in the environment; without it the
route answers 503. Responses: `{ ok, expired, reminded, reminderFailures, ranAt, upmind: { attempted, sent } }`.

### Vercel Cron

`vercel.json` already schedules it hourly. Set `CRON_SECRET` in the project's environment variables:
Vercel sends it automatically as `Authorization: Bearer <CRON_SECRET>`. (Hobby plans only run crons
daily; use Pro for hourly, or the system cron below.)

### System cron (self-hosted)

```cron
# m h dom mon dow  — hourly, quiet unless it fails
0 * * * * curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://perks.example.com/api/cron/expire-vouchers >/dev/null || logger -t perks-cron "expire-vouchers failed"
```

Run manually: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/expire-vouchers`.

## Deployment checklist (security-relevant)

- `NODE_ENV=production`: cookies become `Secure`, HSTS is sent, console SMS/email and local storage refuse to run.
- `CLIENT_IP_HEADER`: IP rate limits trust this header. Use a header your proxy **overwrites**
  (Vercel: default is fine; nginx: `proxy_set_header X-Real-IP $remote_addr;` + `CLIENT_IP_HEADER=x-real-ip`).
- S3/R2 bucket CORS must allow `PUT` from `APP_URL` with `Content-Type`. The CSP allows the bucket origin
  automatically; if a CDN fronts it, set `CSP_STORAGE_ORIGIN`.
- `npm run check:auth` must pass (every API route has an auth check or a reviewed exemption).
