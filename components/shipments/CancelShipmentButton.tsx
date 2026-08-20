"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelShipmentButton({ shipmentId, currentStatus }: { shipmentId: string; currentStatus: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (currentStatus === "CANCELLED") return null;

  async function handleCancel() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/shipments/${shipmentId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not cancel.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="button-secondary" onClick={() => setOpen(true)}>
        Cancel shipment
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        placeholder="Reason for cancelling"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        style={{ fontSize: 13 }}
      />
      <button className="button-secondary" onClick={handleCancel} disabled={submitting}>
        {submitting ? "Cancelling…" : "Confirm cancel"}
      </button>
      {error && <span className="auth-error">{error}</span>}
    </div>
  );
}
