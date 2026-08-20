"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface SupplierData {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  accountNumber: string | null;
  paymentTerms: string | null;
  notes: string | null;
}

export function EditSupplierForm({ supplier }: { supplier: SupplierData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(supplier.name);
  const [contactName, setContactName] = useState(supplier.contactName ?? "");
  const [email, setEmail] = useState(supplier.email ?? "");
  const [phone, setPhone] = useState(supplier.phone ?? "");
  const [website, setWebsite] = useState(supplier.website ?? "");
  const [accountNumber, setAccountNumber] = useState(supplier.accountNumber ?? "");
  const [paymentTerms, setPaymentTerms] = useState(supplier.paymentTerms ?? "");
  const [notes, setNotes] = useState(supplier.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch(`/api/suppliers/${supplier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        contactName: contactName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        website: website || "",
        accountNumber: accountNumber || undefined,
        paymentTerms: paymentTerms || undefined,
        notes: notes || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="button-secondary" onClick={() => setOpen(true)}>
        Edit
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginTop: 12 }}>
      <div className="card-title">Edit supplier</div>
      <div className="form-field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-field">
        <label>Contact name</label>
        <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
      </div>
      <div className="form-field">
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="form-field">
        <label>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="form-field">
        <label>Website (optional)</label>
        <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="supplier.com" />
      </div>
      <div className="form-field">
        <label>Account number</label>
        <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
      </div>
      <div className="form-field">
        <label>Payment terms</label>
        <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30" />
      </div>
      <div className="form-field">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      {error && <div className="auth-error">{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
        <button type="button" className="button-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
