-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "nameRu" TEXT,
    "nameEn" TEXT,
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "notes" TEXT,
    "inOriginalList" BOOLEAN NOT NULL DEFAULT false,
    "lastScrapedAt" TIMESTAMP(3),
    "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "telegramPostId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "views" TEXT,
    "hasMedia" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "translationEn" TEXT,
    "translationFi" TEXT,
    "topic" TEXT,
    "entities" JSONB,
    "summary" TEXT,
    "llmProcessedAt" TIMESTAMP(3),
    "llmModel" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "channelsAttempted" INTEGER NOT NULL DEFAULT 0,
    "channelsSucceeded" INTEGER NOT NULL DEFAULT 0,
    "channelsFailed" INTEGER NOT NULL DEFAULT 0,
    "newMessages" INTEGER NOT NULL DEFAULT 0,
    "triggeredBy" TEXT NOT NULL,
    "errorSummary" TEXT,

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_handle_key" ON "Channel"("handle");

-- CreateIndex
CREATE INDEX "Channel_category_idx" ON "Channel"("category");

-- CreateIndex
CREATE INDEX "Channel_priority_idx" ON "Channel"("priority");

-- CreateIndex
CREATE INDEX "Channel_isActive_idx" ON "Channel"("isActive");

-- CreateIndex
CREATE INDEX "Message_postedAt_idx" ON "Message"("postedAt" DESC);

-- CreateIndex
CREATE INDEX "Message_channelId_postedAt_idx" ON "Message"("channelId", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "Message_llmProcessedAt_idx" ON "Message"("llmProcessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_channelId_telegramPostId_key" ON "Message"("channelId", "telegramPostId");

-- CreateIndex
CREATE INDEX "ScrapeRun_startedAt_idx" ON "ScrapeRun"("startedAt" DESC);

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
