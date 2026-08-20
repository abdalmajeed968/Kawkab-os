"use client";

import { useState, useEffect } from "react";

interface ProductPerf {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: { value: number; isComplete: boolean };
  averageSellingPrice: number | null;
  fees: number;
  cogs: { value: number; isComplete: boolean };
  profit: { value: number; isComplete: boolean };
  margin: number | null;
  roi: number | null;
  incompleteItemCount: number;
}
interface TimeSeriesRow {
  periodLabel: string;
  unitsSold: number;
  revenue: { value: number; isComplete: boolean };
  profit: { value: number; isComplete: boolean };
}
interface MarketplaceRow {
  marketplaceName: string;
  unitsSold: number;
  revenue: { value: number; isComplete: boolean };
}

export function SalesReportsSection() {
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
  const [productPerformance, setProductPerformance] = useState<ProductPerf[] | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesRow[] | null>(null);
  const [marketplaceSales, setMarketplaceSales] = useState<MarketplaceRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/sales?granularity=${granularity}`)
      .then((r) => r.json())
      .then((d) => {
        setProductPerformance(d.productPerformance ?? []);
        setTimeSeries(d.timeSeries ?? []);
        setMarketplaceSales(d.marketplaceSales ?? []);
      })
      .finally(() => setLoading(false));
  }, [granularity]);

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            Sales &amp; profitability
          </div>
          <select value={granularity} onChange={(e) => setGranularity(e.target.value as typeof granularity)}>
            <option value="day">By day</option>
            <option value="week">By week</option>
            <option value="month">By month</option>
          </select>
        </div>
        <div className="card-subtitle">
          Last 30 days. Revenue prefers imported financial events over the sales-report price once both exist — see
          ARCHITECTURE.md's revenue source-of-truth rule. Incomplete figures are shown as such, never as $0.
        </div>
        {loading || !timeSeries ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">Loading…</span>
          </div>
        ) : timeSeries.every((r) => r.unitsSold === 0) ? (
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
                <th>Profit</th>
              </tr>
            </thead>
            <tbody>
              {timeSeries.map((row) => (
                <tr key={row.periodLabel}>
                  <td>{row.periodLabel}</td>
                  <td>{row.unitsSold}</td>
                  <td style={{ color: row.revenue.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                    {row.revenue.isComplete ? `$${row.revenue.value.toFixed(2)}` : "Incomplete"}
                  </td>
                  <td style={{ color: row.profit.isComplete ? "var(--kw-status-profit)" : "var(--kw-status-warning)" }}>
                    {row.profit.isComplete ? `$${row.profit.value.toFixed(2)}` : "Incomplete"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">Product performance</div>
        {!productPerformance || productPerformance.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No sales imported yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Units sold</th>
                <th>Avg. price</th>
                <th>Revenue</th>
                <th>COGS</th>
                <th>Profit</th>
                <th>Margin</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>
              {productPerformance.map((p) => (
                <tr key={p.productId}>
                  <td>
                    <a href={`/products/${p.productId}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {p.productName}
                    </a>
                    {p.incompleteItemCount > 0 && (
                      <span className="widget-placeholder-tag" style={{ marginLeft: 6 }}>
                        {p.incompleteItemCount} incomplete
                      </span>
                    )}
                  </td>
                  <td>{p.unitsSold}</td>
                  <td>{p.averageSellingPrice !== null ? `$${p.averageSellingPrice.toFixed(2)}` : "—"}</td>
                  <td style={{ color: p.revenue.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                    {p.revenue.isComplete ? `$${p.revenue.value.toFixed(2)}` : "Incomplete"}
                  </td>
                  <td style={{ color: p.cogs.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                    {p.cogs.isComplete ? `$${p.cogs.value.toFixed(2)}` : "Incomplete"}
                  </td>
                  <td style={{ color: p.profit.isComplete ? "var(--kw-status-profit)" : "var(--kw-status-warning)" }}>
                    {p.profit.isComplete ? `$${p.profit.value.toFixed(2)}` : "Incomplete"}
                  </td>
                  <td>{p.margin !== null ? `${(p.margin * 100).toFixed(1)}%` : "—"}</td>
                  <td>{p.roi !== null ? `${(p.roi * 100).toFixed(1)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {marketplaceSales && marketplaceSales.length > 0 && (
        <div className="card">
          <div className="card-title">Sales by marketplace</div>
          <table>
            <thead>
              <tr>
                <th>Marketplace</th>
                <th>Units sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {marketplaceSales.map((m) => (
                <tr key={m.marketplaceName}>
                  <td>{m.marketplaceName}</td>
                  <td>{m.unitsSold}</td>
                  <td style={{ color: m.revenue.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                    {m.revenue.isComplete ? `$${m.revenue.value.toFixed(2)}` : "Incomplete"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
