"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface EntryData {
  status: string;
  assumedCost: number | null;
  assumedSellingPrice: number | null;
  competitionNotes: string | null;
  restrictionNotes: string | null;
  sourceUrl: string | null;
  notes: string | null;
}

const STATUSES = ["IDEA", "CHECKING", "VIABLE", "NOT_VIABLE", "SOURCING", "TESTING", "ADOPTED", "REJECTED"];

export function EditResearchEntryForm({ entryId, entry }: { entryId: string; entry: EntryData }) {
  const router = useRouter();
  const [status, setStatus] = useState(entry.status);
  const [assumedCost, setAssumedCost] = useState(entry.assumedCost?.toString() ?? "");
  const [assumedSellingPrice, setAssumedSellingPrice] = useState(entry.assumedSellingPrice?.toString() ?? "");
  const [competitionNotes, setCompetitionNotes] = useState(entry.competitionNotes ?? "");
  const [restrictionNotes, setRestrictionNotes] = useState(entry.restrictionNotes ?? "");
  const [sourceUrl, setSourceUrl] = useState(entry.sourceUrl ?? "");
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch(`/api/research/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        assumedCost,
        assumedSellingPrice,
        competitionNotes,
        restrictionNotes,
        sourceUrl,
        notes,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">Edit research entry</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Assumed cost</label>
          <input type="number" value={assumedCost} onChange={(e) => setAssumedCost(e.target.value)} placeholder="$" />
        </div>
        <div className="form-field">
          <label>Assumed selling price</label>
          <input type="number" value={assumedSellingPrice} onChange={(e) => setAssumedSellingPrice(e.target.value)} placeholder="$" />
        </div>
      </div>
      <div className="form-field">
        <label>Competition notes</label>
        <textarea value={competitionNotes} onChange={(e) => setCompetitionNotes(e.target.value)} rows={2} />
      </div>
      <div className="form-field">
        <label>Restriction notes</label>
        <textarea value={restrictionNotes} onChange={(e) => setRestrictionNotes(e.target.value)} rows={2} />
      </div>
      <div className="form-field">
        <label>Source / reference link</label>
        <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
      </div>
      <div className="form-field">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      {error && <div className="auth-error">{error}</div>}
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
