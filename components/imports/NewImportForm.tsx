"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewImportForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [reportType, setReportType] = useState<"SALES" | "FINANCE" | "INVENTORY">("SALES");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ rowCount: number } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Choose a CSV or Excel file first.");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("reportType", reportType);

    setSubmitting(true);
    const res = await fetch("/api/imports", { method: "POST", body: formData });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Import failed.");
      return;
    }

    const { batch } = await res.json();
    setResult({ rowCount: batch.originalRowCount ?? 0 });
    setFile(null);
    router.push(`/imports/${batch.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">Import a Seller Central report</div>
      <div className="card-subtitle">
        Upload a CSV or Excel export from Amazon Seller Central. Nothing is committed to Sales or inventory yet —
        this step only parses and preserves every row for review.
      </div>

      <div className="form-field">
        <label>Report type</label>
        <select value={reportType} onChange={(e) => setReportType(e.target.value as typeof reportType)}>
          <option value="SALES">Sales — orders and units sold</option>
          <option value="FINANCE">Finance — fees, refunds, settlements</option>
          <option value="INVENTORY">Inventory — Amazon's own stock snapshot</option>
        </select>
        <div style={{ fontSize: 12, color: "var(--kw-text-muted)", marginTop: 4 }}>
          {reportType === "SALES" && "Creates Sale/SaleItem records and reduces inventory once committed."}
          {reportType === "FINANCE" && "Creates individual financial events (fees, refunds, credits) — never overwrites a fixed fee column."}
          {reportType === "INVENTORY" && "Preserved as raw rows for reference — does not overwrite KAWKAB's own calculated inventory."}
        </div>
      </div>

      <div className="form-field">
        <label>File (.csv, .xlsx, .xls)</label>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>

      {error && <div className="auth-error">{error}</div>}
      {result && <div style={{ color: "var(--kw-status-profit)", fontSize: 13, marginBottom: 8 }}>Parsed {result.rowCount} rows.</div>}

      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Uploading & parsing…" : "Upload & parse"}
      </button>
    </form>
  );
}
