import { getRecentActivity } from "@/lib/audit";
import { Role } from "@/lib/permissions";

const ACTION_LABEL: Record<string, string> = {
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "deleted",
  CORRECT: "corrected",
  APPROVE: "approved",
  REJECT: "rejected",
  LOGIN: "logged in",
  LOGOUT: "logged out",
  PERMISSION_DENIED: "was denied",
};

export async function RecentActivity({ role, userId }: { role: Role; userId: string }) {
  const entries = await getRecentActivity(role, userId);

  return (
    <div className="card span-2">
      <div className="card-title">Recent activity</div>
      <div className="card-subtitle">
        {role === "OWNER" ? "Live from the audit log — every mutating action, system-wide" : "Your recent actions"}
      </div>
      {entries.length === 0 ? (
        <div className="widget-placeholder">
          <span className="widget-placeholder-tag">No activity recorded yet</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map((e) => (
            <div key={e.id} style={{ fontSize: 13, color: "var(--kw-text-secondary)" }}>
              <span style={{ color: "var(--kw-text-primary)" }}>{e.user?.name ?? "System"}</span>{" "}
              {ACTION_LABEL[e.action] ?? e.action.toLowerCase()} {e.entityType.toLowerCase()}
              {e.fieldChanged ? ` (${e.fieldChanged})` : ""}
              <span style={{ color: "var(--kw-text-muted)" }}> · {e.timestamp.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
