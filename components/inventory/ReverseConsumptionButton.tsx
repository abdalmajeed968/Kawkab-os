"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReverseConsumptionButton({ eventId, alreadyReversed }: { eventId: string; alreadyReversed: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadyReversed) {
    return <span style={{ fontSize: 11, color: "var(--kw-text-muted)" }}>Reversed</span>;
  }

  async function handleReverse() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/consumption-events/${eventId}/reverse`, {
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
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="button-secondary" style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => setOpen(true)}>
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
