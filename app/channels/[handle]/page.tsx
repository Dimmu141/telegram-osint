import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

const CATEGORY_LABELS: Record<string, string> = {
  kremlin_official: "Kremlin Official",
  state_media: "State Media",
  propagandist: "Propagandist",
  milblogger_frontline: "Frontline Reporter",
  milblogger_analytical: "Military Analyst",
  milblogger: "Military Blogger",
  pmc: "PMC / Wagner-adjacent",
  nationalist: "Nationalist",
  tabloid: "Tabloid",
  exile_independent: "Exile / Independent",
  opposition: "Opposition",
  elite_analytical: "Elite Analytical",
  business: "Business",
  ukrainian: "Ukrainian",
  belarusian: "Belarusian",
};

const STANCE_LABEL: Record<string, string> = {
  pro_kremlin: "Pro-Kremlin",
  mixed: "Mixed",
  independent: "Independent",
  opposition: "Opposition",
  pro_ukraine: "Pro-Ukraine",
  pro_belarus_opposition: "Pro-Belarus opposition",
};

function relTime(d: Date | null): string {
  if (!d) return "never";
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtTime(d: Date): string {
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

function topicLabel(topic: string | null): string {
  return topic?.replace(/_/g, " ") ?? "unclassified";
}

export async function generateMetadata(
  { params }: { params: Promise<{ handle: string }> },
): Promise<Metadata> {
  const { handle } = await params;
  const channel = await prisma.channel.findUnique({
    where: { handle },
    select: { handle: true, nameEn: true, notes: true },
  });
  if (!channel) return { title: "Source not found - Telegram OSINT" };
  return {
    title: `${channel.nameEn ?? `@${channel.handle}`} - Telegram OSINT source profile`,
    description: channel.notes ?? `Recent posts and scrape status for @${channel.handle}.`,
  };
}

export default async function ChannelDetailPage(
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const channel = await prisma.channel.findUnique({
    where: { handle },
    select: {
      handle: true,
      nameEn: true,
      nameRu: true,
      category: true,
      language: true,
      stance: true,
      priority: true,
      sourceType: true,
      notes: true,
      lastScrapedAt: true,
      lastParsedCount: true,
      lastNewMessages: true,
      lastNewMessageAt: true,
      lastScrapeWarning: true,
      consecutiveErrors: true,
      lastError: true,
      messages: {
        orderBy: { postedAt: "desc" },
        take: 40,
        select: {
          id: true,
          telegramPostId: true,
          translationEn: true,
          text: true,
          topic: true,
          significance: true,
          summary: true,
          postedAt: true,
        },
      },
    },
  });

  if (!channel) notFound();

  const [posts24h, posts7d, important7d] = await Promise.all([
    prisma.message.count({ where: { channel: { handle }, postedAt: { gte: since24h } } }),
    prisma.message.count({ where: { channel: { handle }, postedAt: { gte: since7d } } }),
    prisma.message.count({
      where: {
        channel: { handle },
        postedAt: { gte: since7d },
        significance: { in: ["high", "critical"] },
      },
    }),
  ]);

  const topics = new Map<string, number>();
  for (const msg of channel.messages) {
    const label = topicLabel(msg.topic);
    topics.set(label, (topics.get(label) ?? 0) + 1);
  }
  const topTopics = [...topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const hasHealthIssue = channel.consecutiveErrors > 0 || Boolean(channel.lastScrapeWarning);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <div className="brand-mark">tg</div>
            <div>
              <div className="brand-name">Telegram OSINT</div>
              <div className="brand-sub">public - open source</div>
            </div>
          </Link>
          <nav className="simple-nav">
            <Link href="/">Feed</Link>
            <Link href="/channels">Channels</Link>
            <Link href="/narratives">Narratives</Link>
            <Link href="/status">Status</Link>
            <Link href="/about">About</Link>
          </nav>
          <div className="top-actions">
            <a
              href={`https://t.me/s/${channel.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn"
              title="Open Telegram preview"
            >
              TG
            </a>
          </div>
        </div>
      </header>

      <div className="page-container">
        <div className="source-page">
          <div className="about-page-head">
            <div className="about-page-eyebrow">Source profile</div>
            <h1 className="about-page-title">{channel.nameEn ?? `@${channel.handle}`}</h1>
            <p className="about-page-lead">
              @{channel.handle} is listed as {CATEGORY_LABELS[channel.category] ?? channel.category}
              {" "}with a {STANCE_LABEL[channel.stance] ?? channel.stance} stance. Use this page to judge
              what the source is, whether scraping is healthy, and what it has contributed recently.
            </p>
          </div>

          <div className="source-grid">
            <div className="source-card">
              <div className="aside-label">Profile</div>
              <dl className="source-facts">
                <div><dt>Category</dt><dd>{CATEGORY_LABELS[channel.category] ?? channel.category}</dd></div>
                <div><dt>Stance</dt><dd>{STANCE_LABEL[channel.stance] ?? channel.stance}</dd></div>
                <div><dt>Priority</dt><dd>{channel.priority.replace("_", " ")}</dd></div>
                <div><dt>Source type</dt><dd>{channel.sourceType.replace(/_/g, " ")}</dd></div>
                <div><dt>Language</dt><dd>{channel.language.toUpperCase()}</dd></div>
                {channel.nameRu && <div><dt>Original name</dt><dd>{channel.nameRu}</dd></div>}
              </dl>
            </div>

            <div className="source-card">
              <div className="aside-label">Recent output</div>
              <dl className="source-facts">
                <div><dt>24 hours</dt><dd>{posts24h} posts</dd></div>
                <div><dt>7 days</dt><dd>{posts7d} posts</dd></div>
                <div><dt>High / critical</dt><dd>{important7d} posts</dd></div>
                <div><dt>Last new post</dt><dd>{relTime(channel.lastNewMessageAt)}</dd></div>
              </dl>
            </div>

            <div className={`source-card ${hasHealthIssue ? "source-card-warn" : ""}`}>
              <div className="aside-label">Scrape health</div>
              <dl className="source-facts">
                <div><dt>Last scrape</dt><dd>{relTime(channel.lastScrapedAt)}</dd></div>
                <div><dt>Parsed last run</dt><dd>{channel.lastParsedCount}</dd></div>
                <div><dt>New last run</dt><dd>{channel.lastNewMessages}</dd></div>
                <div><dt>Errors</dt><dd>{channel.consecutiveErrors}</dd></div>
              </dl>
              {(channel.lastScrapeWarning || channel.lastError) && (
                <p className="source-warning">{channel.lastScrapeWarning ?? channel.lastError}</p>
              )}
            </div>
          </div>

          {channel.notes && (
            <section className="about-section">
              <h2>Editorial note</h2>
              <p>{channel.notes}</p>
            </section>
          )}

          <section className="about-section">
            <h2>Topic mix</h2>
            <div className="entity-cloud">
              {topTopics.map(([topic, count]) => (
                <span key={topic} className="entity-pill">{topic} <span className="ec">{count}</span></span>
              ))}
              {topTopics.length === 0 && <span className="ch-item-foot">No classified posts yet.</span>}
            </div>
          </section>

          <section className="about-section">
            <h2>Recent posts</h2>
            <div className="source-post-list">
              {channel.messages.map((msg) => (
                <article key={msg.id} className={`source-post ${msg.significance === "critical" ? "crit" : msg.significance === "high" ? "high" : ""}`}>
                  <div className="story-post-head">
                    <span>{fmtTime(msg.postedAt)}</span>
                    <span>{topicLabel(msg.topic)} - {msg.significance ?? "medium"}</span>
                  </div>
                  <p>{msg.translationEn ?? msg.text ?? "No text extracted."}</p>
                  {msg.summary && (
                    <div className="analysis">
                      <div className="analysis-lbl">Analysis</div>
                      <p>{msg.summary}</p>
                    </div>
                  )}
                  <div className="msg-actions">
                    <Link className="msg-action" href={`/m/${msg.id}`}>Open post</Link>
                    <a className="msg-action" href={`https://t.me/${msg.telegramPostId}`} target="_blank" rel="noopener noreferrer">Telegram</a>
                  </div>
                </article>
              ))}
              {channel.messages.length === 0 && <p className="ch-item-foot">No posts stored for this source yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
