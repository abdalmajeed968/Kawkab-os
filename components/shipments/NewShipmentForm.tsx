"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Option {
  id: string;
  name: string;
}
interface ItemRow {
  productId: string;
  quantity: string;
}
interface BoxRow {
  boxTypeId: string;
  quantity: string;
}

export function NewShipmentForm() {
  const router = useRouter();
  const [products, setProducts] = useState<Option[]>([]);
  const [boxTypes, setBoxTypes] = useState<Option[]>([]);
  const [reference, setReference] = useState("");
  const [destinationType, setDestinationType] = useState("OTHER");
  const [destinationName, setDestinationName] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shipDate, setShipDate] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [prepCost, setPrepCost] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ productId: "", quantity: "" }]);
  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/products?tab=all")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
    fetch("/api/boxes")
      .then((r) => r.json())
      .then((d) => setBoxTypes((d.boxTypes ?? []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reference.trim()) {
      setError("A shipment reference/identifier is required.");
      return;
    }
    if (items.some((i) => !i.productId || !i.quantity)) {
      setError("Every product line needs a product and a quantity.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference,
        destinationType,
        destinationName: destinationName || undefined,
        carrier: carrier || undefined,
        trackingNumber: trackingNumber || undefined,
        shipDate: shipDate || undefined,
        shippingCost: shippingCost || undefined,
        prepCost: prepCost || undefined,
        notes: notes || undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
        boxes: boxes.filter((b) => b.boxTypeId && b.quantity).map((b) => ({ boxTypeId: b.boxTypeId, quantity: Number(b.quantity) })),
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create shipment.");
      return;
    }

    const { shipment } = await res.json();
    router.push(`/shipments/${shipment.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-title">New shipment</div>
      <div className="card-subtitle">
        Creating a shipment consumes product inventory (FIFO) and box stock immediately. If stock is insufficient
        for any line, nothing is created.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label>Reference (required)</label>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. SHP-2044" />
        </div>
        <div className="form-field">
          <label>Destination type</label>
          <select value={destinationType} onChange={(e) => setDestinationType(e.target.value)}>
            <option value="AMAZON_FBA">Amazon FBA</option>
            <option value="CUSTOMER_DIRECT">Customer direct</option>
            <option value="THIRD_PARTY_WAREHOUSE">Third-party warehouse</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="form-field">
          <label>Destination name</label>
          <input value={destinationName} onChange={(e) => setDestinationName(e.target.value)} placeholder="e.g. Amazon ONT8" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <div className="form-field">
          <label>Carrier</label>
          <input value={carrier} onChange={(e) => setCarrier(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Tracking #</label>
          <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Ship date</label>
          <input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Shipping cost</label>
          <input type="number" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} placeholder="$ — leave blank if unknown" />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div className="card-title" style={{ fontSize: 13 }}>
          Products
        </div>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, marginBottom: 8 }}>
            <select value={item.productId} onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, productId: e.target.value } : it)))}>
              <option value="">Product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Qty"
              type="number"
              value={item.quantity}
              onChange={(e) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: e.target.value } : it)))}
            />
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
        <button type="button" className="button-secondary" onClick={() => setItems((prev) => [...prev, { productId: "", quantity: "" }])}>
          + Add product
        </button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div className="card-title" style={{ fontSize: 13 }}>
          Boxes used (optional)
        </div>
        {boxes.map((box, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, marginBottom: 8 }}>
            <select value={box.boxTypeId} onChange={(e) => setBoxes((prev) => prev.map((b, i) => (i === idx ? { ...b, boxTypeId: e.target.value } : b)))}>
              <option value="">Box type…</option>
              {boxTypes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Qty"
              type="number"
              value={box.quantity}
              onChange={(e) => setBoxes((prev) => prev.map((b, i) => (i === idx ? { ...b, quantity: e.target.value } : b)))}
            />
            <button type="button" className="button-secondary" onClick={() => setBoxes((prev) => prev.filter((_, i) => i !== idx))}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="button-secondary" onClick={() => setBoxes((prev) => [...prev, { boxTypeId: "", quantity: "" }])}>
          + Add box
        </button>
      </div>

      <div className="form-field">
        <label>Prep cost</label>
        <input type="number" value={prepCost} onChange={(e) => setPrepCost(e.target.value)} placeholder="$" />
      </div>
      <div className="form-field">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      {error && <div className="auth-error">{error}</div>}
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Creating…" : "Create shipment"}
      </button>
    </form>
  );
}
