import { prisma } from "@/lib/prisma";
import { computeSaleItemProfit } from "@/lib/finance";

function Cell({ value, isComplete, format }: { value: number; isComplete: boolean; format: (n: number) => string }) {
  if (!isComplete) return <span style={{ color: "var(--kw-status-warning)" }}>Incomplete</span>;
  return <span>{format(value)}</span>;
}
const money = (n: number) => `$${n.toFixed(2)}`;

export async function ProductPerformancePanel({ productId }: { productId: string }) {
  const saleItems = await prisma.saleItem.findMany({
    where: { productId },
    include: { sale: true },
    orderBy: { sale: { saleDate: "desc" } },
  });

  if (saleItems.length === 0) {
    return (
      <div className="card span-2" id="performance">
        <div className="card-title">Sales performance</div>
        <div className="widget-placeholder">
          <span className="widget-placeholder-tag">No Amazon sales imported for this product yet</span>
        </div>
      </div>
    );
  }

  let unitsSold = 0;
  let revenue = 0;
  let fees = 0;
  let cogs = 0;
  let profit = 0;
  let incompleteCount = 0;

  const rows = [];
  for (const item of saleItems) {
    const p = await computeSaleItemProfit(item.id);
    unitsSold += item.quantity;
    revenue += p.revenue.value;
    fees += p.fees.referral + p.fees.fbaFulfillment + p.fees.other;
    cogs += p.cogs.value;
    profit += p.profit.value;
    if (!p.isFullyComplete) incompleteCount++;
    rows.push({ item, profit: p });
  }

  const avgSellingPrice = unitsSold > 0 ? revenue / unitsSold : null;
  const margin = revenue !== 0 ? profit / revenue : null;
  const roi = cogs !== 0 ? profit / cogs : null;
  const isComplete = incompleteCount === 0;

  return (
    <div className="card span-2" id="performance">
      <div className="card-title">Sales performance</div>
      <div className="card-subtitle">From imported Amazon sales/finance data — real, not estimated.</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--kw-text-muted)" }}>Units sold</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>{unitsSold}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--kw-text-muted)" }}>Avg. selling price</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>{avgSellingPrice !== null ? money(avgSellingPrice) : "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--kw-text-muted)" }}>Revenue</div>
          <div className="kpi-value" style={{ fontSize: 18, color: isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
            {isComplete ? money(revenue) : "Incomplete"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--kw-text-muted)" }}>Profit</div>
          <div className="kpi-value" style={{ fontSize: 18, color: isComplete ? "var(--kw-status-profit)" : "var(--kw-status-warning)" }}>
            {isComplete ? money(profit) : "Incomplete"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, fontSize: 13, marginBottom: 16 }}>
        <div>
          <span style={{ color: "var(--kw-text-muted)" }}>Amazon fees: </span>
          {money(fees)}
        </div>
        <div>
          <span style={{ color: "var(--kw-text-muted)" }}>COGS: </span>
          <Cell value={cogs} isComplete={isComplete} format={money} />
        </div>
        <div>
          <span style={{ color: "var(--kw-text-muted)" }}>Margin: </span>
          {margin !== null ? `${(margin * 100).toFixed(1)}%` : "—"}
        </div>
        <div>
          <span style={{ color: "var(--kw-text-muted)" }}>ROI: </span>
          {roi !== null ? `${(roi * 100).toFixed(1)}%` : "—"}
        </div>
      </div>

      <div className="card-title" style={{ fontSize: 13 }}>
        Sales history
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Qty</th>
            <th>Revenue</th>
            <th>Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map(({ item, profit: p }) => (
            <tr key={item.id}>
              <td>
                <a href={`/sales/${item.saleId}`} style={{ color: "var(--kw-accent-primary)" }}>
                  {item.sale.saleDate.toLocaleDateString()}
                </a>
              </td>
              <td>{item.quantity}</td>
              <td>
                <Cell value={p.revenue.value} isComplete={p.revenue.isComplete} format={money} />
              </td>
              <td style={{ color: p.profit.isComplete ? "var(--kw-status-profit)" : "var(--kw-status-warning)" }}>
                <Cell value={p.profit.value} isComplete={p.profit.isComplete} format={money} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 10 && (
        <div style={{ fontSize: 12, color: "var(--kw-text-muted)", marginTop: 8 }}>+{rows.length - 10} more sales</div>
      )}
    </div>
  );
}
