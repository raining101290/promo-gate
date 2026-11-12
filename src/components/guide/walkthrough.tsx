import Image from "next/image";

import { HelpText } from "@/components/staff/help-text";
import type { GuideShot, GuideStep } from "@/lib/help/types";
import { cn } from "@/lib/utils";

/** Screenshot sizes as captured by tests/guide (CSS pixels; files are 2x / 1.5x). */
const SIZE = { phone: { w: 390, h: 844 }, desktop: { w: 1280, h: 800 } } as const;

export function Screenshot({ shot, className }: { shot: GuideShot; className?: string }) {
  const { w, h } = shot.device === "print" ? { w: shot.w ?? 400, h: shot.h ?? 560 } : SIZE[shot.device];
  return (
    <a
      href={shot.src}
      target="_blank"
      rel="noopener"
      title="Open full size"
      className={cn(
        "bg-muted block overflow-hidden shadow-sm transition-shadow hover:shadow-md",
        shot.device === "phone"
          ? "mx-auto w-full max-w-[240px] rounded-[1.6rem] border-[6px] border-neutral-900 dark:border-neutral-700"
          : shot.device === "print"
            ? "mx-auto w-full max-w-[280px] rounded-sm border"
            : "rounded-lg border",
        className,
      )}
    >
      <Image src={shot.src} alt={shot.alt} width={w} height={h} unoptimized className="block h-auto w-full" />
    </a>
  );
}

/**
 * Numbered steps with a screenshot each. Phone shots sit beside the text on wide screens;
 * desktop shots sit under it, full width.
 */
export function Walkthrough({ steps, startAt = 1 }: { steps: GuideStep[]; startAt?: number }) {
  return (
    <ol className="space-y-10">
      {steps.map((s, i) => {
        const phone = s.shot?.device === "phone" || s.shot?.device === "print";
        return (
          <li key={s.title} className={cn("grid gap-4", phone && "sm:grid-cols-[1fr_240px] sm:items-start sm:gap-8")}>
            <div className="flex min-w-0 gap-3">
              <span
                aria-hidden
                className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums"
              >
                {startAt + i}
              </span>
              <div className="min-w-0 space-y-1.5">
                <h3 className="font-semibold">
                  <span className="sr-only">Step {startAt + i}: </span>
                  {s.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  <HelpText text={s.text} />
                </p>
                {s.tip && (
                  <p className="text-muted-foreground border-l-2 pl-3 text-sm leading-relaxed">
                    <span className="text-foreground font-medium">Tip: </span>
                    <HelpText text={s.tip} />
                  </p>
                )}
              </div>
            </div>
            {s.shot && <Screenshot shot={s.shot} className={phone ? undefined : "sm:ml-10"} />}
          </li>
        );
      })}
    </ol>
  );
}
