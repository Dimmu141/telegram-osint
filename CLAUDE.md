# CLAUDE.md — Telegram OSINT Project Brief
# This file is for Claude (AI assistant) to read when opening this project.
# It summarises exactly where we are and what needs doing next.

## What this project is

A free Telegram OSINT scraper and classifier for a Nordic (Finnish) audience.
It scrapes ~47 Russian/Ukrainian/Belarusian Telegram channels via the public
HTML preview at https://t.me/s/<handle>, stores messages in Supabase Postgres,
and classifies them using the Gemini 2.5 Flash-Lite API (free tier).

The end goal is a public-facing web product showing translated and classified
Russian Telegram content, aimed at Finnish journalists, researchers, and
security analysts.

## Tech stack

- Next.js 14 App Router, TypeScript, Tailwind CSS
- Prisma 5 (NOT v7 — we deliberately downgraded, do not upgrade)
- Supabase Postgres (free tier)
- Gemini 2.5 Flash-Lite API (free tier, model ID: gemini-2.5-flash-lite)
- Cheerio for HTML scraping
- js-yaml for config parsing
- tsx for running scripts

## Project structure

```
config/
  channels.yaml         # 47 channels with handle, category, stance, priority
lib/
  telegram-scraper.ts   # Scraping logic — fetches t.me/s/<handle>, parses HTML,
                        # stores messages in DB, deduplicates via unique constraint
  classifier.ts         # Gemini classification — translates EN+FI, classifies
                        # topic, extracts entities, writes summary
scripts/
  scrape.ts             # CLI: npx tsx scripts/scrape.ts
  classify.ts           # CLI: npx tsx scripts/classify.ts
prisma/
  schema.prisma         # 3 models: Channel, Message, ScrapeRun
.github/workflows/      # NOT YET CREATED — needs scrape + classify workflows
app/                    # Next.js app — frontend NOT YET BUILT
```

## Database models (Prisma)

Channel: handle, nameRu, nameEn, category, language, stance, priority,
         sourceType, notes, inOriginalList, lastScrapedAt, consecutiveErrors,
         lastError, isActive

Message: channelId, telegramPostId, text, views, hasMedia, postedAt, scrapedAt,
         translationEn, translationFi, topic, entities (Json), summary,
         llmProcessedAt, llmModel
         UNIQUE: [channelId, telegramPostId]

ScrapeRun: startedAt, finishedAt, channelsAttempted, channelsSucceeded,
           channelsFailed, newMessages, triggeredBy, errorSummary

## Current status (as of 2026-04-19)

DONE:
- Full project scaffold (Next.js + Prisma + Supabase connected)
- Prisma migration run successfully — all tables exist in Supabase
- Scraper working: 47/47 channels succeed, ~550 messages in DB
- Classifier partially working: ~120/200 messages classified
- Known issue: classifier has a bug where Gemini occasionally returns
  modified IDs that don't match DB records, causing update failures.
  Fix has been designed but NOT yet applied to classifier.ts (see below).

## The fix that needs to be applied to lib/classifier.ts RIGHT NOW

The writeResults function currently uses Promise.all which fails the entire
batch if any single ID doesn't match. It needs to be replaced with a
loop that validates IDs and handles individual failures gracefully.

Replace the writeResults function with:

  async function writeResults(
    prisma: PrismaClient,
    results: ClassifiedMessage[],
    validIds: Set<string>,
    modelName: string
  ): Promise<void> {
    const validResults = results.filter((r) => validIds.has(r.id));
    for (const r of validResults) {
      try {
        await prisma.message.update({
          where: { id: r.id },
          data: {
            translationEn: r.translation_en,
            translationFi: r.translation_fi,
            topic: r.topic,
            entities: r.entities,
            summary: r.summary,
            llmProcessedAt: new Date(),
            llmModel: modelName,
          },
        });
      } catch {
        // skip individual failures silently
      }
    }
  }

And update the call site inside runClassification from:
  await writeResults(prisma, results, modelName);
To:
  const validIds = new Set(inputs.map((m) => m.id));
  await writeResults(prisma, results, validIds, modelName);

After applying this fix, run: npx tsx scripts/classify.ts
It will automatically pick up the ~350 unprocessed messages.

## Environment variables needed (.env file)

DATABASE_URL       — Supabase transaction pooler connection string (port 6543)
DIRECT_URL         — Supabase direct connection string (port 5432)
CRON_SECRET        — random string for securing the Vercel cron endpoint
GEMINI_API_KEY     — Google AI Studio API key (aistudio.google.com)

## What needs to be built next (in priority order)

### 1. Fix the classifier bug (see above) — 5 minutes

### 2. GitHub Actions workflows — 30 minutes
Create .github/workflows/scrape.yml to run every 30 minutes:
  - runs: npx prisma generate && npx tsx scripts/scrape.ts
  - needs secrets: DATABASE_URL, DIRECT_URL
Create .github/workflows/classify.yml to run every 30 minutes (offset by 15):
  - runs: npx prisma generate && npx tsx scripts/classify.ts
  - needs secrets: DATABASE_URL, DIRECT_URL, GEMINI_API_KEY

### 3. Frontend — the main thing left to build
A Next.js page at app/page.tsx showing:
- Messages from the last 24h
- Grouped by channel category (state_media, milblogger, exile_independent etc.)
- Each message shows: channel name, time, Finnish translation, English translation,
  topic badge, summary, entity tags
- Filter chips at the top: All / Military / Political / Economic / Propaganda
- Toggle between Finnish and English translation
- Mobile-friendly layout

### 4. Weekly digest generator (after frontend)
A script that generates a Markdown summary of the week's top themes,
one section per channel category, auto-exported on Sunday.

### 5. GitHub push + Vercel deploy (after frontend)
Push to GitHub, connect to Vercel, set environment variables in Vercel dashboard.

## Important constraints

- DO NOT upgrade Prisma to v7. Stay on v5.x. v7 breaks the schema format.
- The Gemini model ID is exactly: gemini-2.5-flash-lite
- Batch size for classification is 10 messages, with 5 second delays between
  batches to stay under the 15 RPM free tier limit.
- channels.yaml is the source of truth for channel metadata. The DB syncs
  from it on every scrape run. Edit the YAML, not the DB directly.
- The scraper uses t.me/s/<handle> HTML scraping — no Telegram API key needed.

## Running the project locally

npm install
npx prisma generate
npx tsx scripts/scrape.ts      # scrape new messages
npx tsx scripts/classify.ts    # classify unprocessed messages
npm run dev                    # start Next.js dev server (frontend not built yet)

## Key design decisions already made

- Scraping batches 5 channels at a time with 1s delay between batches
- Deduplication uses Prisma createMany with skipDuplicates: true
- Classification batches 10 messages per Gemini call using responseMimeType: application/json
- Channel metadata (category, stance etc.) is included in each Gemini prompt
  so the model understands the editorial context of each message
- Messages are processed newest-first so the most recent content gets
  translated before older backlog
