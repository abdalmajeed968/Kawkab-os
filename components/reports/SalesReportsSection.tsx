"use client";

import { useState, useEffect, useMemo } from "react";

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

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type PresetKey = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";

function presetRange(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case "today":
      return { from: toDateInput(startOfToday), to: toDateInput(now) };
    case "yesterday": {
      const y = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      return { from: toDateInput(y), to: toDateInput(startOfToday) };
    }
    case "last7":
      return { from: toDateInput(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)), to: toDateInput(now) };
    case "last30":
      return { from: toDateInput(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), to: toDateInput(now) };
    case "thisMonth":
      return { from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInput(now) };
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toDateInput(start), to: toDateInput(end) };
    }
    default:
      return { from: toDateInput(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), to: toDateInput(now) };
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "custom", label: "Custom" },
];

export function SalesReportsSection() {
  const [preset, setPreset] = useState<PresetKey>("last30");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
  const [range, setRange] = useState(presetRange("last30"));
  const [productPerformance, setProductPerformance] = useState<ProductPerf[] | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesRow[] | null>(null);
  const [marketplaceSales, setMarketplaceSales] = useState<MarketplaceRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  function selectPreset(key: PresetKey) {
    setPreset(key);
    if (key !== "custom") setRange(presetRange(key));
  }

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ granularity, from: range.from, to: range.to });
    fetch(`/api/reports/sales?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setProductPerformance(d.productPerformance ?? []);
        setTimeSeries(d.timeSeries ?? []);
        setMarketplaceSales(d.marketplaceSales ?? []);
      })
      .finally(() => setLoading(false));
  }, [granularity, range.from, range.to]);

  const totals = useMemo(() => {
    if (!productPerformance) return null;
    const unitsSold = productPerformance.reduce((s, p) => s + p.unitsSold, 0);
    const revenueComplete = productPerformance.every((p) => p.revenue.isComplete);
    const revenue = productPerformance.reduce((s, p) => s + p.revenue.value, 0);
    const fees = productPerformance.reduce((s, p) => s + p.fees, 0);
    const cogsComplete = productPerformance.every((p) => p.cogs.isComplete);
    const cogs = productPerformance.reduce((s, p) => s + p.cogs.value, 0);
    const profitComplete = productPerformance.every((p) => p.profit.isComplete);
    const profit = productPerformance.reduce((s, p) => s + p.profit.value, 0);
    return { unitsSold, revenue: { value: revenue, isComplete: revenueComplete }, fees, cogs: { value: cogs, isComplete: cogsComplete }, profit: { value: profit, isComplete: profitComplete } };
  }, [productPerformance]);

  const bestSelling = useMemo(() => (productPerformance ? [...productPerformance].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5) : []), [productPerformance]);
  const mostProfitable = useMemo(
    () => (productPerformance ? [...productPerformance].filter((p) => p.profit.isComplete).sort((a, b) => b.profit.value - a.profit.value).slice(0, 5) : []),
    [productPerformance]
  );
  const losingMoney = useMemo(
    () => (productPerformance ? [...productPerformance].filter((p) => p.profit.isComplete && p.profit.value < 0).sort((a, b) => a.profit.value - b.profit.value).slice(0, 5) : []),
    [productPerformance]
  );

  return (
    <>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            Sales &amp; profitability
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={preset === p.key ? "button-primary" : "button-secondary"}
                style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={() => selectPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {preset === "custom" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            <span style={{ color: "var(--kw-text-muted)" }}>to</span>
            <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
        )}
        <div className="card-subtitle" style={{ marginTop: 8 }}>
          Revenue prefers imported financial events over the sales-report price once both exist. Incomplete figures
          are shown as such, never as $0.
        </div>

        {totals && (
          <div className="dashboard-grid" style={{ marginBottom: 16 }}>
            <div className="kpi-card span-1">
              <div className="kpi-label">Units sold</div>
              <div className="kpi-value">{totals.unitsSold}</div>
            </div>
            <div className="kpi-card span-1">
              <div className="kpi-label">Revenue</div>
              <div className="kpi-value" style={{ color: totals.revenue.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                {totals.revenue.isComplete ? `$${totals.revenue.value.toFixed(2)}` : "Incomplete"}
              </div>
            </div>
            <div className="kpi-card span-1">
              <div className="kpi-label">COGS</div>
              <div className="kpi-value" style={{ color: totals.cogs.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                {totals.cogs.isComplete ? `$${totals.cogs.value.toFixed(2)}` : "Incomplete"}
              </div>
            </div>
            <div className="kpi-card span-1">
              <div className="kpi-label">Profit</div>
              <div className="kpi-value" style={{ color: totals.profit.isComplete ? "var(--kw-status-profit)" : "var(--kw-status-warning)" }}>
                {totals.profit.isComplete ? `$${totals.profit.value.toFixed(2)}` : "Incomplete"}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <select value={granularity} onChange={(e) => setGranularity(e.target.value as typeof granularity)}>
            <option value="day">By day</option>
            <option value="week">By week</option>
            <option value="month">By month</option>
          </select>
        </div>
        {loading || !timeSeries ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">Loading…</span>
          </div>
        ) : timeSeries.every((r) => r.unitsSold === 0) ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No sales in this range</span>
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

      {productPerformance && productPerformance.length > 0 && (
        <div className="dashboard-grid">
          <div className="card span-1">
            <div className="card-title" style={{ fontSize: 13 }}>Best-selling</div>
            {bestSelling.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>No data</span>
            ) : (
              bestSelling.map((p) => (
                <div key={p.productId} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--kw-border)" }}>
                  <a href={`/products/${p.productId}`} style={{ color: "var(--kw-accent-primary)" }}>{p.productName}</a>
                  <span style={{ color: "var(--kw-text-muted)" }}> — {p.unitsSold} units</span>
                </div>
              ))
            )}
          </div>
          <div className="card span-1">
            <div className="card-title" style={{ fontSize: 13 }}>Most profitable</div>
            {mostProfitable.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>No data</span>
            ) : (
              mostProfitable.map((p) => (
                <div key={p.productId} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--kw-border)" }}>
                  <a href={`/products/${p.productId}`} style={{ color: "var(--kw-accent-primary)" }}>{p.productName}</a>
                  <span style={{ color: "var(--kw-status-profit)" }}> — ${p.profit.value.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
          <div className="card span-2">
            <div className="card-title" style={{ fontSize: 13 }}>Losing money</div>
            {losingMoney.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>None — nothing is currently unprofitable in this range.</span>
            ) : (
              losingMoney.map((p) => (
                <div key={p.productId} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid var(--kw-border)" }}>
                  <a href={`/products/${p.productId}`} style={{ color: "var(--kw-accent-primary)" }}>{p.productName}</a>
                  <span style={{ color: "var(--kw-status-critical)" }}> — ${p.profit.value.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Product performance</div>
        {!productPerformance || productPerformance.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No sales in this range</span>
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
