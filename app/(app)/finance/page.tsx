import { getFinanceSummary, getProductCostBreakdown } from "@/lib/finance";
import { getSessionUser } from "@/lib/session";

export default async function FinancePage() {
  await getSessionUser();
  const [summary, productCosts] = await Promise.all([getFinanceSummary(), getProductCostBreakdown()]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: "var(--kw-text-secondary)", fontSize: 13, maxWidth: 680, margin: 0 }}>
        Everything below is calculated from real KAWKAB data — purchases, inventory cost basis, box spend. Revenue,
        Amazon fees, payouts, settlements, and profit/ROI are not shown because that data doesn't exist yet; nothing
        here is a placeholder for it.
      </p>

      <div className="dashboard-grid">
        <div className="kpi-card span-1">
          <div className="kpi-label">Total purchase spend</div>
          <div className="kpi-value">${summary.totalPurchaseSpend.toFixed(2)}</div>
        </div>
        <div className="kpi-card span-1">
          <div className="kpi-label">Complete / incomplete purchases</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>
            {summary.completePurchaseCount} / {summary.incompletePurchaseCount}
          </div>
        </div>
        <div className="kpi-card span-1">
          <div className="kpi-label">Inventory cost basis</div>
          <div className="kpi-value" style={{ color: summary.totalInventoryCostBasis.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
            ${summary.totalInventoryCostBasis.value.toFixed(2)}
            {!summary.totalInventoryCostBasis.isComplete && (
              <span style={{ fontSize: 11, display: "block", color: "var(--kw-status-warning)" }}>
                {summary.totalInventoryCostBasis.incompleteBatchCount} batch(es) missing cost data
              </span>
            )}
          </div>
        </div>
        <div className="kpi-card span-1">
          <div className="kpi-label">Box/packaging spend</div>
          <div className="kpi-value" style={{ color: summary.totalBoxSpend.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
            ${summary.totalBoxSpend.value.toFixed(2)}
            {!summary.totalBoxSpend.isComplete && (
              <span style={{ fontSize: 11, display: "block", color: "var(--kw-status-warning)" }}>
                {summary.totalBoxSpend.incompleteMovementCount} purchase(s) missing unit cost
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card span-2">
          <div className="card-title">Revenue &amp; net profit</div>
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">Not available until Amazon integration exists</span>
          </div>
        </div>
        <div className="card span-2">
          <div className="card-title">Amazon fees, payouts &amp; settlements</div>
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">Not available until Amazon integration exists</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Supplier spend</div>
        {summary.supplierSpend.length === 0 ? (
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
              {summary.supplierSpend.map((s) => (
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
        <div className="card-title">Product cost basis</div>
        <div className="card-subtitle">Units currently on hand, valued at their FIFO purchase cost.</div>
        {productCosts.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No inventory on hand</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Units on hand</th>
                <th>Unit cost</th>
                <th>Cost basis</th>
              </tr>
            </thead>
            <tbody>
              {productCosts.map((p) => (
                <tr key={p.productId}>
                  <td>
                    <a href={`/products/${p.productId}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {p.productName}
                    </a>
                  </td>
                  <td>{p.unitsOnHand}</td>
                  <td style={{ color: p.landedUnitCost.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                    ${p.landedUnitCost.value.toFixed(2)}
                  </td>
                  <td>${p.costBasis.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
