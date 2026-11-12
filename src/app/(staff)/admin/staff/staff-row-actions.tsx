"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { OneTimePasswordDialog } from "@/components/staff/one-time-password-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { sendJson, StaffForm, type Role } from "./staff-form";

export function StaffRowActions({
  id,
  name,
  email,
  role,
  active,
  isSelf,
  lastAdmin,
}: {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  isSelf: boolean;
  lastAdmin: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  async function call(path: string, body: unknown, method: string, confirmText: string, successText?: string) {
    if (!window.confirm(confirmText)) return null;
    setPending(true);
    setError(null);
    try {
      const r = await sendJson(path, method, body);
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      else {
        if (successText) toast.success(successText);
        router.refresh();
      }
      return r;
    } catch {
      setError("Network error.");
      return null;
    } finally {
      setPending(false);
    }
  }

  const roleLockedReason = isSelf
    ? "You can't change your own role. Ask another admin."
    : lastAdmin
      ? "Last active admin. Make someone else an admin first."
      : undefined;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(true)} data-testid="edit-staff">
          Edit
        </Button>
        {!isSelf && active && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            data-testid="reset-password"
            onClick={async () => {
              const r = await call(`/api/admin/staff/${id}/reset-password`, undefined, "POST", `Reset ${name}'s password? They'll be signed out everywhere and get a new temporary password.`);
              if (r?.ok && r.password) setPassword(r.password);
            }}
          >
            Reset password
          </Button>
        )}
        {!isSelf && (
          <Button
            size="sm"
            variant={active ? "ghost" : "secondary"}
            disabled={pending || (active && lastAdmin)}
            title={active && lastAdmin ? "Last active admin" : undefined}
            data-testid="toggle-active"
            onClick={() =>
              void call(
                `/api/admin/staff/${id}`,
                { active: !active },
                "PATCH",
                active ? `Deactivate ${name}? They lose access immediately.` : `Reactivate ${name}?`,
                active ? `${name} deactivated and signed out.` : `${name} reactivated.`,
              )
            }
          >
            {active ? "Deactivate" : "Reactivate"}
          </Button>
        )}
      </div>
      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {isSelf ? "your details" : name}</DialogTitle>
            <DialogDescription>Changes apply on their next click; they stay signed in.</DialogDescription>
          </DialogHeader>
          {editing && (
            <StaffForm
              initial={{ name, email, role }}
              submitLabel="Save changes"
              roleLockedReason={roleLockedReason}
              onCancel={() => setEditing(false)}
              onSubmit={async (v) => {
                const r = await sendJson(`/api/admin/staff/${id}`, "PATCH", v);
                if (r.ok) {
                  setEditing(false);
                  toast.success(isSelf ? "Your details were saved." : `${v.name}'s details were saved.`);
                  router.refresh();
                }
                return r;
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <OneTimePasswordDialog password={password} who={name} onDone={() => setPassword(null)} />
    </div>
  );
}
