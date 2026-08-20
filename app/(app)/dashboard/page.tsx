import { prisma } from "@/lib/prisma";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { DataHealthWidget } from "@/components/dashboard/DataHealthWidget";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { ActionCenterWidget } from "@/components/dashboard/ActionCenterWidget";
import { InventoryHealthWidget } from "@/components/dashboard/InventoryHealthWidget";
import { SalesPerformanceWidget } from "@/components/dashboard/SalesPerformanceWidget";
import { listProducts } from "@/lib/products";
import { getStandardPeriodPerformance } from "@/lib/finance";
import { getSessionUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await getSessionUser();

  // Real Phase 1A counts — Products, Purchases, and data-health are real
  // data now; Revenue/Units Sold/Amazon fees stay placeholders below
  // because no Amazon-originated data exists yet, per the explicit rule
  // against fabricating those numbers.
  const [productCount, purchaseCount, purchasesNeedingReview, products, periodPerformance] = await Promise.all([
    prisma.product.count(),
    prisma.purchase.count(),
    prisma.purchase.count({ where: { verificationStatus: "NEEDS_REVIEW" } }),
    listProducts("all"),
    getStandardPeriodPerformance(),
  ]);
  const incompleteCount = products.filter((p) => p.dataHealth.percent < 100).length;
  const avgHealth = products.length > 0 ? Math.round(products.reduce((s, p) => s + p.dataHealth.percent, 0) / products.length) : null;
  const { today } = periodPerformance;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Today's sales — real, from imported Amazon data when it exists */}
      <div className="dashboard-grid">
        <KpiCard label="Units sold today" value={today.unitsSold} />
        <KpiCard
          label="Revenue today"
          value={today.revenue.isComplete ? `$${today.revenue.value.toFixed(2)}` : "Incomplete"}
        />
        <KpiCard label="Amazon fees today" value={`$${today.fees.toFixed(2)}`} />
        <KpiCard
          label="Profit today"
          value={today.profit.isComplete ? `$${today.profit.value.toFixed(2)}` : "Incomplete"}
        />
      </div>

      {/* KPI row — real Phase 1A counts, Amazon numbers still placeholders */}
      <div className="dashboard-grid">
        <KpiCard label="Products" value={productCount} />
        <KpiCard label="Products with missing data" value={incompleteCount} />
        <KpiCard label="Purchases" value={purchaseCount} />
        <KpiCard label="Invoices needing review" value={purchasesNeedingReview} />
      </div>

      {/* Profit & cash flow (real) + data health */}
      <div className="dashboard-grid">
        <SalesPerformanceWidget />
        <div className="card span-1">
          <div className="card-title">Average data health</div>
          <div className="card-subtitle">Across all products</div>
          {avgHealth === null ? (
            <div className="widget-placeholder">
              <span className="widget-placeholder-tag">No products yet</span>
            </div>
          ) : (
            <div className="kpi-value" style={{ color: avgHealth === 100 ? "var(--kw-status-profit)" : "var(--kw-status-warning)" }}>
              {avgHealth}%
            </div>
          )}
        </div>
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
