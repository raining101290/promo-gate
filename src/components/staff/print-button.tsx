"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
