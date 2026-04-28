import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pipeline status — Telegram OSINT",
  description:
    "Live scrape, classification, queue, and channel health signals for Telegram OSINT.",
};

function relTime(d: Date | null): string {
  if (!d) return "never";
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtUtc(d: Date | null): string {
  if (!d) return "never";
  return (
    d.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
}

function statusTone(ok: boolean): { label: string; color: string; background: string } {
  return ok
    ? { label: "ok", color: "var(--moss)", background: "var(--moss-faint)" }
    : { label: "attention", color: "var(--amber)", background: "var(--amber-faint)" };
}

export default async function StatusPage() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    latestRun,
    recentRuns,
    queueDepth,
    latestClassify,
    classifiedToday,
    recentClassified,
    activeChannels,
    failingChannels,
  ] = await Promise.all([
    prisma.scrapeRun.findFirst({
      orderBy: { startedAt: "desc" },
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
    }),
    prisma.scrapeRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 8,
      select: {
        startedAt: true,
        finishedAt: true,
        channelsAttempted: true,
        channelsSucceeded: true,
        channelsFailed: true,
        newMessages: true,
        triggeredBy: true,
      },
    }),
    prisma.message.count({ where: { llmProcessedAt: null } }),
    prisma.message.findFirst({
      where: { llmProcessedAt: { not: null } },
      orderBy: { llmProcessedAt: "desc" },
      select: { llmProcessedAt: true },
    }),
    prisma.message.count({
      where: { postedAt: { gte: since }, llmProcessedAt: { not: null } },
    }),
    prisma.message.findMany({
      where: { postedAt: { gte: since }, llmProcessedAt: { not: null } },
      select: { llmModel: true },
    }),
    prisma.channel.count({ where: { isActive: true } }),
    prisma.channel.findMany({
      where: { isActive: true, consecutiveErrors: { gt: 0 } },
      orderBy: [{ consecutiveErrors: "desc" }, { handle: "asc" }],
      take: 12,
      select: {
        handle: true,
        nameEn: true,
        category: true,
        consecutiveErrors: true,
        lastError: true,
        lastScrapedAt: true,
      },
    }),
  ]);

  const minutesSinceScrape = latestRun?.finishedAt
    ? Math.floor((Date.now() - latestRun.finishedAt.getTime()) / 60_000)
    : null;
  const minutesSinceClassify = latestClassify?.llmProcessedAt
    ? Math.floor((Date.now() - latestClassify.llmProcessedAt.getTime()) / 60_000)
    : null;

  const scrapeOk = minutesSinceScrape !== null && minutesSinceScrape < 90;
  const classifyOk = minutesSinceClassify !== null && minutesSinceClassify < 120;
  const queueOk = queueDepth < 200;
  const channelOk = failingChannels.filter((ch) => ch.consecutiveErrors > 2).length === 0;
  const overallOk = scrapeOk && classifyOk && queueOk && channelOk;

  const modelCounts = new Map<string, number>();
  for (const msg of recentClassified) {
    const model = msg.llmModel ?? "unknown";
    modelCounts.set(model, (modelCounts.get(model) ?? 0) + 1);
  }
  const models = [...modelCounts.entries()].sort((a, b) => b[1] - a[1]);
  const overallTone = statusTone(overallOk);

  const cards = [
    { label: "Last scrape", value: relTime(latestRun?.finishedAt ?? null), ok: scrapeOk, detail: fmtUtc(latestRun?.finishedAt ?? null) },
    { label: "Last classify", value: relTime(latestClassify?.llmProcessedAt ?? null), ok: classifyOk, detail: fmtUtc(latestClassify?.llmProcessedAt ?? null) },
    { label: "Queue", value: String(queueDepth), ok: queueOk, detail: "unprocessed messages" },
    { label: "Channels", value: String(activeChannels), ok: channelOk, detail: `${failingChannels.length} with recent errors` },
  ];

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
          <nav
            style={{
              display: "flex",
              gap: 20,
              fontFamily: "var(--mono)",
              fontSize: 12,
              color: "var(--ink-3)",
            }}
          >
            <Link href="/" style={{ color: "var(--ink-3)", textDecoration: "none" }}>Feed</Link>
            <Link href="/channels" style={{ color: "var(--ink-3)", textDecoration: "none" }}>Channels</Link>
            <Link href="/nordic" style={{ color: "var(--ink-3)", textDecoration: "none" }}>Nordic</Link>
            <Link href="/narratives" style={{ color: "var(--ink-3)", textDecoration: "none" }}>Narratives</Link>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>Status</span>
            <Link href="/about" style={{ color: "var(--ink-3)", textDecoration: "none" }}>About</Link>
          </nav>
          <div className="top-actions">
            <a href="/api/health" className="nav-link">API</a>
          </div>
        </div>
      </header>

      <div className="page-container" style={{ maxWidth: 1080 }}>
        <div className="about-page-head">
          <div className="about-page-eyebrow">Operations</div>
          <h1 className="about-page-title">Pipeline status</h1>
          <p className="about-page-lead">
            Live scrape, classification, queue, and channel-health signals. Use this page to decide whether the feed is fresh enough to trust as a triage layer.
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 18,
              padding: "6px 10px",
              borderRadius: 2,
              background: overallTone.background,
              color: overallTone.color,
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span>{overallTone.label}</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 40,
          }}
        >
          {cards.map((card) => {
            const tone = statusTone(card.ok);
            return (
              <div key={card.label} style={{ border: "1px solid var(--rule)", padding: 18, borderRadius: 2 }}>
                <div className="aside-label" style={{ marginBottom: 10 }}>{card.label}</div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 28, lineHeight: 1.1 }}>{card.value}</div>
                <div style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", fontSize: 11, marginTop: 8 }}>{card.detail}</div>
                <div style={{ color: tone.color, fontFamily: "var(--mono)", fontSize: 10, marginTop: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>{tone.label}</div>
              </div>
            );
          })}
        </div>

        <div className="about-sections">
          <section className="about-section">
            <h2>Latest scrape</h2>
            <div className="health">
              <div className="health-row"><span className="k">started</span><span className="v">{fmtUtc(latestRun?.startedAt ?? null)}</span></div>
              <div className="health-row"><span className="k">finished</span><span className="v">{fmtUtc(latestRun?.finishedAt ?? null)}</span></div>
              <div className="health-row"><span className="k">channels</span><span className="v">{latestRun ? `${latestRun.channelsSucceeded}/${latestRun.channelsAttempted} succeeded` : "unknown"}</span></div>
              <div className="health-row"><span className="k">new messages</span><span className="v">{latestRun?.newMessages ?? "unknown"}</span></div>
              <div className="health-row"><span className="k">trigger</span><span className="v">{latestRun?.triggeredBy ?? "unknown"}</span></div>
            </div>
            {latestRun?.errorSummary && (
              <p className="orig-text" style={{ marginTop: 16 }}>{latestRun.errorSummary}</p>
            )}
          </section>

          <section className="about-section">
            <h2>Model mix · last 24 hours</h2>
            {models.length === 0 ? (
              <p>No classified messages in the last 24 hours.</p>
            ) : (
              <div className="health">
                {models.map(([model, count]) => (
                  <div key={model} className="health-row"><span className="k">{model}</span><span className="v">{count}</span></div>
                ))}
                <div className="health-row"><span className="k">total classified</span><span className="v">{classifiedToday}</span></div>
              </div>
            )}
          </section>

          <section className="about-section">
            <h2>Channels with scrape errors</h2>
            {failingChannels.length === 0 ? (
              <p>No active channels have recent scrape errors.</p>
            ) : (
              <div className="ch-list">
                {failingChannels.map((channel) => (
                  <div key={channel.handle} className="ch-item">
                    <div className="ch-item-head">
                      <div className="ch-item-name">
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{channel.nameEn ?? channel.handle}</span>
                        <a href={`https://t.me/s/${channel.handle}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-4)", textDecoration: "none" }}>@{channel.handle} ↗</a>
                      </div>
                      <div className="ch-item-badges">
                        <span className="ch-badge" style={{ background: "var(--amber-faint)", color: "var(--amber)" }}>{channel.consecutiveErrors} errors</span>
                        <span className="ch-badge" style={{ background: "var(--paper-3)", color: "var(--ink-3)" }}>{channel.category.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <p className="ch-item-notes">{channel.lastError ?? "No error summary stored."}</p>
                    <div className="ch-item-foot">last successful scrape {relTime(channel.lastScrapedAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="about-section">
            <h2>Recent scrape runs</h2>
            <div className="health">
              {recentRuns.map((run) => (
                <div key={run.startedAt.toISOString()} className="health-row">
                  <span className="k">{fmtUtc(run.startedAt)}</span>
                  <span className="v">{run.channelsSucceeded}/{run.channelsAttempted} channels · {run.newMessages} new · {run.channelsFailed} failed</span>
                </div>
              ))}
            </div>
          </section>

          <section className="about-section about-section-callout">
            <h2>Trust note</h2>
            <p>
              A healthy pipeline means the feed is fresh and processed. It does not mean the underlying Telegram claims are true. Treat translations, significance, and summaries as triage signals, then verify high-stakes items against primary sources.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
