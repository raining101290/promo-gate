import { describe, expect, it } from "vitest";

import { computeDiscount, quoteRedemption } from "@/lib/money";
import type { OfferTerms } from "@/lib/offer";

const fixed500: OfferTerms = { offerType: "FIXED", value: 500_00, maxDiscount: null, minBill: null };
const pct20cap300: OfferTerms = { offerType: "PERCENT", value: 2000, maxDiscount: 300_00, minBill: null };

describe("computeDiscount / quoteRedemption (all paisa)", () => {
  it("fixed: voucher pays its value when the bill is larger", () => {
    expect(quoteRedemption(fixed500, 1000_00)).toEqual({ ok: true, bill: 1000_00, discount: 500_00, customerPays: 500_00 });
  });

  it("fixed: bill smaller than the voucher -> voucher covers the bill, customer pays 0", () => {
    expect(quoteRedemption(fixed500, 320_00)).toEqual({ ok: true, bill: 320_00, discount: 320_00, customerPays: 0 });
  });

  it("percent below the cap", () => {
    expect(computeDiscount(pct20cap300, 1000_00)).toBe(200_00);
  });

  it("percent is capped at maxDiscount", () => {
    expect(computeDiscount(pct20cap300, 2500_00)).toBe(300_00);
    expect(computeDiscount(pct20cap300, 1_000_000_00)).toBe(300_00);
  });

  it("percent rounds DOWN to the paisa (never over-reimburses)", () => {
    // 777.77 * 20% = 155.554 -> 155.55
    expect(computeDiscount(pct20cap300, 777_77)).toBe(155_55);
  });

  it("percent without a cap still never exceeds the bill", () => {
    expect(computeDiscount({ offerType: "PERCENT", value: 10_000, maxDiscount: null, minBill: null }, 450_00)).toBe(450_00);
  });

  it("enforces the campaign minBill", () => {
    const terms: OfferTerms = { ...pct20cap300, minBill: 500_00 };
    expect(quoteRedemption(terms, 499_99)).toEqual({ ok: false, reason: "below_min_bill", minBill: 500_00 });
    expect(quoteRedemption(terms, 500_00)).toMatchObject({ ok: true, discount: 100_00 });
  });

  it("rejects zero, negative, fractional-paisa and absurd bills", () => {
    for (const bill of [0, -100, 10.5, 100_000_01]) expect(quoteRedemption(fixed500, bill)).toEqual({ ok: false, reason: "invalid_bill" });
  });
});
