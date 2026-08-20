import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products";
import { computeProductDataHealth } from "@/lib/dataHealth";
import { computeDecisionBox } from "@/lib/decisionBox";
import { getEntityAuditTrail } from "@/lib/audit";
import { DataHealthBar } from "@/components/products/DataHealthBar";
import { DecisionBox } from "@/components/products/DecisionBox";
import { EligibilityPanel } from "@/components/products/EligibilityPanel";
import { ProductIdentifiersPanel } from "@/components/products/ProductIdentifiersPanel";
import { Timeline } from "@/components/products/Timeline";
import { EntityDocumentUploadForm } from "@/components/documents/EntityDocumentUploadForm";
import { InventoryPanel } from "@/components/inventory/InventoryPanel";
import { BrandLinkControl } from "@/components/brands/BrandLinkControl";
import { ProductPerformancePanel } from "@/components/products/ProductPerformancePanel";
import { WidgetSlot } from "@/components/dashboard/WidgetSlot";
import { getSessionUser } from "@/lib/session";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  await getSessionUser();

  let product;
  try {
    product = await getProduct(params.id);
  } catch {
    notFound();
  }

  const dataHealth = computeProductDataHealth(product);
  const decisionBox = computeDecisionBox(product);
  const timeline = await getEntityAuditTrail("Product", product.id);

  const latestItem = product.purchaseItems[0];

  return (
    <div className="detail-layout">
      <nav className="section-nav">
        <a href="#overview">Overview</a>
        <a href="#cost-summary">Cost &amp; Purchase Summary</a>
        <a href="#purchases">Purchases</a>
        <a href="#inventory">Inventory</a>
        <a href="#documents">Documents</a>
        <a href="#identity">Product Identity</a>
        <a href="#data-health">Data Health</a>
        <a href="#eligibility">Eligibility</a>
        <a href="#decision">Decision Box</a>
        <a href="#performance">Sales Performance</a>
        <a href="#timeline">Timeline</a>
        <a href="#future">Coming later</a>
      </nav>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="card" id="overview">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="card-title" style={{ fontSize: 20 }}>
                {product.name}
              </div>
              <div className="card-subtitle">{product.brand ?? "No brand set"}</div>
            </div>
            <span className="badge badge-phase">{product.status}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <BrandLinkControl productId={product.id} currentBrandId={product.brandId} />
          </div>
        </div>

        <div className="card" id="cost-summary">
          <div className="card-title">Cost &amp; purchase summary</div>
          <div className="card-subtitle">
            Acquisition landed cost — purchase cost plus supplier shipping, local shipping, prep, packaging, and other
            attributable costs. This is <strong>not</strong> net profit — Amazon fees and revenue aren't part of it
            until Amazon integration exists.
          </div>
          {latestItem ? (
            <div style={{ display: "flex", gap: 32 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>Unit purchase cost</div>
                <div className="kpi-value">${(Number(latestItem.lineItemCost) / latestItem.quantity).toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>Acquisition landed cost</div>
                <div
                  className="kpi-value"
                  style={{ color: decisionBox.acquisitionCost === "known" ? "var(--kw-text-primary)" : "var(--kw-status-warning)" }}
                >
                  {decisionBox.acquisitionCost === "known" ? "Complete" : "Incomplete"}
                </div>
              </div>
            </div>
          ) : (
            <div className="widget-placeholder">
              <span className="widget-placeholder-tag">No purchase recorded yet</span>
            </div>
          )}
        </div>

        <div className="card" id="purchases">
          <div className="card-title">Purchases</div>
          {product.purchaseItems.length === 0 ? (
            <div className="widget-placeholder">
              <span className="widget-placeholder-tag">No purchases recorded</span>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Qty</th>
                  <th>Line cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {product.purchaseItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <a href={`/purchases/${item.purchase.id}`} style={{ color: "var(--kw-accent-primary)" }}>
                        {item.purchase.purchaseDate.toLocaleDateString()}
                      </a>
                    </td>
                    <td>{item.purchase.supplier.name}</td>
                    <td>{item.quantity}</td>
                    <td>${Number(item.lineItemCost).toFixed(2)}</td>
                    <td>{item.purchase.completenessStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <InventoryPanel productId={product.id} />

        <div className="card" id="documents">
          <div className="card-title">Documents</div>
          {product.documents.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--kw-text-muted)", marginBottom: 12 }}>No documents attached directly to this product.</div>
          ) : (
            <table style={{ marginBottom: 12 }}>
              <tbody>
                {product.documents.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <a href={`/api/documents/file/${encodeURIComponent(d.document.storageKey)}`} target="_blank" rel="noreferrer">
                        {d.document.originalFilename}
                      </a>
                    </td>
                    <td>{d.role.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <EntityDocumentUploadForm uploadUrl={`/api/products/${product.id}/documents`} />
        </div>

        <ProductIdentifiersPanel productId={product.id} identifiers={product.identifiers} />

        <div className="card" id="data-health">
          <DataHealthBar percent={dataHealth.percent} checks={dataHealth.checks} />
        </div>

        <EligibilityPanel
          productId={product.id}
          eligibility={
            product.eligibility
              ? {
                  status: product.eligibility.status,
                  approvalStatus: product.eligibility.approvalStatus,
                  approvalNotes: product.eligibility.approvalNotes,
                  invoicePathNotes: product.eligibility.invoicePathNotes,
                  targetBuyPrice: product.eligibility.targetBuyPrice,
                  ownerNotes: product.eligibility.ownerNotes,
                }
              : null
          }
        />

        <div id="decision">
          <DecisionBox result={decisionBox} />
        </div>

        <Timeline entries={timeline} />

        <div id="future" className="dashboard-grid">
          <ProductPerformancePanel productId={product.id} />
          <WidgetSlot title="Replenishment" subtitle="When and how much to reorder" phaseTag="Phase 1C" span={2} />
          <WidgetSlot title="Returns" subtitle="Return rate and reasons" phaseTag="Phase 4" span={1} />
          <WidgetSlot title="AI analysis" subtitle="Recommendations and confidence" phaseTag="Phase 6" span={1} />
        </div>
      </div>
    </div>
  );
}
