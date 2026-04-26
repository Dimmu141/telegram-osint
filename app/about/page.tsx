import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About & Methodology — Telegram OSINT",
  description:
    "How Telegram OSINT works: channel selection, classification methodology, bias caveats, and technical stack.",
};

export default function AboutPage() {
  return (
    <>
      {/* Topbar */}
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
            <Link href="/" style={{ color: "var(--ink-3)", textDecoration: "none" }}>
              Feed
            </Link>
            <Link href="/channels" style={{ color: "var(--ink-3)", textDecoration: "none" }}>
              Channels
            </Link>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>About</span>
          </nav>
          <div className="top-actions">
            <a
              href="https://github.com/Dimmu141/telegram-osint"
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn"
              title="GitHub"
            >
              ↗
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="page-container">
        <div className="about-page">
          <div className="about-page-head">
            <div className="about-page-eyebrow">Methodology</div>
            <h1 className="about-page-title">
              How this works
            </h1>
            <p className="about-page-lead">
              A free, open-source aggregator that monitors 63 Russian, Ukrainian,
              and Belarusian Telegram channels. Every post is scraped, translated
              into English, and classified by topic, significance, and named
              entities — then served here within minutes.
            </p>
          </div>

          <div className="about-sections">

            {/* What this is */}
            <section className="about-section">
              <h2>What this is</h2>
              <p>
                Telegram has become the primary distribution channel for Russian
                military and political information. State media, propagandists,
                frontline milbloggers, and independent exile outlets all publish
                there first — often before press releases, before RT segments,
                before anything appears in Western news.
              </p>
              <p>
                This tool aggregates those channels into a single classified feed,
                translated to English, with AI-generated analysis and entity
                extraction. The goal is to compress the monitoring workload for
                Nordic newsrooms, threat-intelligence teams, and security
                researchers — not to replace primary-source analysis.
              </p>
            </section>

            {/* Important caveats */}
            <section className="about-section about-section-callout">
              <h2>⚠ Important caveats</h2>
              <ul>
                <li>
                  <strong>Scraping pro-Kremlin sources is not endorsing
                  them.</strong> Monitoring what Russian state media and
                  propagandists say is standard OSINT practice. Knowing the
                  Kremlin narrative is necessary to counter it.
                </li>
                <li>
                  <strong>AI classification is imperfect.</strong> Translations
                  may contain errors — especially for military jargon, place
                  names, and proper nouns. Always verify high-stakes claims
                  against primary sources before publishing.
                </li>
                <li>
                  <strong>Significance scores are estimates.</strong> The
                  AI assigns significance (low / medium / high / critical)
                  based on editorial criteria but has no access to ground
                  truth. A post scored "low" may become important hours later.
                </li>
                <li>
                  <strong>Some channels may be information operations
                  themselves.</strong> Anonymous "insider" channels (Nezygar,
                  Kremlevsky BezBashennik) are particularly suspect.
                  Treat them as signals of narrative intent, not factual reporting.
                </li>
              </ul>
            </section>

            {/* Channel selection */}
            <section className="about-section">
              <h2>Channel selection</h2>
              <p>
                Channels are hand-curated with a Nordic-audience bias —
                prioritising content relevant to NATO, Finland, Sweden, the
                Baltic states, and Arctic security. Selection criteria:
              </p>
              <ul>
                <li>
                  <strong>Tier 1 (must-have):</strong> Channels that are
                  primary sources, have large audiences (&gt;100K subscribers),
                  or are uniquely positioned (e.g. Russian MoD, Rybar, Meduza).
                </li>
                <li>
                  <strong>Tier 2 (recommended):</strong> Channels that add
                  meaningful coverage — embedded reporters, credible analysts,
                  key opposition voices.
                </li>
                <li>
                  <strong>Tier 3 (context):</strong> Channels included for
                  completeness — tabloids, noisy official accounts, fringe
                  nationalists. Mostly low-significance but occasionally newsworthy.
                </li>
              </ul>
              <p>
                Categories: state media, Kremlin official, propagandists,
                frontline milbloggers, military analysts, PMC-adjacent, nationalist,
                tabloid, exile/independent, opposition, elite analytical,
                business, Ukrainian, and Belarusian.
              </p>
              <p>
                <Link href="/channels">View the full channel list →</Link>
              </p>
            </section>

            {/* How scraping works */}
            <section className="about-section">
              <h2>Scraping</h2>
              <p>
                Every 30 minutes, the scraper fetches the public HTML preview at{" "}
                <code>t.me/s/&lt;handle&gt;</code> for each active channel.
                No Telegram account, no Bot API, no API key required — only
                public web pages.
              </p>
              <p>
                New messages are stored in Supabase Postgres and
                deduplicated by (channel, post ID). Media attachments are noted
                but not downloaded. Some channels have their web preview
                disabled — those appear in the channel list with zero recent
                messages.
              </p>
            </section>

            {/* Classification */}
            <section className="about-section">
              <h2>AI classification</h2>
              <p>
                Each new message is passed to a large language model with a
                structured prompt requesting:
              </p>
              <ul>
                <li>
                  <strong>English translation</strong> — full text translation
                  (not paraphrase)
                </li>
                <li>
                  <strong>Topic</strong> — one of: military operations,
                  strikes/air defence, casualties & losses, escalation rhetoric,
                  nordic relevance, domestic politics, foreign policy, economic,
                  propaganda, humanitarian, breaking news, opinion/analysis, other
                </li>
                <li>
                  <strong>Significance</strong> — low / medium / high / critical,
                  calibrated against a Nordic-analyst standard (e.g. a critical
                  post would be breaking news, confirmed major strike, or
                  nuclear threat)
                </li>
                <li>
                  <strong>Entities</strong> — people, locations, organizations,
                  weapons mentioned in the post
                </li>
                <li>
                  <strong>Summary/analysis</strong> — 1–2 sentence analyst
                  note on what the post means and why it matters
                </li>
              </ul>
              <p>
                The model used is{" "}
                <strong>Gemini 2.5 Flash-Lite</strong> (primary) with Groq
                fallback. Messages are processed in batches of 10. The channel&apos;s
                editorial category and stance are included in the prompt so the
                model understands the source context.
              </p>
            </section>

            {/* Daily briefing */}
            <section className="about-section">
              <h2>Daily briefing</h2>
              <p>
                Every morning at 07:00 UTC, a briefing is generated summarising
                the previous 24 hours into 6–9 analyst-grade bullet points.
                The briefing focuses on high and critical significance items
                and is written for an analyst audience — no boilerplate
                ("Nordic analysts should note…"), just substance.
              </p>
              <p>
                Briefing model: <strong>Llama 3.3 70B</strong> via Groq API.
              </p>
            </section>

            {/* Data freshness */}
            <section className="about-section">
              <h2>Data freshness</h2>
              <ul>
                <li>Scrape interval: every 30 minutes via GitHub Actions</li>
                <li>Classification: runs every 30 minutes (offset 15 min)</li>
                <li>Daily briefing: 07:00 UTC</li>
                <li>Page cache: 5-minute ISR (revalidate = 300s)</li>
                <li>RSS feed: updates every 5 minutes</li>
              </ul>
              <p>
                Pipeline health is visible in real-time via the feed sidebar
                and at <code>/api/health</code>.
              </p>
            </section>

            {/* Stack */}
            <section className="about-section">
              <h2>Technical stack</h2>
              <ul>
                <li>Next.js 16 App Router (TypeScript)</li>
                <li>Prisma 5 + Supabase Postgres</li>
                <li>Gemini 2.5 Flash-Lite (classification)</li>
                <li>Groq Llama 3.3 70B (daily briefing)</li>
                <li>Cheerio (HTML scraping)</li>
                <li>GitHub Actions (cron jobs)</li>
                <li>Vercel (hosting)</li>
              </ul>
            </section>

            {/* Open source */}
            <section className="about-section">
              <h2>Open source</h2>
              <p>
                The full source code is on GitHub. Contributions welcome —
                particularly for adding channels, improving the classification
                prompt, or building new features.
              </p>
              <p>
                <a
                  href="https://github.com/Dimmu141/telegram-osint"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  github.com/Dimmu141/telegram-osint ↗
                </a>
              </p>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}
