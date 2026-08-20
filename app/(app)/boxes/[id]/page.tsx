import { notFound } from "next/navigation";
import { getBoxType } from "@/lib/boxes";
import { getEntityAuditTrail } from "@/lib/audit";
import { RecordBoxPurchaseForm } from "@/components/boxes/RecordBoxPurchaseForm";
import { RecordBoxConsumptionForm } from "@/components/boxes/RecordBoxConsumptionForm";
import { ReverseBoxMovementButton } from "@/components/boxes/ReverseBoxMovementButton";
import { EntityDocumentUploadForm } from "@/components/documents/EntityDocumentUploadForm";
import { Timeline } from "@/components/products/Timeline";
import { getSessionUser } from "@/lib/session";

export default async function BoxTypeDetailPage({ params }: { params: { id: string } }) {
  await getSessionUser();

  let result;
  try {
    result = await getBoxType(params.id);
  } catch {
    notFound();
  }
  const { boxType, onHand } = result;
  const timeline = await getEntityAuditTrail("BoxType", boxType.id);
  const reversedIds = new Set(
    boxType.movements.filter((m) => m.reversesMovementId).map((m) => m.reversesMovementId)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="card-title" style={{ fontSize: 18 }}>
              {boxType.name}
            </div>
            <div className="card-subtitle">
              {boxType.supplier?.name ?? "No supplier set"}
              {boxType.lengthCm && boxType.widthCm && boxType.heightCm && (
                <> · {Number(boxType.lengthCm)}×{Number(boxType.widthCm)}×{Number(boxType.heightCm)} cm</>
              )}
            </div>
          </div>
          <div className="kpi-value" style={{ fontSize: 22 }}>
            {onHand} <span style={{ fontSize: 11, color: "var(--kw-text-muted)", fontFamily: "var(--kw-font-sans)" }}>on hand</span>
          </div>
        </div>
        {boxType.notes && <div style={{ fontSize: 13, color: "var(--kw-text-secondary)", marginTop: 8 }}>{boxType.notes}</div>}
      </div>

      <div className="card">
        <div className="card-title">Add stock</div>
        <RecordBoxPurchaseForm boxTypeId={boxType.id} />
      </div>

      <div className="card">
        <div className="card-title">Manual adjustment</div>
        <div className="card-subtitle">Damage, loss, or any removal that isn't a shipment.</div>
        <RecordBoxConsumptionForm boxTypeId={boxType.id} />
      </div>

      <div className="card">
        <div className="card-title">Movement history</div>
        {boxType.movements.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No movements yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Unit cost</th>
                <th>Reference</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {boxType.movements.map((m) => (
                <tr key={m.id}>
                  <td>{m.createdAt.toLocaleDateString()}</td>
                  <td>{m.type.replaceAll("_", " ")}</td>
                  <td style={{ color: m.quantity < 0 ? "var(--kw-status-warning)" : "var(--kw-status-profit)" }}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td>
                    {m.type === "PURCHASE" ? (
                      m.unitCost !== null ? `$${Number(m.unitCost).toFixed(2)}` : <span style={{ color: "var(--kw-status-warning)" }}>Unknown</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{m.invoiceNumber ?? m.shipment?.reference ?? "—"}</td>
                  <td>
                    {m.type !== "REVERSAL" && (
                      <ReverseBoxMovementButton movementId={m.id} alreadyReversed={reversedIds.has(m.id)} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">Documents</div>
        {boxType.documents.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--kw-text-muted)", marginBottom: 12 }}>No receipts on file.</div>
        ) : (
          <table style={{ marginBottom: 12 }}>
            <tbody>
              {boxType.documents.map((d) => (
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
        {boxType.movements.filter((m) => m.type === "PURCHASE").length > 0 && (
          <EntityDocumentUploadForm uploadUrl={`/api/box-movements/${boxType.movements.find((m) => m.type === "PURCHASE")!.id}/documents`} />
        )}
      </div>

      <Timeline entries={timeline} />
    </div>
  );
}
