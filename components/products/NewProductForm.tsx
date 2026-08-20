"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Marketplace {
  id: string;
  displayName: string;
}

export function NewProductForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [asin, setAsin] = useState("");
  const [sku, setSku] = useState("");
  const [marketplaceId, setMarketplaceId] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState("UNKNOWN");
  const [expectedSellingPrice, setExpectedSellingPrice] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/settings/marketplaces")
      .then((r) => r.json())
      .then((d) => setMarketplaces(d.marketplaces ?? []));
  }, [open]);

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
      body: JSON.stringify({
        name,
        brand: brand || undefined,
        asin: asin || undefined,
        sku: sku || undefined,
        marketplaceId: marketplaceId || undefined,
        fulfillmentType,
        expectedSellingPrice: expectedSellingPrice || undefined,
        sourceUrl: sourceUrl || undefined,
        notes: notes || undefined,
      }),
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
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 560 }}>
      <div className="card-title">New product</div>
      <div className="card-subtitle">Enter what you know now — everything here can be edited later.</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label htmlFor="p-name">Product name</label>
          <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-field">
          <label htmlFor="p-brand">Brand</label>
          <input id="p-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Type any brand name" />
        </div>
        <div className="form-field">
          <label htmlFor="p-asin">ASIN</label>
          <input id="p-asin" value={asin} onChange={(e) => setAsin(e.target.value)} placeholder="B0XXXXXXXX" />
        </div>
        <div className="form-field">
          <label htmlFor="p-sku">SKU</label>
          <input id="p-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="If available" />
        </div>
        <div className="form-field">
          <label htmlFor="p-marketplace">Marketplace</label>
          <select id="p-marketplace" value={marketplaceId} onChange={(e) => setMarketplaceId(e.target.value)}>
            <option value="">Not set</option>
            {marketplaces.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="p-fulfillment">Fulfillment method</label>
          <select id="p-fulfillment" value={fulfillmentType} onChange={(e) => setFulfillmentType(e.target.value)}>
            <option value="UNKNOWN">Not set</option>
            <option value="FBA">FBA</option>
            <option value="FBM">FBM</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="p-price">Expected selling price</label>
          <input id="p-price" type="number" step="0.01" value={expectedSellingPrice} onChange={(e) => setExpectedSellingPrice(e.target.value)} placeholder="$" />
        </div>
        <div className="form-field">
          <label htmlFor="p-source">Supplier product URL</label>
          <input id="p-source" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Link to the listing on the supplier's site" />
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="p-notes">Notes</label>
        <textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
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
