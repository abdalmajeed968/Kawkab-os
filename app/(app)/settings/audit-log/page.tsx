import { prisma } from "@/lib/prisma";
import { SettingsSubNav } from "@/components/shell/SettingsSubNav";
import { getSessionUser } from "@/lib/session";

export default async function AuditLogPage() {
  const { role } = await getSessionUser();

  if (role !== "OWNER") {
    return (
      <div className="card">
        <div className="card-title">Owner access required</div>
        <div className="card-subtitle">The system-wide audit log is restricted to the Owner role.</div>
      </div>
    );
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 100,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SettingsSubNav active="audit-log" />
      <div className="card">
        <div className="card-title">Audit log</div>
        <div className="card-subtitle">Append-only. Nothing here can be edited or deleted through the app.</div>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Field</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.timestamp.toLocaleString()}</td>
                <td>{l.user?.name ?? "System"}</td>
                <td>{l.action}</td>
                <td>
                  {l.entityType} · {l.entityId.slice(0, 8)}
                </td>
                <td>{l.fieldChanged ?? "—"}</td>
                <td>{l.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
