import { notFound } from "next/navigation";
import { getImportBatch } from "@/lib/salesImport";
import { ImportBatchActions } from "@/components/imports/ImportBatchActions";
import { ImportedRowsTable } from "@/components/imports/ImportedRowsTable";
import { getSessionUser } from "@/lib/session";

export default async function ImportBatchDetailPage({ params }: { params: { id: string } }) {
  await getSessionUser();

  let batch;
  try {
    batch = await getImportBatch(params.id);
  } catch {
    notFound();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="card-title" style={{ fontSize: 18 }}>
              {batch.filename}
            </div>
            <div className="card-subtitle">
              {batch.reportType} · {batch.createdAt.toLocaleString()} · {batch.status.replaceAll("_", " ")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 13, marginTop: 12, marginBottom: 12 }}>
          <div>Total: {batch.originalRowCount ?? 0}</div>
          <div style={{ color: "var(--kw-status-profit)" }}>Matched: {batch.matchedRowCount ?? 0}</div>
          <div style={{ color: "var(--kw-status-warning)" }}>Unmatched: {batch.unmatchedRowCount ?? 0}</div>
          <div style={{ color: "var(--kw-status-warning)" }}>Duplicates: {batch.duplicateRowCount ?? 0}</div>
          <div style={{ color: "var(--kw-status-critical)" }}>Errors: {batch.errorRowCount ?? 0}</div>
        </div>
        <ImportBatchActions batchId={batch.id} reportType={batch.reportType} status={batch.status} />
      </div>

      <ImportedRowsTable
        rows={batch.importedRows.map((r) => ({
          id: r.id,
          rowNumber: r.rowNumber,
          status: r.status,
          errorMessage: r.errorMessage,
          rawData: r.rawData as Record<string, unknown>,
          matchedProduct: r.matchedProduct ? { id: r.matchedProduct.id, name: r.matchedProduct.name } : null,
        }))}
      />
    </div>
  );
}
