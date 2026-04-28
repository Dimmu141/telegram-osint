/**
 * Diagnostic: find channels with zero messages in the last 48h.
 * Run: npx tsx scripts/check-channels.ts
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const channels = await prisma.channel.findMany({
    where: { isActive: true },
    select: {
      handle: true,
      nameEn: true,
      category: true,
      lastScrapedAt: true,
      lastParsedCount: true,
      lastNewMessages: true,
      lastScrapeWarning: true,
      consecutiveErrors: true,
      lastError: true,
      isActive: true,
      _count: { select: { messages: { where: { postedAt: { gte: since } } } } },
    },
    orderBy: { handle: "asc" },
  });

  const dead: typeof channels = [];
  const emptyPreview: typeof channels = [];
  const quiet: typeof channels = [];
  const ok: typeof channels = [];

  for (const c of channels) {
    if (c.lastScrapeWarning || (c.lastScrapedAt && c.lastParsedCount === 0)) {
      emptyPreview.push(c);
    }
    const n = c._count.messages;
    if (n === 0) dead.push(c);
    else if (n < 3) quiet.push(c);
    else ok.push(c);
  }

  console.log(`\n=== ${channels.length} active channels in DB (inactive ones excluded) ===\n`);
  console.log(`OK (>=3 msgs in 48h): ${ok.length}`);
  console.log(`QUIET (1-2 msgs):    ${quiet.length}`);
  console.log(`DEAD (0 msgs):       ${dead.length}\n`);
  console.log(`NO PUBLIC POSTS:     ${emptyPreview.length}\n`);

  if (emptyPreview.length) {
    console.log("--- CHANNELS WITHOUT PUBLIC POSTS (HTTP ok, zero parsed posts last scrape) ---");
    for (const c of emptyPreview) {
      const last = c.lastScrapedAt ? c.lastScrapedAt.toISOString() : "never";
      const warn = c.lastScrapeWarning ? ` | warn: ${c.lastScrapeWarning.slice(0, 80)}` : "";
      console.log(`  ${c.handle.padEnd(28)} parsed=${String(c.lastParsedCount).padStart(2)} new=${String(c.lastNewMessages).padStart(2)} lastScraped=${last}${warn}`);
    }
  }

  if (dead.length) {
    console.log("--- DEAD CHANNELS (zero messages in last 48h) ---");
    for (const c of dead) {
      const last = c.lastScrapedAt ? c.lastScrapedAt.toISOString() : "never";
      const err = c.lastError ? ` | err: ${c.lastError.slice(0, 80)}` : "";
      console.log(`  ${c.handle.padEnd(28)} cat=${c.category.padEnd(22)} lastScraped=${last}${err}`);
    }
  }

  if (quiet.length) {
    console.log("\n--- QUIET CHANNELS (1-2 messages in last 48h) ---");
    for (const c of quiet) {
      console.log(`  ${c.handle.padEnd(28)} cat=${c.category.padEnd(22)} count=${c._count.messages}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
