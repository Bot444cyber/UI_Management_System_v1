-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_uiId_fkey";

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_uiId_fkey" FOREIGN KEY ("uiId") REFERENCES "uis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
