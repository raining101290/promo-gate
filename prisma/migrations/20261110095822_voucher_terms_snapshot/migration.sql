-- Snapshot campaign terms onto each voucher. Add nullable, backfill from the campaign, then enforce NOT NULL.
ALTER TABLE "Voucher"
  ADD COLUMN "offerType"   "OfferType",
  ADD COLUMN "value"       INTEGER,
  ADD COLUMN "maxDiscount" INTEGER,
  ADD COLUMN "minBill"     INTEGER,
  ADD COLUMN "faceValue"   INTEGER;

UPDATE "Voucher" v
SET "offerType"   = c."offerType",
    "value"       = c."value",
    "maxDiscount" = c."maxDiscount",
    "minBill"     = c."minBill",
    "faceValue"   = CASE WHEN c."offerType" = 'FIXED' THEN c."value" ELSE COALESCE(c."maxDiscount", 0) END
FROM "Campaign" c
WHERE c.id = v."campaignId";

ALTER TABLE "Voucher"
  ALTER COLUMN "offerType" SET NOT NULL,
  ALTER COLUMN "value"     SET NOT NULL,
  ALTER COLUMN "faceValue" SET NOT NULL;
