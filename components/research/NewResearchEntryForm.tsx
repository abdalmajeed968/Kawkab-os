"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Option {
  id: string;
  name: string;
}

export function NewResearchEntryForm() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [title, setTitle] = useState("");
  const [asin, setAsin] = useState("");
  const [sku, setSku] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [assumedCost, setAssumedCost] = useState("");
  const [assumedSellingPrice, setAssumedSellingPrice] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers ?? []));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        asin: asin || undefined,
        sku: sku || undefined,
        supplierId: supplierId || undefined,
        assumedCost: assumedCost || undefined,
        assumedSellingPrice: assumedSellingPrice || undefined,
        sourceUrl: sourceUrl || undefined,
        notes: notes || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create entry.");
      return;
    }
    const { entry } = await res.json();
    router.push(`/research/${entry.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">New research entry</div>
      <div className="card-subtitle">
        Cost and selling price here are assumptions you're entering, not real numbers — labeled that way everywhere they show up.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Silicone spatula set" />
        </div>
        <div className="form-field">
          <label>ASIN</label>
          <input value={asin} onChange={(e) => setAsin(e.target.value)} />
        </div>
        <div className="form-field">
          <label>SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label>Assumed cost</label>
          <input type="number" value={assumedCost} onChange={(e) => setAssumedCost(e.target.value)} placeholder="$" />
        </div>
        <div className="form-field">
          <label>Assumed selling price</label>
          <input type="number" value={assumedSellingPrice} onChange={(e) => setAssumedSellingPrice(e.target.value)} placeholder="$" />
        </div>
        <div className="form-field">
          <label>Potential supplier</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-field">
        <label>Source / reference link</label>
        <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
      </div>
      <div className="form-field">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      {error && <div className="auth-error">{error}</div>}
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Creating…" : "Create entry"}
      </button>
    </form>
  );
}
