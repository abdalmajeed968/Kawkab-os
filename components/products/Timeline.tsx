interface AuditRow {
  id: string;
  action: string;
  fieldChanged: string | null;
  timestamp: string | Date;
  user: { name: string } | null;
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: "created",
  UPDATE: "updated",
  CORRECT: "corrected",
  APPROVE: "confirmed",
  REJECT: "rejected",
};

export function Timeline({ entries }: { entries: AuditRow[] }) {
  return (
    <div className="card" id="timeline">
      <div className="card-title">Timeline</div>
      <div className="card-subtitle">Every entry here is a real, append-only audit record.</div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--kw-text-muted)" }}>No history yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map((e) => (
            <div key={e.id} style={{ fontSize: 13, display: "flex", gap: 8 }}>
              <span style={{ color: "var(--kw-text-muted)", minWidth: 130 }}>{new Date(e.timestamp).toLocaleString()}</span>
              <span>
                <span style={{ color: "var(--kw-text-primary)" }}>{e.user?.name ?? "System"}</span>{" "}
                {ACTION_LABEL[e.action] ?? e.action.toLowerCase()}
                {e.fieldChanged ? ` (${e.fieldChanged})` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
