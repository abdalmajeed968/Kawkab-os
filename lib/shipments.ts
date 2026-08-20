// lib/shipments.ts
//
// Creating a Shipment with items and boxes consumes real inventory
// immediately — product quantities through the existing FIFO engine
// (consumeInventoryWithinTx, ConsumptionEventType.SHIPMENT) and box
// quantities through the Box movement ledger (consumeBoxStockWithinTx),
// both inside ONE transaction. If any line can't be covered — a product
// short on stock, a box type short on stock — nothing is written at all,
// not even the Shipment row itself. Cancelling a shipment reverses every
// consumption event and box movement it created, atomically, through the
// same tx-scoped reversal helpers.

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { consumeInventoryWithinTx, reverseConsumptionEventWithinTx, InsufficientInventoryError } from "./fifo";
import { consumeBoxStockWithinTx, reverseBoxMovementWithinTx, InsufficientBoxStockError } from "./boxes";
import { ShipmentStatus, ShipmentDestinationType, CompletenessStatus } from "@prisma/client";

export { InsufficientInventoryError, InsufficientBoxStockError };

export interface ShipmentItemInput {
  productId: string;
  quantity: number;
}
export interface ShipmentBoxInput {
  boxTypeId: string;
  quantity: number;
}

export interface CreateShipmentInput {
  reference: string;
  destinationType?: ShipmentDestinationType;
  destinationName?: string;
  marketplaceId?: string | null;
  carrier?: string;
  trackingNumber?: string;
  shipDate?: Date | null;
  shippingCost?: number | null;
  prepCost?: number | null;
  notes?: string;
  items: ShipmentItemInput[];
  boxes: ShipmentBoxInput[];
}

function deriveShipmentCompleteness(input: { shippingCost?: number | null }, hasItems: boolean): CompletenessStatus {
  return input.shippingCost !== null && input.shippingCost !== undefined && hasItems ? "COMPLETE" : "INCOMPLETE";
}

export async function createShipment(input: CreateShipmentInput, actingUserId: string, role: Role) {
  requirePermission(role, "manage_shipments");

  if (!input.reference?.trim()) {
    throw new Error("A shipment reference/identifier is required.");
  }
  if (input.items.length === 0) {
    throw new Error("A shipment needs at least one product line item.");
  }

  const completenessStatus = deriveShipmentCompleteness(input, input.items.length > 0);

  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.create({
      data: {
        reference: input.reference.trim(),
        destinationType: input.destinationType ?? "OTHER",
        destinationName: input.destinationName,
        marketplaceId: input.marketplaceId ?? undefined,
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
        shipDate: input.shipDate ?? undefined,
        shippingCost: input.shippingCost ?? undefined,
        prepCost: input.prepCost ?? undefined,
        notes: input.notes,
        source: "MANUAL",
        completenessStatus,
        createdByUserId: actingUserId,
      },
    });

    // Consume product inventory for every line item — FIFO, oldest batch
    // first, exactly as a manual sale would. Insufficient stock on ANY
    // line rolls back the whole transaction, including the Shipment row
    // itself — a shipment is never left half-created.
    for (const item of input.items) {
      await tx.shipmentItem.create({ data: { shipmentId: shipment.id, productId: item.productId, quantity: item.quantity } });
      await consumeInventoryWithinTx(
        tx,
        { productId: item.productId, type: "SHIPMENT", quantity: item.quantity, eventDate: new Date(), shipmentId: shipment.id },
        actingUserId
      );
    }

    // Consume box stock the same way.
    for (const box of input.boxes) {
      await tx.shipmentBox.create({ data: { shipmentId: shipment.id, boxTypeId: box.boxTypeId, quantity: box.quantity } });
      await consumeBoxStockWithinTx(
        tx,
        { boxTypeId: box.boxTypeId, quantity: box.quantity, type: "SHIPMENT_USE", shipmentId: shipment.id },
        actingUserId
      );
    }

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Shipment",
      entityId: shipment.id,
      newValue: { reference: shipment.reference, itemCount: input.items.length, boxCount: input.boxes.length, completenessStatus },
      source: "MANUAL",
    });

    return shipment;
  });
}

export async function updateShipmentStatus(shipmentId: string, status: ShipmentStatus, actingUserId: string, role: Role) {
  requirePermission(role, "manage_shipments");
  return prisma.$transaction(async (tx) => {
    const before = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    const after = await tx.shipment.update({
      where: { id: shipmentId },
      data: { status, deliveredDate: status === "DELIVERED" ? new Date() : undefined },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "UPDATE",
      entityType: "Shipment",
      entityId: shipmentId,
      fieldChanged: "status",
      oldValue: { status: before.status },
      newValue: { status: after.status },
      source: "MANUAL",
    });
    return after;
  });
}

/**
 * Cancelling a shipment reverses every consumption event and box
 * movement it created — atomically, in one transaction, using the same
 * tx-scoped reversal helpers a manual reversal uses. Inventory and box
 * stock come back exactly as they were; nothing is silently deleted.
 */
export async function cancelShipment(shipmentId: string, reason: string, actingUserId: string, role: Role) {
  requirePermission(role, "correct_shipment");
  if (!reason?.trim()) throw new Error("Cancelling a shipment requires a reason.");

  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: { consumptionEvents: true, boxMovements: true },
    });

    if (shipment.status === "CANCELLED") {
      throw new Error("This shipment is already cancelled.");
    }

    for (const event of shipment.consumptionEvents.filter((e) => e.type === "SHIPMENT")) {
      await reverseConsumptionEventWithinTx(tx, event.id, reason, actingUserId);
    }
    for (const movement of shipment.boxMovements.filter((m) => m.type === "SHIPMENT_USE")) {
      await reverseBoxMovementWithinTx(tx, movement.id, reason, actingUserId);
    }

    const after = await tx.shipment.update({ where: { id: shipmentId }, data: { status: "CANCELLED" } });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CORRECT",
      entityType: "Shipment",
      entityId: shipmentId,
      fieldChanged: "status",
      oldValue: { status: shipment.status },
      newValue: { status: "CANCELLED", reason },
      source: "MANUAL",
    });

    return after;
  });
}

export async function listShipments() {
  return prisma.shipment.findMany({
    include: { items: { include: { product: true } }, boxes: { include: { boxType: true } }, documents: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getShipment(shipmentId: string) {
  return prisma.shipment.findUniqueOrThrow({
    where: { id: shipmentId },
    include: {
      items: { include: { product: true } },
      boxes: { include: { boxType: true } },
      documents: { include: { document: true } },
      consumptionEvents: true,
      boxMovements: true,
      marketplace: true,
    },
  });
}
