import type { FraudSignal } from "@/server/services/fraud-signals";

/** Warning-only badges; hover/long-press shows the reason. */
export function FraudBadges({ signals }: { signals: FraudSignal[] }) {
  if (signals.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1" data-testid="fraud-signals">
      {signals.map((s) => (
        <span
          key={s.code}
          title={s.detail}
          className="rounded border border-orange-300 bg-orange-50 px-1.5 py-0.5 text-[11px] font-medium text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200"
        >
          ⚠ {s.label}
        </span>
      ))}
    </div>
  );
}
