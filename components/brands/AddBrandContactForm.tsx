"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AddBrandContactForm({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/brands/${brandId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: email || undefined, phone: phone || undefined, title: title || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not add contact.");
      return;
    }
    setName("");
    setEmail("");
    setPhone("");
    setTitle("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="form-field" style={{ marginBottom: 0 }}>
        <label>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <button type="submit" className="button-secondary" disabled={submitting}>
        {submitting ? "Adding…" : "Add contact"}
      </button>
      {error && <div className="auth-error" style={{ width: "100%" }}>{error}</div>}
    </form>
  );
}
