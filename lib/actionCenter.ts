// lib/actionCenter.ts
//
// A genuine operational exception center, not a passive card list — every
// item carries a severity and a real href to the exact record that
// resolves it. Every item here is derived from data that already exists;
// nothing Amazon-derived, because no Amazon data exists yet to derive
// anything from.

import { prisma } from "./prisma";
import { getPurchaseCompletenessReasons } from "./purchases";

export type ActionSeverity = "critical" | "warning";

export interface ActionItem {
  type: string;
  severity: ActionSeverity;
  message: string;
  href: string;
}

export async function getActionCenterItems(): Promise<ActionItem[]> {
  const items: ActionItem[] = [];

  // Missing invoice document is its own critical, red, top-priority item
  // — the Owner's explicit correction, distinct from generic cost
  // incompleteness, which is a warning rather than critical.
  const purchasesWithoutDocuments = await prisma.purchase.findMany({
    where: { documents: { none: {} } },
    include: { supplier: true },
  });
  for (const p of purchasesWithoutDocuments) {
    items.push({
      type: "missing_invoice_document",
      severity: "critical",
      message: `MISSING INVOICE — ${p.supplier.name}, ${p.purchaseDate.toLocaleDateString()} (${p.invoiceNumber})`,
      href: `/purchases/${p.id}`,
    });
  }

  // Purchases that DO have a document but are still incomplete for some
  // other reason (a missing cost field) — kept separate from the
  // document case above so the same purchase isn't listed twice for what
  // reads as the same underlying problem.
  const incompleteWithDocs = await prisma.purchase.findMany({
    where: { completenessStatus: "INCOMPLETE", documents: { some: {} } },
    include: { supplier: true, documents: true },
  });
  for (const p of incompleteWithDocs) {
    const reasons = getPurchaseCompletenessReasons(p, true);
    items.push({
      type: "purchase_cost_incomplete",
      severity: "warning",
      message: `${p.supplier.name}, ${p.purchaseDate.toLocaleDateString()} — ${reasons.join(", ")}`,
      href: `/purchases/${p.id}`,
    });
  }

  const purchasesNeedingReview = await prisma.purchase.findMany({
    where: { verificationStatus: "NEEDS_REVIEW", documents: { some: {} } },
    include: { supplier: true },
  });
  for (const p of purchasesNeedingReview) {
    items.push({
      type: "invoice_needs_review",
      severity: "warning",
      message: `Invoice from ${p.supplier.name} is waiting for review`,
      href: `/purchases/${p.id}`,
    });
  }

  const restrictedProducts = await prisma.product.findMany({ where: { eligibility: { status: "RESTRICTED" } } });
  for (const prod of restrictedProducts) {
    items.push({
      type: "restricted_needs_approval_path",
      severity: "warning",
      message: `${prod.name} is restricted — needs a qualifying supplier / brand approval path`,
      href: `/products/${prod.id}#eligibility`,
    });
  }

  const productsWithoutPurchases = await prisma.product.findMany({ where: { purchaseItems: { none: {} } } });
  for (const prod of productsWithoutPurchases) {
    items.push({
      type: "product_incomplete",
      severity: "warning",
      message: `${prod.name} has no purchase recorded yet`,
      href: `/products/${prod.id}`,
    });
  }

  const lowStockBoxes = await prisma.boxType.findMany({ where: { status: "ACTIVE" }, include: { movements: true } });
  for (const box of lowStockBoxes) {
    const onHand = box.movements.reduce((sum, m) => sum + m.quantity, 0);
    if (box.lowStockThreshold !== null && onHand <= box.lowStockThreshold) {
      items.push({
        type: "box_low_stock",
        severity: onHand <= 0 ? "critical" : "warning",
        message: `${box.name} is ${onHand <= 0 ? "out of stock" : "low on stock"} (${onHand} on hand)`,
        href: `/boxes/${box.id}`,
      });
    }
  }

  const incompleteShipments = await prisma.shipment.findMany({
    where: { completenessStatus: "INCOMPLETE", status: { not: "CANCELLED" } },
  });
  for (const s of incompleteShipments) {
    items.push({
      type: "shipment_incomplete",
      severity: "warning",
      message: `Shipment ${s.reference} is missing shipping cost or line items`,
      href: `/shipments/${s.id}`,
    });
  }

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const overdueFollowUps = await prisma.brandActivity.findMany({
    where: { followUpDate: { not: null, lte: weekAhead } },
    include: { brand: true },
  });
  for (const f of overdueFollowUps) {
    const isOverdue = f.followUpDate! < now;
    items.push({
      type: "brand_follow_up",
      severity: isOverdue ? "critical" : "warning",
      message: `${isOverdue ? "Overdue" : "Upcoming"} follow-up with ${f.brand.name}: ${f.summary}`,
      href: `/brand-crm/${f.brandId}`,
    });
  }

  // Critical items first, so the most urgent things are never buried
  // under a longer list of warnings.
  return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
}
