"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewProductForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, brand: brand || undefined }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create product.");
      return;
    }

    const { product } = await res.json();
    router.push(`/products/${product.id}`);
  }

  if (!open) {
    return (
      <button className="button-primary" onClick={() => setOpen(true)}>
        + New product
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 420 }}>
      <div className="card-title">New product</div>
      <div className="form-field">
        <label htmlFor="p-name">Product name</label>
        <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="form-field">
        <label htmlFor="p-brand">Brand (free text — no dropdown required)</label>
        <input id="p-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Type any brand name" />
      </div>
      {error && <div className="auth-error">{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Creating…" : "Create product"}
        </button>
        <button type="button" className="button-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
