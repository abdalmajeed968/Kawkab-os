import Link from "next/link";
import { getActionCenterItems } from "@/lib/actionCenter";

export async function ActionCenterWidget() {
  const items = await getActionCenterItems();
  const criticalCount = items.filter((i) => i.severity === "critical").length;

  return (
    <div className="card span-2">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="card-title" style={{ marginBottom: 0 }}>
          Action center
        </div>
        {criticalCount > 0 && (
          <span className="pill pill-restricted">
            {criticalCount} critical
          </span>
        )}
      </div>
      <div className="card-subtitle">Every item links to the record that resolves it. Nothing Amazon-derived yet.</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--kw-status-profit)" }}>Nothing needs attention.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.slice(0, 8).map((item, idx) => (
            <Link
              key={idx}
              href={item.href}
              style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start", color: "inherit" }}
            >
              <span className={`status-dot ${item.severity === "critical" ? "status-critical" : "status-warning"}`} style={{ marginTop: 5, flexShrink: 0 }} />
              <span style={{ color: item.severity === "critical" ? "var(--kw-status-critical)" : "var(--kw-text-primary)" }}>
                {item.message}
              </span>
            </Link>
          ))}
          {items.length > 8 && (
            <div style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>+{items.length - 8} more</div>
          )}
        </div>
      )}
    </div>
  );
}
