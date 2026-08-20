import { prisma } from "@/lib/prisma";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { DataHealthWidget } from "@/components/dashboard/DataHealthWidget";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { ActionCenterWidget } from "@/components/dashboard/ActionCenterWidget";
import { InventoryHealthWidget } from "@/components/dashboard/InventoryHealthWidget";
import { SalesPerformanceWidget } from "@/components/dashboard/SalesPerformanceWidget";
import { listProducts } from "@/lib/products";
import { getStandardPeriodPerformance, getFinanceSummary } from "@/lib/finance";
import { getSessionUser } from "@/lib/session";

function money(v: { value: number; isComplete: boolean }): string {
  return v.isComplete ? `$${v.value.toFixed(2)}` : "Incomplete";
}

export default async function DashboardPage() {
  const user = await getSessionUser();

  const [productCount, purchaseCount, purchasesNeedingReview, products, periodPerformance, financeSummary, pendingImports] = await Promise.all([
    prisma.product.count(),
    prisma.purchase.count(),
    prisma.purchase.count({ where: { verificationStatus: "NEEDS_REVIEW" } }),
    listProducts("all"),
    getStandardPeriodPerformance(),
    getFinanceSummary(),
    prisma.importBatch.count({ where: { status: { in: ["PENDING", "PROCESSING", "PARTIALLY_PROCESSED"] } } }),
  ]);
  const incompleteCount = products.filter((p) => p.dataHealth.percent < 100).length;
  const avgHealth = products.length > 0 ? Math.round(products.reduce((s, p) => s + p.dataHealth.percent, 0) / products.length) : null;
  const { today } = periodPerformance;
  const inventoryValue = financeSummary.totalInventoryCostBasis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Today */}
      <div className="dashboard-grid">
        <KpiCard label="Revenue today" value={money(today.revenue)} />
        <KpiCard label="Profit today" value={today.profit.isComplete ? `$${today.profit.value.toFixed(2)}` : "Incomplete"} />
        <KpiCard label="Units sold today" value={today.unitsSold} />
        <KpiCard label="Amazon fees today" value={`$${today.fees.toFixed(2)}`} />
      </div>

      {/* Capital position */}
      <div className="dashboard-grid">
        <KpiCard label="Current inventory value" value={inventoryValue.isComplete ? `$${inventoryValue.value.toFixed(2)}` : "Incomplete"} />
        <KpiCard label="Capital tied in inventory" value={inventoryValue.isComplete ? `$${inventoryValue.value.toFixed(2)}` : "Incomplete"} />
        <KpiCard label="Products" value={productCount} />
        <KpiCard label="Purchases" value={purchaseCount} />
      </div>

      {/* Action items */}
      <div className="dashboard-grid">
        <KpiCard label="Products with missing data" value={incompleteCount} />
        <KpiCard label="Invoices needing review" value={purchasesNeedingReview} />
        <KpiCard label="Pending/unmatched imports" value={pendingImports} />
        <div className="kpi-card span-1">
          <div className="kpi-label">Average data health</div>
          {avgHealth === null ? (
            <div style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>No products yet</div>
          ) : (
            <div className="kpi-value" style={{ fontSize: 20, color: avgHealth === 100 ? "var(--kw-status-profit)" : "var(--kw-status-warning)" }}>
              {avgHealth}%
            </div>
          )}
        </div>
      </div>

      {/* Profit & cash flow across standard periods (real) */}
      <div className="dashboard-grid">
        <SalesPerformanceWidget />
      </div>

      {/* Inventory health (real) + action center (real) */}
      <div className="dashboard-grid">
        <InventoryHealthWidget />
        <ActionCenterWidget />
      </div>

      {/* Recent activity (real) */}
      <div className="dashboard-grid">
        <RecentActivity role={user.role} userId={user.id} />
      </div>

      <div className="dashboard-grid">
        <DataHealthWidget />
      </div>
    </div>
  );
}
