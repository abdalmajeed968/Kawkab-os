import { listShipments } from "@/lib/shipments";
import { NewShipmentForm } from "@/components/shipments/NewShipmentForm";
import { getSessionUser } from "@/lib/session";

export default async function ShipmentsPage() {
  await getSessionUser();
  const shipments = await listShipments();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <NewShipmentForm />
      <div className="card">
        <div className="card-title">All shipments</div>
        {shipments.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No shipments yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Products</th>
                <th>Boxes</th>
                <th>Completeness</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td>
                    <a href={`/shipments/${s.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {s.reference}
                    </a>
                  </td>
                  <td>
                    {s.destinationType.replaceAll("_", " ")}
                    {s.destinationName ? ` — ${s.destinationName}` : ""}
                  </td>
                  <td>{s.status}</td>
                  <td>{s.items.length}</td>
                  <td>{s.boxes.length}</td>
                  <td>
                    <span
                      className="status-dot"
                      style={{ background: s.completenessStatus === "COMPLETE" ? "var(--kw-status-profit)" : "var(--kw-status-warning)" }}
                    />
                    {s.completenessStatus}
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
