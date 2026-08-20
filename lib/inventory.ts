// lib/inventory.ts
//
// Read-side of Phase 1B. Everything here is computed from PurchaseItem +
// BatchConsumption on every call — no cached "quantity on hand" column
// anywhere, for the same reason Decision Box and Data Health are computed
// rather than stored: a cached number can disagree with the rows it's
// summarizing the moment something changes underneath it, and a
// consumption reversal makes that risk concrete, not hypothetical.

import { prisma } from "./prisma";
import { computeLandedCost } from "./landedCost";

export interface AvailableBatch {
  purchaseItemId: string;
  purchaseId: string;
  purchaseDate: Date;
  quantityReceived: number;
  quantityAvailable: number;
  unitPurchaseCost: number;
  landedUnitCost: { value: number; isComplete: boolean; reason?: string };
}

export async function getAvailableBatches(productId: string): Promise<AvailableBatch[]> {
  const items = await prisma.purchaseItem.findMany({
    where: { productId },
    include: { purchase: true, batchConsumptions: true },
    orderBy: { purchase: { purchaseDate: "asc" } }, // FIFO order: oldest first
  });

  const batches: AvailableBatch[] = [];
  for (const item of items) {
    // Signed sum — reversals are negative rows, so this is always the
    // correct net-consumed figure with no separate filtering step needed.
    const consumed = item.batchConsumptions.reduce((sum, c) => sum + c.quantity, 0);
    const available = item.quantity - consumed;
    if (available <= 0) continue;

    const [landed] = computeLandedCost(item.purchase, [
      { id: item.id, productId, quantity: item.quantity, lineItemCost: item.lineItemCost },
    ]);

    batches.push({
      purchaseItemId: item.id,
      purchaseId: item.purchaseId,
      purchaseDate: item.purchase.purchaseDate,
      quantityReceived: item.quantity,
      quantityAvailable: available,
      unitPurchaseCost: landed.unitPurchaseCost,
      landedUnitCost: landed.landedUnitCost,
    });
  }
  return batches;
}

export async function getInventoryOnHand(productId: string): Promise<number> {
  const batches = await getAvailableBatches(productId);
  return batches.reduce((sum, b) => sum + b.quantityAvailable, 0);
}

export interface InventorySummaryRow {
  productId: string;
  productName: string;
  quantityOnHand: number;
  batchCount: number;
  oldestBatchDate: Date | null;
  inventoryValue: { value: number; isComplete: boolean };
  fulfillmentType: string;
}

/** Backs the Inventory list page and the dashboard's Inventory Health widget. */
export async function listInventorySummary(): Promise<InventorySummaryRow[]> {
  const products = await prisma.product.findMany({
    where: { purchaseItems: { some: {} } },
    select: { id: true, name: true, fulfillmentType: true },
  });

  const rows: InventorySummaryRow[] = [];
  for (const product of products) {
    const batches = await getAvailableBatches(product.id);
    if (batches.length === 0) continue; // fully consumed — nothing on hand
    const isComplete = batches.every((b) => b.landedUnitCost.isComplete);
    const inventoryValue = batches.reduce(
      (sum, b) => sum + (b.landedUnitCost.isComplete ? b.landedUnitCost.value : b.unitPurchaseCost) * b.quantityAvailable,
      0
    );
    rows.push({
      productId: product.id,
      productName: product.name,
      quantityOnHand: batches.reduce((sum, b) => sum + b.quantityAvailable, 0),
      batchCount: batches.length,
      oldestBatchDate: batches[0]?.purchaseDate ?? null,
      inventoryValue: { value: inventoryValue, isComplete },
      fulfillmentType: product.fulfillmentType,
    });
  }
  return rows;
}

export async function listConsumptionEvents(productId: string) {
  return prisma.consumptionEvent.findMany({
    where: { productId },
    include: { consumptions: true },
    orderBy: { eventDate: "desc" },
  });
}
