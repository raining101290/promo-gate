"use client";

import { useState } from "react";

import { PinRevealDialog } from "@/components/staff/pin-reveal-dialog";
import { Button } from "@/components/ui/button";

export function ResetPinButton({ branchId, branchName }: { branchId: string; branchName: string }) {
  const [pin, setPin] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function reset() {
    if (!window.confirm(`Reset the PIN for ${branchName}? The current PIN stops working immediately.`)) return;
    setPending(true);
    try {
      const res = await fetch(`/api/admin/branches/${branchId}/reset-pin`, { method: "POST" });
      const data = (await res.json()) as { ok: boolean; pin?: string; error?: string };
      if (data.ok && data.pin) setPin(data.pin);
      else window.alert(data.error ?? "Could not reset the PIN.");
    } catch {
      window.alert("Network error. Try again.");
    }
    setPending(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={reset} disabled={pending}>
        {pending ? "Resetting…" : "Reset PIN"}
      </Button>
      <PinRevealDialog pin={pin} branchName={branchName} onDone={() => setPin(null)} />
    </>
  );
}
