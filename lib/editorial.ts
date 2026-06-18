export interface Entities {
  people: string[];
  locations: string[];
  organizations: string[];
  weapons: string[];
}

export interface SourceContext {
  label: string;
  note: string;
  color: string;
  bg: string;
}

export const TOPIC_FILTERS = [
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

export const SOURCE_FILTERS = [
  { label: "All sources", key: "all", categories: null },
  { label: "Official / State-aligned", key: "official", categories: ["kremlin_official", "state_media"] },
  { label: "Milbloggers", key: "milbloggers", categories: ["milblogger_frontline", "milblogger_analytical", "milblogger", "pmc"] },
  { label: "Propagandists / Nationalists", key: "propagandists", categories: ["propagandist", "nationalist"] },
  { label: "Independent / Exile media", key: "independent", categories: ["exile_independent", "opposition", "ukrainian", "belarusian"] },
  { label: "Anonymous / Elite rumor channels", key: "rumor", categories: ["elite_analytical"] },
  { label: "Business / Economic", key: "business", categories: ["business"] },
  { label: "Tabloid / Incident wires", key: "tabloid", categories: ["tabloid"] },
] as const;

export const SIGNIFICANCE_FILTERS = [
  { label: "All", key: "all", min: 0 },
  { label: "Med+", key: "medium", min: 1 },
  { label: "High+", key: "high", min: 2 },
  { label: "Crit", key: "critical", min: 3 },
] as const;

export const SIG_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export const CATEGORY_LABELS: Record<string, string> = {
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

export const CATEGORY_ORDER = [
  "kremlin_official",
  "state_media",
  "propagandist",
  "nationalist",
  "milblogger_frontline",
  "milblogger_analytical",
  "milblogger",
  "pmc",
  "exile_independent",
  "opposition",
  "ukrainian",
  "belarusian",
  "elite_analytical",
  "business",
  "tabloid",
];

export function topicLabel(topic: string | null | undefined): string {
  if (!topic) return "unclassified";
  if (topic === "nordic_relevance") return "regional security";
  return topic.replace(/_/g, " ");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

export function parseEntities(raw: unknown): Entities {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { people: [], locations: [], organizations: [], weapons: [] };
  }
  const data = raw as Record<string, unknown>;
  return {
    people: stringArray(data.people),
    locations: stringArray(data.locations),
    organizations: stringArray(data.organizations),
    weapons: stringArray(data.weapons),
  };
}

export function entityTerms(raw: unknown): string[] {
  const entities = parseEntities(raw);
  return [
    ...entities.people,
    ...entities.locations,
    ...entities.organizations,
    ...entities.weapons,
  ];
}

export function sourceContextForCategory(category: string): SourceContext {
  if (category === "kremlin_official") {
    return {
      label: "official claim",
      note: "Official or government-aligned source. Useful for position, not proof.",
      color: "var(--signal)",
      bg: "var(--signal-faint)",
    };
  }
  if (category === "state_media") {
    return {
      label: "state-aligned claim",
      note: "State media or institutional Kremlin-aligned source. Treat as a narrative baseline, not confirmation.",
      color: "var(--signal)",
      bg: "var(--signal-faint)",
    };
  }
  if (category === "propagandist" || category === "nationalist") {
    return {
      label: "propaganda/rhetoric signal",
      note: "Ideological or personality-driven rhetoric source. Useful for tracking narratives, not verifying facts.",
      color: "var(--amber)",
      bg: "var(--amber-faint)",
    };
  }
  if (category === "milblogger_frontline" || category === "milblogger_analytical" || category === "milblogger" || category === "pmc") {
    return {
      label: "unverified frontline claim",
      note: "War-reporting source. Often fast and operationally useful, but claims need independent corroboration.",
      color: "var(--blue)",
      bg: "var(--blue-faint)",
    };
  }
  if (category === "exile_independent" || category === "opposition" || category === "ukrainian" || category === "belarusian") {
    return {
      label: "independent reporting - verify source",
      note: "Independent, opposition, Ukrainian, or Belarusian source. Still verify the original post and outside sources before publication.",
      color: "var(--moss)",
      bg: "var(--moss-faint)",
    };
  }
  if (category === "elite_analytical") {
    return {
      label: "rumor/narrative signal",
      note: "Anonymous insider or elite-analysis channel. Treat cautiously and do not publish without corroboration.",
      color: "var(--amber)",
      bg: "var(--amber-faint)",
    };
  }
  if (category === "business") {
    return {
      label: "business/economic source",
      note: "Business or economic coverage. Verify independently before using as fact.",
      color: "var(--moss)",
      bg: "var(--moss-faint)",
    };
  }
  return {
    label: "unverified claim",
    note: "Source context is limited. Treat as a discovery signal until independently verified.",
    color: "var(--ink-3)",
    bg: "var(--paper-3)",
  };
}

export function relevanceLabel(significance: string | null | undefined): string {
  if (significance === "critical") return "critical relevance";
  if (significance === "high") return "high relevance";
  if (significance === "medium") return "medium relevance";
  if (significance === "low") return "low relevance";
  return "unscored relevance";
}

export function flaggedBecause(significance: string | null | undefined, topic: string | null | undefined, category: string): string | null {
  if ((SIG_RANK[significance ?? "medium"] ?? 1) < 2) return null;
  const source = sourceContextForCategory(category).label;
  return `Flagged because: ${relevanceLabel(significance)} + ${topicLabel(topic)} + ${source}`;
}

export function textMatchesQuery(fields: Array<string | null | undefined>, rawEntities: unknown, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [...fields, ...entityTerms(rawEntities)]
    .filter((item): item is string => Boolean(item))
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}
