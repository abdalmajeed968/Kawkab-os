"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Option {
  id: string;
  name: string;
}

export function NewBrandForm() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [supplierId, setSupplierId] = useState("");
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
      setError("Brand name is required.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, website: website || undefined, supplierId: supplierId || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create brand.");
      return;
    }
    const { brand } = await res.json();
    router.push(`/brand-crm/${brand.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">New brand</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Website</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="brand.com" />
        </div>
        <div className="form-field">
          <label>Associated supplier</label>
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
      {error && <div className="auth-error">{error}</div>}
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Creating…" : "Create brand"}
      </button>
    </form>
  );
}
