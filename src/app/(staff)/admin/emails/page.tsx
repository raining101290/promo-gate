import Link from "next/link";

import { HelpLink } from "@/components/staff/help-link";
import { selectClass } from "@/components/staff/form-styles";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EmailStatus } from "@/generated/prisma/client";
import { maskEmail } from "@/lib/phone";
import { redemptionRef } from "@/lib/redemption";
import { formatDhakaDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { emailSetup, listEmailLog } from "@/server/services/email-status";

export const metadata = { title: "Email" };

type Search = { email?: string; status?: string; purpose?: string; page?: string };

const STATUSES: EmailStatus[] = ["SENT", "FAILED"];
const PURPOSES: Record<string, string> = {
  otp: "Login code",
  customer_receipt: "Receipt link",
  expiry_reminder: "Expiry reminder",
  review: "Request decision",
};
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default async function EmailLogPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaffPage(PERMISSIONS.viewEmail, "/admin/emails");
  const sp = await searchParams;
  const emailInput = sp.email?.trim().slice(0, 254) ?? "";
  const email = EMAIL_RE.test(emailInput) ? emailInput.toLowerCase() : undefined;
  const status = STATUSES.includes(sp.status as EmailStatus) ? (sp.status as EmailStatus) : undefined;
  const purpose = sp.purpose && sp.purpose in PURPOSES ? sp.purpose : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const setup = emailSetup();
  const log = await listEmailLog({ email, status, purpose, page });
  const href = (p: number) => {
    const q = new URLSearchParams();
    if (emailInput) q.set("email", emailInput);
    if (status) q.set("status", status);
    if (purpose) q.set("purpose", purpose);
    q.set("page", String(p));
    return `/admin/emails?${q}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Email</h1>
          <HelpLink slug="email" />
        </div>
        <p className="text-muted-foreground text-sm">
          Every email the app sends. Search a customer&apos;s address when they say a login code never arrived.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4" data-testid="email-setup">
          <p className="text-muted-foreground text-xs font-medium uppercase">Sending from</p>
          {setup.from ? (
            <>
              <p className="truncate text-lg font-semibold" title={setup.from}>
                {setup.from}
              </p>
              <p className="text-muted-foreground text-xs">Provider: {setup.driver}</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">—</p>
              <p className="text-muted-foreground text-xs">Driver “{setup.driver}” (development): no real emails are sent.</p>
            </>
          )}
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-xs font-medium uppercase">Sent, last 24h</p>
          <p className="text-2xl font-semibold tabular-nums">{log.sent24h}</p>
        </div>
        <div className={cn("rounded-lg border p-4", log.failed24h > 0 && "border-red-300 bg-red-50 dark:bg-red-950/40")}>
          <p className="text-muted-foreground text-xs font-medium uppercase">Failed, last 24h</p>
          <p className="text-2xl font-semibold tabular-nums">{log.failed24h}</p>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-2" action="/admin/emails">
        <Input
          name="email"
          type="text"
          defaultValue={emailInput}
          placeholder="Customer email address"
          aria-label="Email address"
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
        {(emailInput || status || purpose) && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/emails">Clear</Link>
          </Button>
        )}
      </form>
      {emailInput && !email && <p className="text-destructive text-sm">“{emailInput}” isn&apos;t a complete email address.</p>}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time (Dhaka)</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provider reply</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {log.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                  No emails match these filters.
                </TableCell>
              </TableRow>
            )}
            {log.rows.map((r) => (
              <TableRow key={r.id} data-testid="email-row">
                <TableCell className="whitespace-nowrap">{formatDhakaDateTime(r.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs">{r.toEmail === "[deleted]" ? "[deleted]" : maskEmail(r.toEmail)}</TableCell>
                <TableCell>
                  {PURPOSES[r.purpose ?? ""] ?? r.purpose ?? "—"}
                  {r.redemptionId && <span className="text-muted-foreground block text-xs">{redemptionRef(r.redemptionId)}</span>}
                </TableCell>
                <TableCell className="max-w-xs text-sm break-words whitespace-normal">{r.subject}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
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
            Page {page} of {log.pages} · {log.total} emails
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
