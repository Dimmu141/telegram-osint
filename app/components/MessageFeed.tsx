"use client";

import { useState, useMemo } from "react";

interface Channel {
  handle: string;
  nameEn: string | null;
  category: string;
}

export interface MessageRow {
  id: string;
  translationEn: string | null;
  topic: string | null;
  entities: unknown;
  summary: string | null;
  postedAt: string;
  channel: Channel;
}

const FILTERS = [
  { label: "All", topics: null },
  { label: "Military", topics: ["military_operations", "breaking_news"] },
  { label: "Political", topics: ["political_domestic", "political_foreign", "opinion_analysis"] },
  { label: "Economic", topics: ["economic"] },
  { label: "Propaganda", topics: ["propaganda"] },
] as const;

const TOPIC_STYLES: Record<string, string> = {
  military_operations: "bg-red-100 text-red-700",
  breaking_news: "bg-red-100 text-red-700",
  political_domestic: "bg-blue-100 text-blue-700",
  political_foreign: "bg-blue-100 text-blue-700",
  opinion_analysis: "bg-purple-100 text-purple-700",
  economic: "bg-green-100 text-green-700",
  propaganda: "bg-orange-100 text-orange-700",
  humanitarian: "bg-teal-100 text-teal-700",
  other: "bg-zinc-100 text-zinc-500",
};

const CATEGORY_LABELS: Record<string, string> = {
  kremlin_official: "Kremlin Official",
  state_media: "State Media",
  propagandist: "Propagandists",
  milblogger_frontline: "Frontline Reporters",
  milblogger_analytical: "Military Analysts",
  milblogger: "Military Bloggers", // legacy
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

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fi-FI", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function MessageCard({ msg }: { msg: MessageRow }) {
  const translation = msg.translationEn;
  const entities = parseEntities(msg.entities);
  const topicStyle = msg.topic ? (TOPIC_STYLES[msg.topic] ?? TOPIC_STYLES.other) : TOPIC_STYLES.other;
  const topicLabel = msg.topic?.replace(/_/g, " ") ?? "unclassified";
  const channelName = msg.channel.nameEn ?? `@${msg.channel.handle}`;

  const tags = [
    ...(entities.people ?? []),
    ...(entities.locations ?? []),
    ...(entities.organizations ?? []),
  ].slice(0, 5);

  return (
    <article className="border border-zinc-200 rounded-lg p-4 bg-white hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-sm font-semibold text-zinc-900 truncate">{channelName}</span>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${topicStyle}`}>
            {topicLabel}
          </span>
        </div>
        <time className="text-xs text-zinc-400 whitespace-nowrap shrink-0">
          {formatTimestamp(msg.postedAt)}
        </time>
      </div>

      {translation && (
        <p className="text-sm text-zinc-700 leading-relaxed mb-3">{translation}</p>
      )}

      {msg.summary && (
        <div className="bg-zinc-50 rounded-md p-3 mb-3">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Analysis</p>
          <p className="text-xs text-zinc-500 leading-relaxed">{msg.summary}</p>
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export default function MessageFeed({ messages }: { messages: MessageRow[] }) {
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = useMemo(() => {
    const filter = FILTERS.find((f) => f.label === activeFilter);
    if (!filter || filter.topics === null) return messages;
    return messages.filter((m) => m.topic && (filter.topics as readonly string[]).includes(m.topic));
  }, [messages, activeFilter]);

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

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setActiveFilter(f.label)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeFilter === f.label
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <p className="text-zinc-400 text-sm text-center py-20">
          No classified messages found for this filter.
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
                  <MessageCard key={m.id} msg={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
