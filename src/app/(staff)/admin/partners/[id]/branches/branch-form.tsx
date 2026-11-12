"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PinRevealDialog } from "@/components/staff/pin-reveal-dialog";
import { textareaClass } from "@/components/staff/form-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestBranchCode } from "@/lib/slug";

export type BranchFormValues = { name: string; area: string; address: string; smsPhone: string; active: boolean };
type Errors = Partial<Record<keyof BranchFormValues | "branchCode" | "form", string>>;

/**
 * Create (shows the one-time PIN afterwards) or edit. branchCode is only settable on create;
 * on edit it is shown read-only because it's printed on the standee QR.
 */
export function BranchForm({
  partnerId,
  partnerName,
  initial,
  branchId,
  branchCode,
}: {
  partnerId: string;
  partnerName: string;
  initial: BranchFormValues;
  branchId?: string;
  branchCode?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{ pin: string; name: string } | null>(null);

  const editing = !!branchId;
  const suggestion = suggestBranchCode(partnerName, v.name || "branch");
  const set = (k: keyof BranchFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setV((p) => ({ ...p, [k]: k === "active" ? (e.target as HTMLInputElement).checked : e.target.value }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (editing && initial.active && !v.active && !window.confirm("Deactivate this branch? It will stop accepting vouchers immediately.")) return;
    setPending(true);
    setErrors({});
    try {
      const res = await fetch(editing ? `/api/admin/branches/${branchId}` : `/api/admin/partners/${partnerId}/branches`, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? v : { name: v.name, area: v.area, address: v.address, smsPhone: v.smsPhone, branchCode: code || undefined }),
      });
      const data = (await res.json()) as { ok: boolean; pin?: string; error?: string; fieldErrors?: Errors; branch?: { name: string } };
      if (!data.ok) setErrors({ ...(data.fieldErrors ?? {}), form: data.error });
      else if (!editing && data.pin) setCreated({ pin: data.pin, name: data.branch?.name ?? v.name });
      else {
        toast.success(initial.active && !v.active ? "Branch saved and deactivated. It no longer accepts vouchers." : "Branch saved.");
        router.refresh();
      }
    } catch {
      setErrors({ form: "Network error. Try again." });
    }
    setPending(false);
  }

  const field = (k: keyof Errors, label: string, control: React.ReactNode, hint?: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      {control}
      {errors[k] ? <p className="text-destructive text-xs">{errors[k]}</p> : hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );

  return (
    <>
      <form onSubmit={submit} className="max-w-xl space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", "Branch name", <Input id="name" value={v.name} onChange={set("name")} placeholder="e.g. Gulshan 2" aria-invalid={!!errors.name} />)}
          {field("area", "Area", <Input id="area" value={v.area} onChange={set("area")} placeholder="e.g. Gulshan" aria-invalid={!!errors.area} />)}
        </div>
        {field(
          "address",
          "Address",
          <textarea id="address" rows={2} className={textareaClass} value={v.address} onChange={set("address")} aria-invalid={!!errors.address} />,
        )}
        {field(
          "smsPhone",
          "SMS phone (redemption alerts)",
          <Input id="smsPhone" inputMode="tel" value={v.smsPhone} onChange={set("smsPhone")} placeholder="01XXXXXXXXX" aria-invalid={!!errors.smsPhone} />,
        )}
        {editing
          ? field(
              "branchCode",
              "Branch code",
              <Input id="branchCode" value={branchCode} readOnly disabled className="font-mono" />,
              "Fixed after creation: it's printed in the standee QR.",
            )
          : field(
              "branchCode",
              "Branch code (optional)",
              <Input
                id="branchCode"
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase())}
                placeholder={suggestion}
                className="font-mono"
                aria-invalid={!!errors.branchCode}
              />,
              <>
                Used in the QR link <span className="font-mono">/r/{code || suggestion}</span>. Leave blank to use the suggestion; it
                can&apos;t be changed later. Type one for non-English names.
              </>,
            )}
        {editing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.active} onChange={set("active")} className="size-4" />
            Active (accepts vouchers)
          </label>
        )}
        {errors.form && (
          <p className="text-destructive text-sm" role="alert">
            {errors.form}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save branch" : "Create branch"}
          </Button>
        </div>
      </form>
      <PinRevealDialog
        pin={created?.pin ?? null}
        branchName={created?.name ?? ""}
        onDone={() => {
          toast.success(`Branch “${created?.name ?? ""}” created.`);
          setCreated(null);
          router.push(`/admin/partners/${partnerId}`);
          router.refresh();
        }}
      />
    </>
  );
}
