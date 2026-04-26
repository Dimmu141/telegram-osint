/**
 * Daily briefing generator
 * Reads today's high+critical messages, calls Groq, stores bullet-point digest.
 * Run: npx tsx scripts/briefing.ts
 * Cron: daily at 07:00 UTC
 */
import { PrismaClient } from "@prisma/client";

const GROQ_MODEL = "llama-3.3-70b-versatile";

interface MessageInput {
  channel: string;
  category: string;
  topic: string | null;
  significance: string | null;
  translation: string;
  summary: string | null;
  postedAt: string;
}

const SYSTEM_PROMPT = `You are an intelligence analyst producing a daily briefing for Nordic security professionals monitoring Russian Telegram channels.

Your output: 6–9 concise bullet points covering the most significant developments of the past 24 hours.

Rules:
- Lead with the single most important development
- Each bullet is 1–2 sentences max — dense, factual, analyst-grade
- Cover: frontline developments, strikes/air-defense activity, escalation signals, significant losses, political/military signals
- Note source diversity: if multiple independent milbloggers corroborate a claim vs. only state media, say so
- Flag Nordic/Baltic relevance explicitly when present
- Do NOT start bullets with "Nordic analysts should note" — vary the framing
- Be direct. No hedging fluff. Write like Janes, not CNN.

Respond ONLY with a JSON object: { "bullets": ["...", "...", ...] }`;

async function callGroq(messages: MessageInput[]): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const input = messages
    .map(
      (m, i) =>
        `[${i + 1}] ${m.channel} (${m.category}) — ${m.topic ?? "unclassified"} [${m.significance ?? "medium"}]\n` +
        `${m.translation}\n` +
        (m.summary ? `Analysis: ${m.summary}` : "")
    )
    .join("\n\n---\n\n");

  const userPrompt = `Here are today's ${messages.length} most significant messages from Russian Telegram channels, ordered newest-first. Produce a briefing.\n\n${input}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Groq returned empty response");

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed?.bullets)) throw new Error("Response missing bullets array");
  return parsed.bullets as string[];
}

async function main() {
  const prisma = new PrismaClient();
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  console.log(`[briefing] Generating briefing for ${today}`);

  const messages = await prisma.message.findMany({
    where: {
      postedAt: { gte: since },
      llmProcessedAt: { not: null },
      significance: { in: ["high", "critical"] },
      translationEn: { not: null },
      channel: { isActive: true },
    },
    orderBy: { postedAt: "desc" },
    take: 60,
    select: {
      translationEn: true,
      topic: true,
      significance: true,
      summary: true,
      postedAt: true,
      channel: { select: { nameEn: true, handle: true, category: true } },
    },
  });

  if (messages.length === 0) {
    // Fallback: take top medium messages if no high/critical available
    const fallback = await prisma.message.findMany({
      where: {
        postedAt: { gte: since },
        llmProcessedAt: { not: null },
        translationEn: { not: null },
        channel: { isActive: true },
      },
      orderBy: { postedAt: "desc" },
      take: 40,
      select: {
        translationEn: true,
        topic: true,
        significance: true,
        summary: true,
        postedAt: true,
        channel: { select: { nameEn: true, handle: true, category: true } },
      },
    });

    if (fallback.length === 0) {
      console.log("[briefing] No messages found, skipping.");
      await prisma.$disconnect();
      return;
    }

    messages.push(...fallback);
  }

  console.log(`[briefing] Processing ${messages.length} messages`);

  const inputs: MessageInput[] = messages.map((m) => ({
    channel: m.channel.nameEn ?? m.channel.handle,
    category: m.channel.category,
    topic: m.topic,
    significance: m.significance,
    translation: (m.translationEn ?? "").slice(0, 600),
    summary: m.summary?.slice(0, 200) ?? null,
    postedAt: m.postedAt.toISOString(),
  }));

  const bullets = await callGroq(inputs);
  console.log(`[briefing] Generated ${bullets.length} bullets`);

  await prisma.briefing.upsert({
    where: { date: today },
    create: { date: today, bullets, messageCount: messages.length },
    update: { bullets, messageCount: messages.length, generatedAt: new Date() },
  });

  console.log(`[briefing] ✓ Briefing saved for ${today}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
