"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function RecordConsumptionForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [type, setType] = useState<"MANUAL_SALE" | "MANUAL_ADJUSTMENT">("MANUAL_SALE");
  const [quantity, setQuantity] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!quantity || Number(quantity) <= 0) {
      setError("Enter a positive quantity.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/consumption-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, type, quantity: Number(quantity), eventDate, notes: notes || undefined }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not record consumption.");
      return;
    }

    setQuantity("");
    setNotes("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="MANUAL_SALE">Manual sale</option>
          <option value="MANUAL_ADJUSTMENT">Adjustment (damage, loss, sample, etc.)</option>
        </select>
      </div>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Quantity</label>
        <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: 90 }} />
      </div>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Date</label>
        <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
      </div>
      <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
        <label>Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Recording…" : "Record"}
      </button>
      {error && <div className="auth-error" style={{ width: "100%" }}>{error}</div>}
    </form>
  );
}
