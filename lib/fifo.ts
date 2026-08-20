// lib/fifo.ts
//
// Phase 1B. Consumes PurchaseItem "batches" oldest-first (by purchase
// date), freezing unit cost at the moment of consumption — never
// recomputed later even if the Purchase's own cost fields are corrected
// afterward. That is historical COGS locking, enforced by what this code
// does and does not do, not by a rule someone has to remember to follow.
//
// Reversals are signed, negative BatchConsumption rows linked to a
// REVERSAL-type ConsumptionEvent — never edits to the original rows. See
// the schema comment above ConsumptionEvent/BatchConsumption for why this
// replaced the old prototype's "leave the original, add a new one, hope
// every read filters correctly" pattern: that pattern is exactly what
// caused a real double-counting bug found during the Phase 0 codebase
// review. Signed quantities net correctly under a plain SUM(), by
// construction, everywhere they're read — there's no filter to forget.

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { computeLandedCost } from "./landedCost";
import { ConsumptionEventType, Prisma } from "@prisma/client";

export class InsufficientInventoryError extends Error {
  constructor(
    public readonly productId: string,
    public readonly requested: number,
    public readonly available: number
  ) {
    super(`Insufficient inventory: requested ${requested}, only ${available} available.`);
    this.name = "InsufficientInventoryError";
  }
}

export interface ConsumeInventoryInput {
  productId: string;
  type: ConsumptionEventType;
  quantity: number;
  eventDate: Date;
  notes?: string;
  shipmentId?: string; // set only for a SHIPMENT-type event
  saleItemId?: string; // set only for an AMAZON_SALE-type event
}

/**
 * The actual FIFO consumption logic, scoped to a caller-provided
 * transaction rather than opening its own. recordConsumptionEvent (below)
 * is the standalone entry point that wraps this in its own transaction;
 * lib/shipments.ts calls this directly inside a Shipment's own
 * transaction instead, so consuming inventory for several products in one
 * shipment either all succeeds or all rolls back together — not one
 * separate transaction per line item.
 */
export async function consumeInventoryWithinTx(
  tx: Prisma.TransactionClient,
  input: ConsumeInventoryInput,
  actingUserId: string
) {
  if (input.quantity <= 0) {
    throw new Error("Quantity must be a positive number.");
  }

  const items = await tx.purchaseItem.findMany({
    where: { productId: input.productId },
    include: { purchase: true, batchConsumptions: true },
    orderBy: { purchase: { purchaseDate: "asc" } }, // FIFO: oldest purchase first
  });

  const withAvailable = items
    .map((item) => ({
      item,
      available: item.quantity - item.batchConsumptions.reduce((sum, c) => sum + c.quantity, 0),
    }))
    .filter((x) => x.available > 0);

  const totalAvailable = withAvailable.reduce((sum, x) => sum + x.available, 0);
  if (totalAvailable < input.quantity) {
    throw new InsufficientInventoryError(input.productId, input.quantity, totalAvailable);
  }

  const event = await tx.consumptionEvent.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      eventDate: input.eventDate,
      notes: input.notes,
      source: "MANUAL",
      shipmentId: input.shipmentId,
      saleItemId: input.saleItemId,
      createdByUserId: actingUserId,
    },
  });

  let remaining = input.quantity;
  const consumptions = [];
  for (const { item, available } of withAvailable) {
    if (remaining <= 0) break;
    const take = Math.min(available, remaining);

    const [landed] = computeLandedCost(item.purchase, [
      { id: item.id, productId: input.productId, quantity: item.quantity, lineItemCost: item.lineItemCost },
    ]);

    const consumption = await tx.batchConsumption.create({
      data: {
        purchaseItemId: item.id,
        consumptionEventId: event.id,
        quantity: take,
        unitPurchaseCost: landed.unitPurchaseCost,
        landedUnitCost: landed.landedUnitCost.isComplete ? landed.landedUnitCost.value : null,
        costCompletenessStatus: landed.landedUnitCost.isComplete ? "COMPLETE" : "INCOMPLETE",
      },
    });
    consumptions.push(consumption);
    remaining -= take;
  }

  await writeAuditLog(tx, {
    userId: actingUserId,
    action: "CREATE",
    entityType: "ConsumptionEvent",
    entityId: event.id,
    newValue: { productId: input.productId, type: input.type, quantity: input.quantity, batchesUsed: consumptions.length },
    source: "MANUAL",
  });

  return { event, consumptions };
}

export interface RecordConsumptionInput {
  productId: string;
  type: Extract<ConsumptionEventType, "MANUAL_SALE" | "MANUAL_ADJUSTMENT">;
  quantity: number;
  eventDate: Date;
  notes?: string;
}

/**
 * Records a real inventory movement (a manual sale, a loss, a sample sent
 * out — anything that isn't yet Amazon-sourced, since SP-API doesn't
 * exist until Phase 4) and runs FIFO consumption against it in its own
 * transaction. If available inventory can't cover the requested quantity,
 * this throws rather than partially consuming or guessing — nothing gets
 * written at all, matching the same all-or-nothing principle the
 * architecture review required of the old prototype's FIFO logic.
 */
export async function recordConsumptionEvent(input: RecordConsumptionInput, actingUserId: string, role: Role) {
  requirePermission(role, "record_consumption");
  return prisma.$transaction((tx) => consumeInventoryWithinTx(tx, input, actingUserId));
}

/**
 * The core reversal logic, tx-scoped like consumeInventoryWithinTx above
 * — lib/shipments.ts calls this directly when cancelling a shipment with
 * several products, so all of them reverse atomically or none do.
 */
export async function reverseConsumptionEventWithinTx(
  tx: Prisma.TransactionClient,
  eventId: string,
  reason: string,
  actingUserId: string
) {
  if (!reason?.trim()) {
    throw new Error("A reversal requires a reason.");
  }

  const original = await tx.consumptionEvent.findUniqueOrThrow({
    where: { id: eventId },
    include: { consumptions: true },
  });

  if (original.type === "REVERSAL") {
    throw new Error("A reversal event cannot itself be reversed.");
  }
  const alreadyReversed = await tx.consumptionEvent.findFirst({ where: { reversesEventId: eventId } });
  if (alreadyReversed) {
    throw new Error("This consumption event has already been reversed.");
  }

  const reversalEvent = await tx.consumptionEvent.create({
    data: {
      productId: original.productId,
      type: "REVERSAL",
      quantity: original.quantity,
      eventDate: new Date(),
      notes: reason,
      source: "MANUAL",
      reversesEventId: original.id,
      createdByUserId: actingUserId,
    },
  });

  for (const c of original.consumptions) {
    await tx.batchConsumption.create({
      data: {
        purchaseItemId: c.purchaseItemId,
        consumptionEventId: reversalEvent.id,
        quantity: -c.quantity, // signed — nets the original out under a plain SUM()
        unitPurchaseCost: c.unitPurchaseCost,
        landedUnitCost: c.landedUnitCost,
        costCompletenessStatus: c.costCompletenessStatus,
      },
    });
  }

  await writeAuditLog(tx, {
    userId: actingUserId,
    action: "CORRECT",
    entityType: "ConsumptionEvent",
    entityId: original.id,
    fieldChanged: "reversed",
    oldValue: { quantity: original.quantity },
    newValue: { reversalEventId: reversalEvent.id, reason },
    source: "MANUAL",
  });

  return reversalEvent;
}

/**
 * Reverses a consumption event by writing NEGATIVE BatchConsumption rows
 * against the same batches, linked to a new REVERSAL event — the
 * original event and its consumption rows are never touched. Requires a
 * reason, same as correctPurchase, and for the same audit-trail reason.
 */
export async function reverseConsumptionEvent(eventId: string, reason: string, actingUserId: string, role: Role) {
  requirePermission(role, "correct_consumption");
  return prisma.$transaction((tx) => reverseConsumptionEventWithinTx(tx, eventId, reason, actingUserId));
}
