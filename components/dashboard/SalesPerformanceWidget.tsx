import { getStandardPeriodPerformance } from "@/lib/finance";

function Cell({ value, isComplete, format }: { value: number; isComplete: boolean; format: (n: number) => string }) {
  if (!isComplete) {
    return <span style={{ color: "var(--kw-status-warning)" }}>Incomplete</span>;
  }
  return <span>{format(value)}</span>;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export async function SalesPerformanceWidget() {
  const { today, last7, last30, thisMonth } = await getStandardPeriodPerformance();
  const periods = [today, last7, last30, thisMonth];
  const hasAnySales = periods.some((p) => p.totalItemCount > 0);

  return (
    <div className="card span-3">
      <div className="card-title">Profit &amp; cash flow</div>
      <div className="card-subtitle">
        From imported Amazon sales/finance data. Revenue prefers imported financial events over the sales-report
        price once both exist. Incomplete figures are shown as such, never as $0.
      </div>
      {!hasAnySales ? (
        <div className="widget-placeholder">
          <span className="widget-placeholder-tag">No sales imported yet</span>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Units sold</th>
              <th>Revenue</th>
              <th>Amazon fees</th>
              <th>COGS</th>
              <th>Profit</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.periodLabel}>
                <td>{p.periodLabel}</td>
                <td>{p.unitsSold}</td>
                <td>
                  <Cell value={p.revenue.value} isComplete={p.revenue.isComplete} format={money} />
                </td>
                <td>{money(p.fees)}</td>
                <td>
                  <Cell value={p.cogs.value} isComplete={p.cogs.isComplete} format={money} />
                </td>
                <td style={{ color: p.profit.isComplete ? "var(--kw-status-profit)" : undefined }}>
                  <Cell value={p.profit.value} isComplete={p.profit.isComplete} format={money} />
                </td>
                <td>{p.margin !== null ? `${(p.margin * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
