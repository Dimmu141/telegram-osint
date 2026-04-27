import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import MessageFeed, { type MessageRow, type HealthStats } from "./components/MessageFeed";

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
        channel: { select: { handle: true, nameEn: true, category: true } },
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
    postedAt: m.postedAt.toISOString(),
  }));

  const entityCounts = new Map<string, number>();
  for (const m of messages) {
    const ents = m.entities as { people?: string[]; locations?: string[]; organizations?: string[] } | null;
    if (!ents) continue;
    for (const list of [ents.people ?? [], ents.locations ?? [], ents.organizations ?? []]) {
      for (const e of list) {
        if (e.length > 1) entityCounts.set(e, (entityCounts.get(e) ?? 0) + 1);
      }
    }
  }
  const topEntities = [...entityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  const hourlyMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourlyMap.set(h, 0);
  for (const m of messages) {
    const hour = new Date(m.postedAt).getUTCHours();
    hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);
  }
  const hourlyData = Array.from(hourlyMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ hour, count }));

  const healthStats: HealthStats = {
    lastScrapedAt: latestRun?.finishedAt?.toISOString() ?? null,
    lastClassifiedAt: latestClassify?.llmProcessedAt?.toISOString() ?? null,
    queueDepth,
    classifiedToday,
    totalChannels: 63,
  };

  const briefing = todayBriefing
    ? {
        bullets: todayBriefing.bullets as string[],
        generatedAt: todayBriefing.generatedAt.toISOString(),
      }
    : null;

  const nowStr = new Date().toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a href="/" className="brand">
            <div className="brand-mark">tg</div>
            <div>
              <div className="brand-name">Telegram OSINT</div>
              <div className="brand-sub">public · open source</div>
            </div>
          </a>
          <div className="top-status">
            <div className="stat"><span className="dot" /> <b>live</b></div>
            <div className="stat">
              scraped <b>{healthStats.lastScrapedAt ? formatRelativeServer(healthStats.lastScrapedAt) : "—"}</b>
            </div>
            <div className="stat">
              classified <b>{healthStats.lastClassifiedAt ? formatRelativeServer(healthStats.lastClassifiedAt) : "—"}</b>
            </div>
            <div className="stat">queue <b>{queueDepth}</b></div>
            <div className="stat"><b>{healthStats.totalChannels}</b> channels · <b>{classifiedToday}</b> today</div>
          </div>
          <div className="top-actions">
            <a href="/channels" className="nav-link">Channels</a>
            <a href="/status" className="nav-link">Status</a>
            <a href="/about" className="nav-link">About</a>
            <a href="/feed.xml" className="nav-link" title="RSS feed">RSS</a>
            <a href="https://github.com/Dimmu141/telegram-osint" target="_blank" rel="noopener noreferrer" className="icon-btn" title="GitHub">↗</a>
          </div>
        </div>
      </header>

      <Suspense fallback={
        <div style={{ padding: "40px", fontFamily: "var(--mono)", fontSize: "12px", color: "var(--ink-4)" }}>
          Loading feed...
        </div>
      }>
        <MessageFeed
          messages={rows}
          briefing={briefing}
          healthStats={healthStats}
          topEntities={topEntities}
          hourlyData={hourlyData}
          nowStr={nowStr}
          totalCount={classifiedToday}
        />
      </Suspense>
    </>
  );
}

function formatRelativeServer(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
