"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteAccount({ activeVouchers, redemptions }: { activeVouchers: number; redemptions: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/me/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm }) });
      const data = (await res.json()) as { ok: boolean; error?: string; redirectTo?: string };
      if (data.ok && data.redirectTo) {
        router.replace(data.redirectTo);
        router.refresh();
        return;
      }
      setError(data.error ?? "Could not delete your account.");
    } catch {
      setError("Network error. Try again.");
    }
    setPending(false);
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base">Delete my account</CardTitle>
        <CardDescription>
          We remove your email, phone and name and you&apos;re logged out.{" "}
          {activeVouchers > 0 && <strong>{activeVouchers} unused voucher(s) will be cancelled. </strong>}
          {redemptions > 0 && `Records of your ${redemptions} past redemption(s) are kept without your contact details, because we need them to pay the cafés.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="confirm">Type DELETE to confirm</Label>
        <Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className="h-11" />
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
        <Button variant="destructive" className="h-12 w-full" disabled={confirm !== "DELETE" || pending} onClick={del} data-testid="delete">
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
      </CardContent>
    </Card>
  );
}
