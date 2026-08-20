import { notFound } from "next/navigation";
import { getBrand } from "@/lib/brands";
import { getEntityAuditTrail } from "@/lib/audit";
import { AddBrandContactForm } from "@/components/brands/AddBrandContactForm";
import { LogBrandActivityForm } from "@/components/brands/LogBrandActivityForm";
import { EntityDocumentUploadForm } from "@/components/documents/EntityDocumentUploadForm";
import { EligibilityPill } from "@/components/products/EligibilityPill";
import { Timeline } from "@/components/products/Timeline";
import { getSessionUser } from "@/lib/session";

const STATUS_LABEL: Record<string, string> = {
  NOT_CONTACTED: "Not contacted",
  IN_CONTACT: "In contact",
  NEGOTIATING: "Negotiating",
  PARTNERED: "Partnered",
  DECLINED: "Declined",
  INACTIVE: "Inactive",
};

export default async function BrandDetailPage({ params }: { params: { id: string } }) {
  await getSessionUser();

  let brand;
  try {
    brand = await getBrand(params.id);
  } catch {
    notFound();
  }
  const timeline = await getEntityAuditTrail("Brand", brand.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="card-title" style={{ fontSize: 18 }}>
              {brand.name}
            </div>
            <div className="card-subtitle">
              {brand.supplier?.name ?? "No supplier linked"}
              {brand.website && (
                <>
                  {" · "}
                  <a href={brand.website} target="_blank" rel="noreferrer" style={{ color: "var(--kw-accent-secondary)" }}>
                    {brand.website.replace(/^https?:\/\//, "")}
                  </a>
                </>
              )}
            </div>
          </div>
          <span className="badge badge-phase">{STATUS_LABEL[brand.relationshipStatus] ?? brand.relationshipStatus}</span>
        </div>
        {brand.notes && <div style={{ fontSize: 13, color: "var(--kw-text-secondary)", marginTop: 8 }}>{brand.notes}</div>}
      </div>

      <div className="card">
        <div className="card-title">Products under this brand</div>
        {brand.products.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No products linked yet — link one from the product's detail page</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Eligibility</th>
              </tr>
            </thead>
            <tbody>
              {brand.products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a href={`/products/${p.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {p.name}
                    </a>
                  </td>
                  <td>
                    <EligibilityPill status={p.eligibility?.status ?? "UNKNOWN"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">Contacts</div>
        {brand.contacts.length > 0 && (
          <table style={{ marginBottom: 12 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Email</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {brand.contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.title ?? "—"}</td>
                  <td>{c.email ?? "—"}</td>
                  <td>{c.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <AddBrandContactForm brandId={brand.id} />
      </div>

      <div className="card">
        <div className="card-title">Activity &amp; follow-ups</div>
        {brand.activities.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {brand.activities.map((a) => (
              <div key={a.id} style={{ fontSize: 13, borderBottom: "1px solid var(--kw-border)", paddingBottom: 8 }}>
                <span style={{ color: "var(--kw-text-muted)" }}>{new Date(a.activityDate).toLocaleDateString()}</span>{" "}
                <span className="badge badge-phase">{a.type}</span> {a.summary}
                {a.followUpDate && (
                  <span style={{ color: "var(--kw-status-warning)", marginLeft: 8 }}>
                    Follow up {new Date(a.followUpDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <LogBrandActivityForm brandId={brand.id} />
      </div>

      <div className="card">
        <div className="card-title">Documents</div>
        {brand.documents.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--kw-text-muted)", marginBottom: 12 }}>
            No approval documents, invoices, or agreements on file.
          </div>
        ) : (
          <table style={{ marginBottom: 12 }}>
            <tbody>
              {brand.documents.map((d) => (
                <tr key={d.id}>
                  <td>
                    <a href={`/api/documents/file/${encodeURIComponent(d.document.storageKey)}`} target="_blank" rel="noreferrer">
                      {d.document.originalFilename}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <EntityDocumentUploadForm uploadUrl={`/api/brands/${brand.id}/documents`} />
      </div>

      <Timeline entries={timeline} />
    </div>
  );
}
