"use client";

import { useState, type FormEvent } from "react";

import { OtpCodeForm, postJson } from "@/components/customer/otp-code-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseLoginTarget, TARGET_ERROR } from "@/lib/schemas/auth";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [step, setStep] = useState<"target" | "code">("target");
  const [target, setTarget] = useState("");
  const [pending, setPending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!parseLoginTarget(target)) return setError(TARGET_ERROR);

    setPending(true);
    try {
      const res = await postJson("/api/auth/otp/request", { target });
      if (!res.ok) return setError(res.error ?? "Something went wrong. Try again.");
      setInfo(res.message ?? null);
      setStep("code");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{step === "target" ? "Log in" : "Enter your code"}</CardTitle>
        <CardDescription>
          {step === "target" ? "Use the email or mobile number from your hosting.com order." : info}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "target" ? (
          <form onSubmit={requestCode} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="target">Email or mobile number</Label>
              <Input
                id="target"
                name="target"
                autoComplete="username"
                placeholder="you@example.com or 01XXXXXXXXX"
                className="h-12 text-base"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                aria-invalid={!!error}
                autoFocus
              />
            </div>
            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
              {pending ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : (
          <OtpCodeForm
            target={target}
            nextPath={nextPath}
            onChangeTarget={() => {
              setStep("target");
              setError(null);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
