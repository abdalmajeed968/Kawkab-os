"use client";

import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";

interface ImportedRow {
  id: string;
  rowNumber: number | null;
  status: string;
  errorMessage: string | null;
  rawData: Record<string, unknown>;
  matchedProduct: { id: string; name: string } | null;
}
interface ProductOption {
  id: string;
  name: string;
}

const TABS = ["ALL", "MATCHED", "UNMATCHED", "DUPLICATE", "ERROR", "COMMITTED"] as const;

function ResolveRowControl({ rowId }: { rowId: string }) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selected, setSelected] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/products?tab=all")
      .then((r) => r.json())
      .then((d) => setProducts((d.products ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))));
  }, []);

  async function handleResolve() {
    if (!selected) return;
    setSubmitting(true);
    await fetch(`/api/imported-rows/${rowId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: selected }),
    });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ fontSize: 12 }}>
        <option value="">Assign product…</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button className="button-secondary" style={{ padding: "3px 9px", fontSize: 11 }} onClick={handleResolve} disabled={!selected || submitting}>
        {submitting ? "…" : "Resolve"}
      </button>
    </div>
  );
}

export function ImportedRowsTable({ rows }: { rows: ImportedRow[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("ALL");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filtered = tab === "ALL" ? rows : rows.filter((r) => r.status === tab);

  return (
    <div className="card">
      <div className="card-title">Rows</div>
      <div className="tab-row">
        {TABS.map((t) => {
          const count = t === "ALL" ? rows.length : rows.filter((r) => r.status === t).length;
          return (
            <button key={t} className={`tab-item ${tab === t ? "tab-item-active" : ""}`} onClick={() => setTab(t)}>
              {t.charAt(0) + t.slice(1).toLowerCase()} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="widget-placeholder">
          <span className="widget-placeholder-tag">No rows in this category</span>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Row #</th>
              <th>Status</th>
              <th>Matched product</th>
              <th>Detail</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <Fragment key={row.id}>
                <tr>
                  <td>{row.rowNumber ?? "—"}</td>
                  <td>
                    <span
                      className="status-dot"
                      style={{
                        background:
                          row.status === "ERROR"
                            ? "var(--kw-status-critical)"
                            : row.status === "UNMATCHED" || row.status === "DUPLICATE"
                              ? "var(--kw-status-warning)"
                              : "var(--kw-status-profit)",
                      }}
                    />
                    {row.status}
                  </td>
                  <td>{row.matchedProduct?.name ?? "—"}</td>
                  <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.errorMessage ?? ""}
                  </td>
                  <td style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      className="button-secondary"
                      style={{ padding: "3px 9px", fontSize: 11 }}
                      onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                    >
                      {expandedRow === row.id ? "Hide raw" : "View raw"}
                    </button>
                    {row.status === "UNMATCHED" && <ResolveRowControl rowId={row.id} />}
                  </td>
                </tr>
                {expandedRow === row.id && (
                  <tr>
                    <td colSpan={5}>
                      <pre style={{ fontSize: 11, background: "var(--kw-bg-surface-2)", padding: 12, borderRadius: 6, overflowX: "auto" }}>
                        {JSON.stringify(row.rawData, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
