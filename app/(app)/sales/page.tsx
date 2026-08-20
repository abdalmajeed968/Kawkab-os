import { listSales } from "@/lib/sales";
import { getSessionUser } from "@/lib/session";

export default async function SalesPage() {
  await getSessionUser();
  const sales = await listSales();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: "var(--kw-text-secondary)", fontSize: 13, maxWidth: 620, margin: 0 }}>
        Sales created from imported Seller Central reports, plus any manually-entered sales.{" "}
        <a href="/imports" style={{ color: "var(--kw-accent-primary)" }}>
          Import a report
        </a>{" "}
        to bring in real Amazon orders, or review past imports and their match/error status there.
      </p>
      <div className="card">
        <div className="card-title">Sales</div>
        {sales.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">
              No sales yet —{" "}
              <a href="/imports" style={{ color: "var(--kw-accent-primary)" }}>
                import a Sales report
              </a>{" "}
              to get started
            </span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Marketplace</th>
                <th>Items</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td>
                    <a href={`/sales/${s.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {s.externalOrderId ?? s.id.slice(0, 10)}
                    </a>
                  </td>
                  <td>{s.saleDate.toLocaleDateString()}</td>
                  <td>{s.marketplace?.displayName ?? "—"}</td>
                  <td>{s.items.length}</td>
                  <td>{s.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
