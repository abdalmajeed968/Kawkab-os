"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["DRAFT", "PACKED", "SHIPPED", "IN_TRANSIT", "DELIVERED"];

export function ShipmentStatusControl({ shipmentId, currentStatus }: { shipmentId: string; currentStatus: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (currentStatus === "CANCELLED") {
    return <span className="pill pill-restricted">Cancelled</span>;
  }

  async function handleChange(status: string) {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/shipments/${shipmentId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not update status.");
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <select value={currentStatus} onChange={(e) => handleChange(e.target.value)} disabled={submitting}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      {error && <span className="auth-error">{error}</span>}
    </div>
  );
}
