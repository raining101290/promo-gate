"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type CampaignOption = {
  id: string;
  name: string;
  headline: string;
  conditions: string[];
  validityDays: number;
  remaining: string | null;
  perCustomerLimit: number | null;
};

const selectClass =
  "border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

async function post(url: string, body: unknown) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }
}

export function ReviewPanel({
  requestId,
  campaigns,
  rejectReasons,
  reviewerName,
}: {
  requestId: string;
  campaigns: CampaignOption[];
  rejectReasons: { code: string; label: string }[];
  reviewerName: string;
}) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  // One in-flight action at a time; the server also guards against double approval.
  const [pending, setPending] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);

  const selected = campaigns.find((c) => c.id === campaignId);

  async function run(kind: "approve" | "reject") {
    if (pending) return;
    setError(null);
    setPending(kind);
    const res =
      kind === "approve"
        ? await post(`/api/admin/requests/${requestId}/approve`, { campaignId })
        : await post(`/api/admin/requests/${requestId}/reject`, { reasonCode, note: note.trim() || undefined });
    if (res.ok) {
      toast.success(kind === "approve" ? "Approved. Voucher issued and the customer notified." : "Request rejected. The customer has been notified.");
      router.refresh(); // the page re-renders with the review outcome
      return;
    }
    setError(res.error ?? "Something went wrong.");
    setPending(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review</CardTitle>
        <CardDescription>Decision recorded as {reviewerName}. The customer is notified by SMS and email.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3" aria-labelledby="approve-h">
          <h3 id="approve-h" className="text-sm font-semibold">
            Approve and issue voucher
          </h3>
          {campaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active campaign can issue vouchers right now. An admin needs to activate one.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="campaign">Campaign</Label>
                <select id="campaign" className={selectClass} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.headline})
                    </option>
                  ))}
                </select>
                {selected && (
                  <p className="text-muted-foreground text-xs">
                    {[...selected.conditions, `valid ${selected.validityDays} days`, selected.remaining ? `${selected.remaining} budget left` : "no budget cap", selected.perCustomerLimit ? `max ${selected.perCustomerLimit} per customer` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <Button className="w-full" onClick={() => run("approve")} disabled={!!pending || !campaignId} data-testid="approve">
                {pending === "approve" ? "Approving…" : "Approve & issue voucher"}
              </Button>
            </>
          )}
        </section>

        <div className="border-t" />

        <section className="space-y-3" aria-labelledby="reject-h">
          <h3 id="reject-h" className="text-sm font-semibold">
            Reject
          </h3>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (shown to the customer)</Label>
            <select id="reason" className={selectClass} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              <option value="" disabled>
                Choose a reason…
              </option>
              {rejectReasons.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Details {reasonCode === "OTHER" ? "(required)" : "(optional)"}</Label>
            <textarea
              id="note"
              rows={3}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Invoice INV-123 belongs to a different account"
              className="border-input bg-background focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            />
          </div>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => run("reject")}
            disabled={!!pending || !reasonCode || (reasonCode === "OTHER" && !note.trim())}
            data-testid="reject"
          >
            {pending === "reject" ? "Rejecting…" : "Reject request"}
          </Button>
        </section>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
