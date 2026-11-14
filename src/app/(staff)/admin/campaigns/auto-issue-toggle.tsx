"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Marks the campaign Upmind paid-invoice vouchers come from (only one at a time). */
export function AutoIssueToggle({ id, on, name }: { id: string; on: boolean; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    const msg = on
      ? `Stop issuing Upmind vouchers from “${name}”? New paid invoices will wait in Requests until another campaign is chosen.`
      : `Issue every new Upmind voucher from “${name}”? This replaces the current Upmind campaign.`;
    if (!window.confirm(msg)) return;
    setPending(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoIssue: !on }),
      });
      if (res.ok) toast.success(on ? `Upmind vouchers no longer come from “${name}”.` : `New Upmind vouchers will be issued from “${name}”.`);
      else toast.error("Could not update the campaign. Refresh and try again.");
    } catch {
      toast.error("Network error. Check your connection and try again.");
    }
    setPending(false);
    router.refresh();
  }

  return (
    <Button size="sm" variant="ghost" onClick={toggle} disabled={pending} data-testid="auto-issue-toggle">
      {pending ? "Saving…" : on ? "Stop Upmind" : "Use for Upmind"}
    </Button>
  );
}
