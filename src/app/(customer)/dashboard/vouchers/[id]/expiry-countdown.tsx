"use client";

import { useEffect, useState } from "react";

import { remainingParts } from "@/lib/time";

const LABELS = ["days", "hrs", "min", "sec"] as const;

/** Live countdown. Server render shows "--" placeholders (no hydration mismatch); ticking starts after mount. */
export function ExpiryCountdown({ expiresAt, validUntil }: { expiresAt: string; validUntil: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const parts = now ? remainingParts(new Date(expiresAt), now) : null;
  const values = parts ? [parts.days, parts.hours, parts.minutes, parts.seconds] : null;

  return (
    <div className="rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {parts?.expired ? "Expired" : "Expires in"}
      </p>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center" data-testid="countdown">
        {LABELS.map((label, i) => (
          <div key={label} className="bg-muted rounded-lg py-2">
            <p className="font-mono text-xl font-semibold tabular-nums">
              {values ? String(values[i]).padStart(2, "0") : "--"}
            </p>
            <p className="text-muted-foreground text-xs">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">Valid until {validUntil} (Dhaka time)</p>
    </div>
  );
}
