import { getAvailableBatches, getInventoryOnHand, listConsumptionEvents } from "@/lib/inventory";
import { RecordConsumptionForm } from "@/components/inventory/RecordConsumptionForm";
import { ReverseConsumptionButton } from "@/components/inventory/ReverseConsumptionButton";

export async function InventoryPanel({ productId }: { productId: string }) {
  const [batches, onHand, events] = await Promise.all([
    getAvailableBatches(productId),
    getInventoryOnHand(productId),
    listConsumptionEvents(productId),
  ]);

  const reversedEventIds = new Set(events.filter((e) => e.reversesEventId).map((e) => e.reversesEventId));

  return (
    <div className="card" id="inventory">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="card-title" style={{ marginBottom: 0 }}>
          Inventory
        </div>
        <div className="kpi-value" style={{ fontSize: 20 }}>
          {onHand} <span style={{ fontSize: 11, color: "var(--kw-text-muted)", fontFamily: "var(--kw-font-sans)" }}>on hand</span>
        </div>
      </div>
      <div className="card-subtitle">FIFO batches, oldest first. Consumed quantity is never overwritten — reversals net against it.</div>

      {batches.length === 0 ? (
        <div className="widget-placeholder">
          <span className="widget-placeholder-tag">No inventory available</span>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Purchase date</th>
              <th>Received</th>
              <th>Available</th>
              <th>Unit cost</th>
              <th>Landed unit cost</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.purchaseItemId}>
                <td>
                  <a href={`/purchases/${b.purchaseId}`} style={{ color: "var(--kw-accent-primary)" }}>
                    {new Date(b.purchaseDate).toLocaleDateString()}
                  </a>
                </td>
                <td>{b.quantityReceived}</td>
                <td>{b.quantityAvailable}</td>
                <td>${b.unitPurchaseCost.toFixed(2)}</td>
                <td style={{ color: b.landedUnitCost.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                  {b.landedUnitCost.isComplete ? `$${b.landedUnitCost.value.toFixed(2)}` : "Incomplete"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <RecordConsumptionForm productId={productId} />
      </div>

      {events.length > 0 && (
        <>
          <div className="card-title" style={{ fontSize: 13 }}>
            Consumption history
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events
                .filter((e) => e.type !== "REVERSAL")
                .map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.eventDate).toLocaleDateString()}</td>
                    <td>{e.type.replaceAll("_", " ")}</td>
                    <td>{e.quantity}</td>
                    <td style={{ color: "var(--kw-text-muted)" }}>{e.notes ?? "—"}</td>
                    <td>
                      <ReverseConsumptionButton eventId={e.id} alreadyReversed={reversedEventIds.has(e.id)} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
