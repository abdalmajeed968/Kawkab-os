"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

const DOCUMENT_TYPES = [
  "BUSINESS_REGISTRATION",
  "EIN_LETTER",
  "RESALE_CERTIFICATE",
  "INSURANCE_DOCUMENT",
  "TAX_DOCUMENT",
  "SUPPLIER_AGREEMENT",
  "OTHER",
];

export function DocumentUploadForm({ businessRecordId }: { businessRecordId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Choose a file first.");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("documentType", documentType);
    formData.set("businessRecordId", businessRecordId);

    setSubmitting(true);
    const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Upload failed.");
      return;
    }

    setFile(null);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
        {DOCUMENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <input type="file" onChange={handleFileChange} />
      <button type="submit" className="button-secondary" disabled={submitting}>
        {submitting ? "Uploading…" : "Upload"}
      </button>
      {error && <span className="auth-error">{error}</span>}
    </form>
  );
}
