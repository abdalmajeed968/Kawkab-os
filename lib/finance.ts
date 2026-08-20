// lib/finance.ts
//
// Finance derives entirely from data that already exists — Purchases,
// PurchaseItems, BatchConsumption, BoxMovements. No ledger table of its
// own yet (that's a deliberate scoping choice, documented in the build
// report): every figure here is computed on read from the same
// source-of-truth rows Purchases/Inventory/Boxes already write to, so
// there is no second copy of financial truth that could drift.
//
// The one rule every function here obeys: a total that includes an
// incomplete input is itself reported as incomplete, never silently
// treated as if the missing piece were zero.

import { prisma } from "./prisma";
import { missingSharedCostFields } from "./landedCost";
import { FinancialEventType } from "@prisma/client";

export interface FinanceSummary {
  totalPurchaseSpend: number;
  completePurchaseCount: number;
  incompletePurchaseCount: number;
  totalInventoryCostBasis: { value: number; isComplete: boolean; incompleteBatchCount: number };
  totalBoxSpend: { value: number; isComplete: boolean; incompleteMovementCount: number };
  supplierSpend: Array<{ supplierId: string; supplierName: string; totalSpend: number; purchaseCount: number }>;
}

/**
 * Real, calculable-today numbers only. Revenue, Amazon fees, payouts,
 * settlements, and profit/ROI are deliberately absent — there is no
 * Amazon-sourced data yet to calculate them from, and this file never
 * fabricates a number to fill that gap.
 */
export async function getFinanceSummary(): Promise<FinanceSummary> {
  const purchases = await prisma.purchase.findMany({ include: { supplier: true } });

  const totalPurchaseSpend = purchases.reduce((sum, p) => sum + Number(p.invoiceTotal), 0);
  const completePurchaseCount = purchases.filter((p) => p.completenessStatus === "COMPLETE").length;
  const incompletePurchaseCount = purchases.filter((p) => p.completenessStatus === "INCOMPLETE").length;

  // Inventory cost basis: sum of landed cost for units still on hand
  // (received minus net consumed), using each PurchaseItem's own frozen
  // landed cost where known. A batch with an incomplete landed cost
  // contributes its raw purchase cost to the value shown, but the whole
  // total is flagged incomplete rather than silently treated as correct.
  const items = await prisma.purchaseItem.findMany({ include: { purchase: true, batchConsumptions: true } });
  let inventoryValue = 0;
  let incompleteBatchCount = 0;
  for (const item of items) {
    const consumed = item.batchConsumptions.reduce((s, c) => s + c.quantity, 0);
    const remaining = item.quantity - consumed;
    if (remaining <= 0) continue;
    const missing = missingSharedCostFields(item.purchase);
    const unitPurchaseCost = Number(item.lineItemCost) / item.quantity;
    inventoryValue += unitPurchaseCost * remaining;
    if (missing.length > 0) incompleteBatchCount += 1;
  }

  const boxMovements = await prisma.boxMovement.findMany({ where: { type: "PURCHASE" } });
  const totalBoxSpend = boxMovements.reduce((sum, m) => sum + (m.unitCost ? Number(m.unitCost) * m.quantity : 0), 0);
  const incompleteMovementCount = boxMovements.filter((m) => m.unitCost === null).length;

  const supplierMap = new Map<string, { supplierId: string; supplierName: string; totalSpend: number; purchaseCount: number }>();
  for (const p of purchases) {
    const existing = supplierMap.get(p.supplierId) ?? { supplierId: p.supplierId, supplierName: p.supplier.name, totalSpend: 0, purchaseCount: 0 };
    existing.totalSpend += Number(p.invoiceTotal);
    existing.purchaseCount += 1;
    supplierMap.set(p.supplierId, existing);
  }

  return {
    totalPurchaseSpend,
    completePurchaseCount,
    incompletePurchaseCount,
    totalInventoryCostBasis: { value: inventoryValue, isComplete: incompleteBatchCount === 0, incompleteBatchCount },
    totalBoxSpend: { value: totalBoxSpend, isComplete: incompleteMovementCount === 0, incompleteMovementCount },
    supplierSpend: Array.from(supplierMap.values()).sort((a, b) => b.totalSpend - a.totalSpend),
  };
}

export interface ProductCostRow {
  productId: string;
  productName: string;
  unitsOnHand: number;
  landedUnitCost: { value: number; isComplete: boolean };
  costBasis: number;
}

/** Product-level cost basis — the closest thing to "profitability" available before Amazon revenue data exists. */
export async function getProductCostBreakdown(): Promise<ProductCostRow[]> {
  const products = await prisma.product.findMany({
    include: { purchaseItems: { include: { purchase: true, batchConsumptions: true }, orderBy: { createdAt: "desc" } } },
  });

  const rows: ProductCostRow[] = [];
  for (const product of products) {
    let unitsOnHand = 0;
    let latestLandedCost = { value: 0, isComplete: false };
    let costBasis = 0;

    for (const item of product.purchaseItems) {
      const consumed = item.batchConsumptions.reduce((s, c) => s + c.quantity, 0);
      const remaining = item.quantity - consumed;
      if (remaining <= 0) continue;
      unitsOnHand += remaining;
      const missing = missingSharedCostFields(item.purchase);
      const unitPurchaseCost = Number(item.lineItemCost) / item.quantity;
      costBasis += unitPurchaseCost * remaining;
      if (latestLandedCost.value === 0) {
        latestLandedCost = { value: unitPurchaseCost, isComplete: missing.length === 0 };
      }
    }

    if (product.purchaseItems.length > 0) {
      rows.push({ productId: product.id, productName: product.name, unitsOnHand, landedUnitCost: latestLandedCost, costBasis });
    }
  }

  return rows.sort((a, b) => b.costBasis - a.costBasis);
}

// ============================================================================
// REAL DATA: PROFIT ENGINE
//
// REVENUE SOURCE-OF-TRUTH RULE — the one rule every function below obeys,
// stated once here rather than re-derived per function:
//
//   For a given SaleItem, revenue comes from its PRODUCT_REVENUE
//   SaleFinancialEvent(s) whenever any exist. Finance/settlement data
//   supersedes the sales-report price once it arrives — it's Amazon's own
//   authoritative settled figure, and a sales report's listed price can
//   differ slightly (promotions, rounding, currency). SaleItem.
//   lineItemSubtotal (preferred) or unitSellingPrice × quantity (fallback)
//   is used ONLY when NO PRODUCT_REVENUE event exists yet for that item.
//   The two are never summed — that would double-count revenue, which is
//   exactly the failure mode this rule exists to prevent. See
//   tests/profitEngine.test.ts for this rule verified directly.
//
// COMPLETENESS RULE — a SaleItem's profit is COMPLETE only if:
//   (a) revenue is known, by either source above, AND
//   (b) at least one fee-type event (REFERRAL_FEE, FBA_FULFILLMENT_FEE, or
//       OTHER_FEE) exists — a real Amazon sale essentially always carries
//       a referral fee, so zero fee events almost always means "the
//       finance report hasn't been imported yet," not "there really were
//       no fees." AND
//   (c) COGS is known and every contributing BatchConsumption row was
//       itself COMPLETE at consumption time (reused directly from FIFO,
//       never recomputed or guessed here).
// Refunds/credits/reimbursements/promotions/tax/adjustments are treated as
// legitimately OPTIONAL — a sale simply not being refunded is a real "no
// event" state, not missing data, so their absence contributes $0
// correctly and does not mark the item incomplete.
// ============================================================================

const FEE_EVENT_TYPES: FinancialEventType[] = ["REFERRAL_FEE", "FBA_FULFILLMENT_FEE", "OTHER_FEE"];

export interface SaleItemProfit {
  saleItemId: string;
  productId: string;
  quantity: number;
  revenue: { value: number; isComplete: boolean; source: "financial_events" | "sale_item_fallback" | "unknown" };
  fees: { referral: number; fbaFulfillment: number; other: number; hasAnyFeeEvent: boolean };
  refunds: number;
  credits: number; // REFUND_FEE_CREDIT + REIMBURSEMENT + PROMOTION
  tax: number;
  adjustments: number; // ADJUSTMENT + OTHER
  cogs: { value: number; isComplete: boolean };
  profit: { value: number; isComplete: boolean };
  isFullyComplete: boolean;
}

/**
 * Computes one SaleItem's full profit picture. COGS is read directly from
 * the BatchConsumption rows FIFO already froze at commit time — never
 * recomputed, never a second cost calculation. If the item hasn't been
 * committed yet (no linked ConsumptionEvent), COGS is unknown, and the
 * whole result is marked incomplete rather than silently costed at $0.
 */
export async function computeSaleItemProfit(saleItemId: string): Promise<SaleItemProfit> {
  const saleItem = await prisma.saleItem.findUniqueOrThrow({
    where: { id: saleItemId },
    include: { financialEvents: true, consumptionEvent: { include: { consumptions: true } } },
  });

  const events = saleItem.financialEvents;
  const revenueEvents = events.filter((e) => e.eventType === "PRODUCT_REVENUE");

  let revenueValue = 0;
  let revenueSource: SaleItemProfit["revenue"]["source"] = "unknown";
  let revenueComplete = false;

  if (revenueEvents.length > 0) {
    revenueValue = revenueEvents.reduce((sum, e) => sum + Number(e.amount), 0);
    revenueSource = "financial_events";
    revenueComplete = true;
  } else if (saleItem.lineItemSubtotal !== null) {
    revenueValue = Number(saleItem.lineItemSubtotal);
    revenueSource = "sale_item_fallback";
    revenueComplete = true;
  } else if (saleItem.unitSellingPrice !== null) {
    revenueValue = Number(saleItem.unitSellingPrice) * saleItem.quantity;
    revenueSource = "sale_item_fallback";
    revenueComplete = true;
  }

  const sumByType = (type: FinancialEventType) => events.filter((e) => e.eventType === type).reduce((s, e) => s + Number(e.amount), 0);

  const referral = sumByType("REFERRAL_FEE");
  const fbaFulfillment = sumByType("FBA_FULFILLMENT_FEE");
  const otherFee = sumByType("OTHER_FEE");
  const hasAnyFeeEvent = events.some((e) => FEE_EVENT_TYPES.includes(e.eventType));

  const refunds = sumByType("REFUND");
  const credits = sumByType("REFUND_FEE_CREDIT") + sumByType("REIMBURSEMENT") + sumByType("PROMOTION");
  const tax = sumByType("TAX");
  const adjustments = sumByType("ADJUSTMENT") + sumByType("OTHER");

  let cogsValue = 0;
  let cogsComplete = false;
  if (saleItem.consumptionEvent) {
    const consumptions = saleItem.consumptionEvent.consumptions;
    cogsComplete = consumptions.length > 0 && consumptions.every((c) => c.costCompletenessStatus === "COMPLETE");
    cogsValue = consumptions.reduce((sum, c) => {
      const unitCost = c.landedUnitCost !== null ? Number(c.landedUnitCost) : Number(c.unitPurchaseCost);
      return sum + unitCost * c.quantity;
    }, 0);
  }

  const isFullyComplete = revenueComplete && hasAnyFeeEvent && cogsComplete;
  // Fee/refund/credit amounts are stored signed (a fee is a negative
  // amount) — see the SaleFinancialEvent worked example in schema.prisma.
  // They are added here, never subtracted a second time.
  const profitValue = revenueValue + referral + fbaFulfillment + otherFee + refunds + credits + tax + adjustments - cogsValue;

  return {
    saleItemId,
    productId: saleItem.productId,
    quantity: saleItem.quantity,
    revenue: { value: revenueValue, isComplete: revenueComplete, source: revenueSource },
    fees: { referral, fbaFulfillment, other: otherFee, hasAnyFeeEvent },
    refunds,
    credits,
    tax,
    adjustments,
    cogs: { value: cogsValue, isComplete: cogsComplete },
    profit: { value: profitValue, isComplete: isFullyComplete },
    isFullyComplete,
  };
}

export interface ProductPerformanceSummary {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: { value: number; isComplete: boolean };
  averageSellingPrice: number | null;
  fees: number;
  refunds: number;
  credits: number;
  cogs: { value: number; isComplete: boolean };
  profit: { value: number; isComplete: boolean };
  margin: number | null; // profit / revenue — null, never 0, when revenue is unknown
  roi: number | null; // profit / cogs — null, never 0, when cogs is unknown
  incompleteItemCount: number;
}

/**
 * Per-product performance, optionally scoped to a date range. Known
 * N+1 pattern (one computeSaleItemProfit call per SaleItem) — the same
 * tradeoff already accepted elsewhere in this codebase (lib/products.ts's
 * listProducts has the identical shape) rather than a new one introduced
 * here. Fine at today's data volume; worth revisiting once real import
 * volume exists.
 */
export async function getProductPerformance(dateFrom?: Date, dateTo?: Date): Promise<ProductPerformanceSummary[]> {
  const saleItems = await prisma.saleItem.findMany({
    where: dateFrom || dateTo ? { sale: { saleDate: { gte: dateFrom, lte: dateTo } } } : {},
    include: { product: true },
  });

  const byProduct = new Map<string, { name: string; itemIds: string[]; quantities: Map<string, number> }>();
  for (const item of saleItems) {
    const entry = byProduct.get(item.productId) ?? { name: item.product.name, itemIds: [] as string[], quantities: new Map<string, number>() };
    entry.itemIds.push(item.id);
    entry.quantities.set(item.id, item.quantity);
    byProduct.set(item.productId, entry);
  }

  const results: ProductPerformanceSummary[] = [];
  for (const [productId, { name, itemIds, quantities }] of byProduct) {
    let unitsSold = 0;
    let revenue = 0;
    let fees = 0;
    let refunds = 0;
    let credits = 0;
    let cogs = 0;
    let profit = 0;
    let incompleteItemCount = 0;

    for (const itemId of itemIds) {
      const p = await computeSaleItemProfit(itemId);
      unitsSold += quantities.get(itemId) ?? 0;
      revenue += p.revenue.value;
      fees += p.fees.referral + p.fees.fbaFulfillment + p.fees.other;
      refunds += p.refunds;
      credits += p.credits;
      cogs += p.cogs.value;
      profit += p.profit.value;
      if (!p.isFullyComplete) incompleteItemCount++;
    }

    results.push({
      productId,
      productName: name,
      unitsSold,
      revenue: { value: revenue, isComplete: incompleteItemCount === 0 },
      averageSellingPrice: unitsSold > 0 ? revenue / unitsSold : null,
      fees,
      refunds,
      credits,
      cogs: { value: cogs, isComplete: incompleteItemCount === 0 },
      profit: { value: profit, isComplete: incompleteItemCount === 0 },
      margin: revenue !== 0 ? profit / revenue : null,
      roi: cogs !== 0 ? profit / cogs : null,
      incompleteItemCount,
    });
  }

  return results.sort((a, b) => b.revenue.value - a.revenue.value);
}

export interface BusinessPerformanceSummary {
  periodLabel: string;
  unitsSold: number;
  revenue: { value: number; isComplete: boolean };
  fees: number;
  refunds: number;
  cogs: { value: number; isComplete: boolean };
  profit: { value: number; isComplete: boolean };
  margin: number | null;
  incompleteItemCount: number;
  totalItemCount: number;
}

export async function getBusinessPerformance(dateFrom: Date, dateTo: Date, periodLabel: string): Promise<BusinessPerformanceSummary> {
  const saleItems = await prisma.saleItem.findMany({ where: { sale: { saleDate: { gte: dateFrom, lte: dateTo } } } });

  let unitsSold = 0;
  let revenue = 0;
  let fees = 0;
  let refunds = 0;
  let cogs = 0;
  let profit = 0;
  let incompleteItemCount = 0;

  for (const item of saleItems) {
    const p = await computeSaleItemProfit(item.id);
    unitsSold += item.quantity;
    revenue += p.revenue.value;
    fees += p.fees.referral + p.fees.fbaFulfillment + p.fees.other;
    refunds += p.refunds;
    cogs += p.cogs.value;
    profit += p.profit.value;
    if (!p.isFullyComplete) incompleteItemCount++;
  }

  return {
    periodLabel,
    unitsSold,
    revenue: { value: revenue, isComplete: incompleteItemCount === 0 },
    fees,
    refunds,
    cogs: { value: cogs, isComplete: incompleteItemCount === 0 },
    profit: { value: profit, isComplete: incompleteItemCount === 0 },
    margin: revenue !== 0 ? profit / revenue : null,
    incompleteItemCount,
    totalItemCount: saleItems.length,
  };
}

/** Backs the Dashboard's standard-period KPI cards. */
export async function getStandardPeriodPerformance() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [today, last7, last30, thisMonth] = await Promise.all([
    getBusinessPerformance(startOfToday, now, "Today"),
    getBusinessPerformance(sevenDaysAgo, now, "Last 7 days"),
    getBusinessPerformance(thirtyDaysAgo, now, "Last 30 days"),
    getBusinessPerformance(startOfMonth, now, "This month"),
  ]);

  return { today, last7, last30, thisMonth };
}
