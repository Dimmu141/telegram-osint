# Telegram OSINT

Telegram OSINT is a public-source monitoring dashboard for Russian, Ukrainian, and Belarusian Telegram channels. It scrapes public Telegram web previews, stores new posts in Postgres, translates and classifies them with LLMs, and serves a filtered analyst feed with RSS and health checks.

The project is built for Nordic journalists, security analysts, and researchers who need a fast way to scan Russian-language Telegram without treating the feed as verified ground truth.

## What It Does

- Monitors 63 hand-curated public Telegram channels from `config/channels.yaml`.
- Scrapes `https://t.me/s/<handle>` public HTML previews. No Telegram account or API key is required for scraping.
- Stores channels, messages, scrape runs, and daily briefings in Postgres via Prisma.
- Translates posts to English and classifies topic, significance, entities, and summary.
- Generates a daily briefing from high-significance posts.
- Exposes a web dashboard, message permalinks, a channel transparency page, RSS, and `/api/health`.

## Stack

- Next.js 16 App Router
- React 19
- Prisma 5 with Postgres/Supabase
- Cheerio for Telegram HTML parsing
- Gemini 2.5 Flash-Lite for primary classification
- Groq as classification fallback and daily briefing model
- GitHub Actions for scheduled scraping, classification, and briefing jobs
- Vercel for hosting

## Repository Map

- `app/` - Next.js pages, routes, feed UI, health endpoint, and RSS route.
- `lib/telegram-scraper.ts` - public Telegram HTML scraper and parser.
- `lib/classifier.ts` - LLM classification pipeline.
- `scripts/` - CLI entrypoints used locally and by GitHub Actions.
- `config/channels.yaml` - monitored channel list and editorial metadata.
- `prisma/schema.prisma` - database models.
- `.github/workflows/` - scheduled scrape, classify, and briefing jobs.
- `tests/` - lightweight smoke tests for code that can run without a live database.

## Requirements

- Node.js 20 or newer
- npm
- A Postgres database
- Gemini API key for classification
- Groq API key for fallback classification and daily briefing

## Environment

Copy `.env.example` to `.env.local` for local Next.js development, or configure the same variables in Vercel and GitHub Actions secrets.

Required:

```bash
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
GEMINI_API_KEY="..."
GROQ_API_KEY="..."
```

Recommended:

```bash
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

`DATABASE_URL` is used by Prisma at runtime. `DIRECT_URL` is used by Prisma for direct database access, especially with pooled Supabase connections.

## Local Setup

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open `http://localhost:3000`.

The app expects the database to contain channels and messages. The scraper will upsert channels from `config/channels.yaml` when it runs.

## Operations

Run a scrape manually:

```bash
npx tsx scripts/scrape.ts --triggered-by=manual
```

Run classification manually:

```bash
npx tsx scripts/classify.ts
```

Generate the daily briefing manually:

```bash
npx tsx scripts/briefing.ts
```

Check pipeline health:

```bash
curl http://localhost:3000/api/health
```

## Scheduled Jobs

GitHub Actions currently runs:

- Scraper every 30 minutes.
- Classifier hourly at minute 15.
- Daily briefing at 07:00 UTC.

These workflows require `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, and `GROQ_API_KEY` as repository secrets.

## Testing

Run the lightweight parser smoke test:

```bash
npm test
```

Run linting:

```bash
npm run lint
```

Build the production app:

```bash
npm run build
```

Full build and runtime checks need valid database credentials because server-rendered pages query Prisma.

## Data And Methodology Caveats

This project monitors public Telegram channels only. It does not access private channels, use a Telegram account, use the Bot API, or download media.

The output is not verification. Telegram posts can be propaganda, rumor, satire, recycled claims, or deliberate information operations. LLM translations and classifications can also be wrong, especially for military jargon, place names, transliteration, and ambiguous source framing. Treat the dashboard as a triage layer and verify high-stakes claims against primary sources before publishing.

## Health Signals

The app exposes `/api/health`, which reports:

- last scrape time
- last classification time
- unprocessed queue depth
- messages classified in the last 24 hours
- last scrape success/failure counts

A healthy deployment should have recent scrape and classification timestamps and a queue depth below the configured warning threshold.
