import { NORDIC_TERMS, matchesAnyTerm, normalizedText } from "@/lib/intelligence";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Nordic watch - Telegram OSINT",
  description:
    "Recent Telegram posts that mention the Nordics, Baltics, NATO, Arctic security, or nearby escalation themes.",
};

type NordicMessage = {
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

function messageText(msg: NordicMessage): string {
  return msg.summary ?? msg.translationEn ?? "No English text available yet.";
}

function matchedTerms(msg: NordicMessage): string[] {
  const haystack = normalizedText([msg.translationEn, msg.summary, msg.topic]);
  return NORDIC_TERMS.filter((term) => haystack.includes(term.toLowerCase())).slice(0, 5);
}

function significanceTone(significance: string | null): { bg: string; fg: string } {
  if (significance === "critical") return { bg: "var(--signal)", fg: "var(--paper)" };
  if (significance === "high") return { bg: "var(--amber)", fg: "var(--paper)" };
  return { bg: "var(--paper-3)", fg: "var(--ink-3)" };
}

export default async function NordicPage() {
  // Server-rendered watch windows are intentionally relative to request time.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000);
  const recent = await prisma.message.findMany({
    where: {
      postedAt: { gte: since },
      llmProcessedAt: { not: null },
      channel: { isActive: true },
    },
    orderBy: { postedAt: "desc" },
    take: 400,
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

  const matches = recent
    .filter((msg) => {
      if (msg.topic === "nordic_relevance") return true;
      return matchesAnyTerm(normalizedText([msg.translationEn, msg.summary, msg.topic]), NORDIC_TERMS);
    })
    .slice(0, 90);

  const highPriority = matches.filter(
    (msg) => msg.significance === "high" || msg.significance === "critical"
  ).length;
  const channels = new Set(matches.map((msg) => msg.channel.handle));
  const topTerms = new Map<string, number>();
  for (const msg of matches) {
    for (const term of matchedTerms(msg)) topTerms.set(term, (topTerms.get(term) ?? 0) + 1);
  }
  const termList = [...topTerms.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

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
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>Nordic</span>
            <Link href="/narratives" style={{ color: "var(--ink-3)", textDecoration: "none" }}>Narratives</Link>
            <Link href="/status" style={{ color: "var(--ink-3)", textDecoration: "none" }}>Status</Link>
          </nav>
          <div className="top-actions">
            <a href="/feed.xml" className="nav-link">RSS</a>
          </div>
        </div>
      </header>

      <div className="page-container" style={{ maxWidth: 1080 }}>
        <div className="about-page-head">
          <div className="about-page-eyebrow">Watch view</div>
          <h1 className="about-page-title">Nordic and Baltic signals</h1>
          <p className="about-page-lead">
            A 72-hour watch list for posts mentioning Finland, Sweden, the Baltics, NATO, Kaliningrad, the Arctic, and nearby escalation terms.
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
            <div className="aside-label">Matches</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 30 }}>{matches.length}</div>
          </div>
          <div style={{ border: "1px solid var(--rule)", padding: 18, borderRadius: 2 }}>
            <div className="aside-label">High priority</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 30 }}>{highPriority}</div>
          </div>
          <div style={{ border: "1px solid var(--rule)", padding: 18, borderRadius: 2 }}>
            <div className="aside-label">Channels</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 30 }}>{channels.size}</div>
          </div>
          <div style={{ border: "1px solid var(--rule)", padding: 18, borderRadius: 2 }}>
            <div className="aside-label">Last match</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 30 }}>
              {matches[0] ? relTime(matches[0].postedAt) : "none"}
            </div>
          </div>
        </div>

        {termList.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 30 }}>
            {termList.map(([term, count]) => (
              <span key={term} className="tag tag-other">
                {term} {count}
              </span>
            ))}
          </div>
        )}

        <div className="about-sections">
          <section className="about-section">
            <h2>Latest posts</h2>
            {matches.length === 0 ? (
              <p>No Nordic or Baltic matches found in the last 72 hours.</p>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {matches.map((msg) => {
                  const tone = significanceTone(msg.significance);
                  const terms = matchedTerms(msg);
                  return (
                    <article key={msg.id} style={{ borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "flex-start",
                          marginBottom: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 650 }}>{msg.channel.nameEn ?? `@${msg.channel.handle}`}</div>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-4)" }}>
                            @{msg.channel.handle} - {relTime(msg.postedAt)}
                          </div>
                        </div>
                        <span
                          style={{
                            background: tone.bg,
                            color: tone.fg,
                            borderRadius: 2,
                            fontFamily: "var(--mono)",
                            fontSize: 10,
                            letterSpacing: "0.06em",
                            padding: "3px 7px",
                            textTransform: "uppercase",
                          }}
                        >
                          {msg.significance ?? "medium"}
                        </span>
                      </div>
                      <p style={{ marginTop: 0 }}>{messageText(msg)}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        {terms.map((term) => (
                          <span key={term} className="tag tag-other">{term}</span>
                        ))}
                        <Link href={`/m/${msg.id}`} style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                          Open post
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
