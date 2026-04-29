import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import CopyCitationButton from "./CopyCitationButton";
import {
  flaggedBecause,
  parseEntities,
  relevanceLabel,
  sourceContextForCategory,
  topicLabel,
} from "@/lib/editorial";

export const revalidate = 3600;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const msg = await prisma.message.findUnique({
    where: { id },
    select: {
      translationEn: true,
      summary: true,
      channel: { select: { nameEn: true, handle: true } },
    },
  });
  if (!msg) return { title: "Message not found - Telegram OSINT" };

  const title =
    msg.translationEn?.split(/[.!?\n]/)[0]?.trim().slice(0, 100) ??
    "Telegram OSINT";
  const description =
    msg.summary ??
    msg.translationEn?.slice(0, 200) ??
    "Classified message from Russian-language Telegram.";

  return {
    title: `${title} - Telegram OSINT`,
    description,
    openGraph: {
      title,
      description,
      siteName: "Telegram OSINT",
      type: "article",
    },
  };
}

export default async function MessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const msg = await prisma.message.findUnique({
    where: { id },
    select: {
      id: true,
      telegramPostId: true,
      text: true,
      translationEn: true,
      topic: true,
      significance: true,
      entities: true,
      summary: true,
      postedAt: true,
      llmModel: true,
      channel: {
        select: { handle: true, nameEn: true, nameRu: true, category: true, stance: true, sourceType: true },
      },
    },
  });

  if (!msg) notFound();

  const ents = parseEntities(msg.entities);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC";
  };

  const sig = msg.significance ?? "medium";
  const sourceContext = sourceContextForCategory(msg.channel.category);
  const flagReason = flaggedBecause(msg.significance, msg.topic, msg.channel.category);
  const sigColor =
    sig === "critical"
      ? "var(--signal)"
      : sig === "high"
        ? "var(--amber)"
        : "var(--ink-4)";

  const telegramUrl = msg.telegramPostId
    ? `https://t.me/${msg.telegramPostId}`
    : null;
  const postedIso = msg.postedAt instanceof Date ? msg.postedAt.toISOString() : String(msg.postedAt);
  const localPermalink = `${SITE_URL}/m/${msg.id}`;
  const citation = [
    `${msg.channel.nameEn ?? `@${msg.channel.handle}`} (@${msg.channel.handle}), ${fmtDate(postedIso)}`,
    msg.translationEn ?? msg.text ?? "",
    `Telegram OSINT: ${localPermalink}`,
    telegramUrl ? `Original Telegram: ${telegramUrl}` : null,
    "Machine translation and AI classification. Verify before publication.",
  ].filter(Boolean).join("\n");

  return (
    <>
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <div className="brand-mark">tg</div>
            <div>
              <div className="brand-name">Telegram OSINT</div>
              <div className="brand-sub">public - open source</div>
            </div>
          </Link>
          <nav
            style={{
              display: "flex",
              gap: 20,
              fontFamily: "var(--mono)",
              fontSize: 12,
              color: "var(--ink-3)",
            }}
          >
            <Link href="/" style={{ color: "var(--ink-3)", textDecoration: "none" }}>
              Feed
            </Link>
            <Link href="/channels" style={{ color: "var(--ink-3)", textDecoration: "none" }}>
              Channels
            </Link>
            <Link href="/about" style={{ color: "var(--ink-3)", textDecoration: "none" }}>
              About
            </Link>
          </nav>
          <div className="top-actions">
            <a
              href="https://github.com/Dimmu141/telegram-osint"
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn"
              title="GitHub"
            >
              GH
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="page-container">
        <div className="msg-page">
          {/* Meta row */}
          <div className="msg-page-meta">
            <div className="msg-page-channel">
              <Link
                href={`/channels/${msg.channel.handle}`}
                style={{ fontWeight: 600, fontSize: 15, color: "var(--ink)", textDecoration: "none" }}
              >
                {msg.channel.nameEn ?? `@${msg.channel.handle}`}
              </Link>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-4)",
                }}
              >
                @{msg.channel.handle}
              </span>
            </div>
            <div className="msg-page-tags">
              {msg.topic && (
                <span className="tag tag-other">
                  {topicLabel(msg.topic)}
                </span>
              )}
              {sig !== "medium" && sig !== "low" && (
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 9.5,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "2px 7px",
                    borderRadius: 2,
                    fontWeight: 700,
                    background: sigColor,
                    color: "var(--paper)",
                  }}
                >
                  {relevanceLabel(sig)}
                </span>
              )}
              <span
                className="tag"
                title={sourceContext.note}
                style={{ background: sourceContext.bg, color: sourceContext.color }}
              >
                {sourceContext.label}
              </span>
            </div>
          </div>

          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--ink-4)",
              marginBottom: 24,
              letterSpacing: "0.03em",
            }}
          >
            {fmtDate(postedIso)}
          </div>

          <div className="use-verify">
            <div className="analysis-lbl">Use / verify</div>
            <dl className="use-verify-grid">
              <div><dt>Source</dt><dd>{msg.channel.nameEn ?? `@${msg.channel.handle}`} (@{msg.channel.handle})</dd></div>
              <div><dt>Posted</dt><dd>{fmtDate(postedIso)}</dd></div>
              <div><dt>Original</dt><dd>{telegramUrl ? <a href={telegramUrl} target="_blank" rel="noopener noreferrer">Telegram post</a> : "unavailable"}</dd></div>
              <div><dt>Permalink</dt><dd><a href={localPermalink}>{localPermalink}</a></dd></div>
              <div><dt>Translation</dt><dd>machine-generated</dd></div>
              <div><dt>Classification</dt><dd>AI-generated{msg.llmModel ? ` (${msg.llmModel})` : ""}</dd></div>
            </dl>
            <p>Use this as a discovery signal. Verify the original Telegram post and independent sources before publication.</p>
            {flagReason && <div className="flagged-reason">{flagReason}</div>}
            <CopyCitationButton citation={citation} />
          </div>

          {/* Translation */}
          {msg.translationEn && (
            <div className="msg-page-body">{msg.translationEn}</div>
          )}

          {/* Analysis */}
          {msg.summary && (
            <div className="analysis" style={{ marginBottom: 20 }}>
              <div className="analysis-lbl">Analysis</div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
                {msg.summary}
              </p>
            </div>
          )}

          {/* Entities */}
          {ents && (
            <div style={{ marginBottom: 20 }}>
              {ents.people.length > 0 && (
                <div className="msg-page-entity-group">
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 9.5,
                      color: "var(--ink-4)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    People
                  </span>
                  <div className="entities">
                    {ents.people.map((p) => (
                      <span key={p} className="ent-tag">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ents.locations.length > 0 && (
                <div className="msg-page-entity-group">
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 9.5,
                      color: "var(--ink-4)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Locations
                  </span>
                  <div className="entities">
                    {ents.locations.map((l) => (
                      <span key={l} className="ent-tag">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ents.organizations.length > 0 && (
                <div className="msg-page-entity-group">
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 9.5,
                      color: "var(--ink-4)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Organizations
                  </span>
                  <div className="entities">
                    {ents.organizations.map((o) => (
                      <span key={o} className="ent-tag">
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ents.weapons.length > 0 && (
                <div className="msg-page-entity-group">
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 9.5,
                      color: "var(--ink-4)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Weapons
                  </span>
                  <div className="entities">
                    {ents.weapons.map((w) => (
                      <span key={w} className="ent-tag">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Original Russian */}
          {msg.text && (
            <details style={{ marginBottom: 20 }}>
              <summary
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--ink-4)",
                  cursor: "pointer",
                  marginBottom: 8,
                  userSelect: "none",
                }}
              >
                Original Russian text
              </summary>
              <p className="orig-text" style={{ marginTop: 8 }}>
                {msg.text}
              </p>
            </details>
          )}

          {/* Actions */}
          <div className="msg-page-actions">
            {telegramUrl && (
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="msg-page-btn"
              >
                View on Telegram
              </a>
            )}
            <Link href="/" className="msg-page-btn-secondary">
              Back to feed
            </Link>
          </div>

          {/* Footer */}
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              color: "var(--ink-4)",
              marginTop: 32,
              paddingTop: 20,
              borderTop: "1px dashed var(--rule)",
              letterSpacing: "0.04em",
            }}
          >
            Classified by {msg.llmModel ?? "LLM"} - Telegram OSINT -{" "}
            <a
              href="https://github.com/Dimmu141/telegram-osint"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--ink-4)", textDecoration: "underline" }}
            >
              github
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
