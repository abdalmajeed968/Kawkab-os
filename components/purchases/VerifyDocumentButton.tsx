"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VerifyDocumentButton({ documentId, alreadyVerified }: { documentId: string; alreadyVerified: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  if (alreadyVerified) {
    return <span style={{ fontSize: 12, color: "var(--kw-status-profit)" }}>Verified</span>;
  }

  async function handleClick() {
    setSubmitting(true);
    await fetch("/api/documents/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <button className="button-secondary" onClick={handleClick} disabled={submitting} style={{ padding: "4px 10px", fontSize: 12 }}>
      {submitting ? "Confirming…" : "Review & confirm"}
    </button>
  );
}
