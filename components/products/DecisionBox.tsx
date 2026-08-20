interface DecisionBoxResult {
  dataStatus: string;
  acquisitionCost: string;
  invoiceStatus: string;
  amazonProfitability: string;
  eligibility: string;
  nextAction: string;
}

const ROWS: Array<{ key: keyof DecisionBoxResult; label: string }> = [
  { key: "dataStatus", label: "Data status" },
  { key: "acquisitionCost", label: "Acquisition cost" },
  { key: "invoiceStatus", label: "Invoice" },
  { key: "amazonProfitability", label: "Amazon profitability" },
  { key: "eligibility", label: "Eligibility" },
];

export function DecisionBox({ result }: { result: DecisionBoxResult }) {
  return (
    <div className="decision-box">
      <div className="card-title" style={{ marginBottom: 4 }}>
        Decision box
      </div>
      <div className="card-subtitle">Internal data only — AI-powered recommendations arrive in a later phase</div>
      {ROWS.map((r) => (
        <div key={r.key} className="decision-row">
          <span className="decision-label">{r.label}</span>
          <span style={{ textTransform: "capitalize" }}>{String(result[r.key]).replaceAll("_", " ").toLowerCase()}</span>
        </div>
      ))}
      <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--kw-bg-surface-2)", borderRadius: "var(--kw-radius-sm)" }}>
        <div style={{ fontSize: 11, color: "var(--kw-text-muted)", marginBottom: 4 }}>NEXT ACTION</div>
        <div style={{ fontSize: 13 }}>{result.nextAction}</div>
      </div>
    </div>
  );
}
