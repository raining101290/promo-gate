# Upmind integration

Two HTTPS calls connect Upmind (hosting.com billing) with the Coffee Campaign app:

1. **Upmind → us, when an invoice is paid.** We issue the customer's coffee voucher and answer whether
   Upmind should send its "your voucher is ready" email.
2. **Us → Upmind, when that voucher is redeemed** at a café.

Both are authenticated with one shared secret (`UPMIND_SECRET`, 64 hex characters, exchanged privately,
never sent over the wire).

## The validated code

Every call carries `validatedCode`:

```
validatedCode = lowercase hex( HMAC-SHA256( key = UPMIND_SECRET, message = invoiceNumber + ":" + email ) )
```

`invoiceNumber` and `email` are the exact strings in the JSON body (no trimming or case changes).

Test vector:

| Input | Value |
| --- | --- |
| secret | `3f9a1c7e5b2d4f8a9c0e6b1d7a3f5c2e8b4d0a6c9e1f7b3d5a2c8e0f4b6d9a1c` |
| invoiceNumber | `INV-204518` |
| email | `tahmid.ahmed@example.com` |
| validatedCode | `da4fd3417ff36fee0cee7aa40dd400034c9b483eb65d3a07a3d55de0b512eeb9` |

```php
$validatedCode = hash_hmac('sha256', $invoiceNumber . ':' . $email, $secret);
```

```js
const validatedCode = crypto.createHmac("sha256", secret).update(`${invoiceNumber}:${email}`).digest("hex");
```

## 1. Paid invoice → voucher

`POST https://<app host>/api/integrations/upmind/vouchers` with `Content-Type: application/json`

| Field | Required | Format |
| --- | --- | --- |
| `customerName` | no | up to 120 characters |
| `email` | yes | the customer's email; they log in with it |
| `phone` | yes | Bangladeshi mobile: `01XXXXXXXXX` or `+8801XXXXXXXXX` |
| `invoiceNumber` | yes | 3–64 characters: letters, digits, `- / _ . #` |
| `validatedCode` | yes | see above |

```json
{
  "customerName": "Tahmid Ahmed",
  "email": "tahmid.ahmed@example.com",
  "phone": "01711234567",
  "invoiceNumber": "INV-204518",
  "validatedCode": "da4fd3417ff36fee0cee7aa40dd400034c9b483eb65d3a07a3d55de0b512eeb9"
}
```

### Responses

| HTTP | `status` | Meaning | Send the voucher email? |
| --- | --- | --- | --- |
| 201 | `issued` | Voucher created | **Yes** |
| 200 | `already_issued` | Same invoice sent before; nothing new created | Only if not sent yet |
| 202 | `pending_review` | Received, but our team must review it first (`reason` says why) | **No** |
| 200 | `rejected` | Our team reviewed this invoice earlier and declined it | No |
| 400 | `error` / `invalid_request` | Body isn't JSON or a field is missing (`fields` lists them) | No: fix and resend |
| 401 | `error` / `invalid_code` | `validatedCode` doesn't match | No: check the secret |
| 409 | `error` / `invoice_used` | This invoice already has a request with a different email | No |
| 422 | `error` / `invalid_fields` | A field has a bad value, e.g. a non-BD phone (`fields`, `message`) | No: fix and resend |
| 429 | `error` / `rate_limited` | Too many wrong codes from this IP (`Retry-After` header) | Later |
| 503 | `error` / `not_configured` | Integration switched off on our side | Retry later |

`201` / `200 already_issued` body:

```json
{
  "status": "issued",
  "invoiceNumber": "INV-204518",
  "voucher": { "offer": "৳500 off", "expiresAt": "2026-12-14T09:30:00.000Z" },
  "loginUrl": "https://<app host>/dashboard"
}
```

`202` body: `{ "status": "pending_review", "invoiceNumber": "...", "reason": "no_auto_campaign" | "contact_conflict" | "budget_exceeded" | "customer_limit_reached" | ..., "message": "..." }`

The email should go to the same `email` and link to `loginUrl`. The customer logs in there with a one-time
code sent to that email.

**Retries:** the call is idempotent per `invoiceNumber`. Resending the same body after a timeout or a
5xx is safe.

## 2. Redemption → Upmind

When a voucher from an Upmind invoice is redeemed, we `POST` JSON to the URL Upmind gives us
(`UPMIND_REDEMPTION_URL`, HTTPS):

```json
{
  "event": "voucher.redeemed",
  "invoiceNumber": "INV-204518",
  "validatedCode": "da4fd3417ff36fee0cee7aa40dd400034c9b483eb65d3a07a3d55de0b512eeb9",
  "redemption": {
    "reference": "R-49YE1Z",
    "redeemedAt": "2026-11-14T09:30:18.000Z",
    "cafe": "Demo Bean House",
    "branch": "Gulshan 2",
    "branchCode": "beanhouse-gulshan2",
    "currency": "BDT",
    "billAmount": "1000.00",
    "discountAmount": "500.00",
    "customerPaid": "500.00"
  },
  "voucher": { "offer": "৳500 off" }
}
```

- `validatedCode` is the one Upmind sent for this invoice. Check it by recomputing it from the invoice's
  number and email, or by comparing it with the value you stored.
- Amounts are decimal strings in taka. Times are ISO 8601 in UTC.
- Answer any **2xx within 10 seconds**. Anything else (or a timeout) is retried after 1, 5 and 30 minutes,
  then 2, 6, 12 and 24 hours: 8 attempts in total. After that our admins can resend it by hand.
- The same event can arrive more than once (e.g. you processed it but your reply timed out).
  De-duplicate on `redemption.reference`.

## Our side (operations)

- `.env`: `UPMIND_SECRET` (`openssl rand -hex 32`) and `UPMIND_REDEMPTION_URL`.
- Admin → **Campaigns**: mark one campaign **Use for Upmind**. Without one, paid invoices wait in Requests.
- Admin → **Upmind**: status, every call received, every callback with its result, and **Send again**.
- The hourly cron (`/api/cron/expire-vouchers`) also retries due callbacks.
- The public invoice form is off. `INVOICE_FORM=on` brings it back as a fallback.
