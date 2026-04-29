"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  flaggedBecause,
  parseEntities as parseEditorialEntities,
  sourceContextForCategory,
  textMatchesQuery,
} from "@/lib/editorial";

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
  channel: {
    handle: string;
    nameEn: string | null;
    category: string;
    stance: string;
    sourceType: string;
  };
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

interface ClaimCluster {
  key: string;
  label: string;
  count: number;
  messages: MessageRow[];
  channelCount: number;
  highCount: number;
  criticalCount: number;
  firstSeen: string;
  latestSeen: string;
  sourceMix: string;
  verification: string;
}

type ViewMode = "stories" | "feed" | "saved";

const TOPIC_OPTIONS = [
  { label: "All topics", key: "all", topics: null },
  { label: "Military", key: "military", topics: ["military_operations", "breaking_news"] },
  { label: "Strikes / Air Def", key: "strikes", topics: ["strikes_air_defense"] },
  { label: "Casualties", key: "casualties", topics: ["casualties_losses"] },
  { label: "Escalation", key: "escalation", topics: ["escalation_rhetoric"] },
  { label: "Regional / NATO", key: "regional", topics: ["nordic_relevance"] },
  { label: "Political", key: "political", topics: ["political_domestic", "political_foreign", "opinion_analysis"] },
  { label: "Economic", key: "economic", topics: ["economic"] },
  { label: "Propaganda", key: "propaganda", topics: ["propaganda"] },
] as const;

const SOURCE_OPTIONS = [
  { label: "All sources", key: "all", categories: null },
  { label: "Official / State-aligned", key: "official", categories: ["kremlin_official", "state_media"] },
  { label: "Milbloggers", key: "milbloggers", categories: ["milblogger_frontline", "milblogger_analytical", "milblogger", "pmc"] },
  { label: "Propagandists / Nationalists", key: "propagandists", categories: ["propagandist", "nationalist"] },
  { label: "Independent / Exile media", key: "independent", categories: ["exile_independent", "opposition", "ukrainian", "belarusian"] },
  { label: "Anonymous / Elite rumor channels", key: "rumor", categories: ["elite_analytical"] },
  { label: "Business / Economic", key: "business", categories: ["business"] },
  { label: "Tabloid / Incident wires", key: "tabloid", categories: ["tabloid"] },
] as const;

const SIG_OPTIONS = [
  { label: "All", key: "all", min: 0 },
  { label: "Med+", key: "medium", min: 1 },
  { label: "High+", key: "high", min: 2 },
  { label: "Crit", key: "critical", min: 3 },
] as const;

const SIG_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

const TOPIC_TAG_CLASS: Record<string, string> = {
  military_operations: "tag tag-mil",
  strikes_air_defense: "tag tag-strk",
  casualties_losses: "tag tag-cas",
  escalation_rhetoric: "tag tag-esc",
  nordic_relevance: "tag tag-nor",
  political_domestic: "tag tag-pol",
  political_foreign: "tag tag-pol",
  opinion_analysis: "tag tag-pol",
  economic: "tag tag-eco",
  propaganda: "tag tag-prop",
  humanitarian: "tag tag-other",
  breaking_news: "tag tag-mil",
  other: "tag tag-other",
};

const CATEGORY_LABELS: Record<string, string> = {
  kremlin_official: "Official / Kremlin",
  state_media: "State Media",
  propagandist: "Propagandists",
  milblogger_frontline: "Frontline Milbloggers",
  milblogger_analytical: "Military Analysts",
  milblogger: "Military Bloggers",
  pmc: "PMC-linked",
  nationalist: "Nationalists",
  tabloid: "Tabloid / Incident wires",
  exile_independent: "Exile / Independent media",
  opposition: "Opposition sources",
  elite_analytical: "Anonymous / Elite rumor channels",
  business: "Business / Economic",
  ukrainian: "Ukrainian sources",
  belarusian: "Belarusian sources",
};

const CATEGORY_ORDER = [
  "kremlin_official", "state_media", "propagandist",
  "milblogger_frontline", "milblogger_analytical", "milblogger",
  "pmc", "nationalist", "tabloid",
  "exile_independent", "opposition", "elite_analytical",
  "business", "ukrainian", "belarusian",
];

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
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} - ${hh}:${mm} UTC - ${relTime(iso)}`;
}

interface Entities {
  people?: string[];
  locations?: string[];
  organizations?: string[];
  weapons?: string[];
}

function parseEntities(raw: unknown): Entities {
  return parseEditorialEntities(raw);
}

function claimKey(msg: MessageRow): string {
  const entities = parseEntities(msg.entities);
  const mainEntity =
    entities.locations?.[0] ??
    entities.organizations?.[0] ??
    entities.people?.[0] ??
    entities.weapons?.[0] ??
    msg.channel.category;
  return `${msg.topic ?? "other"}:${mainEntity.toLowerCase()}`;
}

function claimLabel(msg: MessageRow): string {
  const entities = parseEntities(msg.entities);
  const mainEntity =
    entities.locations?.[0] ??
    entities.organizations?.[0] ??
    entities.people?.[0] ??
    entities.weapons?.[0];
  const topic = msg.topic?.replace(/_/g, " ") ?? "related claim";
  return mainEntity ? `${topic} / ${mainEntity}` : topic;
}

function sourceTrust(category: string) {
  return sourceContextForCategory(category);
}

function citationFor(msg: MessageRow): string {
  const base = typeof window === "undefined" ? "" : window.location.origin;
  const channelName = msg.channel.nameEn ?? `@${msg.channel.handle}`;
  const text = msg.translationEn ?? msg.text ?? "";
  return [
    `${channelName} (@${msg.channel.handle}), ${fmtTime(msg.postedAt)}`,
    text,
    `${base}/m/${msg.id}`,
    `Source: https://t.me/${msg.telegramPostId}`,
  ].filter(Boolean).join("\n");
}

function StoryClusterCard({
  cluster, onOpenClaim, onCopy,
}: {
  cluster: ClaimCluster;
  onOpenClaim: (label: string) => void;
  onCopy: (text: string) => void;
}) {
  const topMessages = cluster.messages.slice(0, 3);
  const lead = topMessages[0];
  const sigClass = cluster.criticalCount > 0 ? "crit" : cluster.highCount > 0 ? "high" : "";

  return (
    <article className={`story-card ${sigClass}`}>
      <div className="story-head">
        <div>
          <div className="story-kicker">
            {cluster.count} posts - {cluster.channelCount} sources - {cluster.verification}
          </div>
          <h2>{cluster.label}</h2>
        </div>
        <button className="msg-action" onClick={() => onOpenClaim(cluster.label)}>
          Filter story
        </button>
      </div>
      <div className="story-meta">
        <span>latest {relTime(cluster.latestSeen)}</span>
        <span>first {fmtTime(cluster.firstSeen)}</span>
        <span>{cluster.sourceMix}</span>
      </div>
      <div className="story-posts">
        {topMessages.map((msg) => (
          <div key={msg.id} className="story-post">
            <div className="story-post-head">
              <Link href={`/channels/${msg.channel.handle}`}>{msg.channel.nameEn ?? `@${msg.channel.handle}`}</Link>
              <span>{fmtTime(msg.postedAt)}</span>
            </div>
            <p>{msg.translationEn ?? msg.text ?? "No text extracted."}</p>
            <div className="msg-actions">
              <a className="msg-action" href={`/m/${msg.id}`}>Open post</a>
              <a className="msg-action" href={`https://t.me/${msg.telegramPostId}`} target="_blank" rel="noopener noreferrer">Telegram</a>
              <button className="msg-action" onClick={() => onCopy(citationFor(msg))}>Copy citation</button>
            </div>
          </div>
        ))}
      </div>
      {lead?.summary && (
        <div className="analysis story-analysis">
          <div className="analysis-lbl">Analyst note</div>
          <p>{lead.summary}</p>
        </div>
      )}
    </article>
  );
}

function MessageCard({
  msg, isNew, activeChannel, onChannelClick, cluster, isSaved, onToggleSaved, onCopy,
}: {
  msg: MessageRow;
  isNew: boolean;
  activeChannel: string;
  onChannelClick: (h: string) => void;
  cluster: ClaimCluster | null;
  isSaved: boolean;
  onToggleSaved: (id: string) => void;
  onCopy: (text: string) => void;
}) {
  const [showOrig, setShowOrig] = useState(false);
  const sig = msg.significance ?? "medium";
  const entities = parseEntities(msg.entities);
  const topicLabel = msg.topic?.replace(/_/g, " ") ?? "unclassified";
  const topicClass = msg.topic ? (TOPIC_TAG_CLASS[msg.topic] ?? "tag tag-other") : "tag tag-other";
  const channelName = msg.channel.nameEn ?? `@${msg.channel.handle}`;
  const sourceLink = `https://t.me/${msg.telegramPostId}`;
  const permalink = `/m/${msg.id}`;
  const trust = sourceTrust(msg.channel.category);
  const flagReason = flaggedBecause(msg.significance, msg.topic, msg.channel.category);

  const cardClass = [
    "msg",
    sig === "critical" ? "crit" : sig === "high" ? "high" : sig === "low" ? "low" : "",
    isNew ? "new-msg" : "",
  ].filter(Boolean).join(" ");

  const tags = [
    ...(entities.people ?? []),
    ...(entities.locations ?? []),
    ...(entities.organizations ?? []),
    ...(entities.weapons ?? []),
  ].slice(0, 6);

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
        <Link className="msg-handle" href={`/channels/${msg.channel.handle}`}>@{msg.channel.handle}</Link>
        <span className="tag" title={trust.note} style={{ background: trust.bg, color: trust.color }}>
          {trust.label}
        </span>
        <span className={topicClass}>{topicLabel}</span>
        {sig === "critical" && <span className="tag tag-sig-crit">critical relevance</span>}
        {sig === "high" && <span className="tag tag-sig-high">high relevance</span>}
        {cluster && cluster.count > 1 && (
          <span
            className="tag tag-other"
            title={`${cluster.count} posts in the last 24h share this topic/entity cluster: ${cluster.label}`}
          >
            {cluster.count} related
          </span>
        )}
        {isNew && <span className="tag tag-new">new</span>}
        <span className="msg-time">{fmtTime(msg.postedAt)}</span>
        <a href={permalink} className="msg-link" title="Permalink">#</a>
        <a href={sourceLink} target="_blank" rel="noopener noreferrer" className="msg-link" title="Open in Telegram">open</a>
      </div>

      {msg.translationEn && <p className="msg-body">{msg.translationEn}</p>}

      {msg.text && (
        <>
          <button className="show-orig" onClick={() => setShowOrig((s) => !s)}>
            {showOrig ? "hide original" : "show original"}
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

      {flagReason && <div className="flagged-reason">{flagReason}</div>}

      <div className="msg-actions">
        <button className="msg-action" onClick={() => onToggleSaved(msg.id)}>
          {isSaved ? "Saved" : "Save"}
        </button>
        <button className="msg-action" onClick={() => onCopy(msg.translationEn ?? msg.text ?? "")}>
          Copy quote
        </button>
        <button className="msg-action" onClick={() => onCopy(citationFor(msg))}>
          Copy citation
        </button>
      </div>
    </article>
  );
}

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const topicKey = searchParams.get("topic") ?? "all";
  const sourceKey = searchParams.get("source") ?? "all";
  const sigKey = searchParams.get("sig") ?? "all";
  const search = searchParams.get("q") ?? "";
  const channelFilter = searchParams.get("channel") ?? "";
  const viewParam = searchParams.get("view");
  const viewMode: ViewMode = viewParam === "feed" || viewParam === "saved" ? viewParam : "stories";

  const [lastVisit] = useState<Date | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("osint_last_visit");
    return stored ? new Date(stored) : null;
  });
  const [brifOpen, setBrifOpen] = useState(true);
  const [currentHour] = useState(() => new Date().getUTCHours());
  const [filterOpen, setFilterOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const saved = localStorage.getItem("osint_saved_posts");
    if (!saved) return new Set();
    try {
      return new Set(JSON.parse(saved) as string[]);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem("osint_last_visit", new Date().toISOString());
  }, []);

  useEffect(() => {
    document.body.style.overflow = filterOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [filterOpen]);

  const set = useCallback((key: string, val: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (val) p.set(key, val);
    else p.delete(key);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
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

  const toggleSaved = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("osint_saved_posts", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const copyText = useCallback(async (text: string) => {
    if (!text) return;
    if (navigator.clipboard) await navigator.clipboard.writeText(text);
  }, []);

  const tf = TOPIC_OPTIONS.find((o) => o.key === topicKey);
  const sf = SOURCE_OPTIONS.find((o) => o.key === sourceKey);
  const sgf = SIG_OPTIONS.find((o) => o.key === sigKey);
  const sigMin = sgf?.min ?? 0;

  const hasActiveFilters = topicKey !== "all" || sourceKey !== "all" || sigKey !== "all" || search !== "" || channelFilter !== "";

  const filtered = useMemo(() => {
    const sl = search.toLowerCase();
    return messages.filter((m) => {
      if (tf?.topics && (!m.topic || !(tf.topics as readonly string[]).includes(m.topic))) return false;
      if (sf?.categories && !(sf.categories as readonly string[]).includes(m.channel.category)) return false;
      if (channelFilter && m.channel.handle !== channelFilter) return false;
      if (sigMin > 0 && (SIG_RANK[m.significance ?? "medium"] ?? 1) < sigMin) return false;
      if (sl) {
        const fields = [
          m.translationEn ?? "",
          m.summary ?? "",
          m.text ?? "",
          m.topic ?? "",
          m.significance ?? "",
          m.channel.nameEn ?? "",
          m.channel.handle,
          m.channel.category,
          m.channel.stance,
          m.channel.sourceType,
          m.topic ?? "",
          m.significance ?? "",
        ];
        if (!textMatchesQuery(fields, m.entities, sl)) return false;
      }
      return true;
    });
  }, [messages, tf, sf, channelFilter, sigMin, search]);

  const savedMessages = useMemo(
    () => messages.filter((m) => savedIds.has(m.id)),
    [messages, savedIds],
  );

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

  const claimClusters = useMemo(() => {
    const map = new Map<string, ClaimCluster>();
    for (const msg of messages) {
      const key = claimKey(msg);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.messages.push(msg);
      } else {
        map.set(key, {
          key,
          label: claimLabel(msg),
          count: 1,
          messages: [msg],
          channelCount: 1,
          highCount: 0,
          criticalCount: 0,
          firstSeen: msg.postedAt,
          latestSeen: msg.postedAt,
          sourceMix: "",
          verification: "",
        });
      }
    }

    for (const cluster of map.values()) {
      cluster.messages.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
      const channels = new Set(cluster.messages.map((m) => m.channel.handle));
      const categories = new Set(cluster.messages.map((m) => CATEGORY_LABELS[m.channel.category] ?? m.channel.category));
      cluster.channelCount = channels.size;
      cluster.highCount = cluster.messages.filter((m) => m.significance === "high").length;
      cluster.criticalCount = cluster.messages.filter((m) => m.significance === "critical").length;
      cluster.latestSeen = cluster.messages[0]?.postedAt ?? cluster.latestSeen;
      cluster.firstSeen = cluster.messages[cluster.messages.length - 1]?.postedAt ?? cluster.firstSeen;
      cluster.sourceMix = [...categories].slice(0, 3).join(", ");
      cluster.verification =
        cluster.channelCount >= 3 ? "related mentions across sources" :
        cluster.channelCount === 2 ? "related mentions in two sources" :
        "single-source mention";
    }
    return map;
  }, [messages]);

  const storyClusters = useMemo(() => {
    const visibleKeys = new Set(filtered.map(claimKey));
    return [...claimClusters.values()]
      .filter((cluster) => visibleKeys.has(cluster.key))
      .filter((cluster) => cluster.count > 1 || cluster.highCount > 0 || cluster.criticalCount > 0)
      .sort((a, b) => {
        const aScore = a.criticalCount * 100 + a.highCount * 20 + a.channelCount * 5 + a.count;
        const bScore = b.criticalCount * 100 + b.highCount * 20 + b.channelCount * 5 + b.count;
        if (aScore !== bScore) return bScore - aScore;
        return new Date(b.latestSeen).getTime() - new Date(a.latestSeen).getTime();
      })
      .slice(0, 24);
  }, [claimClusters, filtered]);

  const sparkMax = Math.max(...hourlyData.map((d) => d.count), 1);

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

  const messageList = viewMode === "saved" ? savedMessages : filtered;

  const sidebarContent = (
    <>
      <button className="mob-close-btn" onClick={() => setFilterOpen(false)}>
        <span>Filters</span>
        <span>Close</span>
      </button>

      <div className="side-section">
        <div className="side-label">Search</div>
        <div className="search-box">
          <input
            type="text"
            placeholder="Search translations, originals, entities..."
            value={search}
            onChange={(e) => set("q", e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => set("q", "")} aria-label="Clear search">x</button>
          )}
        </div>
        {channelFilter && (
          <div className="active-channel-chip">
            <span>@{channelFilter}</span>
            <button onClick={() => set("channel", "")} aria-label="Clear channel filter">x</button>
          </div>
        )}
      </div>

      <div className="side-section">
        <div className="side-label">
          Editorial relevance
          {sigKey !== "all" && <button className="clr" onClick={() => set("sig", "all")}>reset</button>}
        </div>
        <div className="filter-note">High relevance means worth reviewing, not confirmed true.</div>
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
        <aside className={`sidebar${filterOpen ? " mob-open" : ""}`}>
          {sidebarContent}
        </aside>

        <main className="main-col">
          <button className="mob-filter-btn" onClick={() => setFilterOpen(true)}>
            {hasActiveFilters && <span className="mob-filter-dot" />}
            Filters
            {hasActiveFilters && <span style={{ color: "var(--blue)" }}>active</span>}
          </button>

          <div className="feed-head">
            <div className="feed-title-row">
              <h1 className="feed-title">
                Russian-language Telegram,{" "}
                <em style={{ fontStyle: "italic", color: "var(--ink-2)" }}>last 24 hours</em>
              </h1>
              <div className="feed-meta">
                <b>{totalCount}</b> classified - {nowStr}
              </div>
            </div>
            <div className="feed-caveat">
              Significance is editorial relevance, not verification. Treat posts as discovery signals until checked against original and independent sources.
            </div>

            {briefing && (
              <div className="briefing">
                <div className="brf-head">
                  <div className="brf-eyebrow">
                    <span>Daily Briefing</span>
                    <span className="when">generated {relTime(briefing.generatedAt)}</span>
                  </div>
                  <button className="brf-toggle" onClick={() => setBrifOpen((o) => !o)}>
                    {brifOpen ? "collapse" : "expand"}
                  </button>
                </div>
                {brifOpen && (
                  <ul className="brf-bullets">
                    {briefing.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                )}
              </div>
            )}

            <div className="spark-row">
              <div>
                <div className="spark-label">Message volume - last 24h UTC</div>
                <div className="spark">
                  {hourlyData.map(({ hour, count }) => {
                    const pct = Math.max(count > 0 ? 4 : 0, (count / sparkMax) * 100);
                    return (
                      <span
                        key={hour}
                        className={hour === currentHour ? "cur" : ""}
                        style={{ height: `${pct}%` }}
                        title={`${String(hour).padStart(2, "0")}:00 UTC - ${count} msgs`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="spark-count">
                <div className="spark-label">Showing</div>
                <div className="spark-count-num">
                  {viewMode === "saved" ? savedMessages.length : filtered.length} <span className="spark-count-total">of {totalCount}</span>
                </div>
              </div>
            </div>

            <div className="view-tabs">
              <button className={viewMode === "stories" ? "active" : ""} onClick={() => set("view", "")}>
                Stories <span>{storyClusters.length}</span>
              </button>
              <button className={viewMode === "feed" ? "active" : ""} onClick={() => set("view", "feed")}>
                Source feed <span>{filtered.length}</span>
              </button>
              <button className={viewMode === "saved" ? "active" : ""} onClick={() => set("view", "saved")}>
                Saved <span>{savedMessages.length}</span>
              </button>
            </div>
          </div>

          {viewMode === "stories" ? (
            storyClusters.length === 0 ? (
              <EmptyState hasActiveFilters={hasActiveFilters} clearFilters={clearFilters} />
            ) : (
              <div className="story-list">
                {storyClusters.map((cluster) => (
                  <StoryClusterCard
                    key={cluster.key}
                    cluster={cluster}
                    onOpenClaim={(label) => set("q", label.split("/").at(-1)?.trim() ?? label)}
                    onCopy={copyText}
                  />
                ))}
              </div>
            )
          ) : messageList.length === 0 ? (
            <EmptyState hasActiveFilters={hasActiveFilters || viewMode === "saved"} clearFilters={viewMode === "saved" ? () => set("view", "") : clearFilters} />
          ) : viewMode === "feed" ? (
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
                    cluster={claimClusters.get(claimKey(m)) ?? null}
                    isSaved={savedIds.has(m.id)}
                    onToggleSaved={toggleSaved}
                    onCopy={copyText}
                  />
                ))}
              </section>
            ))
          ) : (
            <section className="cat-group">
              <div className="cat-head">
                <h2>Saved posts</h2>
                <span className="ct">{savedMessages.length} saved</span>
              </div>
              {savedMessages.map((m) => (
                <MessageCard
                  key={m.id}
                  msg={m}
                  isNew={lastVisit !== null && new Date(m.postedAt) > lastVisit}
                  activeChannel={channelFilter}
                  onChannelClick={handleChannelClick}
                  cluster={claimClusters.get(claimKey(m)) ?? null}
                  isSaved={savedIds.has(m.id)}
                  onToggleSaved={toggleSaved}
                  onCopy={copyText}
                />
              ))}
            </section>
          )}
        </main>

        <aside className="aside-col">
          <div className="aside-block">
            <div className="aside-label">Top entities - today</div>
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
                Built for journalists, researchers and security analysts working from
                public sources. No Telegram API or private accounts are used.
              </p>
              <p>
                <Link href="/about">Methodology</Link>
                {" - "}
                <Link href="/channels">Channels</Link>
              </p>
              <p>
                <a href="https://github.com/Dimmu141/telegram-osint" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
                {" - "}
                <a href="/feed.xml" title="RSS feed">RSS</a>
              </p>
            </div>
          </div>
        </aside>
      </div>

      {filterOpen && (
        <div className="mob-overlay" onClick={() => setFilterOpen(false)} />
      )}
    </>
  );
}

function EmptyState({
  hasActiveFilters,
  clearFilters,
}: {
  hasActiveFilters: boolean;
  clearFilters: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <p style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", fontSize: "13px" }}>
        No messages match the current view.
      </p>
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          style={{
            marginTop: 12,
            padding: "8px 16px",
            border: "1px solid var(--rule)",
            background: "none",
            fontFamily: "var(--mono)",
            fontSize: "11px",
            color: "var(--ink-3)",
            cursor: "pointer",
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
