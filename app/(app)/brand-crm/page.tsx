import { listBrands } from "@/lib/brands";
import { NewBrandForm } from "@/components/brands/NewBrandForm";
import { getSessionUser } from "@/lib/session";

const STATUS_LABEL: Record<string, string> = {
  NOT_CONTACTED: "Not contacted",
  IN_CONTACT: "In contact",
  NEGOTIATING: "Negotiating",
  PARTNERED: "Partnered",
  DECLINED: "Declined",
  INACTIVE: "Inactive",
};

export default async function BrandCrmPage() {
  await getSessionUser();
  const brands = await listBrands();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: "var(--kw-text-secondary)", fontSize: 13, maxWidth: 620, margin: 0 }}>
        A Brand record is separate from a product's free-text brand field — this is the relationship, contacts, and
        approval history behind it. A restricted product's eligibility status lives on the product itself; this is
        what might unlock it.
      </p>
      <NewBrandForm />
      <div className="card">
        <div className="card-title">Brands</div>
        {brands.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No brands yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Relationship</th>
                <th>Supplier</th>
                <th>Products</th>
                <th>Contacts</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id}>
                  <td>
                    <a href={`/brand-crm/${b.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {b.name}
                    </a>
                  </td>
                  <td>{STATUS_LABEL[b.relationshipStatus] ?? b.relationshipStatus}</td>
                  <td>{b.supplier?.name ?? "—"}</td>
                  <td>{b.products.length}</td>
                  <td>{b.contacts.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
