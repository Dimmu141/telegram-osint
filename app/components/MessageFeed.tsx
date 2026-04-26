"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Channel {
  handle: string;
  nameEn: string | null;
  category: string;
}

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
  channel: Channel;
}

interface HealthStats {
  lastScrapedAt: string | null;
  lastClassifiedAt: string | null;
  queueDepth: number;
  classifiedToday: number;
}

interface EntityCount {
  name: string;
  count: number;
}

interface HourlyCount {
  hour: number;
  count: number;
}

interface BriefingData {
  bullets: string[];
  generatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPIC_FILTERS = [
  { label: "All", topics: null },
  { label: "Military", topics: ["military_operations", "strikes_air_defense", "breaking_news"] },
  { label: "Strikes / Air Def", topics: ["strikes_air_defense"] },
  { label: "Casualties", topics: ["casualties_losses"] },
  { label: "Escalation", topics: ["escalation_rhetoric"] },
  { label: "Nordic", topics: ["nordic_relevance"] },
  { label: "Political", topics: ["political_domestic", "political_foreign", "opinion_analysis"] },
  { label: "Economic", topics: ["economic"] },
  { label: "Propaganda", topics: ["propaganda"] },
] as const;

const CATEGORY_FILTERS = [
  { label: "All sources", categories: null },
  { label: "Frontline", categories: ["milblogger_frontline"] },
  { label: "Analytical", categories: ["milblogger_analytical"] },
  { label: "Propagandists", categories: ["propagandist"] },
  { label: "Kremlin", categories: ["kremlin_official"] },
  { label: "State media", categories: ["state_media"] },
  { label: "Independent", categories: ["exile_independent", "opposition", "elite_analytical"] },
  { label: "Belarus", categories: ["belarusian"] },
] as const;

const SIGNIFICANCE_FILTERS = [
  { label: "All", min: 0 },
  { label: "Medium+", min: 1 },
  { label: "High+", min: 2 },
  { label: "Critical only", min: 3 },
] as const;

const SIGNIFICANCE_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const TOPIC_STYLES: Record<string, string> = {
  military_operations: "bg-red-100 text-red-700",
  strikes_air_defense: "bg-red-200 text-red-900",
  casualties_losses: "bg-rose-200 text-rose-800",
  escalation_rhetoric: "bg-amber-100 text-amber-800",
  nordic_relevance: "bg-sky-100 text-sky-800",
  breaking_news: "bg-red-100 text-red-700",
  political_domestic: "bg-blue-100 text-blue-700",
  political_foreign: "bg-blue-100 text-blue-700",
  opinion_analysis: "bg-purple-100 text-purple-700",
  economic: "bg-green-100 text-green-700",
  propaganda: "bg-orange-100 text-orange-700",
  humanitarian: "bg-teal-100 text-teal-700",
  other: "bg-zinc-100 text-zinc-500",
};

const SIGNIFICANCE_STYLES: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-zinc-200 text-zinc-700",
  low: "bg-zinc-100 text-zinc-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  kremlin_official: "Kremlin Official",
  state_media: "State Media",
  propagandist: "Propagandists",
  milblogger_frontline: "Frontline Reporters",
  milblogger_analytical: "Military Analysts",
  milblogger: "Military Bloggers",
  pmc: "PMC",
  nationalist: "Nationalist",
  tabloid: "Tabloid",
  exile_independent: "Exile / Independent",
  opposition: "Opposition",
  elite_analytical: "Elite Analytical",
  business: "Business",
  ukrainian: "Ukrainian",
  belarusian: "Belarusian",
};

const CATEGORY_ORDER = [
  "kremlin_official", "state_media", "propagandist",
  "milblogger_frontline", "milblogger_analytical", "milblogger",
  "pmc", "nationalist", "tabloid",
  "exile_independent", "opposition", "elite_analytical",
  "business", "ukrainian", "belarusian",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fi-FI", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function BriefingPanel({ briefing }: { briefing: BriefingData }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-6 border border-blue-200 rounded-lg bg-blue-50 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
            Daily Briefing
          </span>
          <span className="text-xs text-blue-400">
            {formatRelative(briefing.generatedAt)}
          </span>
        </div>
        <span className="text-blue-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="px-4 pb-4 space-y-2">
          {briefing.bullets.map((bullet, i) => (
            <li key={i} className="flex gap-2 text-sm text-blue-900">
              <span className="text-blue-400 shrink-0 mt-0.5">›</span>
              <span className="leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivitySparkline({ data }: { data: HourlyCount[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const currentHour = new Date().getUTCHours();
  return (
    <div className="flex items-end gap-px h-8 w-full" title="Messages per UTC hour (last 24h)">
      {data.map(({ hour, count }) => {
        const pct = Math.max((count / max) * 100, count > 0 ? 8 : 0);
        const isCurrent = hour === currentHour;
        return (
          <div
            key={hour}
            title={`${String(hour).padStart(2, "0")}:00 UTC — ${count} msgs`}
            style={{ height: `${pct}%` }}
            className={`flex-1 rounded-sm transition-colors ${
              isCurrent ? "bg-blue-400" : "bg-zinc-300 hover:bg-zinc-400"
            }`}
          />
        );
      })}
    </div>
  );
}

function EntityHeader({
  entities,
  activeEntity,
  onEntityClick,
}: {
  entities: EntityCount[];
  activeEntity: string;
  onEntityClick: (name: string) => void;
}) {
  if (entities.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-2">Top entities today</p>
      <div className="flex flex-wrap gap-1.5">
        {entities.map(({ name, count }) => (
          <button
            key={name}
            onClick={() => onEntityClick(name)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              activeEntity === name
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            {name}
            <span className="ml-1 text-zinc-400 text-[10px]">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HealthFooter({ stats }: { stats: HealthStats }) {
  return (
    <footer className="mt-16 pt-4 border-t border-zinc-100 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-400">
      <span>
        🕐 Scraped{" "}
        {stats.lastScrapedAt ? formatRelative(stats.lastScrapedAt) : "unknown"}
      </span>
      <span>
        🤖 Classified{" "}
        {stats.lastClassifiedAt ? formatRelative(stats.lastClassifiedAt) : "unknown"}
      </span>
      <span>📥 Queue: {stats.queueDepth} unprocessed</span>
      <span>✓ {stats.classifiedToday} classified today</span>
    </footer>
  );
}

function FilterRow({
  label,
  options,
  active,
  onChange,
}: {
  label: string;
  options: readonly string[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-widest text-zinc-400 w-16 shrink-0 pt-1">
        {label}
      </span>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              active === opt
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageCard({
  msg,
  isNew,
  onChannelClick,
  activeChannel,
}: {
  msg: MessageRow;
  isNew: boolean;
  onChannelClick: (handle: string) => void;
  activeChannel: string;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const translation = msg.translationEn;
  const entities = parseEntities(msg.entities);
  const topicStyle = msg.topic
    ? (TOPIC_STYLES[msg.topic] ?? TOPIC_STYLES.other)
    : TOPIC_STYLES.other;
  const topicLabel = msg.topic?.replace(/_/g, " ") ?? "unclassified";
  const channelName = msg.channel.nameEn ?? `@${msg.channel.handle}`;
  const sig = msg.significance ?? "medium";
  const sigStyle = SIGNIFICANCE_STYLES[sig] ?? SIGNIFICANCE_STYLES.medium;
  const isHigh = sig === "high" || sig === "critical";
  const isActive = activeChannel === msg.channel.handle;

  // Build t.me source link
  const postId = msg.telegramPostId.split("/").pop();
  const sourceLink = `https://t.me/${msg.channel.handle}/${postId}`;

  const cardClass = [
    "rounded-lg p-4 bg-white transition-colors",
    isHigh ? "border-2 border-orange-300 shadow-sm" : "border border-zinc-200 hover:border-zinc-300",
    sig === "low" ? "opacity-75 hover:opacity-100 transition-opacity" : "",
    isNew ? "ring-1 ring-blue-200" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const tags = [
    ...(entities.people ?? []),
    ...(entities.locations ?? []),
    ...(entities.organizations ?? []),
  ].slice(0, 5);

  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <button
            onClick={() => onChannelClick(msg.channel.handle)}
            className={`text-sm font-semibold truncate hover:underline underline-offset-2 ${
              isActive ? "text-blue-600" : "text-zinc-900"
            }`}
          >
            {channelName}
          </button>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${topicStyle}`}>
            {topicLabel}
          </span>
          {sig !== "medium" && (
            <span
              className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${sigStyle}`}
            >
              {sig}
            </span>
          )}
          {isNew && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-bold uppercase tracking-wide">
              new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <time className="text-xs text-zinc-400 whitespace-nowrap">
            {formatTimestamp(msg.postedAt)}
          </time>
          <a
            href={sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-300 hover:text-zinc-500 transition-colors"
            title="View original in Telegram"
          >
            ↗
          </a>
        </div>
      </div>

      {translation && (
        <p
          className={`text-sm leading-relaxed mb-2 ${
            isHigh ? "text-zinc-900 font-medium" : "text-zinc-700"
          }`}
        >
          {translation}
        </p>
      )}

      {msg.text && (
        <div className="mb-2">
          <button
            onClick={() => setShowOriginal((s) => !s)}
            className="text-[10px] uppercase tracking-wide text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            {showOriginal ? "▲ hide original" : "▼ show original Russian"}
          </button>
          {showOriginal && (
            <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed bg-zinc-50 rounded p-2 font-mono whitespace-pre-wrap">
              {msg.text}
            </p>
          )}
        </div>
      )}

      {msg.summary && (
        <div className="bg-zinc-50 rounded-md p-3 mb-2">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
            Analysis
          </p>
          <p className="text-xs text-zinc-500 leading-relaxed">{msg.summary}</p>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MessageFeed({
  messages,
  briefing,
  healthStats,
  topEntities,
  hourlyData,
}: {
  messages: MessageRow[];
  briefing: BriefingData | null;
  healthStats: HealthStats;
  topEntities: EntityCount[];
  hourlyData: HourlyCount[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Filter state from URL
  const topicFilter = searchParams.get("topic") ?? "All";
  const categoryFilter = searchParams.get("source") ?? "All sources";
  const sigFilter = searchParams.get("sig") ?? "Medium+";
  const search = searchParams.get("q") ?? "";
  const channelFilter = searchParams.get("channel") ?? "";

  // "New since last visit" via localStorage
  const [lastVisit, setLastVisit] = useState<Date | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem("osint_last_visit");
    if (stored) setLastVisit(new Date(stored));
    localStorage.setItem("osint_last_visit", new Date().toISOString());
  }, []);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const handleChannelClick = useCallback(
    (handle: string) => {
      updateParam("channel", channelFilter === handle ? "" : handle);
    },
    [channelFilter, updateParam]
  );

  const handleEntityClick = useCallback(
    (name: string) => {
      updateParam("q", search === name ? "" : name);
    },
    [search, updateParam]
  );

  const filtered = useMemo(() => {
    const tf = TOPIC_FILTERS.find((f) => f.label === topicFilter);
    const cf = CATEGORY_FILTERS.find((f) => f.label === categoryFilter);
    const sf = SIGNIFICANCE_FILTERS.find((f) => f.label === sigFilter);
    const sigMin = sf?.min ?? 1;
    const searchLower = search.toLowerCase();

    return messages.filter((m) => {
      if (tf?.topics && (!m.topic || !(tf.topics as readonly string[]).includes(m.topic)))
        return false;
      if (cf?.categories && !(cf.categories as readonly string[]).includes(m.channel.category))
        return false;
      if (channelFilter && m.channel.handle !== channelFilter) return false;
      if (sigMin > 0) {
        const rank = SIGNIFICANCE_RANK[m.significance ?? "medium"] ?? 1;
        if (rank < sigMin) return false;
      }
      if (searchLower) {
        const haystack = [
          m.translationEn ?? "",
          m.summary ?? "",
          m.channel.nameEn ?? "",
          m.channel.handle,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      return true;
    });
  }, [messages, topicFilter, categoryFilter, sigFilter, channelFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, MessageRow[]>();
    for (const m of filtered) {
      const cat = m.channel.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(m);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [filtered]);

  const hasActiveFilters =
    topicFilter !== "All" ||
    categoryFilter !== "All sources" ||
    sigFilter !== "Medium+" ||
    search !== "" ||
    channelFilter !== "";

  const clearAll = () => {
    router.replace(pathname, { scroll: false });
  };

  return (
    <div>
      {/* Daily briefing */}
      {briefing && <BriefingPanel briefing={briefing} />}

      {/* Sparkline + stats row */}
      <div className="mb-6 grid grid-cols-[1fr_auto] gap-4 items-end">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">
            Message volume · last 24h UTC
          </p>
          <ActivitySparkline data={hourlyData} />
        </div>
        <p className="text-xs text-zinc-400 whitespace-nowrap pb-0.5">
          {messages.length} msgs
        </p>
      </div>

      {/* Top entities */}
      <EntityHeader
        entities={topEntities}
        activeEntity={search}
        onEntityClick={handleEntityClick}
      />

      {/* Filters */}
      <div className="space-y-2 mb-4">
        <FilterRow
          label="Topic"
          options={TOPIC_FILTERS.map((f) => f.label)}
          active={topicFilter}
          onChange={(v) => updateParam("topic", v)}
        />
        <FilterRow
          label="Source"
          options={CATEGORY_FILTERS.map((f) => f.label)}
          active={categoryFilter}
          onChange={(v) => updateParam("source", v)}
        />
        <FilterRow
          label="Signal"
          options={SIGNIFICANCE_FILTERS.map((f) => f.label)}
          active={sigFilter}
          onChange={(v) => updateParam("sig", v)}
        />
      </div>

      {/* Search + active channel chip */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="text"
            value={search}
            onChange={(e) => updateParam("q", e.target.value)}
            placeholder="Search translations, summaries…"
            className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-1.5 pr-8 outline-none focus:border-zinc-400 bg-white"
          />
          {search && (
            <button
              onClick={() => updateParam("q", "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              ×
            </button>
          )}
        </div>
        {channelFilter && (
          <div className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2.5 py-1.5 rounded-lg">
            <span>Channel: {channelFilter}</span>
            <button
              onClick={() => updateParam("channel", "")}
              className="ml-1 hover:text-blue-900"
            >
              ×
            </button>
          </div>
        )}
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
          >
            clear all
          </button>
        )}
      </div>

      <p className="text-xs text-zinc-400 mb-4">{filtered.length} messages match</p>

      {/* Feed */}
      {grouped.length === 0 ? (
        <p className="text-zinc-400 text-sm text-center py-20">
          No messages match the current filters.
        </p>
      ) : (
        <div className="space-y-10">
          {grouped.map(([category, msgs]) => (
            <section key={category}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3 pb-2 border-b border-zinc-100">
                {CATEGORY_LABELS[category] ?? category}{" "}
                <span className="font-normal">({msgs.length})</span>
              </h2>
              <div className="space-y-3">
                {msgs.map((m) => (
                  <MessageCard
                    key={m.id}
                    msg={m}
                    isNew={lastVisit !== null && new Date(m.postedAt) > lastVisit}
                    onChannelClick={handleChannelClick}
                    activeChannel={channelFilter}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <HealthFooter stats={healthStats} />
    </div>
  );
}
