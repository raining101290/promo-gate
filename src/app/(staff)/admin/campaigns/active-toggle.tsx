"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ActiveToggle({ id, active, name }: { id: string; active: boolean; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (active && !window.confirm(`Deactivate “${name}”? Support won't be able to issue vouchers from it. Issued vouchers stay valid.`)) return;
    setPending(true);
    const res = await fetch(`/api/admin/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    if (!res.ok) window.alert("Could not update the campaign. Refresh and try again.");
    setPending(false);
    router.refresh();
  }

  return (
    <Button size="sm" variant={active ? "ghost" : "secondary"} onClick={toggle} disabled={pending}>
      {pending ? "Saving…" : active ? "Deactivate" : "Activate"}
    </Button>
  );
}
