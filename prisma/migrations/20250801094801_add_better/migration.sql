-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN "clickedAt" DATETIME;
ALTER TABLE "EmailLog" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "EmailLog" ADD COLUMN "openedAt" DATETIME;
ALTER TABLE "EmailLog" ADD COLUMN "userAgent" TEXT;
