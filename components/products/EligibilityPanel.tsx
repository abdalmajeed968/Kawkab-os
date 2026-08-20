"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EligibilityPill } from "./EligibilityPill";
import type { MoneyLike } from "@/lib/landedCost";

interface EligibilityData {
  status: string;
  approvalStatus: string;
  approvalNotes: string | null;
  invoicePathNotes: string | null;
  targetBuyPrice: MoneyLike | null;
  ownerNotes: string | null;
}

const STATUSES = ["UNKNOWN", "OPEN", "RESTRICTED", "WORTH_UNLOCKING"];
const APPROVAL_STATUSES = ["NOT_APPLICABLE", "NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "APPROVED", "DENIED"];

export function EligibilityPanel({ productId, eligibility }: { productId: string; eligibility: EligibilityData | null }) {
  const router = useRouter();
  const [status, setStatus] = useState(eligibility?.status ?? "UNKNOWN");
  const [approvalStatus, setApprovalStatus] = useState(eligibility?.approvalStatus ?? "NOT_APPLICABLE");
  const [approvalNotes, setApprovalNotes] = useState(eligibility?.approvalNotes ?? "");
  const [invoicePathNotes, setInvoicePathNotes] = useState(eligibility?.invoicePathNotes ?? "");
  const [targetBuyPrice, setTargetBuyPrice] = useState(eligibility?.targetBuyPrice?.toString() ?? "");
  const [ownerNotes, setOwnerNotes] = useState(eligibility?.ownerNotes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch(`/api/eligibility/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, approvalStatus, approvalNotes, invoicePathNotes, targetBuyPrice, ownerNotes }),
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
    <div className="card" id="eligibility">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>
          Eligibility &amp; approval
        </div>
        <EligibilityPill status={status} />
      </div>
      <div className="card-subtitle">
        A restricted product is never treated as rejected — it stays here as a candidate for a brand relationship or a
        qualifying supplier invoice. KAWKAB can note that a path looks suitable; final approval always belongs to Amazon.
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-field">
            <label>Eligibility status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Approval status</label>
            <select value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value)}>
              {APPROVAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label>Target buy price</label>
          <input value={targetBuyPrice} onChange={(e) => setTargetBuyPrice(e.target.value)} placeholder="$" />
        </div>
        <div className="form-field">
          <label>Invoice / approval path notes</label>
          <textarea value={invoicePathNotes} onChange={(e) => setInvoicePathNotes(e.target.value)} rows={2} />
        </div>
        <div className="form-field">
          <label>Approval notes</label>
          <textarea value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} rows={2} />
        </div>
        <div className="form-field">
          <label>Owner notes</label>
          <textarea value={ownerNotes} onChange={(e) => setOwnerNotes(e.target.value)} rows={2} />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save eligibility"}
        </button>
      </form>
    </div>
  );
}
