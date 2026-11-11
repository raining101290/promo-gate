"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parsePercentToBp, parseTakaToPaisa } from "@/lib/money";
import { dhakaInputToUtcIso } from "@/lib/time";

/** All form values are strings in human units (taka, %, Dhaka local time); converted on submit. */
export type CampaignFormValues = {
  name: string;
  offerType: "FIXED" | "PERCENT";
  value: string;
  maxDiscount: string;
  minBill: string;
  validityDays: string;
  totalBudget: string;
  perCustomerLimit: string;
  startsAt: string;
  endsAt: string;
};

type Errors = Partial<Record<keyof CampaignFormValues | "form", string>>;

const selectClass =
  "border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

function toPayload(v: CampaignFormValues): { payload?: Record<string, unknown>; errors: Errors } {
  const errors: Errors = {};
  const money = (key: keyof CampaignFormValues, required: boolean) => {
    const raw = v[key].trim();
    if (!raw) {
      if (required) errors[key] = "Required";
      return null;
    }
    const p = parseTakaToPaisa(raw);
    if (p == null) errors[key] = "Enter an amount in taka, e.g. 500 or 12.50";
    return p;
  };
  const whole = (key: keyof CampaignFormValues, required: boolean) => {
    const raw = v[key].trim();
    if (!raw) {
      if (required) errors[key] = "Required";
      return null;
    }
    if (!/^\d+$/.test(raw)) {
      errors[key] = "Enter a whole number";
      return null;
    }
    return Number(raw);
  };

  let value: number | null = null;
  if (v.offerType === "FIXED") value = money("value", true);
  else {
    value = parsePercentToBp(v.value);
    if (value == null) errors.value = "Enter a percentage, e.g. 15 or 12.5";
  }
  const startsAt = dhakaInputToUtcIso(v.startsAt);
  if (!startsAt) errors.startsAt = "Choose a start date and time";
  const endsAt = v.endsAt ? dhakaInputToUtcIso(v.endsAt) : null;
  if (v.endsAt && !endsAt) errors.endsAt = "Invalid date";

  const payload = {
    name: v.name,
    offerType: v.offerType,
    value,
    maxDiscount: v.offerType === "PERCENT" ? money("maxDiscount", true) : null,
    minBill: money("minBill", false),
    validityDays: whole("validityDays", true),
    totalBudget: money("totalBudget", false),
    perCustomerLimit: whole("perCustomerLimit", false),
    startsAt,
    endsAt,
  };
  return Object.keys(errors).length ? { errors } : { payload, errors };
}

export function CampaignForm({ initial, campaignId }: { initial: CampaignFormValues; campaignId?: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  const set = (key: keyof CampaignFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((prev) => ({ ...prev, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { payload, errors: clientErrors } = toPayload(v);
    setErrors(clientErrors);
    if (!payload) return;

    setPending(true);
    try {
      const res = await fetch(campaignId ? `/api/admin/campaigns/${campaignId}` : "/api/admin/campaigns", {
        method: campaignId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; fieldErrors?: Errors };
      if (data.ok) {
        router.push("/admin/campaigns");
        router.refresh();
        return;
      }
      setErrors({ ...(data.fieldErrors ?? {}), form: data.error });
    } catch {
      setErrors({ form: "Network error. Try again." });
    }
    setPending(false);
  }

  const field = (key: keyof CampaignFormValues, label: string, input: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      {input}
      {errors[key] ? <p className="text-destructive text-xs">{errors[key]}</p> : hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
  const text = (key: keyof CampaignFormValues, props: React.ComponentProps<typeof Input> = {}) => (
    <Input id={key} name={key} value={v[key]} onChange={set(key)} aria-invalid={!!errors[key]} {...props} />
  );

  const percent = v.offerType === "PERCENT";

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6" noValidate>
      {field("name", "Name", text("name", { placeholder: "e.g. Launch Offer - 500 BDT" }))}

      <div className="grid gap-4 sm:grid-cols-2">
        {field(
          "offerType",
          "Offer type",
          <select id="offerType" className={selectClass} value={v.offerType} onChange={set("offerType")}>
            <option value="FIXED">Fixed amount (৳)</option>
            <option value="PERCENT">Percentage (%)</option>
          </select>,
        )}
        {field("value", percent ? "Percentage off" : "Amount off (৳)", text("value", { inputMode: "decimal", placeholder: percent ? "15" : "500" }))}
        {percent &&
          field("maxDiscount", "Maximum discount (৳)", text("maxDiscount", { inputMode: "decimal", placeholder: "300" }), "Required for percent offers; also the voucher's budget cost.")}
        {field("minBill", "Minimum bill (৳)", text("minBill", { inputMode: "decimal", placeholder: "Optional" }))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {field("validityDays", "Voucher validity (days)", text("validityDays", { inputMode: "numeric" }))}
        {field("totalBudget", "Total budget (৳)", text("totalBudget", { inputMode: "decimal", placeholder: "No cap" }), "Sum of voucher face values.")}
        {field("perCustomerLimit", "Vouchers per customer", text("perCustomerLimit", { inputMode: "numeric", placeholder: "No limit" }))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {field("startsAt", "Starts (Dhaka time)", text("startsAt", { type: "datetime-local" }))}
        {field("endsAt", "Ends (Dhaka time)", text("endsAt", { type: "datetime-local" }), "Leave empty for no end date.")}
      </div>

      {errors.form && (
        <p className="text-destructive text-sm" role="alert">
          {errors.form}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : campaignId ? "Save changes" : "Create campaign"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/campaigns">Cancel</Link>
        </Button>
      </div>
      {!campaignId && <p className="text-muted-foreground text-xs">New campaigns start inactive. Activate them from the list.</p>}
    </form>
  );
}
