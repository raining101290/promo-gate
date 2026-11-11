"use client";

import { useState } from "react";

/** Receipt thumbnail via the staff endpoint (redirects to a short-lived presigned URL; not audited). */
export function ReceiptThumb({ redemptionId, hasReceipt }: { redemptionId: string; hasReceipt: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!hasReceipt) return <span className="text-muted-foreground text-xs">none</span>;
  if (failed) return <span className="bg-muted inline-flex h-14 w-10 items-center justify-center rounded text-[10px]">HEIC</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- presigned, short-lived URL; next/image would cache it
    <img
      src={`/api/admin/redemptions/${redemptionId}/receipt?thumb=1`}
      alt="Receipt thumbnail"
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-14 w-10 rounded border object-cover"
    />
  );
}
