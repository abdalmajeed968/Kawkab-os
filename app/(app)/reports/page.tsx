import {
  getInventoryReport,
  getInventoryValuationReport,
  getPurchasesReport,
  getSupplierSpendReport,
  getMissingDataReport,
  getProductStatusReport,
  getShipmentStatusReport,
  getDataCompletenessReport,
} from "@/lib/reports";
import { getSessionUser } from "@/lib/session";
import { SalesReportsSection } from "@/components/reports/SalesReportsSection";

export default async function ReportsPage() {
  await getSessionUser();

  const [inventory, valuation, purchases, supplierSpend, missingData, productStatus, shipmentStatus, completeness] = await Promise.all([
    getInventoryReport(),
    getInventoryValuationReport(),
    getPurchasesReport(),
    getSupplierSpendReport(),
    getMissingDataReport(),
    getProductStatusReport(),
    getShipmentStatusReport(),
    getDataCompletenessReport(),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: "var(--kw-text-secondary)", fontSize: 13, maxWidth: 680, margin: 0 }}>
        Every figure below is calculated live from the same records Purchases, Inventory, and Finance use — not a
        separate copy. Amazon-derived reports (sales, returns by reason, shipment cost reconciled against Amazon
        fees) aren't shown because that data doesn't exist yet.
      </p>

      <div className="dashboard-grid">
        <div className="kpi-card span-1">
          <div className="kpi-label">Data completeness — Purchases</div>
          <div className="kpi-value">
            {completeness.purchases.complete}/{completeness.purchases.total}
          </div>
        </div>
        <div className="kpi-card span-1">
          <div className="kpi-label">Data completeness — Shipments</div>
          <div className="kpi-value">
            {completeness.shipments.complete}/{completeness.shipments.total}
          </div>
        </div>
        <div className="kpi-card span-1">
          <div className="kpi-label">Average product data health</div>
          <div className="kpi-value">{completeness.products.avgHealthPercent ?? "—"}%</div>
        </div>
        <div className="kpi-card span-1">
          <div className="kpi-label">Inventory valuation</div>
          <div className="kpi-value" style={{ color: valuation.incompleteCount === 0 ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
            ${valuation.totalValue.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Inventory</div>
        {inventory.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No inventory on hand</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>On hand</th>
                <th>Batches</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((r) => (
                <tr key={r.productId}>
                  <td>
                    <a href={`/products/${r.productId}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {r.productName}
                    </a>
                  </td>
                  <td>{r.quantityOnHand}</td>
                  <td>{r.batchCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="card span-2">
          <div className="card-title">Purchases</div>
          <div style={{ display: "flex", gap: 24, fontSize: 13, marginBottom: 12 }}>
            <div>
              <span style={{ color: "var(--kw-text-muted)" }}>Total spend: </span>${purchases.totalSpend.toFixed(2)}
            </div>
            <div>
              <span style={{ color: "var(--kw-text-muted)" }}>Complete: </span>
              {purchases.completeCount}
            </div>
            <div>
              <span style={{ color: "var(--kw-status-warning)" }}>Incomplete: </span>
              {purchases.incompleteCount}
            </div>
            <div>
              <span style={{ color: "var(--kw-status-critical)" }}>Missing invoice: </span>
              {purchases.missingInvoiceCount}
            </div>
          </div>
        </div>
        <div className="card span-2">
          <div className="card-title">Product status</div>
          <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
            <div>Active: {productStatus.counts.ACTIVE}</div>
            <div>Paused: {productStatus.counts.PAUSED}</div>
            <div>Archived: {productStatus.counts.ARCHIVED}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Supplier spend</div>
        {supplierSpend.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No purchases yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Purchases</th>
                <th>Total spend</th>
              </tr>
            </thead>
            <tbody>
              {supplierSpend.map((s) => (
                <tr key={s.supplierId}>
                  <td>
                    <a href={`/suppliers/${s.supplierId}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {s.supplierName}
                    </a>
                  </td>
                  <td>{s.purchaseCount}</td>
                  <td>${s.totalSpend.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">Missing data</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
          {missingData.purchasesMissingInvoice.length === 0 && missingData.purchasesMissingCost.length === 0 && missingData.productsIncomplete.length === 0 ? (
            <span style={{ color: "var(--kw-status-profit)" }}>No missing data found.</span>
          ) : (
            <>
              {missingData.purchasesMissingInvoice.map((p) => (
                <div key={p.id}>
                  <a href={`/purchases/${p.id}`} style={{ color: "var(--kw-status-critical)" }}>
                    Missing invoice — {p.supplier.name}, {p.purchaseDate.toLocaleDateString()}
                  </a>
                </div>
              ))}
              {missingData.purchasesMissingCost.map((p) => (
                <div key={p.id}>
                  <a href={`/purchases/${p.id}`} style={{ color: "var(--kw-status-warning)" }}>
                    Missing cost data — {p.supplier.name}, {p.purchaseDate.toLocaleDateString()}
                  </a>
                </div>
              ))}
              {missingData.productsIncomplete.map(({ product, health }) => (
                <div key={product.id}>
                  <a href={`/products/${product.id}`} style={{ color: "var(--kw-status-warning)" }}>
                    {product.name} — {health.percent}% complete
                  </a>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Shipment status</div>
        <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
          {Object.entries(shipmentStatus.counts).map(([status, count]) => (
            <div key={status}>
              {status.replaceAll("_", " ")}: {count}
            </div>
          ))}
          {shipmentStatus.total === 0 && <span style={{ color: "var(--kw-text-muted)" }}>No shipments yet</span>}
        </div>
      </div>

      <SalesReportsSection />
    </div>
  );
}
