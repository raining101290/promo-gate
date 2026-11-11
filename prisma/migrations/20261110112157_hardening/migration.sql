-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);
