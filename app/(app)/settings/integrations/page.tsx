import { SettingsSubNav } from "@/components/shell/SettingsSubNav";
import { getIntegrationReadiness } from "@/lib/settings";
import { getSessionUser } from "@/lib/session";

export default async function IntegrationsSettingsPage() {
  await getSessionUser();
  const readiness = getIntegrationReadiness();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SettingsSubNav active="integrations" />

      <div className="card">
        <div className="card-title">Document storage</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`status-dot ${readiness.storage.configured ? "status-profit" : "status-critical"}`} />
          {readiness.storage.provider}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Amazon Selling Partner API</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span className="status-dot status-neutral" />
          <span style={{ color: "var(--kw-text-secondary)" }}>{readiness.amazonSpApi.status}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--kw-text-muted)", marginBottom: 4 }}>Required before this can connect:</div>
        <ul style={{ fontSize: 13, color: "var(--kw-text-secondary)", margin: 0, paddingLeft: 20 }}>
          {readiness.amazonSpApi.requiredForConnection.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <div style={{ fontSize: 12, color: "var(--kw-text-muted)", marginTop: 12 }}>
          No credentials are stored in this application's source code. When SP-API integration is built, credentials
          will be configured via environment variables only.
        </div>
      </div>
    </div>
  );
}
