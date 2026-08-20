"use client";

import Link from "next/link";
import { DataHealthBar } from "./DataHealthBar";
import { EligibilityPill } from "./EligibilityPill";

interface Identifier {
  type: string;
  value: string;
  marketplace?: { displayName: string } | null;
}

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  status: string;
  fulfillmentType: string;
  identifiers: Identifier[];
  dataHealth: { percent: number; checks: Array<{ label: string; state: string }> };
  landedCost: { value: number; isComplete: boolean } | null;
  eligibility: { status: string } | null;
  purchaseItems: Array<{ purchase: { verificationStatus: string; documents: unknown[] } }>;
}

function identifierValue(identifiers: Identifier[], type: string) {
  return identifiers.find((i) => i.type === type)?.value ?? "—";
}

export function ProductsTable({ products, amazonWaiting }: { products: ProductRow[]; amazonWaiting: boolean }) {
  if (products.length === 0) {
    return (
      <div className="card">
        <div className="card-title">No products yet</div>
        <div className="card-subtitle">Create your first product to get started.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      {amazonWaiting && (
        <div className="widget-placeholder-tag" style={{ marginBottom: 12, display: "inline-block" }}>
          Waiting for Amazon — this view will rank by real sales data once SP-API is connected
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Brand</th>
            <th>ASIN</th>
            <th>SKU</th>
            <th>Marketplace</th>
            <th>Fulfillment</th>
            <th>Status</th>
            <th>Data Health</th>
            <th>Landed Cost</th>
            <th>Amazon Data</th>
            <th>Eligibility</th>
            <th>Invoice</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const invoiceState = p.purchaseItems[0]
              ? p.purchaseItems[0].purchase.documents.length > 0
                ? p.purchaseItems[0].purchase.verificationStatus === "VERIFIED"
                  ? "Verified"
                  : "Needs review"
                : "Missing"
              : "—";
            return (
              <tr key={p.id}>
                <td>
                  <Link href={`/products/${p.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                    {p.name}
                  </Link>
                </td>
                <td>{p.brand ?? "—"}</td>
                <td>{identifierValue(p.identifiers, "ASIN")}</td>
                <td>{identifierValue(p.identifiers, "INTERNAL_SKU")}</td>
                <td>{p.identifiers.find((i) => i.marketplace)?.marketplace?.displayName ?? "—"}</td>
                <td>{p.fulfillmentType}</td>
                <td>{p.status}</td>
                <td style={{ minWidth: 90 }}>
                  <div className="health-bar-track">
                    <div
                      className="health-bar-fill"
                      style={{
                        width: `${p.dataHealth.percent}%`,
                        background:
                          p.dataHealth.percent === 100
                            ? "var(--kw-status-profit)"
                            : p.dataHealth.percent >= 50
                              ? "var(--kw-status-warning)"
                              : "var(--kw-status-critical)",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--kw-text-muted)" }}>{p.dataHealth.percent}%</span>
                </td>
                <td>
                  {p.landedCost ? (
                    <span style={{ color: p.landedCost.isComplete ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}>
                      ${p.landedCost.value.toFixed(2)}
                      {!p.landedCost.isComplete && " (partial)"}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <span className="widget-placeholder-tag">Not synced</span>
                </td>
                <td>{p.eligibility ? <EligibilityPill status={p.eligibility.status} /> : <EligibilityPill status="UNKNOWN" />}</td>
                <td>{invoiceState}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
