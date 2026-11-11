"use client";

import { useState, type FormEvent } from "react";

import { ChannelToggle, type OtpChannel } from "@/components/customer/channel-toggle";
import { OtpCodeForm, postJson } from "@/components/customer/otp-code-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseLoginTarget } from "@/lib/schemas/auth";

type Channel = OtpChannel;

const CHANNELS: Record<Channel, { label: string; placeholder: string; inputMode: "tel" | "email"; autoComplete: string; error: string }> = {
  SMS: {
    label: "Mobile number",
    placeholder: "01XXXXXXXXX",
    inputMode: "tel",
    autoComplete: "tel",
    error: "Enter a valid BD mobile number (01XXXXXXXXX)",
  },
  EMAIL: { label: "Email address", placeholder: "you@example.com", inputMode: "email", autoComplete: "email", error: "Enter a valid email address" },
};

export function LoginForm({ nextPath, channels }: { nextPath: string; channels: Channel[] }) {
  const [step, setStep] = useState<"target" | "code">("target");
  const [channel, setChannel] = useState<Channel>(channels[0] ?? "EMAIL");
  const choice = channels.length > 1;
  const [target, setTarget] = useState("");
  const [pending, setPending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // The customer picks how to receive the code; the value must match that choice.
    if (parseLoginTarget(target)?.channel !== channel) return setError(CHANNELS[channel].error);

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
          {step === "target"
            ? choice
              ? "Get a login code by SMS or email. Use the mobile number or email from your hosting.com order."
              : "We'll email you a login code. Use the email address from your hosting.com order."
            : info}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "target" ? (
          <form onSubmit={requestCode} className="space-y-4" noValidate>
            {choice && (
              <ChannelToggle
                value={channel}
                onChange={(c) => {
                  setChannel(c);
                  setTarget("");
                  setError(null);
                }}
              />
            )}
            <div className="space-y-2">
              <Label htmlFor="target">{CHANNELS[channel].label}</Label>
              <Input
                id="target"
                name="target"
                type={channel === "EMAIL" ? "email" : "tel"}
                inputMode={CHANNELS[channel].inputMode}
                autoComplete={CHANNELS[channel].autoComplete}
                placeholder={CHANNELS[channel].placeholder}
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
              {pending ? "Sending…" : channel === "SMS" ? "Send code by SMS" : "Send code by email"}
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
