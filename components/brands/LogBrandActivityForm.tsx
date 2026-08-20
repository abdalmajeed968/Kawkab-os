"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LogBrandActivityForm({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [type, setType] = useState("NOTE");
  const [summary, setSummary] = useState("");
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [followUpDate, setFollowUpDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!summary.trim()) {
      setError("A summary is required.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/brands/${brandId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, summary, activityDate, followUpDate: followUpDate || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not log activity.");
      return;
    }
    setSummary("");
    setFollowUpDate("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="NOTE">Note</option>
            <option value="EMAIL">Email</option>
            <option value="CALL">Call</option>
            <option value="MEETING">Meeting</option>
          </select>
        </div>
        <div className="form-field">
          <label>Date</label>
          <input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Follow-up date (optional)</label>
          <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
        </div>
      </div>
      <div className="form-field">
        <label>Summary</label>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} />
      </div>
      {error && <div className="auth-error">{error}</div>}
      <button type="submit" className="button-secondary" disabled={submitting}>
        {submitting ? "Logging…" : "Log activity"}
      </button>
    </form>
  );
}
