-- CreateTable
CREATE TABLE "Briefing" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "bullets" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Briefing_date_key" ON "Briefing"("date");

-- CreateIndex
CREATE INDEX "Briefing_date_idx" ON "Briefing"("date");
