import { listInventorySummary } from "@/lib/inventory";
import { getSessionUser } from "@/lib/session";

export default async function InventoryPage() {
  await getSessionUser();

  const rows = await listInventorySummary();
  const totalValue = rows.reduce((sum, r) => sum + r.inventoryValue.value, 0);
  const allComplete = rows.every((r) => r.inventoryValue.isComplete);
  const totalUnits = rows.reduce((sum, r) => sum + r.quantityOnHand, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: "var(--kw-text-secondary)", fontSize: 13, maxWidth: 620, margin: 0 }}>
        On-hand quantity and value are computed from FIFO batches, not stored — they can never drift out of sync with
        the purchases and consumption events they're derived from.
      </p>

      <div className="dashboard-grid">
        <div className="kpi-card span-1">
          <div className="kpi-label">Products in stock</div>
          <div className="kpi-value">{rows.length}</div>
        </div>
        <div className="kpi-card span-1">
          <div className="kpi-label">Units on hand</div>
          <div className="kpi-value">{totalUnits}</div>
        </div>
        <div className="kpi-card span-2">
          <div className="kpi-label">Inventory value / capital tied up</div>
          <div className="kpi-value" style={{ color: allComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
            {allComplete ? `$${totalValue.toFixed(2)}` : `~$${totalValue.toFixed(2)} (incomplete)`}
          </div>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No inventory recorded yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Fulfillment</th>
                <th>On hand</th>
                <th>Batches</th>
                <th>Oldest batch</th>
                <th>Inventory value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId}>
                  <td>
                    <a href={`/products/${r.productId}#inventory`} style={{ color: "var(--kw-accent-primary)" }}>
                      {r.productName}
                    </a>
                  </td>
                  <td>{r.fulfillmentType}</td>
                  <td>{r.quantityOnHand}</td>
                  <td>{r.batchCount}</td>
                  <td>{r.oldestBatchDate ? new Date(r.oldestBatchDate).toLocaleDateString() : "—"}</td>
                  <td style={{ color: r.inventoryValue.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                    {r.inventoryValue.isComplete ? `$${r.inventoryValue.value.toFixed(2)}` : "Incomplete"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
