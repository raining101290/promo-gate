import { formatBDT, formatPercent } from "@/lib/money";

/** Plain shape (no Prisma import) so client and server components can both use it. */
export type OfferTerms = {
  offerType: "FIXED" | "PERCENT";
  /** FIXED: paisa. PERCENT: basis points. */
  value: number;
  maxDiscount: number | null;
  minBill: number | null;
};

/**
 * Maximum liability of one voucher in paisa: FIXED -> value, PERCENT -> maxDiscount.
 * Percent campaigns must have a cap (enforced by the campaign schema), so this is always bounded.
 */
export function faceValue(t: OfferTerms): number {
  if (t.offerType === "FIXED") return t.value;
  if (t.maxDiscount == null) throw new Error("PERCENT offer without maxDiscount has no face value");
  return t.maxDiscount;
}

/** Terms to copy onto a voucher at issue time. */
export function snapshotTerms(t: OfferTerms) {
  return {
    offerType: t.offerType,
    value: t.value,
    maxDiscount: t.maxDiscount,
    minBill: t.minBill,
    faceValue: faceValue(t),
  };
}

/** "৳500 off" / "15% off" */
export function offerHeadline(t: OfferTerms): string {
  return t.offerType === "FIXED" ? `${formatBDT(t.value)} off` : `${formatPercent(t.value)} off`;
}

/** Secondary lines: cap and minimum bill, when set. */
export function offerConditions(t: OfferTerms): string[] {
  const lines: string[] = [];
  if (t.offerType === "PERCENT" && t.maxDiscount != null) lines.push(`Up to ${formatBDT(t.maxDiscount)}`);
  if (t.minBill != null) lines.push(`Min. bill ${formatBDT(t.minBill)}`);
  return lines;
}
