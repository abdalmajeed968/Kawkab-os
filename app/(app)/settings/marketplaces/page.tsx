import { SettingsSubNav } from "@/components/shell/SettingsSubNav";
import { NewMarketplaceForm } from "@/components/settings/NewMarketplaceForm";
import { listMarketplaces } from "@/lib/settings";
import { getSessionUser } from "@/lib/session";

export default async function MarketplacesSettingsPage() {
  const user = await getSessionUser();
  const marketplaces = await listMarketplaces();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SettingsSubNav active="marketplaces" />
      {user.role === "OWNER" ? (
        <NewMarketplaceForm />
      ) : (
        <div className="card">
          <div className="card-title">Owner access required</div>
          <div className="card-subtitle">Adding marketplaces is restricted to the Owner role.</div>
        </div>
      )}
      <div className="card">
        <div className="card-title">Marketplaces</div>
        <table>
          <thead>
            <tr>
              <th>Marketplace ID</th>
              <th>Name</th>
              <th>Country</th>
              <th>Currency</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {marketplaces.map((m) => (
              <tr key={m.id}>
                <td>{m.code}</td>
                <td>{m.displayName}</td>
                <td>{m.countryCode}</td>
                <td>{m.currency}</td>
                <td>{m.isActive ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
