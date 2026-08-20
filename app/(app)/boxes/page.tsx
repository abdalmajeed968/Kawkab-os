import { listBoxTypes } from "@/lib/boxes";
import { NewBoxTypeForm } from "@/components/boxes/NewBoxTypeForm";
import { getSessionUser } from "@/lib/session";

export default async function BoxesPage() {
  await getSessionUser();
  const boxTypes = await listBoxTypes();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: "var(--kw-text-secondary)", fontSize: 13, maxWidth: 620, margin: 0 }}>
        On-hand quantity is computed from a signed movement ledger, the same principle Inventory uses — never a
        stored counter that can drift. A missing unit cost on a purchase is shown as unknown, never zero.
      </p>
      <NewBoxTypeForm />
      <div className="card">
        <div className="card-title">Box types</div>
        {boxTypes.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No box types yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>On hand</th>
                <th>Last known cost</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {boxTypes.map((b) => (
                <tr key={b.id}>
                  <td>
                    <a href={`/boxes/${b.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {b.name}
                    </a>
                  </td>
                  <td>{b.status}</td>
                  <td>{b.onHand}</td>
                  <td>
                    {b.lastKnownUnitCost !== null ? (
                      `$${b.lastKnownUnitCost.toFixed(2)}`
                    ) : b.hasIncompleteCostMovement ? (
                      <span style={{ color: "var(--kw-status-warning)" }}>Unknown</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {b.isLowStock ? <span className="pill pill-restricted">Low stock</span> : <span className="pill pill-open">OK</span>}
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
