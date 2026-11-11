"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ApiResult = {
  ok: boolean;
  message?: string;
  error?: string;
  reason?: string;
  redirectTo?: string;
};

export async function postJson<T = ApiResult>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

/** Step 2 of login: enter the 6-digit code sent to `target`. On success navigates to the redirect. */
export function OtpCodeForm({
  target,
  nextPath,
  onChangeTarget,
  changeTargetLabel = "Change email/phone",
}: {
  /** Email or E.164 phone the code was sent to; passed back to the verify endpoint. */
  target: string;
  nextPath: string;
  onChangeTarget?: () => void;
  changeTargetLabel?: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noCustomer, setNoCustomer] = useState(false);

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");

    setPending(true);
    try {
      const res = await postJson("/api/auth/otp/verify", { target, code, next: nextPath });
      if (res.ok && res.redirectTo) {
        router.replace(res.redirectTo);
        router.refresh();
        return; // keep the button disabled while navigating
      }
      setNoCustomer(res.reason === "no_customer");
      setError(res.error ?? "Something went wrong. Try again.");
    } catch {
      setError("Network error. Check your connection and try again.");
    }
    setPending(false);
  }

  async function resend() {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const res = await postJson("/api/auth/otp/request", { target });
      if (res.ok) {
        setCode("");
        setNotice("A new code is on its way. Earlier codes no longer work.");
      } else {
        setError(res.error ?? "Could not resend the code.");
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    }
    setPending(false);
  }

  return (
    <form onSubmit={verify} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="code">6-digit code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="••••••"
          className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          aria-invalid={!!error}
          autoFocus
        />
      </div>
      {notice && <p className="text-muted-foreground text-sm">{notice}</p>}
      {error && (
        <div className="text-destructive space-y-1 text-sm" role="alert">
          <p>{error}</p>
          {noCustomer && (
            <p className="text-foreground">
              Bought hosting recently?{" "}
              <Link href="/" className="font-medium underline underline-offset-4">
                Submit your invoice to get an offer
              </Link>
            </p>
          )}
        </div>
      )}
      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Checking…" : "Verify and continue"}
      </Button>
      <div className="flex justify-between gap-4 text-sm">
        {onChangeTarget ? (
          <button
            type="button"
            className="text-muted-foreground py-2 underline-offset-4 hover:underline"
            onClick={onChangeTarget}
          >
            {changeTargetLabel}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="text-muted-foreground py-2 underline-offset-4 hover:underline disabled:opacity-50"
          disabled={pending}
          onClick={resend}
        >
          Resend code
        </button>
      </div>
    </form>
  );
}
