-- AlterTable
ALTER TABLE "SmsLog" ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "purpose" TEXT;
