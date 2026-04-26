import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Telegram OSINT — Russian-language channel monitor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#faf9f5",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 90px",
        }}
      >
        {/* Brand mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              border: "2px solid #1a1a2e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "monospace",
              fontSize: 16,
              fontWeight: 700,
              color: "#1a1a2e",
              letterSpacing: "-0.02em",
              position: "relative",
            }}
          >
            tg
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontFamily: "serif",
                fontSize: 26,
                fontWeight: 600,
                color: "#1a1a2e",
                lineHeight: 1,
                letterSpacing: "-0.01em",
              }}
            >
              Telegram OSINT
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "#999",
                marginTop: 4,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              public · open source
            </div>
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontFamily: "serif",
            fontSize: 58,
            fontWeight: 500,
            color: "#1a1a2e",
            lineHeight: 1.1,
            letterSpacing: "-0.015em",
            marginBottom: 28,
            maxWidth: 900,
          }}
        >
          Russian-language Telegram,{" "}
          <span style={{ color: "#666" }}>translated & classified</span>
        </div>

        {/* Description */}
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 22,
            color: "#555",
            lineHeight: 1.45,
            maxWidth: 780,
            marginBottom: 48,
          }}
        >
          63 Russian, Ukrainian and Belarusian channels — scraped every
          30 minutes, classified by topic and significance, built for Nordic
          journalists and security analysts.
        </div>

        {/* Footer stats */}
        <div
          style={{
            display: "flex",
            gap: 32,
            fontFamily: "monospace",
            fontSize: 13,
            color: "#888",
            letterSpacing: "0.04em",
            borderTop: "1px solid #e5e3da",
            paddingTop: 24,
            width: "100%",
          }}
        >
          <span>63 CHANNELS</span>
          <span>·</span>
          <span>EVERY 30 MIN</span>
          <span>·</span>
          <span>FREE · OPEN SOURCE</span>
          <span>·</span>
          <span>github.com/Dimmu141/telegram-osint</span>
        </div>

        {/* Red indicator dot */}
        <div
          style={{
            position: "absolute",
            top: 80,
            right: 90,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#d94f3a",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
