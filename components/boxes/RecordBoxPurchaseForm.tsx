"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function RecordBoxPurchaseForm({ boxTypeId }: { boxTypeId: string }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
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
    const res = await fetch(`/api/boxes/${boxTypeId}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: Number(quantity), unitCost: unitCost || undefined, invoiceNumber: invoiceNumber || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not record purchase.");
      return;
    }
    setQuantity("");
    setUnitCost("");
    setInvoiceNumber("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Quantity added</label>
        <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: 100 }} />
      </div>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Unit cost (leave blank if unknown)</label>
        <input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} style={{ width: 110 }} placeholder="$" />
      </div>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Invoice #</label>
        <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} style={{ width: 140 }} />
      </div>
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Recording…" : "Record purchase"}
      </button>
      {error && <div className="auth-error" style={{ width: "100%" }}>{error}</div>}
    </form>
  );
}
