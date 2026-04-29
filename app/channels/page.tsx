import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Channel list - Telegram OSINT",
  description:
    "All 63 Russian, Ukrainian and Belarusian Telegram channels monitored by Telegram OSINT, with category, stance, and editorial notes.",
};

const CATEGORY_LABELS: Record<string, string> = {
  kremlin_official: "Kremlin Official",
  state_media: "State Media",
  propagandist: "Propagandists",
  milblogger_frontline: "Frontline Reporters",
  milblogger_analytical: "Military Analysts",
  milblogger: "Military Bloggers",
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

const CATEGORY_DESC: Record<string, string> = {
  kremlin_official: "Ministries, spokespeople, and Kremlin-aligned officials. Authoritative for official position.",
  state_media: "Institutional Kremlin media - TASS, RIA Novosti, RT. The formal state voice.",
  propagandist: "Personality-driven propaganda channels. Often set the rhetorical agenda before it reaches official media.",
  milblogger_frontline: "Embedded or frontline reporters. Raw, often contradicts MoD briefings.",
  milblogger_analytical: "Commentary, maps, and tactical analysis from a distance. Usually more reliable for operational picture.",
  milblogger: "Military bloggers.",
  pmc: "Private military company-adjacent. Wagner-related content post-Prigozhin.",
  nationalist: "Ultranationalist / ideological channels. Often more extreme than the Kremlin mainstream.",
  tabloid: "Breaking news and tabloid outlets. Mostly domestic, occasionally first on incidents.",
  exile_independent: "Russia's independent exile press. Investigative and opposition-leaning.",
  opposition: "Opposition politicians, activists, and anti-war voices.",
  elite_analytical: "Anonymous 'insider' channels. Treat with caution - potentially IO instruments.",
  business: "Russian economic and business coverage.",
  ukrainian: "Ukrainian sources included for reaction and context.",
  belarusian: "Belarusian opposition and security coverage with regional security relevance.",
};

const CATEGORY_ORDER = [
  "kremlin_official",
  "state_media",
  "propagandist",
  "milblogger_frontline",
  "milblogger_analytical",
  "milblogger",
  "pmc",
  "nationalist",
  "tabloid",
  "exile_independent",
  "opposition",
  "elite_analytical",
  "business",
  "ukrainian",
  "belarusian",
];

const PRIORITY_RANK: Record<string, number> = {
  tier_1: 1,
  tier_2: 2,
  tier_3: 3,
};

const STANCE_LABEL: Record<string, string> = {
  pro_kremlin: "Pro-Kremlin",
  mixed: "Mixed",
  independent: "Independent",
  opposition: "Opposition",
  pro_ukraine: "Pro-Ukraine",
  pro_belarus_opposition: "Pro-BY opposition",
};

const STANCE_COLOR: Record<string, { bg: string; fg: string }> = {
  pro_kremlin: { bg: "var(--signal-faint)", fg: "var(--signal)" },
  mixed: { bg: "var(--amber-faint)", fg: "var(--amber)" },
  independent: { bg: "var(--blue-faint)", fg: "var(--blue)" },
  opposition: { bg: "var(--moss-faint)", fg: "var(--moss)" },
  pro_ukraine: { bg: "var(--moss-faint)", fg: "var(--moss)" },
  pro_belarus_opposition: { bg: "var(--moss-faint)", fg: "var(--moss)" },
};

const PRIORITY_COLOR: Record<string, { bg: string; fg: string }> = {
  tier_1: { bg: "var(--ink)", fg: "var(--paper)" },
  tier_2: { bg: "var(--paper-3)", fg: "var(--ink-2)" },
  tier_3: { bg: "var(--paper-2)", fg: "var(--ink-4)" },
};

function relTime(d: Date | null): string {
  if (!d) return "never";
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function ChannelsPage() {
  const channels = await prisma.channel.findMany({
    where: { isActive: true },
    orderBy: [{ handle: "asc" }],
    select: {
      handle: true,
      nameEn: true,
      nameRu: true,
      category: true,
      stance: true,
      priority: true,
      sourceType: true,
      notes: true,
      language: true,
      lastScrapedAt: true,
      lastParsedCount: true,
      lastNewMessages: true,
      lastScrapeWarning: true,
      consecutiveErrors: true,
    },
  });

  // Group by category
  const grouped = new Map<string, typeof channels>();
  for (const ch of channels) {
    if (!grouped.has(ch.category)) grouped.set(ch.category, []);
    grouped.get(ch.category)!.push(ch);
  }
  for (const [, chs] of grouped) {
    chs.sort(
      (a, b) =>
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
    );
  }
  const sortedGroups = [...grouped.entries()].sort(([a], [b]) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const total = channels.length;
  const tier1 = channels.filter((c) => c.priority === "tier_1").length;
  const tier2 = channels.filter((c) => c.priority === "tier_2").length;
  const tier3 = channels.filter((c) => c.priority === "tier_3").length;

  return (
    <>
      {/* Topbar */}
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
            <Link
              href="/"
              style={{ color: "var(--ink-3)", textDecoration: "none" }}
            >
              Feed
            </Link>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>
              Channels
            </span>
            <Link
              href="/narratives"
              style={{ color: "var(--ink-3)", textDecoration: "none" }}
            >
              Narratives
            </Link>
            <Link
              href="/status"
              style={{ color: "var(--ink-3)", textDecoration: "none" }}
            >
              Status
            </Link>
            <Link
              href="/about"
              style={{ color: "var(--ink-3)", textDecoration: "none" }}
            >
              About
            </Link>
          </nav>
          <div className="top-actions">
            <a
              href="https://github.com/Dimmu141/telegram-osint"
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn"
              title="GitHub"
            >
              GH
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="page-container">
        <div className="channels-page">
          {/* Header */}
          <div className="about-page-head">
            <div className="about-page-eyebrow">Transparency</div>
            <h1 className="about-page-title">Channel list</h1>
            <p className="about-page-lead">
              {total} active channels across {sortedGroups.length} categories.
              Tier 1: {tier1} - Tier 2: {tier2} - Tier 3: {tier3}.
              Channels are scraped every 30 minutes from their public Telegram
              web preview.
            </p>
          </div>

          {/* Groups */}
          {sortedGroups.map(([cat, chs]) => (
            <div key={cat} className="ch-group">
              <div className="ch-group-head">
                <div>
                  <h2 className="ch-group-title">
                    {CATEGORY_LABELS[cat] ?? cat}
                    <span className="ch-group-count">{chs.length}</span>
                  </h2>
                  {CATEGORY_DESC[cat] && (
                    <p className="ch-group-desc">{CATEGORY_DESC[cat]}</p>
                  )}
                </div>
              </div>

              <div className="ch-list">
                {chs.map((ch) => {
                  const stanceColor =
                    STANCE_COLOR[ch.stance] ?? STANCE_COLOR.mixed;
                  const prioColor =
                    PRIORITY_COLOR[ch.priority] ?? PRIORITY_COLOR.tier_3;
                  const hasErrors = ch.consecutiveErrors > 2;
                  const hasWarning = Boolean(ch.lastScrapeWarning);

                  return (
                    <div key={ch.handle} className="ch-item">
                      <div className="ch-item-head">
                        <div className="ch-item-name">
                          <Link
                            href={`/channels/${ch.handle}`}
                            style={{
                              fontWeight: 600,
                              fontSize: 14,
                              color: "var(--ink)",
                              textDecoration: "none",
                            }}
                          >
                            {ch.nameEn ?? ch.handle}
                          </Link>
                          <a
                            href={`https://t.me/s/${ch.handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 11,
                              color: "var(--ink-4)",
                              textDecoration: "none",
                            }}
                          >
                            @{ch.handle} open
                          </a>
                          {ch.nameRu && (
                            <span
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: 11,
                                color: "var(--ink-4)",
                              }}
                            >
                              {ch.nameRu}
                            </span>
                          )}
                        </div>
                        <div className="ch-item-badges">
                          <span
                            className="ch-badge"
                            style={{
                              background: prioColor.bg,
                              color: prioColor.fg,
                            }}
                          >
                            {ch.priority.replace("_", " ")}
                          </span>
                          <span
                            className="ch-badge"
                            style={{
                              background: stanceColor.bg,
                              color: stanceColor.fg,
                            }}
                          >
                            {STANCE_LABEL[ch.stance] ?? ch.stance}
                          </span>
                          <span
                            className="ch-badge"
                            style={{
                              background: "var(--paper-2)",
                              color: "var(--ink-3)",
                            }}
                          >
                            {ch.sourceType.replace(/_/g, " ")}
                          </span>
                          {ch.language !== "ru" && (
                            <span
                              className="ch-badge"
                              style={{
                                background: "var(--paper-3)",
                                color: "var(--ink-3)",
                              }}
                            >
                              {ch.language.toUpperCase()}
                            </span>
                          )}
                          {hasWarning && (
                            <span
                              className="ch-badge"
                              style={{
                                background: "var(--amber-faint)",
                                color: "var(--amber)",
                              }}
                              title={ch.lastScrapeWarning ?? undefined}
                            >
                              no public posts
                            </span>
                          )}
                        </div>
                      </div>

                      {ch.notes && (
                        <p className="ch-item-notes">{ch.notes}</p>
                      )}

                      <div className="ch-item-foot">
                        <span
                          style={{
                            color: hasErrors
                              ? "var(--amber)"
                              : "var(--ink-4)",
                          }}
                        >
                          {hasErrors
                            ? `${ch.consecutiveErrors} consecutive errors`
                            : hasWarning
                              ? `no public posts ${relTime(ch.lastScrapedAt)}`
                              : `scraped ${relTime(ch.lastScrapedAt)} - ${ch.lastParsedCount} parsed - ${ch.lastNewMessages} new`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
