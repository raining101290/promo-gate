/*
  Warnings:

  - Added the required column `createdById` to the `Settlement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "paidById" TEXT;

-- CreateIndex
CREATE INDEX "Settlement_createdById_idx" ON "Settlement"("createdById");

-- CreateIndex
CREATE INDEX "Settlement_paidById_idx" ON "Settlement"("paidById");

-- CreateIndex
CREATE INDEX "Settlement_status_createdAt_idx" ON "Settlement"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
