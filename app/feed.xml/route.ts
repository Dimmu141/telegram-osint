import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

export async function GET() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const messages = await prisma.message.findMany({
    where: {
      postedAt: { gte: since },
      llmProcessedAt: { not: null },
      channel: { isActive: true },
      significance: { in: ["high", "critical"] },
    },
    orderBy: { postedAt: "desc" },
    take: 60,
    select: {
      id: true,
      telegramPostId: true,
      translationEn: true,
      summary: true,
      topic: true,
      significance: true,
      postedAt: true,
      channel: { select: { handle: true, nameEn: true, category: true } },
    },
  });

  const items = messages
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
    <description><![CDATA[<p><strong>${esc(m.significance ?? "high")}</strong> significance · <strong>${channelName}</strong> (@${esc(m.channel.handle)})</p><p>${esc(desc)}</p><p><a href="${link}">View on Telegram OSINT</a> · <a href="https://t.me/${esc(m.telegramPostId ?? "")}">Source on Telegram</a></p>]]></description>
  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Telegram OSINT — High significance alerts</title>
    <link>${BASE_URL}</link>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>High and critical significance posts from 63 Russian, Ukrainian and Belarusian Telegram channels, translated to English and classified by topic. Built for Nordic journalists and security analysts.</description>
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
