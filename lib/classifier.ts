/**
 * Classification Pipeline
 * Primary: Groq (llama-3.3-70b-versatile) — ~14,400 RPD free tier
 * Fallback: Gemini 2.5 Flash-Lite — used if Groq fails
 */

import { PrismaClient } from "@prisma/client";

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",  // best quality
  "llama-3.1-8b-instant",     // separate TPD quota, fast
  "gemma2-9b-it",             // separate TPD quota
];
const GEMINI_MODEL = "gemini-2.5-flash-lite";
const BATCH_SIZE = 8;
const RATE_LIMIT_DELAY_MS = 35_000; // ~5,800 tokens/batch, 12K TPM limit → need ~29s refill
const MAX_MESSAGES_PER_RUN = 500;

const TOPICS = [
  "military_operations",
  "strikes_air_defense",
  "casualties_losses",
  "escalation_rhetoric",
  "nordic_relevance",
  "political_domestic",
  "political_foreign",
  "economic",
  "humanitarian",
  "propaganda",
  "breaking_news",
  "opinion_analysis",
  "other",
] as const;

type Topic = (typeof TOPICS)[number];

const SIGNIFICANCE_LEVELS = ["low", "medium", "high", "critical"] as const;
type Significance = (typeof SIGNIFICANCE_LEVELS)[number];

interface MessageInput {
  id: string;
  text: string;
  channelHandle: string;
  channelCategory: string;
  channelStance: string;
}

interface ClassifiedMessage {
  id: string;
  translation_en: string;
  topic: Topic;
  significance: Significance;
  entities: {
    people: string[];
    locations: string[];
    organizations: string[];
    weapons: string[];
  };
  summary: string;
}

export interface ClassifyRunResult {
  processed: number;
  failed: number;
  durationMs: number;
}

const SYSTEM_PROMPT = `You are an OSINT analyst providing intelligence support to Nordic security analysts monitoring Russian-language Telegram channels.

For each message you receive, provide:
1. An accurate English translation preserving tone, military terminology, and propaganda framing
2. Topic classification from the provided list
3. A significance rating (low | medium | high | critical) — see scale below
4. Named entity extraction
5. A 2-3 sentence analytical summary in English that notes: what is claimed, how it is framed, and what a Nordic analyst should note. AVOID formulaic openers like "Nordic analysts should note..." — write each summary naturally.

SIGNIFICANCE SCALE:
- low: routine state-media noise, ceremonial content, propaganda boilerplate, daily ribbon-cutting
- medium: standard frontline updates, ordinary political commentary, typical economic news
- high: confirmed casualties, equipment losses, named operations, escalation rhetoric, sanctions impact, Nordic/NATO-relevant moves, high-profile elite statements
- critical: nuclear threats, strategic strikes, major escalations, infrastructure attacks, direct Nordic/Finnish references, leadership change signals, war-ending or war-expanding events

TOPIC GUIDANCE:
- strikes_air_defense: missile/drone strikes (Shahed, Geran, Iskander, Kalibr, Kh-101, Kinzhal), air defense activations, downed UAVs, attacks on infrastructure (energy grid, ports, airfields). PREFER this over military_operations when the message is specifically about strike packages or air-defense engagement — these are the most Nordic-relevant since the same systems threaten Baltic airspace.
- casualties_losses: confirmed or claimed deaths, equipment destroyed, POW exchanges
- escalation_rhetoric: nuclear threats, threats against NATO/Nordic states, calls for expansion of war
- nordic_relevance: any direct mention of Finland, Sweden, Norway, Denmark, Baltic states, Arctic, Nordic NATO posture
- propaganda: pure ideological/agitprop content with no news substance
- military_operations: factual front-line developments NOT covered by strikes_air_defense (troop movements, ground assaults, tactical maneuvers)

Be precise with military terminology. Do not soften propaganda language — translate it accurately so analysts can see how it is framed.

Respond ONLY with valid JSON. No markdown, no preamble, no explanation outside the JSON.`;

function buildUserPrompt(messages: MessageInput[]): string {
  const topics = TOPICS.join(", ");
  const input = messages.map((m) => ({
    id: m.id,
    text: m.text,
    channel: m.channelHandle,
    channel_category: m.channelCategory,
    channel_stance: m.channelStance,
  }));

  return `Classify these ${messages.length} messages.

Topic options: ${topics}

Return a JSON object with a "results" array where each element has:
- id (string, unchanged from input)
- translation_en (string)
- topic (string, one of the topic options)
- significance (string, one of: low, medium, high, critical)
- entities (object with arrays: people, locations, organizations, weapons)
- summary (string, 2-3 sentences analytical summary in English)

Input:
${JSON.stringify(input, null, 2)}`;
}

function parseGroqRetryMs(errorBody: string): number {
  // Parse "16m31.872s" or "30.425s" formats
  const minMatch = errorBody.match(/(\d+)m(\d+(?:\.\d+)?)s/);
  if (minMatch) return (parseInt(minMatch[1]) * 60 + parseFloat(minMatch[2])) * 1000 + 2_000;
  const secMatch = errorBody.match(/try again in (\d+(?:\.\d+)?)s/);
  return secMatch ? Math.ceil(parseFloat(secMatch[1])) * 1000 + 2_000 : 35_000;
}

function isTPDError(errorBody: string): boolean {
  return errorBody.includes("tokens per day") || errorBody.includes("TPD");
}

async function callGroqModel(
  model: string,
  messages: MessageInput[],
  attempt = 0
): Promise<ClassifiedMessage[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set in environment");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(messages) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) {
      if (isTPDError(text)) {
        // Daily quota exhausted for this model — caller should try next model
        throw Object.assign(new Error(`Groq TPD exceeded for ${model}`), { isTPD: true });
      }
      if (attempt < 2) {
        const waitMs = parseGroqRetryMs(text);
        console.log(`[classify] Groq (${model}) TPM limited, waiting ${(waitMs / 1000).toFixed(1)}s...`);
        await new Promise((r) => setTimeout(r, waitMs));
        return callGroqModel(model, messages, attempt + 1);
      }
    }
    throw new Error(`Groq API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error(`Groq (${model}) returned empty response`);

  const parsed = JSON.parse(rawText);
  const results = parsed?.results;
  if (!Array.isArray(results)) throw new Error(`Groq (${model}) response missing results array`);

  return results as ClassifiedMessage[];
}

async function callGroq(messages: MessageInput[]): Promise<{ results: ClassifiedMessage[]; model: string }> {
  for (const model of GROQ_MODELS) {
    try {
      const results = await callGroqModel(model, messages);
      return { results, model };
    } catch (err) {
      if ((err as { isTPD?: boolean }).isTPD) {
        console.log(`[classify] Groq model ${model} daily quota exhausted, trying next model...`);
        continue;
      }
      throw err;
    }
  }
  throw new Error("All Groq models exhausted their daily token quota");
}

async function callGemini(
  messages: MessageInput[]
): Promise<ClassifiedMessage[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in environment");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(messages) }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Gemini returned empty response");

  const parsed = JSON.parse(rawText);
  const results = parsed?.results ?? parsed;
  if (!Array.isArray(results)) throw new Error("Gemini response was not an array");

  return results as ClassifiedMessage[];
}

async function callLLM(
  messages: MessageInput[]
): Promise<{ results: ClassifiedMessage[]; model: string }> {
  try {
    return await callGroq(messages);
  } catch (groqErr) {
    const groqMsg = groqErr instanceof Error ? groqErr.message : String(groqErr);
    console.warn(`[classify] All Groq models failed, trying Gemini fallback: ${groqMsg}`);
    const results = await callGemini(messages);
    return { results, model: GEMINI_MODEL };
  }
}

async function writeResults(
  prisma: PrismaClient,
  results: ClassifiedMessage[],
  validIds: Set<string>,
  modelName: string
): Promise<void> {
  const validResults = results.filter((r) => validIds.has(r.id));
  for (const r of validResults) {
    try {
      await prisma.message.update({
        where: { id: r.id },
        data: {
          translationEn: r.translation_en,
          topic: r.topic,
          significance: (SIGNIFICANCE_LEVELS as readonly string[]).includes(r.significance) ? r.significance : "medium",
          entities: r.entities,
          summary: r.summary,
          llmProcessedAt: new Date(),
          llmModel: modelName,
        },
      });
    } catch {
      // skip individual failures silently
    }
  }
}

export async function runClassification(options?: {
  prisma?: PrismaClient;
  maxMessages?: number;
}): Promise<ClassifyRunResult> {
  const prisma = options?.prisma ?? new PrismaClient();
  const maxMessages = options?.maxMessages ?? MAX_MESSAGES_PER_RUN;
  const startedAt = Date.now();

  const messages = await prisma.message.findMany({
    where: {
      llmProcessedAt: null,
      text: { not: "" },
    },
    orderBy: { postedAt: "desc" },
    take: maxMessages,
    include: {
      channel: {
        select: {
          handle: true,
          category: true,
          stance: true,
        },
      },
    },
  });

  if (messages.length === 0) {
    console.log("[classify] No unprocessed messages found.");
    await prisma.$disconnect();
    return { processed: 0, failed: 0, durationMs: Date.now() - startedAt };
  }

  console.log(`[classify] Found ${messages.length} unprocessed messages`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(messages.length / BATCH_SIZE);

    console.log(`[classify] Batch ${batchNum}/${totalBatches} (${batch.length} messages)`);

    const inputs: MessageInput[] = batch.map((m) => ({
      id: m.id,
      text: m.text.slice(0, 2000),
      channelHandle: m.channel.handle,
      channelCategory: m.channel.category,
      channelStance: m.channel.stance,
    }));

    try {
      const { results, model } = await callLLM(inputs);
      const validIds = new Set(inputs.map((m) => m.id));
      await writeResults(prisma, results, validIds, model);
      processed += results.length;
      console.log(`[classify] ✓ Batch ${batchNum} done (${results.length} classified via ${model})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[classify] ✗ Batch ${batchNum} failed: ${message}`);
      failed += batch.length;
    }

    if (i + BATCH_SIZE < messages.length) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
    }
  }

  if (!options?.prisma) await prisma.$disconnect();

  return {
    processed,
    failed,
    durationMs: Date.now() - startedAt,
  };
}
