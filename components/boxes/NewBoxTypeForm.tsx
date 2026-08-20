"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface SupplierOption {
  id: string;
  name: string;
}

export function NewBoxTypeForm() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [name, setName] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
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
    if (!name.trim()) {
      setError("Box name is required.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/boxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        lengthCm: lengthCm || undefined,
        widthCm: widthCm || undefined,
        heightCm: heightCm || undefined,
        supplierId: supplierId || undefined,
        lowStockThreshold: lowStockThreshold || undefined,
        notes: notes || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create box type.");
      return;
    }
    const { boxType } = await res.json();
    router.push(`/boxes/${boxType.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">New box type</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Medium mailer box" />
        </div>
        <div className="form-field">
          <label>Supplier</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Low stock threshold</label>
          <input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} placeholder="units" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label>Length (cm)</label>
          <input type="number" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Width (cm)</label>
          <input type="number" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Height (cm)</label>
          <input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
        </div>
      </div>
      <div className="form-field">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      {error && <div className="auth-error">{error}</div>}
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Creating…" : "Create box type"}
      </button>
    </form>
  );
}
