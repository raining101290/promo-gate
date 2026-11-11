"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/** A ready-to-send customer reply with a Copy button. */
export function CopyReply({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <figure className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="mb-2 flex items-center justify-between gap-2">
        <figcaption className="text-sm font-medium">{label}</figcaption>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="copy-reply"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <blockquote className="text-sm leading-relaxed whitespace-pre-line">{text}</blockquote>
    </figure>
  );
}
