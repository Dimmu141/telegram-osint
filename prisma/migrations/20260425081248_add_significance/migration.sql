-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "significance" TEXT;

-- CreateIndex
CREATE INDEX "Message_significance_idx" ON "Message"("significance");
