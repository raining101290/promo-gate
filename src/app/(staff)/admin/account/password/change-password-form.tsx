"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN } from "@/lib/schemas/staff";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) return setErrors({ confirm: "The two new passwords don't match" });
    setPending(true);
    setErrors({});
    try {
      const res = await fetch("/api/admin/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; fieldErrors?: Record<string, string>; redirectTo?: string };
      if (data.ok) {
        toast.success("Password changed.");
        router.replace(data.redirectTo ?? "/admin");
        router.refresh();
        return;
      }
      setErrors({ ...(data.fieldErrors ?? {}), form: data.fieldErrors ? "" : (data.error ?? "Could not change the password.") });
    } catch {
      setErrors({ form: "Network error. Try again." });
    }
    setPending(false);
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, auto: string, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" autoComplete={auto} value={value} onChange={(e) => set(e.target.value)} aria-invalid={!!errors[id === "current" ? "currentPassword" : id === "next" ? "newPassword" : id]} />
      {errors[id === "current" ? "currentPassword" : id === "next" ? "newPassword" : id] ? (
        <p className="text-destructive text-xs">{errors[id === "current" ? "currentPassword" : id === "next" ? "newPassword" : id]}</p>
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {field("current", forced ? "Temporary password" : "Current password", current, setCurrent, "current-password")}
      {field("next", "New password", next, setNext, "new-password", `At least ${PASSWORD_MIN} characters. A short sentence is easier to remember.`)}
      {field("confirm", "Repeat new password", confirm, setConfirm, "new-password")}
      {errors.form && (
        <p className="text-destructive text-sm" role="alert">
          {errors.form}
        </p>
      )}
      <Button type="submit" disabled={pending || !current || !next || !confirm} data-testid="change-password">
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
