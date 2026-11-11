"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Shows an admin-issued temporary password exactly once (only its hash is stored). The person must
 * change it at first login. Outside clicks / Esc don't close it, so it isn't lost by accident.
 */
export function OneTimePasswordDialog({ password, who, onDone }: { password: string | null; who: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={!!password}>
      <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Temporary password for {who}</DialogTitle>
          <DialogDescription>
            Send it to them privately (not by email together with the login link). It&apos;s shown only once; they&apos;ll be asked to choose
            their own password when they first sign in.
          </DialogDescription>
        </DialogHeader>
        <p className="bg-muted rounded-lg py-4 text-center font-mono text-2xl font-semibold break-all select-all" data-testid="temp-password">
          {password}
        </p>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (password) await navigator.clipboard?.writeText(password).catch(() => {});
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            onClick={() => {
              setCopied(false);
              onDone();
            }}
          >
            I&apos;ve sent it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
