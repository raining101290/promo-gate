"use client";

import { useState, type FormEvent } from "react";

import { selectClass } from "@/components/staff/form-styles";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Role = "SUPPORT" | "FINANCE" | "ADMIN";
export type StaffValues = { name: string; email: string; role: Role };

export const ROLE_HELP: Record<Role, string> = {
  SUPPORT: "Reviews invoices and verifies redemptions",
  FINANCE: "Partner payouts and settlements",
  ADMIN: "Everything, including campaigns, partners and staff",
};

type Result = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

/** Name / email / role fields shared by the Add and Edit dialogs. */
export function StaffForm({
  initial,
  submitLabel,
  roleLockedReason,
  onSubmit,
  onCancel,
}: {
  initial: StaffValues;
  submitLabel: string;
  /** When set, the role can't be changed here (yourself / last admin); shown as the hint. */
  roleLockedReason?: string;
  onSubmit: (v: StaffValues) => Promise<Result>;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    try {
      const r = await onSubmit(v);
      if (!r.ok) setErrors({ ...(r.fieldErrors ?? {}), form: r.fieldErrors ? "" : (r.error ?? "Something went wrong.") });
    } catch {
      setErrors({ form: "Network error. Try again." });
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="staff-name">Name</Label>
        <Input id="staff-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-invalid={!!errors.name} autoFocus />
        {errors.name && <p className="text-destructive text-xs">{errors.name}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-email">Work email</Label>
        <Input id="staff-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} aria-invalid={!!errors.email} />
        {errors.email ? (
          <p className="text-destructive text-xs">{errors.email}</p>
        ) : (
          <p className="text-muted-foreground text-xs">They sign in with this email.</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-role">Role</Label>
        <select
          id="staff-role"
          className={selectClass}
          value={v.role}
          disabled={!!roleLockedReason}
          onChange={(e) => setV({ ...v, role: e.target.value as Role })}
        >
          <option value="SUPPORT">Support</option>
          <option value="FINANCE">Finance</option>
          <option value="ADMIN">Admin</option>
        </select>
        <p className="text-muted-foreground text-xs">{roleLockedReason ?? ROLE_HELP[v.role]}</p>
      </div>
      {errors.form && (
        <p className="text-destructive text-sm" role="alert">
          {errors.form}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !v.name.trim() || !v.email.trim()} data-testid="staff-save">
          {pending ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export async function sendJson(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json()) as Result & { password?: string };
}
