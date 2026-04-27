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
            <Link href="/status" style={{ color: "var(--ink-3)", textDecoration: "none" }}>Status</Link>
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

      <div className="page-container">
        <div className="about-page">
          <div className="about-page-head">
            <div className="about-page-eyebrow">Methodology</div>
            <h1 className="about-page-title">How this works</h1>
            <p className="about-page-lead">
              A free, open-source aggregator that monitors 63 Russian, Ukrainian,
              and Belarusian Telegram channels. Every post is scraped, translated
              into English, and classified by topic, significance, and named
              entities — then served here within minutes.
            </p>
          </div>

          <div className="about-sections">
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

            <section className="about-section about-section-callout">
              <h2>Important caveats</h2>
              <ul>
                <li>
                  <strong>Scraping pro-Kremlin sources is not endorsing them.</strong> Monitoring what Russian state media and propagandists say is standard OSINT practice. Knowing the Kremlin narrative is necessary to counter it.
                </li>
                <li>
                  <strong>AI classification is imperfect.</strong> Translations may contain errors — especially for military jargon, place names, and proper nouns. Always verify high-stakes claims against primary sources before publishing.
                </li>
                <li>
                  <strong>Significance scores are estimates.</strong> The AI assigns significance based on editorial criteria but has no access to ground truth. A post scored "low" may become important hours later.
                </li>
                <li>
                  <strong>Some channels may be information operations themselves.</strong> Anonymous "insider" channels such as Nezygar and Kremlevsky BezBashennik are particularly suspect. Treat them as signals of narrative intent, not factual reporting.
                </li>
              </ul>
            </section>

            <section className="about-section">
              <h2>Channel selection</h2>
              <p>
                Channels are hand-curated with a Nordic-audience bias — prioritising content relevant to NATO, Finland, Sweden, the Baltic states, and Arctic security.
              </p>
              <ul>
                <li><strong>Tier 1:</strong> Primary sources, large audiences, or uniquely positioned channels.</li>
                <li><strong>Tier 2:</strong> Meaningful coverage from embedded reporters, credible analysts, or key opposition voices.</li>
                <li><strong>Tier 3:</strong> Context channels: tabloids, noisy official accounts, or fringe nationalist sources.</li>
              </ul>
              <p><Link href="/channels">View the full channel list →</Link></p>
            </section>

            <section className="about-section">
              <h2>Scraping</h2>
              <p>
                Every 30 minutes, the scraper fetches the public HTML preview at <code>t.me/s/&lt;handle&gt;</code> for each active channel. No Telegram account, no Bot API, no API key required — only public web pages.
              </p>
              <p>
                New messages are stored in Supabase Postgres and deduplicated by channel and post ID. Media attachments are noted but not downloaded. Some channels have their web preview disabled and may show repeated scrape errors.
              </p>
            </section>

            <section className="about-section">
              <h2>AI classification</h2>
              <p>Each new message is passed to a large language model with a structured prompt requesting:</p>
              <ul>
                <li><strong>English translation</strong> — full text translation, not paraphrase.</li>
                <li><strong>Topic</strong> — military operations, strikes, casualties, escalation, Nordic relevance, politics, economics, propaganda, humanitarian, breaking news, opinion, or other.</li>
                <li><strong>Significance</strong> — low, medium, high, or critical.</li>
                <li><strong>Entities</strong> — people, locations, organizations, and weapons.</li>
                <li><strong>Summary</strong> — a short analyst note on what the post claims and why it may matter.</li>
              </ul>
              <p>
                The primary classifier is <strong>Gemini 2.5 Flash-Lite</strong>, with Groq fallback. The channel category and stance are included in the prompt so the model has source context.
              </p>
            </section>

            <section className="about-section">
              <h2>Daily briefing</h2>
              <p>
                Every morning at 07:00 UTC, a briefing is generated summarising the previous 24 hours into 6–9 analyst-grade bullet points. The briefing focuses on high and critical significance items and is written for an analyst audience.
              </p>
              <p>Briefing model: <strong>Llama 3.3 70B</strong> via Groq API.</p>
            </section>

            <section className="about-section">
              <h2>Data freshness</h2>
              <ul>
                <li>Scrape interval: every 30 minutes via GitHub Actions</li>
                <li>Classification: hourly at minute 15</li>
                <li>Daily briefing: 07:00 UTC</li>
                <li>Page cache: 5-minute ISR</li>
                <li>RSS feed: updates every 5 minutes</li>
              </ul>
              <p>
                Pipeline health is visible in the feed sidebar, at <code>/api/health</code>, and on the human-readable <Link href="/status">status page</Link>.
              </p>
            </section>

            <section className="about-section">
              <h2>Technical stack</h2>
              <ul>
                <li>Next.js 16 App Router with TypeScript</li>
                <li>Prisma 5 and Supabase Postgres</li>
                <li>Gemini 2.5 Flash-Lite for classification</li>
                <li>Groq Llama 3.3 70B for daily briefing</li>
                <li>Cheerio for HTML scraping</li>
                <li>GitHub Actions for scheduled jobs</li>
                <li>Vercel for hosting</li>
              </ul>
            </section>

            <section className="about-section">
              <h2>Open source</h2>
              <p>
                The full source code is on GitHub. Contributions are especially useful around adding channels, improving classifier prompts, and hardening the scraper.
              </p>
              <p>
                <a href="https://github.com/Dimmu141/telegram-osint" target="_blank" rel="noopener noreferrer">github.com/Dimmu141/telegram-osint ↗</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
