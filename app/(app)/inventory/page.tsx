import { listInventorySummary } from "@/lib/inventory";
import { getSessionUser } from "@/lib/session";

export default async function InventoryPage() {
  await getSessionUser();

  const rows = await listInventorySummary();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: "var(--kw-text-secondary)", fontSize: 13, maxWidth: 620, margin: 0 }}>
        On-hand quantity is computed from FIFO batches, not stored — it can never drift out of sync with the
        purchases and consumption events it's derived from. Record a sale, sample, or loss from a product's own
        page; reorder recommendations arrive in a later phase once there's real sales velocity to base them on.
      </p>

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
                <th>On hand</th>
                <th>Batches</th>
                <th>Oldest batch</th>
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
                  <td>{r.quantityOnHand}</td>
                  <td>{r.batchCount}</td>
                  <td>{r.oldestBatchDate ? new Date(r.oldestBatchDate).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
