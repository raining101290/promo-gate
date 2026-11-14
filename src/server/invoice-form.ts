import "server-only";

/**
 * The public "submit your invoice" form. Off by default: vouchers now come from Upmind paid-invoice
 * pushes. INVOICE_FORM=on brings the form (and /api/offer-requests) back as a fallback.
 */
export function invoiceFormEnabled(): boolean {
  return process.env.INVOICE_FORM === "on";
}
