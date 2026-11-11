"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { formatBDT, parseTakaToPaisa, quoteRedemption } from "@/lib/money";
import type { OfferTerms } from "@/lib/offer";
import { redeemFailureMessage } from "@/lib/redeem-messages";
import { cn } from "@/lib/utils";

type VoucherOption = { id: string; headline: string; conditions: string[]; terms: OfferTerms; expires: string };
type Branch = { code: string; name: string; area: string; partnerName: string };
type Amounts = { bill: number; discount: number; customerPays: number };
type Api = { ok: boolean; error?: string; reason?: string; attemptsLeft?: number; redirectTo?: string } & Partial<Amounts>;

async function post(url: string, body: unknown): Promise<Api> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as Api;
}

export function RedeemFlow({ branch, vouchers, initialVoucherId }: { branch: Branch; vouchers: VoucherOption[]; initialVoucherId: string }) {
  const [step, setStep] = useState<"amount" | "pin">("amount");
  const [voucherId, setVoucherId] = useState(initialVoucherId);
  const [billInput, setBillInput] = useState("");
  const [amounts, setAmounts] = useState<Amounts | null>(null);

  const voucher = vouchers.find((v) => v.id === voucherId) ?? vouchers[0];

  return step === "amount" || !amounts ? (
    <AmountStep
      branch={branch}
      vouchers={vouchers}
      voucher={voucher}
      onVoucher={setVoucherId}
      billInput={billInput}
      onBill={setBillInput}
      onContinue={(a) => {
        setAmounts(a);
        setStep("pin");
      }}
    />
  ) : (
    <PinStep branch={branch} voucher={voucher} amounts={amounts} onBack={() => setStep("amount")} />
  );
}

/* ---------------- Step 1: choose voucher + bill, live calculation ---------------- */

function AmountStep({
  branch,
  vouchers,
  voucher,
  onVoucher,
  billInput,
  onBill,
  onContinue,
}: {
  branch: Branch;
  vouchers: VoucherOption[];
  voucher: VoucherOption;
  onVoucher: (id: string) => void;
  billInput: string;
  onBill: (v: string) => void;
  onContinue: (a: Amounts) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const billPaisa = billInput.trim() ? parseTakaToPaisa(billInput) : null;
  const quote = billPaisa == null ? null : quoteRedemption(voucher.terms, billPaisa);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!quote?.ok || billPaisa == null) return;
    setError(null);
    setPending(true);
    try {
      // Server is the authority on amounts and eligibility; the live preview is just a mirror.
      const res = await post("/api/redeem/preview", { branchCode: branch.code, voucherId: voucher.id, billPaisa });
      if (res.ok && res.bill != null && res.discount != null && res.customerPays != null) {
        onContinue({ bill: res.bill, discount: res.discount, customerPays: res.customerPays });
      } else setError(res.error ?? "Something went wrong.");
    } catch {
      setError("Network error. Check your connection.");
    }
    setPending(false);
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-4 pt-5 pb-10">
      <Link href={`/r/${branch.code}`} className="text-muted-foreground inline-block py-1 text-sm">
        ← Back
      </Link>
      <p className="text-muted-foreground mt-2 text-xs font-semibold tracking-widest uppercase">Step 1 of 3</p>
      <h1 className="text-2xl font-semibold tracking-tight">Enter your bill</h1>
      <p className="text-muted-foreground text-sm">
        {branch.partnerName} · {branch.name}
      </p>

      <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
        {vouchers.length > 1 ? (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Voucher</legend>
            {vouchers.map((v) => (
              <label
                key={v.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3",
                  v.id === voucher.id ? "border-primary ring-primary ring-1" : "border-border",
                )}
              >
                <input type="radio" name="voucher" value={v.id} checked={v.id === voucher.id} onChange={() => onVoucher(v.id)} className="size-4" />
                <span className="min-w-0">
                  <span className="block font-semibold">{v.headline}</span>
                  <span className="text-muted-foreground block truncate text-xs">{[...v.conditions, v.expires].join(" · ")}</span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="rounded-xl border p-3">
            <p className="font-semibold">{voucher.headline}</p>
            <p className="text-muted-foreground text-xs">{[...voucher.conditions, voucher.expires].join(" · ")}</p>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="bill" className="text-sm font-medium">
            Bill total (from the cashier)
          </label>
          <div className="focus-within:ring-ring/50 flex items-center rounded-xl border px-4 focus-within:ring-[3px]">
            <span className="text-muted-foreground text-2xl">৳</span>
            <input
              id="bill"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={billInput}
              onChange={(e) => onBill(e.target.value.replace(/[^\d.,]/g, ""))}
              className="h-16 w-full bg-transparent px-2 text-3xl font-semibold tabular-nums outline-none"
              aria-describedby="calc"
              autoFocus
            />
          </div>
        </div>

        <div id="calc" className="bg-muted space-y-2 rounded-xl p-4 tabular-nums" aria-live="polite" data-testid="calc">
          <Row label="Bill" value={quote?.ok ? formatBDT(quote.bill) : "—"} />
          <Row label="Voucher pays" value={quote?.ok ? `− ${formatBDT(quote.discount)}` : "—"} strong className="text-emerald-700 dark:text-emerald-400" />
          <div className="border-t" />
          <Row label="You pay" value={quote?.ok ? formatBDT(quote.customerPays) : "—"} strong large />
          {quote && !quote.ok && (
            <p className="text-destructive text-sm" role="alert">
              {redeemFailureMessage(quote)}
            </p>
          )}
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="h-14 w-full text-lg" disabled={!quote?.ok || pending}>
          {pending ? "Checking…" : "Continue"}
        </Button>
      </form>
    </main>
  );
}

function Row({ label, value, strong, large, className }: { label: string; value: string; strong?: boolean; large?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <span className={cn("text-sm", !strong && "text-muted-foreground")}>{label}</span>
      <span className={cn(strong && "font-semibold", large ? "text-2xl" : "text-lg")}>{value}</span>
    </div>
  );
}

/* ---------------- Step 2: hand phone to cashier, PIN pad ---------------- */

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"] as const;

function PinStep({ branch, voucher, amounts, onBack }: { branch: Branch; voucher: VoucherOption; amounts: Amounts; onBack: () => void }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [shake, setShake] = useState(0);

  async function confirm(fullPin: string) {
    setPending(true);
    setError(null);
    try {
      const res = await post("/api/redeem/confirm", { branchCode: branch.code, voucherId: voucher.id, billPaisa: amounts.bill, pin: fullPin });
      if (res.ok && res.redirectTo) {
        router.replace(res.redirectTo); // replace: Back can't return to a submittable PIN screen
        return;
      }
      setError(res.error ?? "Something went wrong.");
      setLocked(res.reason === "voucher_locked" || res.reason === "already_redeemed" || res.reason === "voucher_not_active");
      setShake((n) => n + 1);
    } catch {
      setError("Network error. Try again.");
    }
    setPin("");
    setPending(false);
  }

  function press(k: (typeof KEYS)[number]) {
    if (pending || locked || !k) return;
    if (k === "⌫") return setPin((p) => p.slice(0, -1));
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) void confirm(next);
  }

  return (
    <main className="bg-foreground text-background mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-5 pb-6">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold tracking-widest uppercase opacity-60">Step 2 of 3</span>
        <button type="button" onClick={onBack} className="py-1 underline-offset-4 opacity-70 hover:underline" disabled={pending}>
          Edit amount
        </button>
      </div>
      <h1 className="mt-3 text-center text-xl font-semibold">Hand your phone to the cashier</h1>

      <section className="bg-background/10 mt-4 rounded-2xl p-4 text-center" data-testid="cashier-summary">
        <p className="text-sm opacity-70">Hosting.com voucher at</p>
        <p className="text-lg leading-tight font-semibold">
          {branch.partnerName} · {branch.name}
        </p>
        <p className="mt-3 text-sm opacity-70">Voucher pays</p>
        <p className="text-5xl font-bold tracking-tight tabular-nums">{formatBDT(amounts.discount)}</p>
        <div className="mt-3 flex justify-center gap-6 text-sm tabular-nums">
          <span>
            <span className="opacity-70">Bill</span> {formatBDT(amounts.bill)}
          </span>
          <span>
            <span className="opacity-70">Customer pays</span> <strong>{formatBDT(amounts.customerPays)}</strong>
          </span>
        </div>
      </section>

      <p className="mt-5 text-center text-sm opacity-80">Cashier: enter your 4-digit branch PIN</p>
      <div key={shake} className={cn("mt-3 flex justify-center gap-4", shake > 0 && "animate-[perks-shake_0.4s]")} aria-label={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("size-4 rounded-full border-2 border-current", i < pin.length && "bg-current")} />
        ))}
      </div>
      <p className={cn("mt-3 min-h-5 text-center text-sm font-medium", error ? "text-red-300" : "opacity-0")} role="alert" data-testid="pin-error">
        {error ?? "."}
      </p>

      <div className="mt-auto grid grid-cols-3 gap-3 pt-4" data-testid="pinpad">
        {KEYS.map((k, i) =>
          k ? (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              disabled={pending || locked}
              aria-label={k === "⌫" ? "Delete" : k}
              className="bg-background/10 active:bg-background/25 h-16 rounded-2xl text-2xl font-semibold disabled:opacity-40"
            >
              {k}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
      {pending && <p className="mt-3 text-center text-sm opacity-70">Checking PIN…</p>}
    </main>
  );
}
