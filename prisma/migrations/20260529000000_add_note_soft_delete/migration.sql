-- AlterTable
ALTER TABLE "Note" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Note_deletedAt_idx" ON "Note"("deletedAt");
