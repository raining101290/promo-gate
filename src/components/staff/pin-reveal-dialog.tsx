"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Shows a freshly generated branch PIN exactly once. The PIN lives only in client memory: it is not
 * stored server-side in plaintext, so closing this dialog is final (a lost PIN must be reset).
 * Outside clicks / Esc don't close it, to avoid losing the PIN by accident.
 */
export function PinRevealDialog({
  pin,
  branchName,
  onDone,
}: {
  pin: string | null;
  branchName: string;
  onDone: () => void;
}) {
  return (
    <Dialog open={!!pin}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Cashier PIN for {branchName}</DialogTitle>
          <DialogDescription>
            Give this PIN to the branch manager now. It is shown only once. If it&apos;s lost, reset it to get a new one.
          </DialogDescription>
        </DialogHeader>
        <p
          className="bg-muted rounded-lg py-6 text-center font-mono text-5xl font-semibold tracking-[0.4em] tabular-nums"
          data-testid="pin"
          aria-label={`PIN ${pin?.split("").join(" ")}`}
        >
          {pin}
        </p>
        <DialogFooter>
          <Button onClick={onDone} className="w-full sm:w-auto">
            I&apos;ve noted the PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
