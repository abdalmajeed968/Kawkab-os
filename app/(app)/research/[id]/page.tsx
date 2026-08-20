import { notFound } from "next/navigation";
import { getResearchEntry } from "@/lib/research";
import { getEntityAuditTrail } from "@/lib/audit";
import { EditResearchEntryForm } from "@/components/research/EditResearchEntryForm";
import { EntityDocumentUploadForm } from "@/components/documents/EntityDocumentUploadForm";
import { Timeline } from "@/components/products/Timeline";
import { getSessionUser } from "@/lib/session";

const STATUS_LABEL: Record<string, string> = {
  IDEA: "Idea",
  CHECKING: "Checking",
  VIABLE: "Viable",
  NOT_VIABLE: "Not viable",
  SOURCING: "Sourcing",
  TESTING: "Testing",
  ADOPTED: "Adopted",
  REJECTED: "Rejected",
};

export default async function ResearchDetailPage({ params }: { params: { id: string } }) {
  await getSessionUser();

  let entry;
  try {
    entry = await getResearchEntry(params.id);
  } catch {
    notFound();
  }
  const timeline = await getEntityAuditTrail("ResearchEntry", entry.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="card-title" style={{ fontSize: 18 }}>
              {entry.title}
            </div>
            <div className="card-subtitle">
              {entry.asin ?? "No ASIN"} {entry.sku ? `· ${entry.sku}` : ""} {entry.supplierName ? `· ${entry.supplierName}` : ""}
            </div>
          </div>
          <span className="badge badge-phase">{STATUS_LABEL[entry.status] ?? entry.status}</span>
        </div>

        <div style={{ display: "flex", gap: 32, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>Assumed cost</div>
            <div className="kpi-value" style={{ fontSize: 18 }}>
              {entry.assumedCost !== null ? `$${entry.assumedCost.toFixed(2)}` : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>Assumed selling price</div>
            <div className="kpi-value" style={{ fontSize: 18 }}>
              {entry.assumedSellingPrice !== null ? `$${entry.assumedSellingPrice.toFixed(2)}` : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>Assumed margin</div>
            <div
              className="kpi-value"
              style={{ fontSize: 18, color: entry.assumedMargin === null ? "var(--kw-text-muted)" : entry.assumedMargin >= 0 ? "var(--kw-status-profit)" : "var(--kw-status-critical)" }}
            >
              {entry.assumedMargin !== null ? `$${entry.assumedMargin.toFixed(2)}` : "Needs both inputs"}
            </div>
          </div>
        </div>

        {entry.sourceUrl && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <a href={entry.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--kw-accent-secondary)" }}>
              {entry.sourceUrl}
            </a>
          </div>
        )}
        {entry.competitionNotes && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            <span style={{ color: "var(--kw-text-muted)" }}>Competition: </span>
            {entry.competitionNotes}
          </div>
        )}
        {entry.restrictionNotes && (
          <div style={{ marginTop: 4, fontSize: 13 }}>
            <span style={{ color: "var(--kw-text-muted)" }}>Restrictions: </span>
            {entry.restrictionNotes}
          </div>
        )}
        {entry.product && (
          <div style={{ marginTop: 8, fontSize: 13 }}>
            Linked product:{" "}
            <a href={`/products/${entry.product.id}`} style={{ color: "var(--kw-accent-primary)" }}>
              {entry.product.name}
            </a>
          </div>
        )}
      </div>

      <EditResearchEntryForm
        entryId={entry.id}
        entry={{
          status: entry.status,
          assumedCost: entry.assumedCost,
          assumedSellingPrice: entry.assumedSellingPrice,
          competitionNotes: entry.competitionNotes,
          restrictionNotes: entry.restrictionNotes,
          sourceUrl: entry.sourceUrl,
          notes: entry.notes,
        }}
      />

      <div className="card">
        <div className="card-title">Documents</div>
        {entry.documents.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--kw-text-muted)", marginBottom: 12 }}>Nothing uploaded yet.</div>
        ) : (
          <table style={{ marginBottom: 12 }}>
            <tbody>
              {entry.documents.map((d) => (
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
        <EntityDocumentUploadForm uploadUrl={`/api/research/${entry.id}/documents`} />
      </div>

      <Timeline entries={timeline} />
    </div>
  );
}
