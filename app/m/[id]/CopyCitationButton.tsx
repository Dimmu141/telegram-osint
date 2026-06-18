"use client";

export default function CopyCitationButton({ citation }: { citation: string }) {
  return (
    <button
      className="msg-page-btn-secondary"
      type="button"
      onClick={() => navigator.clipboard?.writeText(citation)}
    >
      Copy citation
    </button>
  );
}
