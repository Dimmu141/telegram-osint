"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        fontFamily: "var(--mono)",
        background: "var(--paper)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--ink-4)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 20,
        }}
      >
        Something went wrong
      </div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 20,
          color: "var(--ink-2)",
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        The feed failed to load
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-4)",
          marginBottom: 32,
          maxWidth: 420,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        {error.message || "An unexpected error occurred. This may be a temporary database issue."}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={reset}
          style={{
            padding: "9px 20px",
            border: "1px solid var(--ink)",
            background: "var(--ink)",
            color: "var(--paper)",
            cursor: "pointer",
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Try again
        </button>
        <a
          href="/"
          style={{
            padding: "9px 20px",
            border: "1px solid var(--rule)",
            background: "none",
            color: "var(--ink-2)",
            cursor: "pointer",
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Reload page
        </a>
      </div>
    </div>
  );
}
