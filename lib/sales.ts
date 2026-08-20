// lib/sales.ts
//
// Sale/SaleItem are the "what was sold" facts — no fee/refund columns
// here, that's SaleFinancialEvent's job (lib/financialEvents.ts).
// Committing a SaleItem is what actually reduces inventory, reusing the
// existing FIFO engine exactly the way Shipments does — never a second
// inventory-tracking mechanism.

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { consumeInventoryWithinTx, reverseConsumptionEventWithinTx } from "./fifo";

/**
 * Commits a single SaleItem: consumes inventory via the existing FIFO
 * engine, exactly once. Idempotent by construction — if this SaleItem
 * already has a linked ConsumptionEvent, this is a safe no-op rather than
 * an error, so re-running a commit pass over a batch that partially
 * succeeded earlier never double-consumes. The ultimate backstop is the
 * database-level unique constraint on ConsumptionEvent.saleItemId — even
 * a concurrent double-call cannot create two consumption events for the
 * same SaleItem.
 */
export async function commitSaleItem(saleItemId: string, actingUserId: string, role: Role) {
  requirePermission(role, "manage_imports");

  return prisma.$transaction(async (tx) => {
    const saleItem = await tx.saleItem.findUniqueOrThrow({
      where: { id: saleItemId },
      include: { consumptionEvent: true, sale: true },
    });

    if (saleItem.consumptionEvent) {
      return { saleItem, consumptionEvent: saleItem.consumptionEvent, alreadyCommitted: true };
    }
    if (saleItem.quantity <= 0) {
      throw new Error("SaleItem quantity must be positive to commit.");
    }

    const { event } = await consumeInventoryWithinTx(
      tx,
      {
        productId: saleItem.productId,
        type: "AMAZON_SALE",
        quantity: saleItem.quantity,
        eventDate: saleItem.sale.saleDate,
        notes: `Amazon sale — SaleItem ${saleItem.id}`,
        saleItemId: saleItem.id,
      },
      actingUserId
    );

    if (saleItem.importedRowId) {
      await tx.importedRow.update({ where: { id: saleItem.importedRowId }, data: { status: "COMMITTED" } });
    }

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "SaleItem",
      entityId: saleItem.id,
      fieldChanged: "committed",
      newValue: { productId: saleItem.productId, quantity: saleItem.quantity, consumptionEventId: event.id },
      source: saleItem.sale.source,
    });

    return { saleItem, consumptionEvent: event, alreadyCommitted: false };
  });
}

/**
 * Reverses a committed SaleItem's inventory consumption — an Owner-only
 * judgment call, same reasoning as correcting a purchase or a manual
 * consumption event. Uses the existing signed-reversal mechanism; the
 * original ConsumptionEvent/BatchConsumption rows are never edited.
 */
export async function reverseSaleItemConsumption(saleItemId: string, reason: string, actingUserId: string, role: Role) {
  requirePermission(role, "correct_sale");

  return prisma.$transaction(async (tx) => {
    const saleItem = await tx.saleItem.findUniqueOrThrow({ where: { id: saleItemId }, include: { consumptionEvent: true } });
    if (!saleItem.consumptionEvent) {
      throw new Error("This sale item has not been committed yet — there is nothing to reverse.");
    }
    return reverseConsumptionEventWithinTx(tx, saleItem.consumptionEvent.id, reason, actingUserId);
  });
}

export interface ManualSaleItemInput {
  productId: string;
  quantity: number;
  unitSellingPrice: number;
}

/**
 * The "simple manual sale fallback" — file import remains the primary
 * Amazon-sales workflow; this exists only for the rare one-off case
 * (a wholesale sale, a sample, anything outside a Seller Central report).
 * Uses MANUAL_SALE, not AMAZON_SALE — this is not Amazon-sourced data.
 */
export async function createManualSale(
  input: { saleDate: Date; marketplaceId?: string | null; notes?: string; items: ManualSaleItemInput[] },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "manage_imports");
  if (input.items.length === 0) throw new Error("A sale needs at least one item.");

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        saleDate: input.saleDate,
        marketplaceId: input.marketplaceId ?? undefined,
        source: "MANUAL",
        notes: input.notes,
        createdByUserId: actingUserId,
      },
    });

    const items = [];
    for (const i of input.items) {
      const item = await tx.saleItem.create({
        data: { saleId: sale.id, productId: i.productId, quantity: i.quantity, unitSellingPrice: i.unitSellingPrice },
      });
      const { event } = await consumeInventoryWithinTx(
        tx,
        { productId: i.productId, type: "MANUAL_SALE", quantity: i.quantity, eventDate: input.saleDate, saleItemId: item.id },
        actingUserId
      );
      items.push({ item, event });
    }

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Sale",
      entityId: sale.id,
      newValue: { itemCount: input.items.length, source: "MANUAL" },
      source: "MANUAL",
    });

    return { sale, items };
  });
}

export async function listSales() {
  return prisma.sale.findMany({
    include: { items: { include: { product: true } }, marketplace: true, importBatch: true },
    orderBy: { saleDate: "desc" },
  });
}

export async function getSale(saleId: string) {
  return prisma.sale.findUniqueOrThrow({
    where: { id: saleId },
    include: {
      items: { include: { product: true, consumptionEvent: true, financialEvents: true } },
      financialEvents: true,
      marketplace: true,
      importBatch: true,
    },
  });
}
