"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MessageRow {
  id: string;
  telegramPostId: string;
  text: string | null;
  translationEn: string | null;
  topic: string | null;
  significance: string | null;
  entities: unknown;
  summary: string | null;
  postedAt: string;
  channel: { handle: string; nameEn: string | null; category: string };
}

export interface HealthStats {
  lastScrapedAt: string | null;
  lastClassifiedAt: string | null;
  queueDepth: number;
  classifiedToday: number;
  totalChannels: number;
}

interface EntityCount { name: string; count: number }
interface HourlyCount { hour: number; count: number }
interface BriefingData { bullets: string[]; generatedAt: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPIC_OPTIONS = [
  { label: "All topics",        key: "all",       topics: null },
  { label: "Military",          key: "military",  topics: ["military_operations", "breaking_news"] },
  { label: "Strikes / Air Def", key: "strikes",   topics: ["strikes_air_defense"] },
  { label: "Casualties",        key: "casualties",topics: ["casualties_losses"] },
  { label: "Escalation",        key: "escalation",topics: ["escalation_rhetoric"] },
  { label: "Nordic relevance",  key: "nordic",    topics: ["nordic_relevance"] },
  { label: "Political",         key: "political", topics: ["political_domestic", "political_foreign", "opinion_analysis"] },
  { label: "Economic",          key: "economic",  topics: ["economic"] },
  { label: "Propaganda",        key: "propaganda",topics: ["propaganda"] },
] as const;

// Simplified from 8 → 5 options (reader-friendly labels)
const SOURCE_OPTIONS = [
  { label: "All sources",       key: "all",        categories: null },
  { label: "Pro-Kremlin",       key: "kremlin",    categories: ["kremlin_official", "state_media", "propagandist", "nationalist"] },
  { label: "Milbloggers",       key: "military",   categories: ["milblogger_frontline", "milblogger_analytical", "milblogger", "pmc"] },
  { label: "Independent",       key: "independent",categories: ["exile_independent", "opposition", "elite_analytical", "business"] },
  { label: "Ukraine & Belarus", key: "peripheral", categories: ["ukrainian", "belarusian"] },
] as const;

const SIG_OPTIONS = [
  { label: "All",    key: "all",      min: 0 },
  { label: "Med+",   key: "medium",   min: 1 },
  { label: "High+",  key: "high",     min: 2 },
  { label: "Crit",   key: "critical", min: 3 },
] as const;

const SIG_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

const TOPIC_TAG_CLASS: Record<string, string> = {
  military_operations: "tag tag-mil",
  strikes_air_defense: "tag tag-strk",
  casualties_losses:   "tag tag-cas",
  escalation_rhetoric: "tag tag-esc",
  nordic_relevance:    "tag tag-nor",
  political_domestic:  "tag tag-pol",
  political_foreign:   "tag tag-pol",
  opinion_analysis:    "tag tag-pol",
  economic:            "tag tag-eco",
  propaganda:          "tag tag-prop",
  humanitarian:        "tag tag-other",
  breaking_news:       "tag tag-mil",
  other:               "tag tag-other",
};

const CATEGORY_LABELS: Record<string, string> = {
  kremlin_official:     "Kremlin Official",
  state_media:          "State Media",
  propagandist:         "Propagandists",
  milblogger_frontline: "Frontline Reporters",
  milblogger_analytical:"Military Analysts",
  milblogger:           "Military Bloggers",
  pmc:                  "PMC",
  nationalist:          "Nationalist",
  tabloid:              "Tabloid",
  exile_independent:    "Exile / Independent",
  opposition:           "Opposition",
  elite_analytical:     "Elite Analytical",
  business:             "Business",
  ukrainian:            "Ukrainian",
  belarusian:           "Belarusian",
};

const CATEGORY_ORDER = [
  "kremlin_official", "state_media", "propagandist",
  "milblogger_frontline", "milblogger_analytical", "milblogger",
  "pmc", "nationalist", "tabloid",
  "exile_independent", "opposition", "elite_analytical",
  "business", "ukrainian", "belarusian",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const mon = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  const hh  = String(d.getUTCHours()).padStart(2, "0");
  const mm  = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} · ${hh}:${mm} UTC · ${relTime(iso)}`;
}

interface Entities {
  people?: string[];
  locations?: string[];
  organizations?: string[];
  weapons?: string[];
}
function parseEntities(raw: unknown): Entities {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Entities;
}

// ─── Message card ─────────────────────────────────────────────────────────────

function MessageCard({
  msg, isNew, activeChannel, onChannelClick,
}: {
  msg: MessageRow;
  isNew: boolean;
  activeChannel: string;
  onChannelClick: (h: string) => void;
}) {
  const [showOrig, setShowOrig] = useState(false);
  const sig = msg.significance ?? "medium";
  const entities = parseEntities(msg.entities);
  const topicLabel = msg.topic?.replace(/_/g, " ") ?? "unclassified";
  const topicClass = msg.topic ? (TOPIC_TAG_CLASS[msg.topic] ?? "tag tag-other") : "tag tag-other";
  const channelName = msg.channel.nameEn ?? `@${msg.channel.handle}`;
  const sourceLink = `https://t.me/${msg.telegramPostId}`;
  const permalink = `/m/${msg.id}`;

  const cardClass = [
    "msg",
    sig === "critical" ? "crit" : sig === "high" ? "high" : sig === "low" ? "low" : "",
    isNew ? "new-msg" : "",
  ].filter(Boolean).join(" ");

  const tags = [
    ...(entities.people ?? []),
    ...(entities.locations ?? []),
    ...(entities.organizations ?? []),
  ].slice(0, 5);

  return (
    <article className={cardClass}>
      <div className="msg-head">
        <button
          className="msg-channel"
          onClick={() => onChannelClick(msg.channel.handle)}
          style={activeChannel === msg.channel.handle ? { color: "var(--blue)" } : undefined}
        >
          {channelName}
        </button>
        <span className="msg-handle">@{msg.channel.handle}</span>
        <span className={topicClass}>{topicLabel}</span>
        {sig === "critical" && <span className="tag tag-sig-crit">critical</span>}
        {sig === "high"     && <span className="tag tag-sig-high">high</span>}
        {isNew              && <span className="tag tag-new">new</span>}
        <span className="msg-time">{fmtTime(msg.postedAt)}</span>
        <a href={permalink} className="msg-link" title="Permalink">¶</a>
        <a href={sourceLink} target="_blank" rel="noopener noreferrer" className="msg-link" title="Open in Telegram">↗</a>
      </div>

      {msg.translationEn && (
        <p className="msg-body">{msg.translationEn}</p>
      )}

      {msg.text && (
        <>
          <button className="show-orig" onClick={() => setShowOrig((s) => !s)}>
            {showOrig ? "▲ hide original" : "▼ show original Russian"}
          </button>
          {showOrig && <p className="orig-text">{msg.text}</p>}
        </>
      )}

      {msg.summary && (
        <div className="analysis">
          <div className="analysis-lbl">Analysis</div>
          <p>{msg.summary}</p>
        </div>
      )}

      {tags.length > 0 && (
        <div className="entities">
          {tags.map((t) => <span key={t} className="ent-tag">{t}</span>)}
        </div>
      )}
    </article>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MessageFeed({
  messages, briefing, healthStats, topEntities, hourlyData, nowStr, totalCount,
}: {
  messages: MessageRow[];
  briefing: BriefingData | null;
  healthStats: HealthStats;
  topEntities: EntityCount[];
  hourlyData: HourlyCount[];
  nowStr: string;
  totalCount: number;
}) {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const pathname      = usePathname();

  // URL-driven filter state (default sig: "all" — don't silently hide content)
  const topicKey      = searchParams.get("topic")   ?? "all";
  const sourceKey     = searchParams.get("source")  ?? "all";
  const sigKey        = searchParams.get("sig")     ?? "all";
  const search        = searchParams.get("q")       ?? "";
  const channelFilter = searchParams.get("channel") ?? "";

  const [lastVisit, setLastVisit]     = useState<Date | null>(null);
  const [brifOpen, setBrifOpen]       = useState(true);
  const [currentHour, setCurrentHour] = useState(0);
  const [filterOpen, setFilterOpen]   = useState(false);

  useEffect(() => {
    setCurrentHour(new Date().getUTCHours());
    const stored = localStorage.getItem("osint_last_visit");
    if (stored) setLastVisit(new Date(stored));
    localStorage.setItem("osint_last_visit", new Date().toISOString());
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (filterOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [filterOpen]);

  const set = useCallback((key: string, val: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set(key, val);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const handleChannelClick = useCallback((handle: string) => {
    set("channel", channelFilter === handle ? "" : handle);
  }, [channelFilter, set]);

  const handleEntityClick = useCallback((name: string) => {
    set("q", search === name ? "" : name);
  }, [search, set]);

  const clearFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  // Filter logic
  const tf  = TOPIC_OPTIONS.find((o) => o.key  === topicKey);
  const sf  = SOURCE_OPTIONS.find((o) => o.key  === sourceKey);
  const sgf = SIG_OPTIONS.find((o)   => o.key  === sigKey);
  const sigMin = sgf?.min ?? 0;

  const hasActiveFilters = topicKey !== "all" || sourceKey !== "all" || sigKey !== "all" || search !== "" || channelFilter !== "";

  const filtered = useMemo(() => {
    const sl = search.toLowerCase();
    return messages.filter((m) => {
      if (tf?.topics  && (!m.topic || !(tf.topics  as readonly string[]).includes(m.topic)))  return false;
      if (sf?.categories && !(sf.categories as readonly string[]).includes(m.channel.category)) return false;
      if (channelFilter && m.channel.handle !== channelFilter) return false;
      if (sigMin > 0 && (SIG_RANK[m.significance ?? "medium"] ?? 1) < sigMin) return false;
      if (sl) {
        const hay = [m.translationEn ?? "", m.summary ?? "", m.channel.nameEn ?? "", m.channel.handle].join(" ").toLowerCase();
        if (!hay.includes(sl)) return false;
      }
      return true;
    });
  }, [messages, tf, sf, channelFilter, sigMin, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, MessageRow[]>();
    for (const m of filtered) {
      if (!map.has(m.channel.category)) map.set(m.channel.category, []);
      map.get(m.channel.category)!.push(m);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a), bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [filtered]);

  // Sparkline
  const sparkMax = Math.max(...hourlyData.map((d) => d.count), 1);

  // Counts for filter labels
  const topicCounts = useMemo(() => {
    const c: Record<string, number> = { all: messages.length };
    for (const opt of TOPIC_OPTIONS) {
      if (!opt.topics) continue;
      c[opt.key] = messages.filter((m) => m.topic && (opt.topics as readonly string[]).includes(m.topic)).length;
    }
    return c;
  }, [messages]);

  const sourceCounts = useMemo(() => {
    const c: Record<string, number> = { all: new Set(messages.map((m) => m.channel.handle)).size };
    for (const opt of SOURCE_OPTIONS) {
      if (!opt.categories) continue;
      c[opt.key] = new Set(
        messages
          .filter((m) => (opt.categories as readonly string[]).includes(m.channel.category))
          .map((m) => m.channel.handle)
      ).size;
    }
    return c;
  }, [messages]);

  // Sidebar content (shared between desktop and mobile drawer)
  const sidebarContent = (
    <>
      {/* Mobile close button */}
      <button className="mob-close-btn" onClick={() => setFilterOpen(false)}>
        <span>Filters</span>
        <span>✕ Close</span>
      </button>

      <div className="side-section">
        <div className="side-label">Search</div>
        <div className="search-box">
          <input
            type="text"
            placeholder="Translations, summaries…"
            value={search}
            onChange={(e) => set("q", e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => set("q", "")} aria-label="Clear search">×</button>
          )}
        </div>
        {channelFilter && (
          <div className="active-channel-chip">
            <span>@{channelFilter}</span>
            <button onClick={() => set("channel", "")} aria-label="Clear channel filter">×</button>
          </div>
        )}
      </div>

      <div className="side-section">
        <div className="side-label">
          Significance
          {sigKey !== "all" && <button className="clr" onClick={() => set("sig", "all")}>reset</button>}
        </div>
        <div className="sig-row">
          {SIG_OPTIONS.map((o) => (
            <button key={o.key} className={sigKey === o.key ? "active" : ""} onClick={() => set("sig", o.key)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="side-section">
        <div className="side-label">
          Topic
          {topicKey !== "all" && <button className="clr" onClick={() => set("topic", "all")}>reset</button>}
        </div>
        <div className="filter-list">
          {TOPIC_OPTIONS.map((o) => (
            <button key={o.key} className={"filter-opt" + (topicKey === o.key ? " active" : "")} onClick={() => set("topic", o.key)}>
              {o.label}
              <span className="n">{topicCounts[o.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="side-section">
        <div className="side-label">
          Source
          {sourceKey !== "all" && <button className="clr" onClick={() => set("source", "all")}>reset</button>}
        </div>
        <div className="filter-list">
          {SOURCE_OPTIONS.map((o) => (
            <button key={o.key} className={"filter-opt" + (sourceKey === o.key ? " active" : "")} onClick={() => set("source", o.key)}>
              {o.label}
              <span className="n">{sourceCounts[o.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {hasActiveFilters && (
        <div className="side-section">
          <button className="filter-opt" style={{ color: "var(--signal)", fontWeight: 500 }} onClick={clearFilters}>
            Clear all filters
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="layout">

        {/* ── LEFT SIDEBAR ── */}
        <aside className={`sidebar${filterOpen ? " mob-open" : ""}`}>
          {sidebarContent}
        </aside>

        {/* ── MAIN FEED ── */}
        <main className="main-col">

          {/* Mobile filter button */}
          <button className="mob-filter-btn" onClick={() => setFilterOpen(true)}>
            {hasActiveFilters && <span className="mob-filter-dot" />}
            ≡ Filters
            {hasActiveFilters && <span style={{ color: "var(--blue)" }}>· active</span>}
          </button>

          <div className="feed-head">
            <div className="feed-title-row">
              <h1 className="feed-title">
                Russian-language Telegram,{" "}
                <em style={{ fontStyle: "italic", color: "var(--ink-2)" }}>last 24 hours</em>
              </h1>
              <div className="feed-meta">
                <b>{totalCount}</b> classified · {nowStr}
              </div>
            </div>

            {/* Daily briefing */}
            {briefing && (
              <div className="briefing">
                <div className="brf-head">
                  <div className="brf-eyebrow">
                    <span>Daily Briefing</span>
                    <span className="when">generated {relTime(briefing.generatedAt)}</span>
                  </div>
                  <button className="brf-toggle" onClick={() => setBrifOpen((o) => !o)}>
                    {brifOpen ? "▲ collapse" : "▼ expand"}
                  </button>
                </div>
                {brifOpen && (
                  <ul className="brf-bullets">
                    {briefing.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Sparkline */}
            <div className="spark-row">
              <div>
                <div className="spark-label">Message volume · last 24h UTC</div>
                <div className="spark">
                  {hourlyData.map(({ hour, count }) => {
                    const pct = Math.max(count > 0 ? 4 : 0, (count / sparkMax) * 100);
                    return (
                      <span
                        key={hour}
                        className={hour === currentHour ? "cur" : ""}
                        style={{ height: `${pct}%` }}
                        title={`${String(hour).padStart(2, "0")}:00 UTC — ${count} msgs`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="spark-count">
                <div className="spark-label">Showing</div>
                <div className="spark-count-num">
                  {filtered.length} <span className="spark-count-total">of {totalCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feed */}
          {grouped.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <p style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", fontSize: "13px" }}>
                No messages match the current filters.
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  style={{
                    marginTop: 12, padding: "8px 16px",
                    border: "1px solid var(--rule)", background: "none",
                    fontFamily: "var(--mono)", fontSize: "11px",
                    color: "var(--ink-3)", cursor: "pointer",
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            grouped.map(([cat, msgs]) => (
              <section key={cat} className="cat-group">
                <div className="cat-head">
                  <h2>{CATEGORY_LABELS[cat] ?? cat}</h2>
                  <span className="ct">{msgs.length} {msgs.length === 1 ? "message" : "messages"}</span>
                </div>
                {msgs.map((m) => (
                  <MessageCard
                    key={m.id}
                    msg={m}
                    isNew={lastVisit !== null && new Date(m.postedAt) > lastVisit}
                    activeChannel={channelFilter}
                    onChannelClick={handleChannelClick}
                  />
                ))}
              </section>
            ))
          )}

        </main>

        {/* ── RIGHT ASIDE ── */}
        <aside className="aside-col">

          <div className="aside-block">
            <div className="aside-label">Top entities · today</div>
            <div className="entity-cloud">
              {topEntities.map(({ name, count }) => (
                <button
                  key={name}
                  className={"entity-pill" + (search === name ? " active" : "")}
                  onClick={() => handleEntityClick(name)}
                >
                  {name} <span className="ec">{count}</span>
                </button>
              ))}
              {topEntities.length === 0 && (
                <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--ink-4)" }}>
                  No entities yet
                </span>
              )}
            </div>
          </div>

          <div className="aside-block">
            <div className="aside-label">Pipeline</div>
            <div className="health">
              <div className="health-row">
                <span className="k">last scrape</span>
                <span className={"v" + (healthStats.lastScrapedAt ? " ok" : " warn")}>
                  {healthStats.lastScrapedAt ? relTime(healthStats.lastScrapedAt) : "unknown"}
                </span>
              </div>
              <div className="health-row">
                <span className="k">last classify</span>
                <span className={"v" + (healthStats.lastClassifiedAt ? " ok" : " warn")}>
                  {healthStats.lastClassifiedAt ? relTime(healthStats.lastClassifiedAt) : "unknown"}
                </span>
              </div>
              <div className="health-row">
                <span className="k">unprocessed</span>
                <span className={"v" + (healthStats.queueDepth > 50 ? " warn" : "")}>
                  {healthStats.queueDepth}
                </span>
              </div>
            </div>
          </div>

          <div className="aside-block">
            <div className="aside-label">About</div>
            <div className="about">
              <p>
                Scrapes {healthStats.totalChannels} Russian, Ukrainian and Belarusian
                Telegram channels every 30 minutes. Each post is translated to English
                and classified by topic, significance and entity.
              </p>
              <p>
                Built for Nordic newsrooms and threat-intelligence analysts.
                Public sources only — no Telegram API.
              </p>
              <p>
                <a href="/about">Methodology →</a>
                {" · "}
                <a href="/channels">Channels →</a>
              </p>
              <p>
                <a href="https://github.com/Dimmu141/telegram-osint" target="_blank" rel="noopener noreferrer">
                  GitHub ↗
                </a>
                {" · "}
                <a href="/feed.xml" title="RSS feed">RSS ↗</a>
              </p>
            </div>
          </div>

        </aside>

      </div>

      {/* Mobile overlay backdrop */}
      {filterOpen && (
        <div className="mob-overlay" onClick={() => setFilterOpen(false)} />
      )}
    </>
  );
}
