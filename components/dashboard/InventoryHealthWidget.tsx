import { listInventorySummary } from "@/lib/inventory";

export async function InventoryHealthWidget() {
  const rows = await listInventorySummary();
  const totalUnits = rows.reduce((sum, r) => sum + r.quantityOnHand, 0);
  const productsWithStock = rows.length;

  return (
    <div className="card span-2">
      <div className="card-title">Inventory health</div>
      <div className="card-subtitle">Stock levels are real; days-of-cover needs Amazon sales velocity, not available yet.</div>
      <div style={{ display: "flex", gap: 32 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>Units on hand</div>
          <div className="kpi-value">{totalUnits}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>Products with stock</div>
          <div className="kpi-value">{productsWithStock}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>Days of cover</div>
          <div className="kpi-value-placeholder">Waiting for Amazon</div>
        </div>
      </div>
    </div>
  );
}
