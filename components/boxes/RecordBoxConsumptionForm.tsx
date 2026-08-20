"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function RecordBoxConsumptionForm({ boxTypeId }: { boxTypeId: string }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("");
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
    const res = await fetch(`/api/boxes/${boxTypeId}/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: Number(quantity), notes: notes || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not record adjustment.");
      return;
    }
    setQuantity("");
    setNotes("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Quantity removed</label>
        <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: 100 }} />
      </div>
      <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
        <label>Reason (damaged, lost, etc.)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <button type="submit" className="button-secondary" disabled={submitting}>
        {submitting ? "Recording…" : "Record adjustment"}
      </button>
      {error && <div className="auth-error" style={{ width: "100%" }}>{error}</div>}
    </form>
  );
}
