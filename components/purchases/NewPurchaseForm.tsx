"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Option {
  id: string;
  name: string;
}
interface LineItem {
  productId: string;
  quantity: string;
  unitCost: string;
}

const emptyLine = (): LineItem => ({ productId: "", quantity: "", unitCost: "" });

export function NewPurchaseForm() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [costFields, setCostFields] = useState({
    tax: "",
    discount: "",
    supplierShipping: "",
    localShipping: "",
    prepCost: "",
    packagingCost: "",
    otherCost: "",
  });
  const [notes, setNotes] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers ?? []));
    fetch("/api/products?tab=all")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
  }, []);

  function lineTotal(item: LineItem): number {
    const qty = Number(item.quantity) || 0;
    const unit = Number(item.unitCost) || 0;
    return qty * unit;
  }

  const invoiceTotal = items.reduce((sum, i) => sum + lineTotal(i), 0);

  function updateItem(idx: number, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supplierId) {
      setError("Supplier is required.");
      return;
    }
    if (!invoiceNumber.trim()) {
      setError("An invoice or order number is required to create a purchase — the document itself can be added later.");
      return;
    }
    if (items.some((i) => !i.productId || !i.quantity || !i.unitCost)) {
      setError("Every line item needs a product, quantity, and unit cost.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        purchaseDate,
        invoiceNumber: invoiceNumber.trim(),
        invoiceTotal,
        ...costFields,
        notes: notes || undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unitCost: Number(i.unitCost) })),
      }),
    });

    if (!res.ok) {
      setSubmitting(false);
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create purchase.");
      return;
    }

    const { purchase } = await res.json();

    // Optional invoice document, uploaded right after creation if one was
    // chosen — the Purchase already exists and is valid without it; this
    // just resolves "missing invoice document" immediately if the owner
    // has the file on hand right now.
    if (invoiceFile) {
      const formData = new FormData();
      formData.set("file", invoiceFile);
      formData.set("documentType", "INVOICE");
      await fetch(`/api/purchases/${purchase.id}/documents`, { method: "POST", body: formData });
    }

    setSubmitting(false);
    router.push(`/purchases/${purchase.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">New purchase</div>
      <div className="card-subtitle">
        An invoice/order number is required. The invoice document itself is optional here — attach it now or later.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label>Supplier</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Purchase date</label>
          <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Invoice / order number (required)</label>
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2044" />
        </div>
      </div>

      <div style={{ marginTop: 8, marginBottom: 8 }}>
        <div className="card-title" style={{ fontSize: 13 }}>
          Line items
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 4, fontSize: 11, color: "var(--kw-text-muted)" }}>
          <span>Product</span>
          <span>Quantity</span>
          <span>Unit cost</span>
          <span>Line total</span>
          <span></span>
        </div>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
            <select value={item.productId} onChange={(e) => updateItem(idx, "productId", e.target.value)}>
              <option value="">Product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input placeholder="Qty" type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} />
            <input
              placeholder="$ per unit"
              type="number"
              value={item.unitCost}
              onChange={(e) => updateItem(idx, "unitCost", e.target.value)}
            />
            <div style={{ fontSize: 13, alignSelf: "center", fontFamily: "var(--kw-font-mono)" }}>
              ${lineTotal(item).toFixed(2)}
            </div>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
              disabled={items.length === 1}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="button-secondary" onClick={() => setItems((prev) => [...prev, emptyLine()])}>
          + Add line item
        </button>
      </div>

      <div style={{ fontSize: 13, marginBottom: 12 }}>
        Invoice total (quantity × unit cost, summed): <strong>${invoiceTotal.toFixed(2)}</strong>
      </div>

      <div className="card-title" style={{ fontSize: 13 }}>
        Shared costs — leave blank if unknown, enter 0 if genuinely none
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {(
          [
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
              value={costFields[key]}
              onChange={(e) => setCostFields((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder="$"
            />
          </div>
        ))}
      </div>

      <div className="form-field">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="form-field">
        <label>Invoice document (optional — attach now or later)</label>
        <input type="file" onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} />
      </div>

      {error && <div className="auth-error">{error}</div>}
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Creating…" : "Create purchase"}
      </button>
    </form>
  );
}
