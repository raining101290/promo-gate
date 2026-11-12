"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Camera + wasm code only loads when the customer opens the scanner, and never on the server.
const BranchQrScanner = dynamic(() => import("@/components/redeem/scanner").then((m) => m.BranchQrScanner), {
  ssr: false,
  loading: () => <div className="bg-muted aspect-square animate-pulse rounded-xl" />,
});

export function RedeemButton({ voucherId }: { voucherId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-14 w-full text-lg" data-testid="redeem-button">
          Redeem at a branch
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan the café&apos;s QR</DialogTitle>
          <DialogDescription>It&apos;s on the Hosting.com Coffee Campaign standee at the counter.</DialogDescription>
        </DialogHeader>
        {open && <BranchQrScanner voucherId={voucherId} />}
      </DialogContent>
    </Dialog>
  );
}
