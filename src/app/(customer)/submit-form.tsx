"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ChannelToggle, type OtpChannel } from "@/components/customer/channel-toggle";
import { OtpCodeForm, postJson } from "@/components/customer/otp-code-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { offerRequestInputSchema, type OfferRequestField } from "@/lib/schemas/offer-request";

type SubmitResponse = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<OfferRequestField, string>>;
  next?: "otp" | "dashboard";
  otp?: { channel: "EMAIL" | "SMS"; target: string; sent: boolean } | null;
};

type FieldErrors = Partial<Record<OfferRequestField, string>>;

const FIELDS: {
  name: OfferRequestField;
  label: string;
  placeholder: string;
  type: string;
  autoComplete: string;
  inputMode?: "email" | "tel" | "text";
}[] = [
  { name: "invoiceNumber", label: "Invoice number", placeholder: "e.g. INV-104233", type: "text", autoComplete: "off" },
  { name: "email", label: "Email", placeholder: "you@example.com", type: "email", autoComplete: "email", inputMode: "email" },
  { name: "phone", label: "Mobile number", placeholder: "01XXXXXXXXX", type: "tel", autoComplete: "tel", inputMode: "tel" },
];

/** +8801711000000 -> 01711000000 for display */
function displayTarget(t: { channel: "EMAIL" | "SMS"; target: string }) {
  return t.channel === "SMS" && t.target.startsWith("+880") ? `0${t.target.slice(4)}` : t.target;
}

export function SubmitForm() {
  const router = useRouter();
  const [values, setValues] = useState<Record<OfferRequestField, string>>({ invoiceNumber: "", email: "", phone: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [otpChannel, setOtpChannel] = useState<OtpChannel>("SMS");
  const [otp, setOtp] = useState<SubmitResponse["otp"]>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = offerRequestInputSchema.safeParse(values);
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as OfferRequestField;
        errs[key] ??= issue.message;
      }
      return setFieldErrors(errs);
    }
    setFieldErrors({});

    setPending(true);
    try {
      const res = await postJson<SubmitResponse>("/api/offer-requests", { ...values, otpChannel });
      if (!res.ok) {
        setFieldErrors(res.fieldErrors ?? {});
        setError(res.fieldErrors ? null : (res.error ?? "Something went wrong. Try again."));
        return;
      }
      if (res.next === "dashboard" || !res.otp) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setOtp(res.otp);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (otp) {
    return (
      <div className="space-y-4">
        <div className="bg-muted rounded-lg p-3 text-sm" role="status">
          <p className="font-medium">Invoice received. We&apos;ll review it shortly.</p>
          <p className="text-muted-foreground mt-1">
            {otp.sent
              ? `To follow its status, enter the code we sent by ${otp.channel === "SMS" ? "SMS" : "email"} to ${displayTarget(otp)}.`
              : `We recently sent a code to ${displayTarget(otp)}. Use the latest one, or wait a few minutes and resend.`}
          </p>
        </div>
        <OtpCodeForm target={otp.target} nextPath="/dashboard" />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {FIELDS.map((f) => (
        <div key={f.name} className="space-y-2">
          <Label htmlFor={f.name}>{f.label}</Label>
          <Input
            id={f.name}
            name={f.name}
            type={f.type}
            inputMode={f.inputMode}
            autoComplete={f.autoComplete}
            placeholder={f.placeholder}
            className="h-12 text-base"
            value={values[f.name]}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            aria-invalid={!!fieldErrors[f.name]}
            aria-describedby={fieldErrors[f.name] ? `${f.name}-error` : undefined}
          />
          {fieldErrors[f.name] && (
            <p id={`${f.name}-error`} className="text-destructive text-sm">
              {fieldErrors[f.name]}
            </p>
          )}
        </div>
      ))}
      <ChannelToggle value={otpChannel} onChange={setOtpChannel} label="Send my login code by" />
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Submitting…" : "Submit invoice"}
      </Button>
    </form>
  );
}
