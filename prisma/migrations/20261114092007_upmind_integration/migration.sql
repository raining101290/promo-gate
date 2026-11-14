-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('FORM', 'UPMIND');

-- CreateEnum
CREATE TYPE "UpmindDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "autoIssue" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OfferRequest" ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "source" "RequestSource" NOT NULL DEFAULT 'FORM',
ADD COLUMN     "upmindCode" TEXT;

-- CreateTable
CREATE TABLE "UpmindInbound" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "outcome" TEXT NOT NULL,
    "httpStatus" INTEGER NOT NULL,
    "detail" TEXT,
    "offerRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpmindInbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpmindDelivery" (
    "id" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "UpmindDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastStatus" INTEGER,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpmindDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UpmindInbound_createdAt_idx" ON "UpmindInbound"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UpmindDelivery_redemptionId_key" ON "UpmindDelivery"("redemptionId");

-- CreateIndex
CREATE INDEX "UpmindDelivery_status_nextAttemptAt_idx" ON "UpmindDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "UpmindDelivery_createdAt_idx" ON "UpmindDelivery"("createdAt");
