import { prisma } from "@/lib/prisma";
import { DocumentUploadForm } from "@/components/documents/DocumentUploadForm";
import { DocumentList } from "@/components/documents/DocumentList";
import { NewBusinessRecordForm } from "@/components/documents/NewBusinessRecordForm";
import { getSessionUser } from "@/lib/session";

export default async function DocumentsPage() {
  const { role } = await getSessionUser();

  const records = await prisma.businessRecord.findMany({
    where: role === "OPERATOR" ? { visibleToOperator: true } : {},
    orderBy: { createdAt: "desc" },
    include: { documents: { include: { document: true } } },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: "var(--kw-text-secondary)", fontSize: 13, maxWidth: 640 }}>
        Business and legal paperwork lives here in Phase 0 — the proof that upload, storage, linking, retrieval, and
        the audit trail all work end to end before Products, Suppliers, or Purchases exist. Every future module
        (Products, Suppliers, Purchase Orders...) gets its own dedicated document join table added the same way,
        never a shared polymorphic one.
      </p>

      <NewBusinessRecordForm />

      {records.length === 0 ? (
        <div className="card">
          <div className="card-title">No business records yet</div>
          <div className="card-subtitle">Create one above, then upload a document to it.</div>
        </div>
      ) : (
        records.map((record) => (
          <div key={record.id} className="card">
            <div className="card-title">
              {record.name}
              {!record.visibleToOperator && <span className="badge badge-phase" style={{ marginLeft: 8 }}>Owner only</span>}
            </div>
            <div className="card-subtitle">{record.category}</div>
            <DocumentList documents={record.documents} />
            <div style={{ marginTop: 12 }}>
              <DocumentUploadForm businessRecordId={record.id} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
