// Money is integer paisa everywhere (1 BDT = 100 paisa). Format only at the edge.
import type { OfferTerms } from "@/lib/offer";


const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const fractional = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 50000 -> "৳500", 125050 -> "৳1,250.50" (South Asian digit grouping). */
export function formatBDT(paisa: number): string {
  const taka = paisa / 100;
  return `৳${paisa % 100 === 0 ? whole.format(taka) : fractional.format(taka)}`;
}

/** Basis points -> "15%" / "12.5%". */
export function formatPercent(basisPoints: number): string {
  return `${basisPoints / 100}%`;
}

/** "500" | "12.5" | "1,250.50" -> paisa, or null if not a valid non-negative taka amount. No floats. */
export function parseTakaToPaisa(input: string): number | null {
  const v = input.trim().replace(/,/g, "");
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(v);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** "15" | "12.5" -> basis points (1500 / 1250), or null. */
export function parsePercentToBp(input: string): number | null {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** paisa -> plain input string ("500", "12.50") for editing forms. */
export function paisaToInput(paisa: number | null): string {
  if (paisa == null) return "";
  return paisa % 100 === 0 ? String(paisa / 100) : (paisa / 100).toFixed(2);
}

/** "1,250.50" / "500": the amount without the ৳ sign (for "record 500 BDT" style copy). */
export function formatTakaAmount(paisa: number): string {
  return formatBDT(paisa).slice(1);
}

/** Largest bill we accept at a counter: ৳100,000. Anything above is almost certainly a typo. */
export const MAX_BILL_PAISA = 100_000_00;

/**
 * THE discount rule (single source of truth, used by the UI preview and the redeem transaction).
 * FIXED: min(value, bill). PERCENT: min(floor(bill * bp / 10000), maxDiscount, bill). All paisa.
 */
export function computeDiscount(terms: OfferTerms, billPaisa: number): number {
  if (terms.offerType === "FIXED") return Math.min(terms.value, billPaisa);
  const pct = Math.floor((billPaisa * terms.value) / 10_000);
  return Math.min(pct, terms.maxDiscount ?? Number.POSITIVE_INFINITY, billPaisa);
}

export type RedemptionQuote =
  | { ok: true; bill: number; discount: number; customerPays: number }
  | { ok: false; reason: "invalid_bill" }
  | { ok: false; reason: "below_min_bill"; minBill: number };

/** Validates the bill (incl. the voucher's minBill) and splits it into voucher part + customer part. */
export function quoteRedemption(terms: OfferTerms, billPaisa: number): RedemptionQuote {
  if (!Number.isInteger(billPaisa) || billPaisa <= 0 || billPaisa > MAX_BILL_PAISA) return { ok: false, reason: "invalid_bill" };
  if (terms.minBill != null && billPaisa < terms.minBill) return { ok: false, reason: "below_min_bill", minBill: terms.minBill };
  const discount = computeDiscount(terms, billPaisa);
  return { ok: true, bill: billPaisa, discount, customerPays: billPaisa - discount };
}
