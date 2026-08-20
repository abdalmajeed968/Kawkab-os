"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({ currentName }: { currentName: string }) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, newPassword: newPassword || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save.");
      return;
    }
    setNewPassword("");
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">Your profile</div>
      <div className="form-field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-field">
        <label>New password (leave blank to keep current)</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 10 characters" />
      </div>
      {error && <div className="auth-error">{error}</div>}
      {success && <div style={{ color: "var(--kw-status-profit)", fontSize: 13, marginBottom: 8 }}>Saved.</div>}
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
