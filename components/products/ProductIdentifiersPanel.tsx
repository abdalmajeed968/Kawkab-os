"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const TYPES = ["ASIN", "FNSKU", "UPC", "EAN", "GTIN", "MPN", "INTERNAL_SKU"];

interface IdentifierRow {
  id: string;
  type: string;
  value: string;
  isCurrent: boolean;
  effectiveFrom: string | Date;
  effectiveTo: string | Date | null;
  marketplace?: { displayName: string } | null;
}

export function ProductIdentifiersPanel({ productId, identifiers }: { productId: string; identifiers: IdentifierRow[] }) {
  const router = useRouter();
  const [type, setType] = useState(TYPES[0]);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!value.trim()) {
      setError("Enter a value.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/product-identifiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, type, value }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save identifier.");
      return;
    }
    setValue("");
    router.refresh();
  }

  const current = identifiers.filter((i) => i.isCurrent);
  const historical = identifiers.filter((i) => !i.isCurrent);

  return (
    <div className="card" id="identity">
      <div className="card-title">Product identity</div>
      <div className="card-subtitle">
        Current identifiers, with full history — a new value never overwrites the old one.
      </div>

      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Value</th>
            <th>Marketplace</th>
            <th>Since</th>
          </tr>
        </thead>
        <tbody>
          {current.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ color: "var(--kw-text-muted)" }}>
                No identifiers set yet
              </td>
            </tr>
          ) : (
            current.map((i) => (
              <tr key={i.id}>
                <td>{i.type}</td>
                <td>{i.value}</td>
                <td>{i.marketplace?.displayName ?? "—"}</td>
                <td>{new Date(i.effectiveFrom).toLocaleDateString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {historical.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12, color: "var(--kw-text-muted)", cursor: "pointer" }}>
            {historical.length} superseded identifier{historical.length > 1 ? "s" : ""}
          </summary>
          <table style={{ marginTop: 8 }}>
            <tbody>
              {historical.map((i) => (
                <tr key={i.id}>
                  <td>{i.type}</td>
                  <td style={{ textDecoration: "line-through", color: "var(--kw-text-muted)" }}>{i.value}</td>
                  <td style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>
                    {new Date(i.effectiveFrom).toLocaleDateString()} –{" "}
                    {i.effectiveTo ? new Date(i.effectiveTo).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" />
        <button type="submit" className="button-secondary" disabled={submitting}>
          {submitting ? "Saving…" : "Set identifier"}
        </button>
      </form>
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}
