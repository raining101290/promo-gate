"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { textareaClass } from "@/components/staff/form-styles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** How staff confirmed a sale when the customer never uploaded a receipt. */
const NO_RECEIPT_PRESETS = ["Café confirmed the Hosting.com Voucher payment in its POS records", "Café confirmed the sale by phone"];

const PRESETS = [
  "Receipt is unreadable",
  "Bill amount doesn't match the receipt",
  "No Hosting.com Voucher payment on the receipt",
  "Receipt is from a different shop or date",
  "Duplicate of another redemption",
];

type Action = "verify" | "dispute" | "reject";

export function RedemptionReviewPanel({ redemptionId, hasReceipt, status }: { redemptionId: string; hasReceipt: boolean; status: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [confirmNote, setConfirmNote] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: Action) {
    if (pending) return;
    setError(null);
    if (action === "reject" && !window.confirm("Reject this redemption? The partner won't be reimbursed for it.")) return;
    if (action === "verify" && !hasReceipt && !window.confirm("Verify without a receipt? The partner will be reimbursed based on your confirmation."))
      return;
    setPending(action);
    try {
      const res = await fetch(`/api/admin/redemptions/${redemptionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: (action === "verify" ? (hasReceipt ? "" : confirmNote) : reason).trim() || undefined }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        toast.success(
          action === "verify"
            ? hasReceipt
              ? "Redemption verified. It will be included in the next settlement."
              : "Verified without receipt. It will be included in the next settlement."
            : action === "dispute"
              ? "Redemption disputed and put on hold."
              : "Redemption rejected. The partner won't be reimbursed for it.",
        );
        router.refresh();
        return;
      }
      setError(data.error ?? "Something went wrong.");
    } catch {
      setError("Network error. Try again.");
    }
    setPending(null);
  }

  const canDispute = status !== "DISPUTED";
  const needReason = !reason.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review</CardTitle>
        <CardDescription>Verified redemptions become ready to pay to the partner.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasReceipt ? (
          <Button className="w-full" onClick={() => act("verify")} disabled={!!pending} data-testid="verify">
            {pending === "verify" ? "Verifying…" : "Verify: receipt matches"}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">
              No receipt from the customer. The cashier&apos;s PIN shows the café accepted this voucher. Ask the café to check its POS for a
              &ldquo;Hosting.com Voucher&rdquo; payment at this time and amount.
            </p>
            <label htmlFor="confirm-note" className="text-sm font-medium">
              How did you confirm the sale?
            </label>
            <div className="flex flex-wrap gap-1">
              {NO_RECEIPT_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setConfirmNote(p)}
                  className="bg-muted hover:bg-accent rounded-full px-2.5 py-1 text-left text-xs"
                >
                  {p}
                </button>
              ))}
            </div>
            <textarea
              id="confirm-note"
              rows={2}
              maxLength={300}
              value={confirmNote}
              onChange={(e) => setConfirmNote(e.target.value)}
              placeholder="e.g. Café manager confirmed on phone, POS bill #1234"
              className={textareaClass}
            />
            <Button className="w-full" onClick={() => act("verify")} disabled={!!pending || !confirmNote.trim()} data-testid="verify-no-receipt">
              {pending === "verify" ? "Verifying…" : "Verify without receipt"}
            </Button>
            {!confirmNote.trim() && <p className="text-muted-foreground text-xs">Pick or write how you confirmed it to enable this button.</p>}
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <label htmlFor="reason" className="text-sm font-medium">
            Reason (required to dispute or reject)
          </label>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setReason(p)} className="bg-muted hover:bg-accent rounded-full px-2.5 py-1 text-xs">
                {p}
              </button>
            ))}
          </div>
          <textarea id="reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} />
          <div className="flex gap-2">
            {canDispute && (
              <Button variant="outline" className="flex-1" onClick={() => act("dispute")} disabled={!!pending || needReason} data-testid="dispute">
                {pending === "dispute" ? "Saving…" : "Dispute"}
              </Button>
            )}
            <Button variant="destructive" className="flex-1" onClick={() => act("reject")} disabled={!!pending || needReason} data-testid="reject">
              {pending === "reject" ? "Saving…" : "Reject"}
            </Button>
          </div>
        </div>
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
