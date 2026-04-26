import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [latestRun, queueDepth, latestClassify, totalToday] =
      await Promise.all([
        prisma.scrapeRun.findFirst({
          orderBy: { startedAt: "desc" },
          select: {
            finishedAt: true,
            startedAt: true,
            channelsSucceeded: true,
            channelsFailed: true,
            newMessages: true,
          },
        }),
        prisma.message.count({ where: { llmProcessedAt: null } }),
        prisma.message.findFirst({
          where: { llmProcessedAt: { not: null } },
          orderBy: { llmProcessedAt: "desc" },
          select: { llmProcessedAt: true },
        }),
        prisma.message.count({
          where: {
            postedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            llmProcessedAt: { not: null },
          },
        }),
      ]);

    const lastScrape = latestRun?.finishedAt;
    const minutesSinceScrape = lastScrape
      ? Math.floor((Date.now() - lastScrape.getTime()) / 60_000)
      : null;

    const lastClassify = latestClassify?.llmProcessedAt;
    const minutesSinceClassify = lastClassify
      ? Math.floor((Date.now() - lastClassify.getTime()) / 60_000)
      : null;

    const scrapeOk = minutesSinceScrape !== null && minutesSinceScrape < 90;
    const classifyOk =
      minutesSinceClassify !== null && minutesSinceClassify < 120;
    const queueOk = queueDepth < 200;

    const status =
      scrapeOk && classifyOk && queueOk
        ? "ok"
        : !scrapeOk
          ? "stale_scrape"
          : !classifyOk
            ? "stale_classify"
            : "queue_buildup";

    return NextResponse.json(
      {
        status,
        ok: status === "ok",
        pipeline: {
          lastScrapedAt: lastScrape?.toISOString() ?? null,
          minutesSinceScrape,
          lastClassifiedAt: lastClassify?.toISOString() ?? null,
          minutesSinceClassify,
          queueDepth,
          classifiedToday: totalToday,
          scrapeSucceeded: latestRun?.channelsSucceeded ?? null,
          scrapeFailed: latestRun?.channelsFailed ?? null,
          newMessages: latestRun?.newMessages ?? null,
        },
      },
      { status: status === "ok" ? 200 : 503 }
    );
  } catch (e) {
    return NextResponse.json(
      { status: "error", ok: false, error: String(e) },
      { status: 500 }
    );
  }
}
