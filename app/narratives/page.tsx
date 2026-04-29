import { NARRATIVES, matchesAnyTerm, normalizedText } from "@/lib/intelligence";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Narrative tracker - Telegram OSINT",
  description:
    "Keyword-assisted tracking for recurring narratives across monitored Telegram channels.",
};

type TrackerMessage = {
  id: string;
  translationEn: string | null;
  summary: string | null;
  topic: string | null;
  significance: string | null;
  postedAt: Date;
  channel: {
    handle: string;
    nameEn: string | null;
    category: string;
  };
};

function relTime(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function excerpt(msg: TrackerMessage): string {
  const text = msg.summary ?? msg.translationEn ?? "No English text available yet.";
  return text.length > 260 ? `${text.slice(0, 257)}...` : text;
}

export default async function NarrativesPage() {
  // Server-rendered tracker windows are intentionally relative to request time.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await prisma.message.findMany({
    where: {
      postedAt: { gte: since },
      llmProcessedAt: { not: null },
      channel: { isActive: true },
    },
    orderBy: { postedAt: "desc" },
    take: 900,
    select: {
      id: true,
      translationEn: true,
      summary: true,
      topic: true,
      significance: true,
      postedAt: true,
      channel: {
        select: { handle: true, nameEn: true, category: true },
      },
    },
  });

  const groups = NARRATIVES.map((narrative) => {
    const messages = recent.filter((msg) =>
      matchesAnyTerm(normalizedText([msg.translationEn, msg.summary, msg.topic]), narrative.terms)
    );
    const highPriority = messages.filter(
      (msg) => msg.significance === "high" || msg.significance === "critical"
    ).length;
    const channels = new Set(messages.map((msg) => msg.channel.handle));
    return {
      ...narrative,
      messages,
      highPriority,
      channelCount: channels.size,
    };
  }).sort((a, b) => b.messages.length - a.messages.length);

  const totalHits = groups.reduce((sum, group) => sum + group.messages.length, 0);
  const activeNarratives = groups.filter((group) => group.messages.length > 0).length;
  const highPriority = groups.reduce((sum, group) => sum + group.highPriority, 0);

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
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>Narratives</span>
            <Link href="/status" style={{ color: "var(--ink-3)", textDecoration: "none" }}>Status</Link>
          </nav>
          <div className="top-actions">
            <a href="/feed.xml" className="nav-link">RSS</a>
          </div>
        </div>
      </header>

      <div className="page-container" style={{ maxWidth: 1120 }}>
        <div className="about-page-head">
          <div className="about-page-eyebrow">Narrative tracker</div>
          <h1 className="about-page-title">Recurring claims and themes</h1>
          <p className="about-page-lead">
            A seven-day view that groups posts by recurring propaganda, escalation, war-cost, and strike narratives. It is a triage view, not automated verification.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 36,
          }}
        >
          <div style={{ border: "1px solid var(--rule)", padding: 18, borderRadius: 2 }}>
            <div className="aside-label">Narratives active</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 30 }}>{activeNarratives}</div>
          </div>
          <div style={{ border: "1px solid var(--rule)", padding: 18, borderRadius: 2 }}>
            <div className="aside-label">Matched posts</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 30 }}>{totalHits}</div>
          </div>
          <div style={{ border: "1px solid var(--rule)", padding: 18, borderRadius: 2 }}>
            <div className="aside-label">High priority</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 30 }}>{highPriority}</div>
          </div>
        </div>

        <div className="about-sections">
          {groups.map((group) => (
            <section key={group.key} className="about-section">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h2>{group.label}</h2>
                  <p>{group.description}</p>
                </div>
                <div style={{ textAlign: "right", minWidth: 130 }}>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 28 }}>{group.messages.length}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-4)" }}>
                    {group.channelCount} channels
                  </div>
                </div>
              </div>

              {group.messages.length === 0 ? (
                <p style={{ color: "var(--ink-4)" }}>No matches in the last seven days.</p>
              ) : (
                <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                  {group.messages.slice(0, 5).map((msg) => (
                    <article key={msg.id} style={{ borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          color: "var(--ink-4)",
                          marginBottom: 8,
                        }}
                      >
                        <span>@{msg.channel.handle}</span>
                        <span>{relTime(msg.postedAt)}</span>
                      </div>
                      <p style={{ marginTop: 0 }}>{excerpt(msg)}</p>
                      <Link href={`/m/${msg.id}`} style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                        Open post
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
