/**
 * Diagnostic: find channels with zero messages in the last 48h.
 * Run: npx tsx scripts/check-channels.ts
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const channels = await prisma.channel.findMany({
    select: {
      handle: true,
      nameEn: true,
      category: true,
      lastScrapedAt: true,
      consecutiveErrors: true,
      lastError: true,
      isActive: true,
      _count: { select: { messages: { where: { postedAt: { gte: since } } } } },
    },
    orderBy: { handle: "asc" },
  });

  const dead: typeof channels = [];
  const quiet: typeof channels = [];
  const ok: typeof channels = [];

  for (const c of channels) {
    const n = c._count.messages;
    if (n === 0) dead.push(c);
    else if (n < 3) quiet.push(c);
    else ok.push(c);
  }

  console.log(`\n=== ${channels.length} channels in DB ===\n`);
  console.log(`OK (≥3 msgs in 48h): ${ok.length}`);
  console.log(`QUIET (1-2 msgs):    ${quiet.length}`);
  console.log(`DEAD (0 msgs):       ${dead.length}\n`);

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
