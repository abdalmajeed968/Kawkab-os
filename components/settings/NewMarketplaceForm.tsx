"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewMarketplaceForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [currency, setCurrency] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim() || !displayName.trim() || !countryCode.trim() || !currency.trim()) {
      setError("All fields are required.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/settings/marketplaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, displayName, countryCode, currency }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create marketplace.");
      return;
    }
    setCode("");
    setDisplayName("");
    setCountryCode("");
    setCurrency("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">Add marketplace</div>
      <div className="card-subtitle">This registers a marketplace record for future identifier mapping — it does not connect to Amazon.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label>Amazon marketplace ID</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. A2EUQ1WTGCTBG2" />
        </div>
        <div className="form-field">
          <label>Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Amazon.ca" />
        </div>
        <div className="form-field">
          <label>Country code</label>
          <input value={countryCode} onChange={(e) => setCountryCode(e.target.value)} placeholder="CA" />
        </div>
        <div className="form-field">
          <label>Currency</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="CAD" />
        </div>
      </div>
      {error && <div className="auth-error">{error}</div>}
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Adding…" : "Add marketplace"}
      </button>
    </form>
  );
}
