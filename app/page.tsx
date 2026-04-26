import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import MessageFeed, { type MessageRow } from "./components/MessageFeed";

export const revalidate = 300;

export default async function Home() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const today = new Date().toISOString().slice(0, 10);

  const [
    messages,
    latestRun,
    latestClassify,
    queueDepth,
    classifiedToday,
    todayBriefing,
  ] = await Promise.all([
    prisma.message.findMany({
      where: {
        postedAt: { gte: since },
        llmProcessedAt: { not: null },
        channel: { isActive: true },
      },
      orderBy: { postedAt: "desc" },
      select: {
        id: true,
        telegramPostId: true,
        text: true,
        translationEn: true,
        topic: true,
        significance: true,
        entities: true,
        summary: true,
        postedAt: true,
        channel: {
          select: { handle: true, nameEn: true, category: true },
        },
      },
    }),
    prisma.scrapeRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: { finishedAt: true },
    }),
    prisma.message.findFirst({
      where: { llmProcessedAt: { not: null } },
      orderBy: { llmProcessedAt: "desc" },
      select: { llmProcessedAt: true },
    }),
    prisma.message.count({ where: { llmProcessedAt: null } }),
    prisma.message.count({
      where: { postedAt: { gte: since }, llmProcessedAt: { not: null } },
    }),
    prisma.briefing.findUnique({
      where: { date: today },
      select: { bullets: true, generatedAt: true },
    }),
  ]);

  const rows: MessageRow[] = messages.map((m) => ({
    ...m,
    text: m.text,
    postedAt: m.postedAt.toISOString(),
  }));

  // Compute top entities server-side from the fetched messages
  const entityCounts = new Map<string, number>();
  for (const m of messages) {
    const ents = m.entities as {
      people?: string[];
      locations?: string[];
      organizations?: string[];
    } | null;
    if (!ents) continue;
    for (const list of [
      ents.people ?? [],
      ents.locations ?? [],
      ents.organizations ?? [],
    ]) {
      for (const e of list) {
        if (e.length > 1) {
          entityCounts.set(e, (entityCounts.get(e) ?? 0) + 1);
        }
      }
    }
  }
  const topEntities = [...entityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  // Compute hourly message counts (UTC hours 0–23)
  const hourlyMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourlyMap.set(h, 0);
  for (const m of messages) {
    const hour = new Date(m.postedAt).getUTCHours();
    hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);
  }
  const hourlyData = Array.from(hourlyMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ hour, count }));

  const healthStats = {
    lastScrapedAt: latestRun?.finishedAt?.toISOString() ?? null,
    lastClassifiedAt: latestClassify?.llmProcessedAt?.toISOString() ?? null,
    queueDepth,
    classifiedToday,
  };

  const briefing = todayBriefing
    ? {
        bullets: todayBriefing.bullets as string[],
        generatedAt: todayBriefing.generatedAt.toISOString(),
      }
    : null;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Telegram OSINT</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Russian-language channels · last 24h · {messages.length} classified messages
        </p>
      </header>
      <Suspense fallback={<p className="text-zinc-400 text-sm">Loading…</p>}>
        <MessageFeed
          messages={rows}
          briefing={briefing}
          healthStats={healthStats}
          topEntities={topEntities}
          hourlyData={hourlyData}
        />
      </Suspense>
    </main>
  );
}
