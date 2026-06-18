-- Add per-channel scrape-health signals so HTTP success is not confused with
-- actually parsing Telegram posts.
ALTER TABLE "Channel"
  ADD COLUMN "lastParsedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastNewMessageAt" TIMESTAMP(3),
  ADD COLUMN "lastNewMessages" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastEmptyScrapeAt" TIMESTAMP(3),
  ADD COLUMN "lastScrapeWarning" TEXT;
