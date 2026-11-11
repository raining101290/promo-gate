import Link from "next/link";

import { selectClass } from "@/components/staff/form-styles";
import { HelpLink } from "@/components/staff/help-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActorType } from "@/generated/prisma/client";
import { dhakaDayStart, formatDhakaDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { AUDIT_PAGE_SIZE, listAuditLog } from "@/server/services/audit";

export const metadata = { title: "Audit log" };

type Search = {
  action?: string;
  actorType?: string;
  actor?: string;
  entityType?: string;
  entity?: string;
  from?: string;
  to?: string;
  page?: string;
};

const ACTOR_TYPES: ActorType[] = ["STAFF", "CUSTOMER", "SYSTEM"];
const clean = (s?: string, max = 80) => (s && s.length <= max && /^[\w.:@+-]+$/.test(s) ? s : undefined);

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaffPage(PERMISSIONS.viewAudit, "/admin/audit");
  const sp = await searchParams;
  const f = {
    action: clean(sp.action),
    actorType: ACTOR_TYPES.includes(sp.actorType as ActorType) ? (sp.actorType as ActorType) : undefined,
    actor: clean(sp.actor),
    entityType: clean(sp.entityType),
    entity: clean(sp.entity),
    from: sp.from && dhakaDayStart(sp.from) ? sp.from : undefined,
    to: sp.to && dhakaDayStart(sp.to) ? sp.to : undefined,
  };
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const toStart = f.to ? dhakaDayStart(f.to) : null;
  const data = await listAuditLog({
    action: f.action,
    actorType: f.actorType,
    actorId: f.actor,
    entityType: f.entityType,
    entityId: f.entity,
    from: f.from ? (dhakaDayStart(f.from) ?? undefined) : undefined,
    to: toStart ? new Date(toStart.getTime() + 24 * 60 * 60 * 1000) : undefined,
    page,
  });
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    return `/admin/audit?${q}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <HelpLink slug="audit-log" />
        </div>
        <p className="text-muted-foreground text-sm">Every state change and sensitive action, newest first. Read-only.</p>
      </div>

      <form action="/admin/audit" className="flex flex-wrap items-end gap-3" role="search">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">Action</span>
          <select name="action" defaultValue={f.action ?? ""} className={cn(selectClass, "w-60")}>
            <option value="">All actions</option>
            <optgroup label="Families">
              {data.families.map((a) => (
                <option key={a} value={a}>
                  {a}*
                </option>
              ))}
            </optgroup>
            <optgroup label="Exact">
              {data.actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">Actor type</span>
          <select name="actorType" defaultValue={f.actorType ?? ""} className={cn(selectClass, "w-32")}>
            <option value="">Any</option>
            {ACTOR_TYPES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">Staff member</span>
          <select name="actor" defaultValue={f.actor ?? ""} className={cn(selectClass, "w-44")}>
            <option value="">Anyone</option>
            {data.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.role.toLowerCase()})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">Entity</span>
          <select name="entityType" defaultValue={f.entityType ?? ""} className={cn(selectClass, "w-40")}>
            <option value="">Any type</option>
            {data.entityTypes.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">Entity id contains</span>
          <Input name="entity" defaultValue={f.entity} className="w-44 font-mono" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">From</span>
          <Input type="date" name="from" defaultValue={f.from} className="w-36" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">To</span>
          <Input type="date" name="to" defaultValue={f.to} className="w-36" />
        </label>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/audit">Clear</Link>
        </Button>
      </form>

      <p className="text-muted-foreground text-sm" data-testid="audit-total">
        {data.total} entries
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When (Dhaka)</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.id} className="align-top">
                <TableCell className="whitespace-nowrap tabular-nums">{formatDhakaDateTime(r.createdAt)}</TableCell>
                <TableCell className="text-sm">
                  <div>{r.actorName ?? r.actorType.toLowerCase()}</div>
                  <div className="text-muted-foreground font-mono text-xs">
                    {r.actorId === "anonymous" || r.actorId === "system" ? r.actorId : `…${r.actorId.slice(-6)}`}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs font-medium">{r.action}</TableCell>
                <TableCell className="text-sm">
                  <div>{r.entityType}</div>
                  <div className="text-muted-foreground font-mono text-xs">…{r.entityId.slice(-6)}</div>
                </TableCell>
                <TableCell className="max-w-md">
                  <details>
                    <summary className="text-muted-foreground cursor-pointer truncate font-mono text-xs">{JSON.stringify(r.meta)}</summary>
                    <pre className="bg-muted mt-1 max-h-64 overflow-auto rounded p-2 text-xs">{JSON.stringify(r.meta, null, 2)}</pre>
                  </details>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {Math.min(page, data.pages)} of {data.pages} · {AUDIT_PAGE_SIZE} per page
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={href(page - 1)}>Previous</Link>
            </Button>
          )}
          {page < data.pages && (
            <Button asChild variant="outline" size="sm">
              <Link href={href(page + 1)}>Next</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
