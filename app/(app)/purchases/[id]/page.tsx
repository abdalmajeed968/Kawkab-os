import { notFound } from "next/navigation";
import { getPurchase } from "@/lib/purchases";
import { getEntityAuditTrail } from "@/lib/audit";
import { CorrectPurchaseForm } from "@/components/purchases/CorrectPurchaseForm";
import { EntityDocumentUploadForm } from "@/components/documents/EntityDocumentUploadForm";
import { VerifyDocumentButton } from "@/components/purchases/VerifyDocumentButton";
import { Timeline } from "@/components/products/Timeline";
import { getSessionUser } from "@/lib/session";

export default async function PurchaseDetailPage({ params }: { params: { id: string } }) {
  await getSessionUser();

  let result;
  try {
    result = await getPurchase(params.id);
  } catch {
    notFound();
  }
  const { purchase, landedCosts, completenessReasons } = result;
  const timeline = await getEntityAuditTrail("Purchase", purchase.id);
  const missingDocument = purchase.documents.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {missingDocument && (
        <div
          className="card"
          style={{ borderColor: "var(--kw-status-critical)", background: "rgba(239, 68, 68, 0.06)" }}
        >
          <div style={{ color: "var(--kw-status-critical)", fontWeight: 600, fontSize: 13 }}>
            INCOMPLETE — MISSING INVOICE DOCUMENT
          </div>
          <div style={{ fontSize: 13, color: "var(--kw-text-secondary)", marginTop: 4 }}>
            This purchase has an invoice number but no uploaded document yet. Attach it below to resolve this.
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div className="card-title" style={{ fontSize: 18 }}>
              {purchase.supplier.name} — {purchase.purchaseDate.toLocaleDateString()}
            </div>
            <div className="card-subtitle">
              Invoice {purchase.invoiceNumber} · ${Number(purchase.invoiceTotal).toFixed(2)}
            </div>
          </div>
          <span
            className="badge badge-phase"
            style={{ color: purchase.completenessStatus === "COMPLETE" ? "var(--kw-status-profit)" : "var(--kw-status-warning)" }}
          >
            {purchase.completenessStatus}
          </span>
        </div>
        {completenessReasons.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--kw-text-muted)" }}>
            {completenessReasons.join(" · ")}
          </div>
        )}
        <CorrectPurchaseForm
          purchaseId={purchase.id}
          purchase={{
            supplierShipping: purchase.supplierShipping,
            localShipping: purchase.localShipping,
            prepCost: purchase.prepCost,
            packagingCost: purchase.packagingCost,
            otherCost: purchase.otherCost,
            tax: purchase.tax,
            discount: purchase.discount,
            invoiceTotal: purchase.invoiceTotal,
          }}
        />
      </div>

      <div className="card">
        <div className="card-title">Line items &amp; landed cost</div>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Line cost</th>
              <th>Unit purchase cost</th>
              <th>Landed unit cost</th>
            </tr>
          </thead>
          <tbody>
            {purchase.items.map((item) => {
              const landed = landedCosts.find((l) => l.purchaseItemId === item.id);
              return (
                <tr key={item.id}>
                  <td>
                    <a href={`/products/${item.productId}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {item.product.name}
                    </a>
                  </td>
                  <td>{item.quantity}</td>
                  <td>${Number(item.lineItemCost).toFixed(2)}</td>
                  <td>${landed ? landed.unitPurchaseCost.toFixed(2) : "—"}</td>
                  <td style={{ color: landed?.landedUnitCost.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                    {landed?.landedUnitCost.isComplete
                      ? `$${landed.landedUnitCost.value.toFixed(2)}`
                      : `Incomplete${landed?.landedUnitCost.reason ? ` — ${landed.landedUnitCost.reason}` : ""}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Invoice / receipt</div>
        {purchase.documents.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--kw-text-muted)", marginBottom: 12 }}>Nothing uploaded yet.</div>
        ) : (
          <table style={{ marginBottom: 12 }}>
            <tbody>
              {purchase.documents.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a href={`/api/documents/file/${encodeURIComponent(d.document.storageKey)}`} target="_blank" rel="noreferrer">
                      {d.document.originalFilename}
                    </a>
                  </td>
                  <td>
                    <VerifyDocumentButton documentId={d.document.id} alreadyVerified={d.document.verificationStatus === "VERIFIED"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <EntityDocumentUploadForm uploadUrl={`/api/purchases/${purchase.id}/documents`} />
      </div>

      <Timeline entries={timeline} />
    </div>
  );
}
