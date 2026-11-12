"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateDraftForm({ partnerId, defaultFrom, defaultTo }: { partnerId: string; defaultFrom: string; defaultTo: string }) {
  const router = useRouter();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, from, to }),
      });
      const data = (await res.json()) as { ok: boolean; settlementId?: string; error?: string };
      if (data.ok && data.settlementId) {
        toast.success("Draft settlement created. Another finance or admin user must approve it.");
        router.push(`/admin/settlements/${data.settlementId}`);
        return;
      }
      setError(data.error ?? "Could not create the draft.");
    } catch {
      setError("Network error. Try again.");
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" aria-label="Period start" />
      <span className="text-muted-foreground">–</span>
      <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" aria-label="Period end" />
      <Button type="submit" size="sm" disabled={pending} data-testid="create-draft">
        {pending ? "Creating…" : "Create draft"}
      </Button>
      {error && <p className="text-destructive w-full text-xs">{error}</p>}
    </form>
  );
}
