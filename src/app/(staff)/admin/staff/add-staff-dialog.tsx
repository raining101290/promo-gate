"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { OneTimePasswordDialog } from "@/components/staff/one-time-password-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { sendJson, StaffForm } from "./staff-form";

export function AddStaffDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ password: string; who: string } | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button data-testid="add-staff">Add staff member</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
            <DialogDescription>They get a one-time password and choose their own at first sign-in.</DialogDescription>
          </DialogHeader>
          {open && (
            <StaffForm
              initial={{ name: "", email: "", role: "SUPPORT" }}
              submitLabel="Add"
              onCancel={() => setOpen(false)}
              onSubmit={async (v) => {
                const r = await sendJson("/api/admin/staff", "POST", v);
                if (r.ok && r.password) {
                  setOpen(false);
                  setCreated({ password: r.password, who: v.name });
                }
                return r;
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <OneTimePasswordDialog
        password={created?.password ?? null}
        who={created?.who ?? ""}
        onDone={() => {
          setCreated(null);
          router.refresh();
        }}
      />
    </>
  );
}
