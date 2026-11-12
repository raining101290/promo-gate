"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ActiveToggle({ id, active, name }: { id: string; active: boolean; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (active && !window.confirm(`Deactivate “${name}”? Support won't be able to issue vouchers from it. Issued vouchers stay valid.`)) return;
    setPending(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (res.ok) toast.success(active ? `“${name}” deactivated.` : `“${name}” activated. Support can issue vouchers from it.`);
      else toast.error("Could not update the campaign. Refresh and try again.");
    } catch {
      toast.error("Network error. Check your connection and try again.");
    }
    setPending(false);
    router.refresh();
  }

  return (
    <Button size="sm" variant={active ? "ghost" : "secondary"} onClick={toggle} disabled={pending}>
      {pending ? "Saving…" : active ? "Deactivate" : "Activate"}
    </Button>
  );
}
