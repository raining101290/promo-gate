import { formatBDT } from "@/lib/money";

type Failure =
  | { reason: string; minBill?: number; retryAfterSeconds?: number; attemptsLeft?: number; status?: string };

/** Customer-facing text for every redeem failure (shown on the customer's phone, sometimes to the cashier). */
export function redeemFailureMessage(f: Failure): string {
  switch (f.reason) {
    case "branch_not_found":
      return "We don't recognise this café's QR code.";
    case "branch_unavailable":
      return "This café isn't accepting Hosting.com vouchers right now.";
    case "voucher_not_found":
      return "Voucher not found.";
    case "voucher_not_active":
      return f.status === "REDEEMED" ? "This voucher has already been used." : "This voucher can't be used.";
    case "voucher_expired":
      return "This voucher has expired.";
    case "voucher_locked": {
      const min = Math.ceil((f.retryAfterSeconds ?? 900) / 60);
      return `Too many wrong PINs. This voucher is locked for ${min} minute${min === 1 ? "" : "s"}.`;
    }
    case "below_min_bill":
      return `This voucher needs a bill of at least ${formatBDT(f.minBill ?? 0)}.`;
    case "invalid_bill":
      return "Enter the bill total in taka.";
    case "wrong_pin":
      return `Wrong PIN. ${f.attemptsLeft} attempt${f.attemptsLeft === 1 ? "" : "s"} left.`;
    case "already_redeemed":
      return "This voucher has already been used.";
    default:
      return "Something went wrong. Please try again.";
  }
}
