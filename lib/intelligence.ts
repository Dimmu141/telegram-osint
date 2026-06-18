export const NORDIC_TERMS = [
  "finland",
  "finnish",
  "helsinki",
  "sweden",
  "swedish",
  "stockholm",
  "norway",
  "norwegian",
  "denmark",
  "danish",
  "iceland",
  "nordic",
  "baltic",
  "estonia",
  "estonian",
  "latvia",
  "latvian",
  "lithuania",
  "lithuanian",
  "nato",
  "kaliningrad",
  "arctic",
  "barents",
  "baltic sea",
  "suwałki",
  "suwalki",
];

export const NARRATIVES = [
  {
    key: "nato-escalation",
    label: "NATO escalation",
    description: "Claims that NATO, Europe, or Nordic states are expanding the war or forcing confrontation.",
    terms: ["nato", "escalation", "europe", "finland", "sweden", "baltic", "article 5", "alliance"],
  },
  {
    key: "nuclear-threats",
    label: "Nuclear threats",
    description: "Nuclear coercion, strategic weapons signaling, or threats of irreversible escalation.",
    terms: ["nuclear", "tactical nuclear", "strategic", "doomsday", "sarmat", "oreshnik", "red line"],
  },
  {
    key: "western-fatigue",
    label: "Western fatigue",
    description: "Claims that Ukraine's backers are exhausted, divided, bankrupt, or ready to abandon Kyiv.",
    terms: ["fatigue", "tired", "exhausted", "aid", "funding", "bankrupt", "collapse", "negotiations"],
  },
  {
    key: "ukraine-corruption",
    label: "Ukraine corruption",
    description: "Narratives portraying Ukraine as corrupt, illegitimate, or unable to govern itself.",
    terms: ["corruption", "zelensky", "regime", "mobilization", "desertion", "illegal", "maidan"],
  },
  {
    key: "strike-air-defense",
    label: "Strikes and air defense",
    description: "Drone, missile, refinery, airfield, and air-defense claims across Russia and Ukraine.",
    terms: ["drone", "uav", "missile", "air defense", "shahed", "geran", "refinery", "airfield", "explosion"],
  },
  {
    key: "domestic-war-cost",
    label: "Domestic war cost",
    description: "Russian mobilization, casualties, veteran crime, economic strain, and internal pressure.",
    terms: ["mobilization", "contract", "casualties", "veteran", "inflation", "budget", "payments", "conscription"],
  },
] as const;

export function normalizedText(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function matchesAnyTerm(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term.toLowerCase()));
}
