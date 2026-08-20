"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Settings {
  businessName: string | null;
  defaultCurrency: string;
  timezone: string;
}

export function BusinessSettingsForm({ settings, canEdit }: { settings: Settings; canEdit: boolean }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(settings.businessName ?? "");
  const [defaultCurrency, setDefaultCurrency] = useState(settings.defaultCurrency);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    const res = await fetch("/api/settings/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, defaultCurrency, timezone }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save.");
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">Business settings</div>
      <div className="card-subtitle">USD-only for V1 — the currency field is here for the record, not a live switch.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label>Business name</label>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} disabled={!canEdit} />
        </div>
        <div className="form-field">
          <label>Default currency</label>
          <input value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)} disabled={!canEdit} />
        </div>
        <div className="form-field">
          <label>Timezone</label>
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={!canEdit} />
        </div>
      </div>
      {error && <div className="auth-error">{error}</div>}
      {success && <div style={{ color: "var(--kw-status-profit)", fontSize: 13, marginBottom: 8 }}>Saved.</div>}
      {canEdit ? (
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
      ) : (
        <div style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>Owner access required to change these settings.</div>
      )}
    </form>
  );
}
