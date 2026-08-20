import { notFound } from "next/navigation";
import { getSupplier } from "@/lib/suppliers";
import { getEntityAuditTrail } from "@/lib/audit";
import { EditSupplierForm } from "@/components/suppliers/EditSupplierForm";
import { Timeline } from "@/components/products/Timeline";
import { getSessionUser } from "@/lib/session";

export default async function SupplierDetailPage({ params }: { params: { id: string } }) {
  await getSessionUser();

  let supplier;
  try {
    supplier = await getSupplier(params.id);
  } catch {
    notFound();
  }

  const timeline = await getEntityAuditTrail("Supplier", supplier.id);
  const totalSpend = supplier.purchases.reduce((sum, p) => sum + Number(p.invoiceTotal), 0);
  const productsSupplied = new Set(supplier.purchases.flatMap((p) => p.items.map((i) => i.product.name)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="card-title" style={{ fontSize: 18 }}>
              {supplier.name}
            </div>
            <div className="card-subtitle">
              {supplier.contactName ? `${supplier.contactName} · ` : ""}
              {supplier.email ?? "No email"} · {supplier.phone ?? "No phone"}
              {supplier.website && (
                <>
                  {" · "}
                  <a href={supplier.website} target="_blank" rel="noreferrer" style={{ color: "var(--kw-accent-secondary)" }}>
                    {supplier.website.replace(/^https?:\/\//, "")}
                  </a>
                </>
              )}
              {supplier.accountNumber && ` · Account: ${supplier.accountNumber}`}
              {supplier.paymentTerms && ` · Terms: ${supplier.paymentTerms}`}
            </div>
          </div>
        </div>
        {supplier.notes && <div style={{ fontSize: 13, color: "var(--kw-text-secondary)", marginTop: 8 }}>{supplier.notes}</div>}
        <div style={{ marginTop: 12 }}>
          <EditSupplierForm
            supplier={{
              id: supplier.id,
              name: supplier.name,
              contactName: supplier.contactName,
              email: supplier.email,
              phone: supplier.phone,
              website: supplier.website,
              accountNumber: supplier.accountNumber,
              paymentTerms: supplier.paymentTerms,
              notes: supplier.notes,
            }}
          />
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="kpi-card span-1">
          <div className="kpi-label">Total spend</div>
          <div className="kpi-value">${totalSpend.toFixed(2)}</div>
        </div>
        <div className="kpi-card span-1">
          <div className="kpi-label">Purchases</div>
          <div className="kpi-value">{supplier.purchases.length}</div>
        </div>
        <div className="kpi-card span-1">
          <div className="kpi-label">Products supplied</div>
          <div className="kpi-value">{productsSupplied.size}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Purchase history</div>
        {supplier.purchases.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No purchases from this supplier yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice #</th>
                <th>Total</th>
                <th>Completeness</th>
                <th>Documents</th>
              </tr>
            </thead>
            <tbody>
              {supplier.purchases.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a href={`/purchases/${p.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {p.purchaseDate.toLocaleDateString()}
                    </a>
                  </td>
                  <td>{p.invoiceNumber}</td>
                  <td>${Number(p.invoiceTotal).toFixed(2)}</td>
                  <td>{p.completenessStatus}</td>
                  <td>{p.documents.length === 0 ? <span style={{ color: "var(--kw-status-critical)" }}>Missing</span> : p.documents.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Timeline entries={timeline} />
    </div>
  );
}
