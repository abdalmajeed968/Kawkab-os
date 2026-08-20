export function KpiCard({ label, phaseTag, value }: { label: string; phaseTag?: string; value?: string | number }) {
  return (
    <div className="kpi-card span-1">
      <div className="kpi-label">{label}</div>
      {value !== undefined ? (
        <div className="kpi-value">{value}</div>
      ) : (
        <div className="kpi-value-placeholder">Available in {phaseTag}</div>
      )}
    </div>
  );
}
