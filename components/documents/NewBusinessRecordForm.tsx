"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewBusinessRecordForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [visibleToOperator, setVisibleToOperator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !category.trim()) {
      setError("Name and category are required.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/business-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, visibleToOperator }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create record.");
      return;
    }

    setName("");
    setCategory("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">New business record</div>
      <div className="form-field">
        <label htmlFor="br-name">Name</label>
        <input id="br-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Delaware LLC registration" />
      </div>
      <div className="form-field">
        <label htmlFor="br-category">Category</label>
        <input id="br-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Business registration" />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" checked={visibleToOperator} onChange={(e) => setVisibleToOperator(e.target.checked)} style={{ width: "auto" }} />
        Visible to Operator (unchecked = Owner only)
      </label>
      {error && <div className="auth-error">{error}</div>}
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Creating…" : "Create record"}
      </button>
    </form>
  );
}
