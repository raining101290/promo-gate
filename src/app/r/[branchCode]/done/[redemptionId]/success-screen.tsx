"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DISPLAY_TZ } from "@/lib/time";
import { cn } from "@/lib/utils";

const clockFmt = new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

type Props = {
  redeemedAt: string;
  redeemedAtLabel: string;
  freshUntil: string;
  initiallyFresh: boolean;
  partnerName: string;
  branchName: string;
  bill: string;
  discount: string;
  discountPlain: string;
  customerPaid: string;
  reference: string;
  receiptHref: string;
};

/**
 * Full-screen confirmation shown to the cashier. Anti-screenshot cues: live ticking clock, a scrolling
 * marquee and an animated tick. Turns grey once the fresh window passes.
 */
export function SuccessScreen(p: Props) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  // The voucher is used now: drop the client router cache so Back to the branch page fetches a fresh
  // voucher list instead of showing the cached one that still offers this voucher.
  useEffect(() => router.refresh(), [router]);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const fresh = now ? now.getTime() < new Date(p.freshUntil).getTime() : p.initiallyFresh;
  const ago = now ? Math.max(0, Math.floor((now.getTime() - new Date(p.redeemedAt).getTime()) / 60_000)) : 0;
  const marquee = fresh ? `VOUCHER ACCEPTED · ${p.reference} · HOSTING.COM CAFÉ PASS · ` : `OLD CONFIRMATION · NOT VALID FOR A NEW PURCHASE · `;

  return (
    <main
      className={cn(
        "fixed inset-0 z-50 flex flex-col overflow-y-auto text-white",
        fresh ? "bg-emerald-600" : "bg-neutral-600",
      )}
      data-testid="success"
      data-fresh={fresh}
    >
      {/* Moving element: a static screenshot can't reproduce this. */}
      <div className="overflow-hidden bg-black/15 py-1.5 text-xs font-bold tracking-widest whitespace-nowrap" aria-hidden>
        <div className="inline-block animate-[perks-marquee_6s_linear_infinite]">{marquee.repeat(8)}</div>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pt-6 pb-5 text-center">
        <div className="relative flex size-28 items-center justify-center">
          {fresh && <span className="absolute inset-0 animate-[perks-ripple_1.6s_ease-out_infinite] rounded-full bg-white/40" aria-hidden />}
          <div className="relative flex size-28 animate-[perks-pop_0.5s_ease-out] items-center justify-center rounded-full bg-white">
            <svg viewBox="0 0 52 52" className={cn("size-16", fresh ? "text-emerald-600" : "text-neutral-500")} aria-hidden>
              <path
                d="M14 27 l8 8 l16 -18"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="48"
                strokeDashoffset="48"
                className="animate-[perks-draw_0.5s_0.35s_ease-out_forwards]"
              />
            </svg>
          </div>
        </div>

        <h1 className="mt-5 text-3xl font-bold tracking-tight">{fresh ? "Voucher accepted" : "Already used"}</h1>
        <p className="mt-1 text-lg font-medium">
          {p.partnerName} · {p.branchName}
        </p>

        <p className="mt-5 font-mono text-5xl font-bold tabular-nums" data-testid="clock" aria-label="Current time">
          {now ? clockFmt.format(now) : "--:--:--"}
        </p>
        <p className="text-sm opacity-80">
          {fresh ? "Live time (Dhaka)" : `Redeemed ${p.redeemedAtLabel} (${ago} min ago)`}
        </p>

        <dl className="mt-5 w-full space-y-2 rounded-2xl bg-white/15 p-4 text-left tabular-nums">
          <div className="flex justify-between">
            <dt className="opacity-85">Bill</dt>
            <dd>{p.bill}</dd>
          </div>
          <div className="flex justify-between text-xl font-bold">
            <dt>Voucher pays</dt>
            <dd data-testid="discount">{p.discount}</dd>
          </div>
          <div className="flex justify-between border-t border-white/30 pt-2">
            <dt className="opacity-85">Customer pays</dt>
            <dd className="font-semibold">{p.customerPaid}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="opacity-85">Reference</dt>
            <dd className="font-mono font-semibold" data-testid="ref">
              {p.reference}
            </dd>
          </div>
        </dl>

        {fresh ? (
          <p className="mt-4 rounded-xl bg-white px-4 py-3 text-base font-semibold text-emerald-800" data-testid="cashier-instruction">
            Cashier: record {p.discountPlain} BDT as payment type “Hosting.com Voucher”
          </p>
        ) : (
          <p className="mt-4 rounded-xl bg-white/90 px-4 py-3 text-sm font-semibold text-neutral-800">
            This is an old confirmation. Don&apos;t accept it for a new purchase.
          </p>
        )}

        <div className="mt-auto w-full space-y-2 pt-5">
          <Link href={p.receiptHref} className="block w-full rounded-xl bg-white py-4 font-semibold text-emerald-800" data-testid="upload-receipt-now">
            Upload receipt now
          </Link>
          <Link href="/dashboard" className="block w-full rounded-xl bg-black/20 py-3 font-semibold">
            Done
          </Link>
        </div>
      </div>
    </main>
  );
}
