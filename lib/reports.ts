// lib/reports.ts
//
// Every report here is assembled from the same service functions the
// operational pages already use (listInventorySummary, listPurchases,
// getFinanceSummary, getProductCostBreakdown, computeProductDataHealth) —
// never a second, parallel query path. If Purchases or Inventory ever
// change how they compute something, Reports inherits that change
// automatically instead of drifting out of sync with it.

import { prisma } from "./prisma";
import { listInventorySummary } from "./inventory";
import { listPurchases } from "./purchases";
import { getFinanceSummary, getProductCostBreakdown, getProductPerformance, getBusinessPerformance, computeSaleItemProfit } from "./finance";
import { computeProductDataHealth } from "./dataHealth";

export async function getInventoryReport() {
  return listInventorySummary();
}

export async function getInventoryValuationReport() {
  const rows = await getProductCostBreakdown();
  const totalValue = rows.reduce((sum, r) => sum + r.costBasis, 0);
  const incompleteCount = rows.filter((r) => !r.landedUnitCost.isComplete).length;
  return { rows, totalValue, incompleteCount };
}

export async function getPurchasesReport(dateFrom?: Date, dateTo?: Date) {
  const purchases = await listPurchases();
  const filtered = purchases.filter((p) => {
    if (dateFrom && p.purchaseDate < dateFrom) return false;
    if (dateTo && p.purchaseDate > dateTo) return false;
    return true;
  });
  return {
    purchases: filtered,
    totalSpend: filtered.reduce((sum, p) => sum + Number(p.invoiceTotal), 0),
    completeCount: filtered.filter((p) => p.completenessStatus === "COMPLETE").length,
    incompleteCount: filtered.filter((p) => p.completenessStatus === "INCOMPLETE").length,
    missingInvoiceCount: filtered.filter((p) => p.documents.length === 0).length,
  };
}

export async function getSupplierSpendReport() {
  const { supplierSpend } = await getFinanceSummary();
  return supplierSpend;
}

export async function getMissingDataReport() {
  const [purchasesMissingInvoice, purchasesMissingCost, products] = await Promise.all([
    prisma.purchase.findMany({ where: { documents: { none: {} } }, include: { supplier: true } }),
    prisma.purchase.findMany({ where: { completenessStatus: "INCOMPLETE", documents: { some: {} } }, include: { supplier: true } }),
    prisma.product.findMany({
      include: {
        purchaseItems: { orderBy: { createdAt: "desc" }, take: 1, include: { purchase: { include: { documents: true } } } },
      },
    }),
  ]);

  const productsIncomplete = products
    .map((p) => ({ product: p, health: computeProductDataHealth(p) }))
    .filter((x) => x.health.percent < 100);

  return { purchasesMissingInvoice, purchasesMissingCost, productsIncomplete };
}

export async function getProductStatusReport() {
  const products = await prisma.product.findMany();
  const counts = { ACTIVE: 0, PAUSED: 0, ARCHIVED: 0 };
  for (const p of products) counts[p.status as keyof typeof counts]++;
  return { total: products.length, counts };
}

export async function getShipmentStatusReport() {
  const shipments = await prisma.shipment.findMany();
  const counts: Record<string, number> = {};
  for (const s of shipments) counts[s.status] = (counts[s.status] ?? 0) + 1;
  return { total: shipments.length, counts, incomplete: shipments.filter((s) => s.completenessStatus === "INCOMPLETE").length };
}

export async function getDataCompletenessReport() {
  const [purchases, shipments, products] = await Promise.all([
    prisma.purchase.findMany(),
    prisma.shipment.findMany(),
    prisma.product.findMany({
      include: { purchaseItems: { orderBy: { createdAt: "desc" }, take: 1, include: { purchase: { include: { documents: true } } } } },
    }),
  ]);

  const productHealth = products.map((p) => computeProductDataHealth(p));
  const avgProductHealth = productHealth.length > 0 ? Math.round(productHealth.reduce((s, h) => s + h.percent, 0) / productHealth.length) : null;

  return {
    purchases: { total: purchases.length, complete: purchases.filter((p) => p.completenessStatus === "COMPLETE").length },
    shipments: { total: shipments.length, complete: shipments.filter((s) => s.completenessStatus === "COMPLETE").length },
    products: { total: products.length, avgHealthPercent: avgProductHealth },
  };
}

// ============================================================================
// REAL DATA: SALES / PROFITABILITY REPORTS
//
// Every function here composes lib/finance.ts's profit-engine functions —
// no separate revenue/COGS calculation exists in this file. The day/week/
// month grouping below is the only genuinely new logic; the numbers
// themselves are always the same numbers the Finance page and Product
// Detail page show, for the same reason every other report in this file
// reuses the operational pages' own service functions.
// ============================================================================

export async function getProductPerformanceReport(dateFrom?: Date, dateTo?: Date) {
  return getProductPerformance(dateFrom, dateTo);
}

export interface SalesTimeSeriesRow {
  periodLabel: string;
  periodStart: Date;
  unitsSold: number;
  revenue: { value: number; isComplete: boolean };
  profit: { value: number; isComplete: boolean };
}

/**
 * Groups sales into day/week/month buckets over a date range. Computes
 * each bucket via getBusinessPerformance — reused, not reimplemented —
 * so a day's numbers here always match what a report scoped to just that
 * day would show anywhere else in the app.
 */
export async function getSalesTimeSeriesReport(
  dateFrom: Date,
  dateTo: Date,
  granularity: "day" | "week" | "month"
): Promise<SalesTimeSeriesRow[]> {
  const buckets: Array<{ label: string; start: Date; end: Date }> = [];
  const cursor = new Date(dateFrom);

  while (cursor <= dateTo) {
    const start = new Date(cursor);
    let end: Date;
    let label: string;

    if (granularity === "day") {
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      label = start.toLocaleDateString();
      cursor.setDate(cursor.getDate() + 1);
    } else if (granularity === "week") {
      end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      label = `Week of ${start.toLocaleDateString()}`;
      cursor.setDate(cursor.getDate() + 7);
    } else {
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
      label = start.toLocaleDateString(undefined, { year: "numeric", month: "long" });
      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setDate(1);
    }

    buckets.push({ label, start, end: end > dateTo ? dateTo : end });
  }

  const rows: SalesTimeSeriesRow[] = [];
  for (const bucket of buckets) {
    const perf = await getBusinessPerformance(bucket.start, bucket.end, bucket.label);
    rows.push({
      periodLabel: bucket.label,
      periodStart: bucket.start,
      unitsSold: perf.unitsSold,
      revenue: perf.revenue,
      profit: perf.profit,
    });
  }

  return rows;
}

export interface MarketplaceSalesRow {
  marketplaceId: string | null;
  marketplaceName: string;
  unitsSold: number;
  revenue: { value: number; isComplete: boolean };
}

/** Breakdown by marketplace, when marketplace data exists on the Sale. */
export async function getMarketplaceSalesReport(): Promise<MarketplaceSalesRow[]> {
  const sales = await prisma.sale.findMany({ include: { marketplace: true, items: true } });

  const byMarketplace = new Map<string, { name: string; saleItemIds: string[]; units: number }>();
  for (const sale of sales) {
    const key = sale.marketplaceId ?? "unknown";
    const name = sale.marketplace?.displayName ?? "Unknown / not recorded";
    const entry = byMarketplace.get(key) ?? { name, saleItemIds: [], units: 0 };
    for (const item of sale.items) {
      entry.saleItemIds.push(item.id);
      entry.units += item.quantity;
    }
    byMarketplace.set(key, entry);
  }

  const rows: MarketplaceSalesRow[] = [];
  for (const [key, { name, saleItemIds, units }] of byMarketplace) {
    let revenue = 0;
    let incomplete = 0;
    for (const id of saleItemIds) {
      const p = await computeSaleItemProfit(id);
      revenue += p.revenue.value;
      if (!p.revenue.isComplete) incomplete++;
    }
    rows.push({
      marketplaceId: key === "unknown" ? null : key,
      marketplaceName: name,
      unitsSold: units,
      revenue: { value: revenue, isComplete: incomplete === 0 },
    });
  }

  return rows.sort((a, b) => b.revenue.value - a.revenue.value);
}
