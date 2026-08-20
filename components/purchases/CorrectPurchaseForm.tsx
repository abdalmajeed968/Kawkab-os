"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MoneyLike } from "@/lib/landedCost";

interface PurchaseData {
  supplierShipping: MoneyLike | null;
  localShipping: MoneyLike | null;
  prepCost: MoneyLike | null;
  packagingCost: MoneyLike | null;
  otherCost: MoneyLike | null;
  tax: MoneyLike | null;
  discount: MoneyLike | null;
  invoiceTotal: MoneyLike;
}

export function CorrectPurchaseForm({ purchaseId, purchase }: { purchaseId: string; purchase: PurchaseData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState({
    supplierShipping: purchase.supplierShipping?.toString() ?? "",
    localShipping: purchase.localShipping?.toString() ?? "",
    prepCost: purchase.prepCost?.toString() ?? "",
    packagingCost: purchase.packagingCost?.toString() ?? "",
    otherCost: purchase.otherCost?.toString() ?? "",
    tax: purchase.tax?.toString() ?? "",
    discount: purchase.discount?.toString() ?? "",
    invoiceTotal: purchase.invoiceTotal?.toString() ?? "",
  });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError("A reason is required for every correction — it's recorded in the audit trail.");
      return;
    }

    setSubmitting(true);
    const payload: Record<string, unknown> = { reason };
    for (const [k, v] of Object.entries(fields)) {
      payload[k] = v === "" ? null : Number(v);
    }
    const res = await fetch(`/api/purchases/${purchaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save correction.");
      return;
    }

    setOpen(false);
    setReason("");
    router.refresh();
  }

  if (!open) {
    return (
      <button className="button-secondary" onClick={() => setOpen(true)}>
        Correct cost fields
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginTop: 12 }}>
      <div className="card-title">Correct purchase costs</div>
      <div className="card-subtitle">Every correction is audited with the old value, new value, and this reason — nothing is silently changed.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {(
          [
            ["invoiceTotal", "Invoice total"],
            ["tax", "Tax"],
            ["discount", "Discount"],
            ["supplierShipping", "Supplier shipping"],
            ["localShipping", "Local shipping"],
            ["prepCost", "Prep"],
            ["packagingCost", "Packaging"],
            ["otherCost", "Other"],
          ] as const
        ).map(([key, label]) => (
          <div className="form-field" key={key}>
            <label>{label}</label>
            <input
              type="number"
              value={fields[key]}
              onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="form-field">
        <label>Reason for correction (required)</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
      </div>
      {error && <div className="auth-error">{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save correction"}
        </button>
        <button type="button" className="button-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
