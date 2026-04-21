import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { PrismaClient } from "@prisma/client";

export interface ChannelConfig {
  handle: string;
  name_ru?: string;
  name_en?: string;
  url: string;
  category: string;
  language: string;
  stance: string;
  priority: string;
  source_type: string;
  notes?: string;
  in_original_list: boolean;
  verify?: boolean;
}

export interface ParsedMessage {
  telegramPostId: string;
  text: string;
  views?: string;
  hasMedia: boolean;
  postedAt: Date;
}

export interface ChannelScrapeResult {
  handle: string;
  newMessages: number;
  totalParsed: number;
  durationMs: number;
  error?: string;
}

export interface ScrapeRunResult {
  runId: string;
  channelsAttempted: number;
  channelsSucceeded: number;
  channelsFailed: number;
  newMessages: number;
  durationMs: number;
  perChannel: ChannelScrapeResult[];
}

export function loadChannelsFromYaml(yamlPath?: string): ChannelConfig[] {
  const resolvedPath =
    yamlPath ?? path.join(process.cwd(), "config", "channels.yaml");
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`channels.yaml not found at ${resolvedPath}`);
  }
  const raw = fs.readFileSync(resolvedPath, "utf-8");
  const parsed = yaml.load(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("channels.yaml must be a YAML list at the top level");
  }
  return parsed as ChannelConfig[];
}

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 15_000;

async function fetchChannelHtml(handle: string): Promise<string> {
  const url = `https://t.me/s/${handle}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ru,en;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function parseMessages(html: string): ParsedMessage[] {
  const $ = cheerio.load(html);
  const messages: ParsedMessage[] = [];

  $(".tgme_widget_message").each((_, el) => {
    const $el = $(el);
    const telegramPostId = $el.attr("data-post");
    if (!telegramPostId) return;

    const timeEl = $el.find("time[datetime]").first();
    const datetime = timeEl.attr("datetime");
    if (!datetime) return;

    const postedAt = new Date(datetime);
    if (isNaN(postedAt.getTime())) return;

    const $text = $el.find(".tgme_widget_message_text").first();
    let text = "";
    if ($text.length > 0) {
      $text.find("br").replaceWith("\n");
      text = $text.text().trim();
    }

    const hasMedia =
      $el.find(".tgme_widget_message_photo_wrap").length > 0 ||
      $el.find(".tgme_widget_message_video_player").length > 0 ||
      $el.find(".tgme_widget_message_document").length > 0 ||
      $el.find(".tgme_widget_message_voice").length > 0;

    if (!text && !hasMedia) return;

    const viewsEl = $el.find(".tgme_widget_message_views").first();
    const views = viewsEl.text().trim() || undefined;

    messages.push({
      telegramPostId,
      text,
      views,
      hasMedia,
      postedAt,
    });
  });

  return messages;
}

async function upsertChannel(
  prisma: PrismaClient,
  config: ChannelConfig
): Promise<string> {
  const channel = await prisma.channel.upsert({
    where: { handle: config.handle },
    create: {
      handle: config.handle,
      nameRu: config.name_ru,
      nameEn: config.name_en,
      category: config.category,
      language: config.language,
      stance: config.stance,
      priority: config.priority,
      sourceType: config.source_type,
      notes: config.notes,
      inOriginalList: config.in_original_list,
    },
    update: {
      nameRu: config.name_ru,
      nameEn: config.name_en,
      category: config.category,
      language: config.language,
      stance: config.stance,
      priority: config.priority,
      sourceType: config.source_type,
      notes: config.notes,
      inOriginalList: config.in_original_list,
    },
  });
  return channel.id;
}

async function insertNewMessages(
  prisma: PrismaClient,
  channelId: string,
  messages: ParsedMessage[]
): Promise<number> {
  if (messages.length === 0) return 0;
  const result = await prisma.message.createMany({
    data: messages.map((m) => ({
      channelId,
      telegramPostId: m.telegramPostId,
      text: m.text,
      views: m.views,
      hasMedia: m.hasMedia,
      postedAt: m.postedAt,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function scrapeChannel(
  prisma: PrismaClient,
  config: ChannelConfig
): Promise<ChannelScrapeResult> {
  const start = Date.now();
  try {
    const channelId = await upsertChannel(prisma, config);
    const html = await fetchChannelHtml(config.handle);
    const parsed = parseMessages(html);
    const newMessages = await insertNewMessages(prisma, channelId, parsed);

    await prisma.channel.update({
      where: { id: channelId },
      data: {
        lastScrapedAt: new Date(),
        consecutiveErrors: 0,
        lastError: null,
      },
    });

    return {
      handle: config.handle,
      newMessages,
      totalParsed: parsed.length,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await prisma.channel.update({
        where: { handle: config.handle },
        data: {
          consecutiveErrors: { increment: 1 },
          lastError: message.slice(0, 500),
        },
      });
    } catch {
      // Channel may not exist yet if upsert failed
    }
    return {
      handle: config.handle,
      newMessages: 0,
      totalParsed: 0,
      durationMs: Date.now() - start,
      error: message,
    };
  }
}

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1_000;

export async function runScrape(options?: {
  prisma?: PrismaClient;
  channels?: ChannelConfig[];
  triggeredBy?: string;
}): Promise<ScrapeRunResult> {
  const prisma = options?.prisma ?? new PrismaClient();
  const channels = options?.channels ?? loadChannelsFromYaml();
  const triggeredBy = options?.triggeredBy ?? "manual";
  const startedAt = new Date();

  const run = await prisma.scrapeRun.create({
    data: {
      startedAt,
      channelsAttempted: channels.length,
      triggeredBy,
    },
  });

  const perChannel: ChannelScrapeResult[] = [];

  for (let i = 0; i < channels.length; i += BATCH_SIZE) {
    const batch = channels.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((c) => scrapeChannel(prisma, c))
    );
    perChannel.push(...batchResults);
    if (i + BATCH_SIZE < channels.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  const succeeded = perChannel.filter((r) => !r.error).length;
  const failed = perChannel.filter((r) => r.error).length;
  const newMessages = perChannel.reduce((sum, r) => sum + r.newMessages, 0);
  const errorSummary = perChannel
    .filter((r) => r.error)
    .map((r) => `${r.handle}: ${r.error}`)
    .join("\n");

  const finishedAt = new Date();

  await prisma.scrapeRun.update({
    where: { id: run.id },
    data: {
      finishedAt,
      channelsSucceeded: succeeded,
      channelsFailed: failed,
      newMessages,
      errorSummary: errorSummary || null,
    },
  });

  if (!options?.prisma) {
    await prisma.$disconnect();
  }

  return {
    runId: run.id,
    channelsAttempted: channels.length,
    channelsSucceeded: succeeded,
    channelsFailed: failed,
    newMessages,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    perChannel,
  };
}