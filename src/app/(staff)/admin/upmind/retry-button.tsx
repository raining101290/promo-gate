"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function RetryDeliveryButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function retry() {
    setPending(true);
    try {
      const res = await fetch(`/api/admin/upmind/deliveries/${id}/retry`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { status?: string; error?: string | null };
      if (body.status === "SENT") toast.success("Sent to Upmind.");
      else toast.error(body.error ? `Upmind didn't accept it: ${body.error}` : "Could not send it. Try again later.");
    } catch {
      toast.error("Network error. Check your connection and try again.");
    }
    setPending(false);
    router.refresh();
  }

  return (
    <Button size="sm" variant="outline" onClick={retry} disabled={pending} data-testid="upmind-retry">
      {pending ? "Sending…" : "Send again"}
    </Button>
  );
}
