"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SaleItemActions({ saleItemId, committed }: { saleItemId: string; committed: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showReverseForm, setShowReverseForm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCommit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/sale-items/${saleItemId}/commit`, { method: "POST" });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not commit.");
      return;
    }
    router.refresh();
  }

  async function handleReverse() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/sale-items/${saleItemId}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not reverse.");
      return;
    }
    setShowReverseForm(false);
    router.refresh();
  }

  if (!committed) {
    return (
      <div>
        <button className="button-secondary" style={{ padding: "3px 9px", fontSize: 11 }} onClick={handleCommit} disabled={submitting}>
          {submitting ? "Committing…" : "Commit (reduce inventory)"}
        </button>
        {error && <div className="auth-error">{error}</div>}
      </div>
    );
  }

  if (!showReverseForm) {
    return (
      <button className="button-secondary" style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => setShowReverseForm(true)}>
        Reverse
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} style={{ fontSize: 12, padding: "4px 8px" }} />
      <button className="button-secondary" style={{ padding: "3px 9px", fontSize: 11 }} onClick={handleReverse} disabled={submitting}>
        {submitting ? "…" : "Confirm"}
      </button>
      {error && <span className="auth-error">{error}</span>}
    </div>
  );
}
