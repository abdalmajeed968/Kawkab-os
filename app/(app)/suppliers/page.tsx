import { listSuppliers } from "@/lib/suppliers";
import { NewSupplierForm } from "@/components/suppliers/NewSupplierForm";
import { getSessionUser } from "@/lib/session";

export default async function SuppliersPage() {
  await getSessionUser();

  const suppliers = await listSuppliers();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <NewSupplierForm />
      <div className="card">
        <div className="card-title">Suppliers</div>
        {suppliers.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No suppliers yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Website</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <a href={`/suppliers/${s.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {s.name}
                    </a>
                  </td>
                  <td>{s.email ?? "—"}</td>
                  <td>{s.phone ?? "—"}</td>
                  <td>
                    {s.website ? (
                      <a href={s.website} target="_blank" rel="noreferrer" style={{ color: "var(--kw-accent-secondary)" }}>
                        {s.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
