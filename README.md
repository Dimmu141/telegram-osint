# Telegram OSINT

Telegram OSINT is a public-source monitoring dashboard for Russian, Ukrainian, and Belarusian Telegram channels. It scrapes public Telegram web previews, stores new posts in Postgres, translates and classifies them with LLMs, and serves a filtered analyst feed with RSS, channel transparency, and live pipeline status.

The project is built for Nordic journalists, security analysts, and researchers who need a fast way to scan Russian-language Telegram without treating the feed as verified ground truth.

## What It Does

- Monitors hand-curated public Telegram channels from `config/channels.yaml` plus `config/russian-expansion.yaml`.
- Scrapes `https://t.me/s/<handle>` public HTML previews. No Telegram account or API key is required for scraping.
- Stores channels, messages, scrape runs, and daily briefings in Postgres via Prisma.
- Translates posts to English and classifies topic, significance, entities, and summary.
- Generates a daily briefing from high-significance posts.
- Exposes a web dashboard, message permalinks, a channel transparency page, RSS, `/api/health`, and a human-readable `/status` page.

## Product Surfaces

- `/` - analyst feed for the last 24 hours, with briefing, filters, entities, and pipeline summary.
- `/channels` - channel transparency page with source category, stance, priority, notes, and scrape state.
- `/nordic` - 72-hour watch view for Nordic, Baltic, NATO, Arctic, and nearby escalation terms.
- `/narratives` - seven-day tracker for recurring claims and propaganda themes.
- `/status` - operational trust view showing freshness, queue depth, model mix, scrape failures, and recent runs.
- `/feed.xml` - RSS feed for high and critical significance items.
- `/api/health` - machine-readable health endpoint for monitors.

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

- `app/` - Next.js pages, routes, feed UI, status page, health endpoint, and RSS route.
- `lib/telegram-scraper.ts` - public Telegram HTML scraper and parser.
- `lib/classifier.ts` - LLM classification pipeline.
- `scripts/` - CLI entrypoints used locally and by GitHub Actions.
- `config/channels.yaml` - core monitored channel list and editorial metadata.
- `config/russian-expansion.yaml` - additional Russian channels to broaden domestic, independent, and Z-channel coverage.
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

Open the human-readable operations view:

```bash
open http://localhost:3000/status
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

The app exposes both `/status` and `/api/health`, reporting:

- last scrape time
- last classification time
- unprocessed queue depth
- messages classified in the last 24 hours
- model mix across recent classifications
- last scrape success/failure counts
- channels with recent scrape errors
- recent scrape runs

A healthy deployment should have recent scrape and classification timestamps, few repeated channel errors, and a queue depth below the configured warning threshold.
