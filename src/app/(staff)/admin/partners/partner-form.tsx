"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { selectClass } from "@/components/staff/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PartnerFormValues = {
  name: string;
  contactName: string;
  contactPhone: string;
  payoutMethod: "BANK" | "BKASH";
  payoutAccount: string;
  contractStatus: "ACTIVE" | "PAUSED" | "ENDED";
};
type Errors = Partial<Record<keyof PartnerFormValues | "form", string>>;

export function PartnerForm({ initial, partnerId }: { initial: PartnerFormValues; partnerId?: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof PartnerFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSaved(false);
    setV((p) => ({ ...p, [k]: e.target.value }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      partnerId &&
      v.contractStatus !== initial.contractStatus &&
      v.contractStatus !== "ACTIVE" &&
      !window.confirm(`Set contract to ${v.contractStatus}? All of this partner's branches will stop accepting vouchers.`)
    ) {
      return;
    }
    setPending(true);
    setErrors({});
    try {
      const res = await fetch(partnerId ? `/api/admin/partners/${partnerId}` : "/api/admin/partners", {
        method: partnerId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = (await res.json()) as { ok: boolean; id?: string; error?: string; fieldErrors?: Errors };
      if (data.ok) {
        if (partnerId) {
          setSaved(true);
          router.refresh();
        } else {
          router.push(`/admin/partners/${data.id}`);
        }
      } else {
        setErrors({ ...(data.fieldErrors ?? {}), form: data.error });
      }
    } catch {
      setErrors({ form: "Network error. Try again." });
    }
    setPending(false);
  }

  const field = (k: keyof PartnerFormValues, label: string, control: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      {control}
      {errors[k] ? <p className="text-destructive text-xs">{errors[k]}</p> : hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
  const input = (k: keyof PartnerFormValues, props: React.ComponentProps<typeof Input> = {}) => (
    <Input id={k} value={v[k]} onChange={set(k)} aria-invalid={!!errors[k]} {...props} />
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {field("name", "Partner name", input("name", { placeholder: "e.g. North End Coffee" }))}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("contactName", "Contact person", input("contactName"))}
        {field("contactPhone", "Contact phone", input("contactPhone", { inputMode: "tel", placeholder: "01XXXXXXXXX" }))}
      </div>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        {field(
          "payoutMethod",
          "Payout method",
          <select id="payoutMethod" className={selectClass} value={v.payoutMethod} onChange={set("payoutMethod")}>
            <option value="BANK">Bank transfer</option>
            <option value="BKASH">bKash</option>
          </select>,
        )}
        {field(
          "payoutAccount",
          v.payoutMethod === "BKASH" ? "bKash number" : "Bank account",
          input("payoutAccount", {
            placeholder: v.payoutMethod === "BKASH" ? "01XXXXXXXXX" : "Bank, branch, account name and number",
            inputMode: v.payoutMethod === "BKASH" ? "tel" : "text",
          }),
        )}
      </div>
      {field(
        "contractStatus",
        "Contract status",
        <select id="contractStatus" className={selectClass} value={v.contractStatus} onChange={set("contractStatus")}>
          <option value="ACTIVE">Active: branches accept vouchers</option>
          <option value="PAUSED">Paused: no redemptions for now</option>
          <option value="ENDED">Ended</option>
        </select>,
      )}
      {errors.form && (
        <p className="text-destructive text-sm" role="alert">
          {errors.form}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : partnerId ? "Save partner" : "Create partner"}
        </Button>
        {saved && <span className="text-muted-foreground text-sm">Saved</span>}
      </div>
    </form>
  );
}
