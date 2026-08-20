"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportBatchActions({ batchId, reportType, status }: { batchId: string; reportType: string; status: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);

  async function runMatch() {
    setSubmitting("match");
    setError(null);
    const res = await fetch(`/api/imports/${batchId}/match`, { method: "POST" });
    setSubmitting(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Matching failed.");
      return;
    }
    const result = await res.json();
    setMessage(`Matched ${result.matched}, unmatched ${result.unmatched}.`);
    router.refresh();
  }

  async function runCommit() {
    setSubmitting("commit");
    setError(null);
    const res = await fetch(`/api/imports/${batchId}/commit`, { method: "POST" });
    setSubmitting(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Commit failed.");
      return;
    }
    const result = await res.json();
    const successCount = result.committed ?? result.created ?? 0;
    const failCount = result.failed ?? 0;
    setMessage(`Committed ${successCount} row(s)${failCount > 0 ? `, ${failCount} failed — see error rows below` : ""}.`);
    setCommitted(true);
    router.refresh();
  }

  const isFinished = status === "PROCESSED";
  const resultsHref = reportType === "FINANCE" ? "/finance" : reportType === "SALES" ? "/sales" : "/reports";

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button className="button-secondary" onClick={runMatch} disabled={submitting !== null || isFinished}>
        {submitting === "match" ? "Matching…" : "Match products"}
      </button>
      <button className="button-primary" onClick={runCommit} disabled={submitting !== null || isFinished}>
        {submitting === "commit"
          ? "Committing…"
          : reportType === "SALES"
            ? "Commit sales (reduces inventory)"
            : reportType === "FINANCE"
              ? "Commit financial events"
              : "Commit"}
      </button>
      {(committed || isFinished) && (
        <a href={resultsHref} className="button-secondary" style={{ textDecoration: "none" }}>
          View Results
        </a>
      )}
      {message && <span style={{ fontSize: 13, color: "var(--kw-status-profit)" }}>{message}</span>}
      {error && <span className="auth-error">{error}</span>}
    </div>
  );
}
