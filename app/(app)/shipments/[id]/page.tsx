import { notFound } from "next/navigation";
import { getShipment } from "@/lib/shipments";
import { getEntityAuditTrail } from "@/lib/audit";
import { ShipmentStatusControl } from "@/components/shipments/ShipmentStatusControl";
import { CancelShipmentButton } from "@/components/shipments/CancelShipmentButton";
import { EntityDocumentUploadForm } from "@/components/documents/EntityDocumentUploadForm";
import { Timeline } from "@/components/products/Timeline";
import { getSessionUser } from "@/lib/session";

export default async function ShipmentDetailPage({ params }: { params: { id: string } }) {
  await getSessionUser();

  let shipment;
  try {
    shipment = await getShipment(params.id);
  } catch {
    notFound();
  }
  const timeline = await getEntityAuditTrail("Shipment", shipment.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="card-title" style={{ fontSize: 18 }}>
              {shipment.reference}
            </div>
            <div className="card-subtitle">
              {shipment.destinationType.replaceAll("_", " ")}
              {shipment.destinationName ? ` — ${shipment.destinationName}` : ""}
              {shipment.carrier ? ` · ${shipment.carrier}` : ""}
              {shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ""}
            </div>
          </div>
          <ShipmentStatusControl shipmentId={shipment.id} currentStatus={shipment.status} />
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 13 }}>
          <div>
            <span style={{ color: "var(--kw-text-muted)" }}>Shipping cost: </span>
            {shipment.shippingCost !== null ? `$${Number(shipment.shippingCost).toFixed(2)}` : <span style={{ color: "var(--kw-status-warning)" }}>Unknown</span>}
          </div>
          <div>
            <span style={{ color: "var(--kw-text-muted)" }}>Completeness: </span>
            {shipment.completenessStatus}
          </div>
        </div>
        {shipment.notes && <div style={{ fontSize: 13, color: "var(--kw-text-secondary)", marginTop: 8 }}>{shipment.notes}</div>}
        <div style={{ marginTop: 12 }}>
          <CancelShipmentButton shipmentId={shipment.id} currentStatus={shipment.status} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Products</div>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {shipment.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <a href={`/products/${item.productId}`} style={{ color: "var(--kw-accent-primary)" }}>
                    {item.product.name}
                  </a>
                </td>
                <td>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shipment.boxes.length > 0 && (
        <div className="card">
          <div className="card-title">Boxes used</div>
          <table>
            <thead>
              <tr>
                <th>Box type</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {shipment.boxes.map((b) => (
                <tr key={b.id}>
                  <td>
                    <a href={`/boxes/${b.boxTypeId}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {b.boxType.name}
                    </a>
                  </td>
                  <td>{b.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-title">Documents</div>
        {shipment.documents.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--kw-text-muted)", marginBottom: 12 }}>Nothing uploaded yet.</div>
        ) : (
          <table style={{ marginBottom: 12 }}>
            <tbody>
              {shipment.documents.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a href={`/api/documents/file/${encodeURIComponent(d.document.storageKey)}`} target="_blank" rel="noreferrer">
                      {d.document.originalFilename}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <EntityDocumentUploadForm uploadUrl={`/api/shipments/${shipment.id}/documents`} />
      </div>

      <Timeline entries={timeline} />
    </div>
  );
}
