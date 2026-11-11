import Link from "next/link";

import { HelpLink } from "@/components/staff/help-link";
import { selectClass } from "@/components/staff/form-styles";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SmsStatus } from "@/generated/prisma/client";
import { maskPhone, normalizeBdPhone } from "@/lib/phone";
import { redemptionRef } from "@/lib/redemption";
import { formatDhakaDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { getSmsBalance, listSmsLog, SMS_LOW_BALANCE } from "@/server/services/sms-status";

export const metadata = { title: "SMS" };

type Search = { phone?: string; status?: string; purpose?: string; page?: string };

const STATUSES: SmsStatus[] = ["SENT", "FAILED"];
const PURPOSES: Record<string, string> = {
  otp: "Login code",
  branch_redemption: "Branch alert",
  customer_receipt: "Receipt link",
  expiry_reminder: "Expiry reminder",
  review: "Review",
};
const taka = (n: number) => `৳${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function SmsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaffPage(PERMISSIONS.viewSms, "/admin/sms");
  const sp = await searchParams;
  const phoneInput = sp.phone?.trim().slice(0, 20) ?? "";
  const phone = phoneInput ? (normalizeBdPhone(phoneInput) ?? undefined) : undefined;
  const status = STATUSES.includes(sp.status as SmsStatus) ? (sp.status as SmsStatus) : undefined;
  const purpose = sp.purpose && sp.purpose in PURPOSES ? sp.purpose : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [balance, log] = await Promise.all([getSmsBalance(), listSmsLog({ phone, status, purpose, page })]);
  const href = (p: number) => {
    const q = new URLSearchParams();
    if (phoneInput) q.set("phone", phoneInput);
    if (status) q.set("status", status);
    if (purpose) q.set("purpose", purpose);
    q.set("page", String(p));
    return `/admin/sms?${q}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">SMS</h1>
          <HelpLink slug="sms" />
        </div>
        <p className="text-muted-foreground text-sm">
          Gateway credit and every SMS attempt. Search a customer&apos;s number when they say a code never arrived.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div
          className={cn("rounded-lg border p-4", balance.kind === "ok" && balance.low && "border-amber-400 bg-amber-50 dark:bg-amber-950/40")}
          data-testid="sms-balance"
        >
          <p className="text-muted-foreground text-xs font-medium uppercase">Gateway credit</p>
          {balance.kind === "ok" ? (
            <>
              <p className="text-2xl font-semibold tabular-nums">{taka(balance.taka)}</p>
              <p className="text-muted-foreground text-xs">
                {balance.low ? `Low: below ${taka(SMS_LOW_BALANCE)}. Top up so login codes keep working.` : `Provider: ${balance.provider}`}
              </p>
            </>
          ) : balance.kind === "unsupported" ? (
            <>
              <p className="text-lg font-semibold">—</p>
              <p className="text-muted-foreground text-xs">Driver “{balance.provider}” (development): no real SMS are sent.</p>
            </>
          ) : (
            <>
              <p className="text-destructive text-lg font-semibold">Unavailable</p>
              <p className="text-muted-foreground text-xs break-words">{balance.message}</p>
            </>
          )}
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs font-medium uppercase">Sent, last 24h</p>
          <p className="text-2xl font-semibold tabular-nums">{log.sent24h}</p>
        </div>
        <div className={cn("rounded-lg border p-4", log.failed24h > 0 && "border-red-300 bg-red-50 dark:bg-red-950/40")}>
          <p className="text-muted-foreground text-xs font-medium uppercase">Failed attempts, last 24h</p>
          <p className="text-2xl font-semibold tabular-nums">{log.failed24h}</p>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2" action="/admin/sms">
        <Input
          name="phone"
          defaultValue={phoneInput}
          placeholder="Customer or branch number 01XXXXXXXXX"
          aria-label="Phone number"
          className="h-9 w-72"
        />
        <select name="status" defaultValue={status ?? ""} className={cn(selectClass, "h-9 w-36")} aria-label="Status">
          <option value="">Any status</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
        </select>
        <select name="purpose" defaultValue={purpose ?? ""} className={cn(selectClass, "h-9 w-44")} aria-label="Type">
          <option value="">Any type</option>
          {Object.entries(PURPOSES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Filter
        </Button>
        {(phoneInput || status || purpose) && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/sms">Clear</Link>
          </Button>
        )}
      </form>
      {phoneInput && !phone && <p className="text-destructive text-sm">“{phoneInput}” isn&apos;t a valid BD mobile number.</p>}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time (Dhaka)</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Try</TableHead>
              <TableHead>Gateway reply</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {log.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                  No SMS match these filters.
                </TableCell>
              </TableRow>
            )}
            {log.rows.map((r) => (
              <TableRow key={r.id} data-testid="sms-row">
                <TableCell className="whitespace-nowrap">{formatDhakaDateTime(r.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs">{maskPhone(r.toPhone)}</TableCell>
                <TableCell>
                  {PURPOSES[r.purpose ?? ""] ?? r.purpose ?? "—"}
                  {r.redemptionId && <span className="text-muted-foreground block text-xs">{redemptionRef(r.redemptionId)}</span>}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="tabular-nums">{r.attempt}</TableCell>
                <TableCell className="max-w-md text-xs break-words whitespace-normal">
                  {r.error ?? (
                    <span className="text-muted-foreground">
                      {r.provider}
                      {r.providerRef ? ` · ${r.providerRef}` : ""}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {log.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {log.pages} · {log.total} attempts
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={href(page - 1)}>Previous</Link>
              </Button>
            )}
            {page < log.pages && (
              <Button asChild variant="outline" size="sm">
                <Link href={href(page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
