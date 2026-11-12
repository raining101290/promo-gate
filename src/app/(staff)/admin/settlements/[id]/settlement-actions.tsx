"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettlementActions({
  settlementId,
  status,
  isCreator,
  creatorName,
  total,
}: {
  settlementId: string;
  status: "DRAFT" | "APPROVED" | "PAID";
  isCreator: boolean;
  creatorName: string;
  total: string;
}) {
  const router = useRouter();
  const [paymentRef, setPaymentRef] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, body?: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/settlements/${settlementId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        toast.success(path === "approve" ? `Settlement of ${total} approved.` : `${total} marked as paid. The settlement is closed.`);
        router.refresh();
        setPending(false);
        return;
      }
      setError(data.error ?? "Something went wrong.");
    } catch {
      setError("Network error. Try again.");
    }
    setPending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Next step</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "DRAFT" &&
          (isCreator ? (
            <p className="text-muted-foreground text-sm" data-testid="four-eyes">
              You created this draft. Another finance or admin user must approve it.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">Check the lines and total, then approve. Created by {creatorName}.</p>
              <Button className="w-full" disabled={pending} onClick={() => call("approve", undefined, `Approve settlement of ${total}?`)} data-testid="approve">
                {pending ? "Approving…" : `Approve ${total}`}
              </Button>
            </>
          ))}
        {status === "APPROVED" && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void call("pay", { paymentRef }, `Mark ${total} as paid with reference ${paymentRef}?`);
            }}
          >
            <Label htmlFor="ref">Payment reference (bank txn or bKash TrxID)</Label>
            <Input id="ref" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="e.g. 9KX2B7QW1M" className="font-mono" />
            <Button type="submit" className="w-full" disabled={pending || paymentRef.trim().length < 4} data-testid="mark-paid">
              {pending ? "Saving…" : "Mark as paid"}
            </Button>
          </form>
        )}
        {status === "PAID" && <p className="text-sm">Paid. This settlement is closed and can&apos;t be changed.</p>}
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
