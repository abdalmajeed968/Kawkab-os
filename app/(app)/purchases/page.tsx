import { listPurchases } from "@/lib/purchases";
import { NewPurchaseForm } from "@/components/purchases/NewPurchaseForm";
import { getSessionUser } from "@/lib/session";

export default async function PurchasesPage() {
  await getSessionUser();

  const purchases = await listPurchases();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <NewPurchaseForm />

      <div className="card">
        <div className="card-title">All purchases</div>
        {purchases.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No purchases yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Supplier</th>
                <th>Invoice #</th>
                <th>Total</th>
                <th>Completeness</th>
                <th>Verification</th>
                <th>Documents</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a href={`/purchases/${p.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {p.purchaseDate.toLocaleDateString()}
                    </a>
                  </td>
                  <td>{p.supplier.name}</td>
                  <td>{p.invoiceNumber}</td>
                  <td>${Number(p.invoiceTotal).toFixed(2)}</td>
                  <td>
                    {p.documents.length === 0 ? (
                      <span style={{ color: "var(--kw-status-critical)", fontWeight: 600 }}>
                        <span className="status-dot status-critical" />
                        MISSING INVOICE
                      </span>
                    ) : (
                      <span>
                        <span
                          className="status-dot"
                          style={{
                            background: p.completenessStatus === "COMPLETE" ? "var(--kw-status-profit)" : "var(--kw-status-warning)",
                          }}
                        />
                        {p.completenessStatus}
                      </span>
                    )}
                  </td>
                  <td>{p.verificationStatus.replaceAll("_", " ")}</td>
                  <td>{p.documents.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
