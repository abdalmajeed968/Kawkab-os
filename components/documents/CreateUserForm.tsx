"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function CreateUserForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("OPERATOR");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || password.length < 10) {
      setError("Name and email are required; password must be at least 10 characters.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create user.");
      return;
    }

    setName("");
    setEmail("");
    setPassword("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">Add a user</div>
      <div className="form-field">
        <label htmlFor="u-name">Name</label>
        <input id="u-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="u-email">Email</label>
        <input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="u-password">Temporary password</label>
        <input id="u-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="u-role">Role</label>
        <select id="u-role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="OWNER">OWNER</option>
          <option value="OPERATOR">OPERATOR</option>
          <option value="AI_AGENT">AI_AGENT</option>
        </select>
      </div>
      {error && <div className="auth-error">{error}</div>}
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}
