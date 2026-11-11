import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES = {
  amber: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  green: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  blue: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
  red: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  gray: "border-border bg-muted text-muted-foreground",
} as const;

const LABELS: Record<string, { label: string; tone: keyof typeof STYLES }> = {
  // OfferRequest
  PENDING: { label: "Pending", tone: "amber" },
  APPROVED: { label: "Approved", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
  // Voucher (display status)
  ACTIVE: { label: "Active", tone: "green" },
  REDEEMED: { label: "Redeemed", tone: "gray" },
  EXPIRED: { label: "Expired", tone: "gray" },
  VOID: { label: "Cancelled", tone: "gray" },
  // Redemption
  CLAIMED: { label: "Receipt needed", tone: "amber" },
  RECEIPT_UPLOADED: { label: "Receipt sent", tone: "blue" },
  VERIFIED: { label: "Verified", tone: "green" },
  DISPUTED: { label: "Disputed", tone: "red" },
  // Settlement (APPROVED shared above)
  DRAFT: { label: "Draft", tone: "gray" },
  PAID: { label: "Paid", tone: "green" },
  SENT: { label: "Sent", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  QUEUED: { label: "Queued", tone: "gray" },
  // Partner contract
  PAUSED: { label: "Paused", tone: "amber" },
  ENDED: { label: "Ended", tone: "gray" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = LABELS[status] ?? { label: status, tone: "gray" as const };
  return (
    <Badge variant="outline" className={cn(STYLES[s.tone], className)}>
      {s.label}
    </Badge>
  );
}
