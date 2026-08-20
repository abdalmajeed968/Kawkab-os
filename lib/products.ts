// lib/products.ts

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { computeProductDataHealth } from "./dataHealth";
import { computeLandedCost } from "./landedCost";
import { ProductStatus, FulfillmentType } from "@prisma/client";

export type ProductTab =
  | "all"
  | "most_profitable"
  | "best_selling"
  | "needs_reorder"
  | "losing_money"
  | "incomplete_data"
  | "paused";

// Tabs that genuinely need Amazon-originated data (sales velocity, profit,
// reorder points) are not fake-computed in Phase 1A — they're listed here
// so the UI can render them as real tabs with an honest "waiting for
// Amazon" state, per the spec's explicit instruction not to fabricate
// this before SP-API integration exists.
export const AMAZON_DEPENDENT_TABS: ProductTab[] = ["most_profitable", "best_selling", "needs_reorder", "losing_money"];

export async function createProduct(
  input: { name: string; brand?: string; fulfillmentType?: FulfillmentType; notes?: string },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "manage_products");

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: input.name,
        brand: input.brand,
        fulfillmentType: input.fulfillmentType ?? "UNKNOWN",
        notes: input.notes,
        createdByUserId: actingUserId,
      },
    });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Product",
      entityId: product.id,
      newValue: { name: product.name, brand: product.brand },
      source: "MANUAL",
    });

    return product;
  });
}

export async function updateProductStatus(productId: string, status: ProductStatus, actingUserId: string, role: Role) {
  requirePermission(role, "manage_products");

  return prisma.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    const after = await tx.product.update({ where: { id: productId }, data: { status } });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "UPDATE",
      entityType: "Product",
      entityId: productId,
      fieldChanged: "status",
      oldValue: { status: before.status },
      newValue: { status: after.status },
      source: "MANUAL",
    });

    return after;
  });
}

async function fetchProductsWithHealthData() {
  return prisma.product.findMany({
    include: {
      purchaseItems: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { purchase: { include: { documents: true } } },
      },
      identifiers: { where: { isCurrent: true } },
      eligibility: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listProducts(tab: ProductTab = "all") {
  const products = await fetchProductsWithHealthData();

  const withHealth = products.map((p) => {
    const dataHealth = computeProductDataHealth(p);
    const latestItem = p.purchaseItems[0];
    const landedCost = latestItem
      ? computeLandedCost(latestItem.purchase, [
          { id: latestItem.id, productId: p.id, quantity: latestItem.quantity, lineItemCost: latestItem.lineItemCost },
        ])[0].landedUnitCost
      : null;
    return { ...p, dataHealth, landedCost };
  });

  switch (tab) {
    case "paused":
      return withHealth.filter((p) => p.status === "PAUSED");
    case "incomplete_data":
      return withHealth.filter((p) => p.dataHealth.percent < 100);
    case "most_profitable":
    case "best_selling":
    case "needs_reorder":
    case "losing_money":
      // Amazon-dependent — Phase 1A has no sales data to rank by. Return
      // everything unranked rather than fabricate an order; the page
      // renders an honest "waiting for Amazon" banner for these tabs.
      return withHealth;
    case "all":
    default:
      return withHealth;
  }
}

export async function getProduct(productId: string) {
  return prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: {
      identifiers: { include: { marketplace: true }, orderBy: [{ type: "asc" }, { effectiveFrom: "desc" }] },
      purchaseItems: {
        include: { purchase: { include: { supplier: true, documents: { include: { document: true } } } } },
        orderBy: { createdAt: "desc" },
      },
      documents: { include: { document: true } },
      eligibility: { include: { potentialSupplier: true } },
    },
  });
}
