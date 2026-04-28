import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function relTime(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function main() {
  console.log("\n=== TELEGRAM OSINT PIPELINE DIAGNOSTIC ===");
  console.log(`Now: ${new Date().toISOString()}\n`);

  // 1. Recent scrape runs
  const runs = await prisma.scrapeRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
    select: {
      startedAt: true,
      finishedAt: true,
      channelsAttempted: true,
      channelsSucceeded: true,
      channelsFailed: true,
      newMessages: true,
      triggeredBy: true,
      errorSummary: true,
    },
  });

  console.log("--- RECENT SCRAPE RUNS -----------------------------");
  for (const r of runs) {
    const dur = r.finishedAt
      ? Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000)
      : "?";
    console.log(
      `${r.startedAt.toISOString()} (${relTime(r.startedAt).padStart(12)})  ` +
        `${String(r.channelsSucceeded).padStart(2)}/${r.channelsAttempted} ok, ` +
        `${String(r.channelsFailed).padStart(2)} fail, ` +
        `${String(r.newMessages).padStart(4)} new msgs, ${dur}s  [${r.triggeredBy}]`
    );
    if (r.errorSummary) {
      const firstLine = r.errorSummary.split("\n")[0]?.slice(0, 100);
      console.log(`   warning: ${firstLine}...`);
    }
  }

  // 2. Most recent message overall
  const newestMsg = await prisma.message.findFirst({
    orderBy: { postedAt: "desc" },
    select: {
      postedAt: true,
      scrapedAt: true,
      llmProcessedAt: true,
      channel: { select: { handle: true } },
    },
  });
  console.log("\n--- MOST RECENT MESSAGE OVERALL --------------------");
  if (newestMsg) {
    console.log(
      `posted:    ${newestMsg.postedAt.toISOString()} (${relTime(newestMsg.postedAt)})`
    );
    console.log(
      `scraped:   ${newestMsg.scrapedAt.toISOString()} (${relTime(newestMsg.scrapedAt)})`
    );
    console.log(
      `classified: ${newestMsg.llmProcessedAt ? newestMsg.llmProcessedAt.toISOString() + " (" + relTime(newestMsg.llmProcessedAt) + ")" : "NOT YET"}`
    );
    console.log(`channel:   @${newestMsg.channel.handle}`);
  }

  // 3. Most recent classified message
  const newestClassified = await prisma.message.findFirst({
    where: { llmProcessedAt: { not: null } },
    orderBy: { llmProcessedAt: "desc" },
    select: {
      llmProcessedAt: true,
      postedAt: true,
      llmModel: true,
      channel: { select: { handle: true } },
    },
  });
  console.log("\n--- MOST RECENT CLASSIFIED MESSAGE -----------------");
  if (newestClassified) {
    console.log(
      `classified: ${newestClassified.llmProcessedAt!.toISOString()} (${relTime(newestClassified.llmProcessedAt!)})`
    );
    console.log(
      `posted:    ${newestClassified.postedAt.toISOString()} (${relTime(newestClassified.postedAt)})`
    );
    console.log(`model:     ${newestClassified.llmModel ?? "?"}`);
  }

  // 4. Classification queue
  const queueDepth = await prisma.message.count({
    where: { llmProcessedAt: null },
  });
  console.log(`\n--- CLASSIFICATION QUEUE ---------------------------`);
  console.log(`Unprocessed messages: ${queueDepth}`);

  // 5. Hourly post counts (last 24h, by postedAt)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.message.findMany({
    where: { postedAt: { gte: since } },
    select: { postedAt: true, scrapedAt: true, llmProcessedAt: true },
  });

  const hourlyPosted = new Map<number, number>();
  const hourlyScraped = new Map<number, number>();
  const hourlyClassified = new Map<number, number>();
  for (let h = 0; h < 24; h++) {
    hourlyPosted.set(h, 0);
    hourlyScraped.set(h, 0);
    hourlyClassified.set(h, 0);
  }
  for (const m of recent) {
    const phoursAgo = Math.floor((Date.now() - m.postedAt.getTime()) / 3_600_000);
    const shoursAgo = Math.floor((Date.now() - m.scrapedAt.getTime()) / 3_600_000);
    if (phoursAgo < 24) hourlyPosted.set(phoursAgo, (hourlyPosted.get(phoursAgo) ?? 0) + 1);
    if (shoursAgo < 24) hourlyScraped.set(shoursAgo, (hourlyScraped.get(shoursAgo) ?? 0) + 1);
    if (m.llmProcessedAt) {
      const choursAgo = Math.floor((Date.now() - m.llmProcessedAt.getTime()) / 3_600_000);
      if (choursAgo < 24) hourlyClassified.set(choursAgo, (hourlyClassified.get(choursAgo) ?? 0) + 1);
    }
  }

  console.log("\n--- HOURLY MESSAGE FLOW (last 24h) -----------------");
  console.log(`hours ago  posted  scraped  classified`);
  for (let h = 0; h < 24; h++) {
    const p = hourlyPosted.get(h) ?? 0;
    const s = hourlyScraped.get(h) ?? 0;
    const c = hourlyClassified.get(h) ?? 0;
    if (p === 0 && s === 0 && c === 0) continue;
    const bar = "#".repeat(Math.min(40, Math.round(p / 3)));
    console.log(
      `${String(h).padStart(2)}h        ${String(p).padStart(4)}    ${String(s).padStart(4)}     ${String(c).padStart(5)}   ${bar}`
    );
  }

  // 6. Channels: last scraped time
  const channels = await prisma.channel.findMany({
    where: { isActive: true },
    orderBy: { lastScrapedAt: "desc" },
    select: {
      handle: true,
      lastScrapedAt: true,
      lastParsedCount: true,
      lastNewMessages: true,
      lastScrapeWarning: true,
      consecutiveErrors: true,
      lastError: true,
    },
  });

  const stale = channels.filter(
    (c) =>
      !c.lastScrapedAt ||
      Date.now() - c.lastScrapedAt.getTime() > 60 * 60 * 1000
  );
  console.log(
    `\n--- CHANNELS NOT SCRAPED IN >60 MIN: ${stale.length} of ${channels.length} ---`
  );
  for (const c of stale.slice(0, 20)) {
    console.log(
      `  @${c.handle.padEnd(28)} ${c.lastScrapedAt ? relTime(c.lastScrapedAt) : "NEVER"}  ` +
        `errors: ${c.consecutiveErrors}` +
        (c.lastError ? `  [${c.lastError.slice(0, 60)}]` : "")
    );
  }

  // 7. Channels with errors
  const errored = channels.filter((c) => c.consecutiveErrors > 0);
  console.log(`\n--- CHANNELS WITH ERRORS: ${errored.length} ---`);
  for (const c of errored.slice(0, 20)) {
    console.log(
      `  @${c.handle.padEnd(28)} errors=${c.consecutiveErrors}  ` +
        `last_scraped=${c.lastScrapedAt ? relTime(c.lastScrapedAt) : "NEVER"}` +
        (c.lastError ? `\n     [${c.lastError.slice(0, 120)}]` : "")
    );
  }

  const emptyPreview = channels.filter(
    (c) => c.lastScrapeWarning || (c.lastScrapedAt && c.lastParsedCount === 0)
  );
  console.log(`\n--- CHANNELS WITHOUT PUBLIC POSTS: ${emptyPreview.length} ---`);
  for (const c of emptyPreview.slice(0, 30)) {
    console.log(
      `  @${c.handle.padEnd(28)} parsed=${String(c.lastParsedCount).padStart(2)} ` +
        `new=${String(c.lastNewMessages).padStart(2)} last_scraped=${c.lastScrapedAt ? relTime(c.lastScrapedAt) : "NEVER"}` +
        (c.lastScrapeWarning ? `\n     [${c.lastScrapeWarning.slice(0, 120)}]` : "")
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
