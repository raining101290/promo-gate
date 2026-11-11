"use client";

import { cn } from "@/lib/utils";

export type OtpChannel = "SMS" | "EMAIL";

const LABEL: Record<OtpChannel, string> = { SMS: "Mobile (SMS)", EMAIL: "Email" };

/** "Send my code by SMS / Email" segmented control (big tap targets, radio semantics). */
export function ChannelToggle({
  value,
  onChange,
  label = "Send my code by",
}: {
  value: OtpChannel;
  onChange: (c: OtpChannel) => void;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" id="otp-channel-label">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby="otp-channel-label" className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
        {(Object.keys(LABEL) as OtpChannel[]).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            data-testid={`channel-${c.toLowerCase()}`}
            onClick={() => c !== value && onChange(c)}
            className={cn(
              "h-11 rounded-md text-sm font-medium transition-colors",
              value === c ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LABEL[c]}
          </button>
        ))}
      </div>
    </div>
  );
}
