import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { SOURCE_FILTERS, TOPIC_FILTERS, textMatchesQuery } from "@/lib/editorial";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function topicFilter(value: string | null): string[] | null {
  if (!value || value === "all") return null;
  const grouped = TOPIC_FILTERS.find((item) => item.key === value);
  if (grouped?.topics) return [...grouped.topics];
  return [value];
}

function sourceFilter(value: string | null): string[] | null {
  if (!value || value === "all") return null;
  const grouped = SOURCE_FILTERS.find((item) => item.key === value);
  if (grouped?.categories) return [...grouped.categories];
  return [value];
}

function significanceFilter(value: string | null): Prisma.MessageWhereInput["significance"] | undefined {
  if (!value) return { in: ["high", "critical"] };
  if (value === "all" || value === "low") return undefined;
  if (value === "medium") return { in: ["medium", "high", "critical"] };
  if (value === "high") return { in: ["high", "critical"] };
  if (value === "critical") return "critical";
  return { in: ["high", "critical"] };
}

export async function GET(request: NextRequest) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const params = request.nextUrl.searchParams;
  const sig = params.get("sig");
  const topic = topicFilter(params.get("topic"));
  const source = sourceFilter(params.get("source"));
  const channel = params.get("channel")?.trim();
  const q = params.get("q")?.trim() ?? "";

  const where: Prisma.MessageWhereInput = {
    postedAt: { gte: since },
    llmProcessedAt: { not: null },
    channel: {
      isActive: true,
      ...(channel ? { handle: channel } : {}),
      ...(source ? { category: { in: source } } : {}),
    },
  };

  const significance = significanceFilter(sig);
  if (significance) where.significance = significance;
  if (topic) where.topic = { in: topic };

  const messages = await prisma.message.findMany({
    where,
    orderBy: { postedAt: "desc" },
    take: q ? 200 : 60,
    select: {
      id: true,
      telegramPostId: true,
      text: true,
      translationEn: true,
      summary: true,
      topic: true,
      significance: true,
      entities: true,
      postedAt: true,
      channel: { select: { handle: true, nameEn: true, category: true } },
    },
  });

  const filtered = q
    ? messages.filter((m) =>
        textMatchesQuery(
          [
            m.text,
            m.translationEn,
            m.summary,
            m.topic,
            m.significance,
            m.channel.nameEn,
            m.channel.handle,
            m.channel.category,
          ],
          m.entities,
          q,
        ),
      )
    : messages;

  const items = filtered
    .slice(0, 60)
    .map((m) => {
      const rawTitle =
        m.translationEn?.split(/[.!?\n]/)[0]?.trim().slice(0, 130) ??
        "Untitled";
      const title = esc(rawTitle);
      const link = `${BASE_URL}/m/${m.id}`;
      const pubDate = new Date(m.postedAt).toUTCString();
      const category = esc(m.topic?.replace(/_/g, " ") ?? "unclassified");
      const channelName = esc(m.channel.nameEn ?? `@${m.channel.handle}`);
      const desc = [m.summary, m.translationEn?.slice(0, 500)]
        .filter(Boolean)
        .join("\n\n");

      return `  <item>
    <title>${title}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${pubDate}</pubDate>
    <category>${category}</category>
    <description><![CDATA[<p><strong>${esc(m.significance ?? "high")}</strong> editorial relevance - <strong>${channelName}</strong> (@${esc(m.channel.handle)})</p><p>${esc(desc)}</p><p>Machine translation and AI classification. Verify before publication.</p><p><a href="${link}">View on Telegram OSINT</a> - <a href="https://t.me/${esc(m.telegramPostId ?? "")}">Source on Telegram</a></p>]]></description>
  </item>`;
    })
    .join("\n");
  const selfPath = `/feed.xml${request.nextUrl.search}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Telegram OSINT - High editorial relevance alerts</title>
    <link>${BASE_URL}</link>
    <atom:link href="${esc(`${BASE_URL}${selfPath}`)}" rel="self" type="application/rss+xml"/>
    <description>High and critical editorial relevance posts from Russian, Ukrainian and Belarusian Telegram channels, translated to English and classified by topic for journalists and security analysts. Significance is not verification.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>15</ttl>
    <image>
      <url>${BASE_URL}/opengraph-image</url>
      <title>Telegram OSINT</title>
      <link>${BASE_URL}</link>
    </image>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
