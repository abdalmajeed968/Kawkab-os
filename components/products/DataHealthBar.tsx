interface Check {
  label: string;
  state: "OK" | "MISSING" | "NOT_AVAILABLE_YET";
}

function colorFor(percent: number) {
  if (percent === 100) return "var(--kw-status-profit)";
  if (percent >= 50) return "var(--kw-status-warning)";
  return "var(--kw-status-critical)";
}

export function DataHealthBar({ percent, checks }: { percent: number; checks: Check[] }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>Data health</span>
        <span style={{ fontSize: 12, fontFamily: "var(--kw-font-mono)", color: colorFor(percent) }}>{percent}%</span>
      </div>
      <div className="health-bar-track">
        <div className="health-bar-fill" style={{ width: `${percent}%`, background: colorFor(percent) }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
        {checks.map((c) => (
          <div key={c.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "var(--kw-text-secondary)" }}>{c.label}</span>
            <span
              style={{
                color:
                  c.state === "OK"
                    ? "var(--kw-status-profit)"
                    : c.state === "MISSING"
                      ? "var(--kw-status-warning)"
                      : "var(--kw-text-muted)",
              }}
            >
              {c.state === "OK" ? "✓" : c.state === "MISSING" ? "Missing" : "Not synced"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
