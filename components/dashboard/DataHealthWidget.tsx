// components/dashboard/DataHealthWidget.tsx
//
// This is the dashboard's visible proof of the missing-cost invariant:
// once Phase 1+ has real financial rows, this widget shows how many are
// COMPLETE vs INCOMPLETE — never folding an incomplete row into a "looks
// fine" total. In Phase 0 there is no financial data at all, so it shows
// the three states it will track rather than any number, fake or real.

export function DataHealthWidget() {
  return (
    <div className="card span-1">
      <div className="card-title">Data health</div>
      <div className="card-subtitle">Missing costs are shown, never treated as zero</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13 }}>
            <span className="status-dot status-profit" />
            Complete
          </span>
          <span className="widget-placeholder-tag">Phase 5</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13 }}>
            <span className="status-dot status-warning" />
            Incomplete
          </span>
          <span className="widget-placeholder-tag">Phase 5</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13 }}>
            <span className="status-dot status-neutral" />
            Needs review
          </span>
          <span className="widget-placeholder-tag">Phase 5</span>
        </div>
      </div>
    </div>
  );
}
