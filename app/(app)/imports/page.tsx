import { listImportBatches } from "@/lib/salesImport";
import { NewImportForm } from "@/components/imports/NewImportForm";
import { getSessionUser } from "@/lib/session";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "var(--kw-status-neutral)",
  PROCESSING: "var(--kw-status-warning)",
  PROCESSED: "var(--kw-status-profit)",
  PARTIALLY_PROCESSED: "var(--kw-status-warning)",
  FAILED: "var(--kw-status-critical)",
};

export default async function ImportsPage() {
  await getSessionUser();
  const batches = await listImportBatches();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <NewImportForm />

      <div className="card">
        <div className="card-title">Import history</div>
        {batches.length === 0 ? (
          <div className="widget-placeholder">
            <span className="widget-placeholder-tag">No imports yet</span>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Date</th>
                <th>Status</th>
                <th>Total rows</th>
                <th>Matched</th>
                <th>Unmatched</th>
                <th>Duplicates</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>
                    <a href={`/imports/${b.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                      {b.filename}
                    </a>
                  </td>
                  <td>{b.reportType}</td>
                  <td>{b.createdAt.toLocaleDateString()}</td>
                  <td>
                    <span className="status-dot" style={{ background: STATUS_COLOR[b.status] }} />
                    {b.status.replaceAll("_", " ")}
                  </td>
                  <td>{b.originalRowCount ?? "—"}</td>
                  <td>{b.matchedRowCount ?? "—"}</td>
                  <td style={{ color: (b.unmatchedRowCount ?? 0) > 0 ? "var(--kw-status-warning)" : undefined }}>
                    {b.unmatchedRowCount ?? "—"}
                  </td>
                  <td>{b.duplicateRowCount ?? "—"}</td>
                  <td style={{ color: (b.errorRowCount ?? 0) > 0 ? "var(--kw-status-critical)" : undefined }}>
                    {b.errorRowCount ?? "—"}
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
