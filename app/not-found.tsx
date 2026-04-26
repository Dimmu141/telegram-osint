import Link from "next/link";

export default function NotFound() {
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
          marginBottom: 16,
        }}
      >
        404
      </div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 24,
          color: "var(--ink)",
          marginBottom: 12,
        }}
      >
        Page not found
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--ink-4)",
          marginBottom: 32,
        }}
      >
        This page does not exist or has been removed.
      </div>
      <Link
        href="/"
        style={{
          padding: "9px 20px",
          border: "1px solid var(--ink)",
          background: "var(--ink)",
          color: "var(--paper)",
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        Back to feed
      </Link>
    </div>
  );
}
