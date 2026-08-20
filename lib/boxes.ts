// lib/boxes.ts
//
// BoxType is the packaging catalog; BoxMovement is the single signed-
// quantity ledger every stock change writes to — a PURCHASE adds
// (positive quantity, known unit cost or the row is INCOMPLETE), a
// SHIPMENT_USE/MANUAL_ADJUSTMENT removes (negative quantity), and a
// REVERSAL negates a prior movement rather than editing it. On-hand
// quantity is always SUM(quantity), computed on read — see
// getBoxTypeOnHand below — never a stored counter.

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { BoxMovementType, ProductStatus, Prisma } from "@prisma/client";

export interface BoxTypeInput {
  name: string;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  weightCapacityKg?: number | null;
  supplierId?: string | null;
  lowStockThreshold?: number | null;
  notes?: string;
}

export async function createBoxType(input: BoxTypeInput, actingUserId: string, role: Role) {
  requirePermission(role, "manage_boxes");
  if (!input.name?.trim()) throw new Error("Box name is required.");

  return prisma.$transaction(async (tx) => {
    const boxType = await tx.boxType.create({
      data: {
        name: input.name.trim(),
        lengthCm: input.lengthCm ?? undefined,
        widthCm: input.widthCm ?? undefined,
        heightCm: input.heightCm ?? undefined,
        weightCapacityKg: input.weightCapacityKg ?? undefined,
        supplierId: input.supplierId ?? undefined,
        lowStockThreshold: input.lowStockThreshold ?? undefined,
        notes: input.notes,
        createdByUserId: actingUserId,
      },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "BoxType",
      entityId: boxType.id,
      newValue: { name: boxType.name },
      source: "MANUAL",
    });
    return boxType;
  });
}

export async function updateBoxTypeStatus(boxTypeId: string, status: ProductStatus, actingUserId: string, role: Role) {
  requirePermission(role, "manage_boxes");
  return prisma.$transaction(async (tx) => {
    const before = await tx.boxType.findUniqueOrThrow({ where: { id: boxTypeId } });
    const after = await tx.boxType.update({ where: { id: boxTypeId }, data: { status } });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "UPDATE",
      entityType: "BoxType",
      entityId: boxTypeId,
      fieldChanged: "status",
      oldValue: { status: before.status },
      newValue: { status: after.status },
      source: "MANUAL",
    });
    return after;
  });
}

export interface RecordBoxPurchaseInput {
  boxTypeId: string;
  quantity: number;
  unitCost?: number | null; // null = INCOMPLETE — never defaulted to 0
  invoiceNumber?: string;
  notes?: string;
}

export async function recordBoxPurchase(input: RecordBoxPurchaseInput, actingUserId: string, role: Role) {
  requirePermission(role, "manage_boxes");
  if (input.quantity <= 0) throw new Error("Quantity must be positive.");

  return prisma.$transaction(async (tx) => {
    const movement = await tx.boxMovement.create({
      data: {
        boxTypeId: input.boxTypeId,
        type: "PURCHASE",
        quantity: input.quantity,
        unitCost: input.unitCost ?? undefined,
        invoiceNumber: input.invoiceNumber,
        notes: input.notes,
        source: "MANUAL",
        createdByUserId: actingUserId,
      },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "BoxMovement",
      entityId: movement.id,
      newValue: { boxTypeId: input.boxTypeId, type: "PURCHASE", quantity: input.quantity, unitCost: input.unitCost ?? null },
      source: "MANUAL",
    });
    return movement;
  });
}

export class InsufficientBoxStockError extends Error {
  constructor(
    public readonly boxTypeId: string,
    public readonly requested: number,
    public readonly available: number
  ) {
    super(`Insufficient box stock: requested ${requested}, only ${available} available.`);
    this.name = "InsufficientBoxStockError";
  }
}

/**
 * tx-scoped core, mirroring lib/fifo.ts's consumeInventoryWithinTx —
 * lib/shipments.ts calls this directly inside a Shipment's own
 * transaction so box stock and product inventory are consumed
 * atomically together, not in separate transactions that could partially
 * succeed.
 */
export async function consumeBoxStockWithinTx(
  tx: Prisma.TransactionClient,
  input: { boxTypeId: string; quantity: number; type: BoxMovementType; shipmentId?: string; notes?: string },
  actingUserId: string
) {
  if (input.quantity <= 0) throw new Error("Quantity must be positive.");

  const onHandResult = await tx.boxMovement.aggregate({ where: { boxTypeId: input.boxTypeId }, _sum: { quantity: true } });
  const onHand = onHandResult._sum.quantity ?? 0;
  if (onHand < input.quantity) {
    throw new InsufficientBoxStockError(input.boxTypeId, input.quantity, onHand);
  }

  const movement = await tx.boxMovement.create({
    data: {
      boxTypeId: input.boxTypeId,
      type: input.type,
      quantity: -input.quantity,
      shipmentId: input.shipmentId,
      notes: input.notes,
      source: "MANUAL",
      createdByUserId: actingUserId,
    },
  });
  await writeAuditLog(tx, {
    userId: actingUserId,
    action: "CREATE",
    entityType: "BoxMovement",
    entityId: movement.id,
    newValue: { boxTypeId: input.boxTypeId, type: input.type, quantity: -input.quantity },
    source: "MANUAL",
  });
  return movement;
}

/**
 * Removes stock for a reason other than a shipment (a shipment writes its
 * own SHIPMENT_USE movement — see lib/shipments.ts, which calls
 * consumeBoxStockWithinTx directly). Throws rather than allowing on-hand
 * to go negative, matching the FIFO engine's InsufficientInventoryError.
 */
export async function recordBoxConsumption(
  input: { boxTypeId: string; quantity: number; type: Extract<BoxMovementType, "MANUAL_ADJUSTMENT">; notes?: string },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "manage_boxes");
  return prisma.$transaction((tx) => consumeBoxStockWithinTx(tx, input, actingUserId));
}

export async function getBoxTypeOnHand(boxTypeId: string): Promise<number> {
  const result = await prisma.boxMovement.aggregate({ where: { boxTypeId }, _sum: { quantity: true } });
  return result._sum.quantity ?? 0;
}

/**
 * tx-scoped reversal core, mirroring lib/fifo.ts's
 * reverseConsumptionEventWithinTx — used directly by shipment
 * cancellation so several box movements reverse atomically together.
 */
export async function reverseBoxMovementWithinTx(
  tx: Prisma.TransactionClient,
  movementId: string,
  reason: string,
  actingUserId: string
) {
  if (!reason?.trim()) throw new Error("A reversal requires a reason.");

  const original = await tx.boxMovement.findUniqueOrThrow({ where: { id: movementId } });
  if (original.type === "REVERSAL") throw new Error("A reversal cannot itself be reversed.");
  const already = await tx.boxMovement.findFirst({ where: { reversesMovementId: movementId } });
  if (already) throw new Error("This movement has already been reversed.");

  const reversal = await tx.boxMovement.create({
    data: {
      boxTypeId: original.boxTypeId,
      type: "REVERSAL",
      quantity: -original.quantity,
      notes: reason,
      source: "MANUAL",
      reversesMovementId: original.id,
      createdByUserId: actingUserId,
    },
  });
  await writeAuditLog(tx, {
    userId: actingUserId,
    action: "CORRECT",
    entityType: "BoxMovement",
    entityId: original.id,
    fieldChanged: "reversed",
    oldValue: { quantity: original.quantity },
    newValue: { reversalMovementId: reversal.id, reason },
    source: "MANUAL",
  });
  return reversal;
}

export async function reverseBoxMovement(movementId: string, reason: string, actingUserId: string, role: Role) {
  requirePermission(role, "correct_box_movement");
  return prisma.$transaction((tx) => reverseBoxMovementWithinTx(tx, movementId, reason, actingUserId));
}

export interface BoxTypeSummary {
  id: string;
  name: string;
  status: string;
  onHand: number;
  lowStockThreshold: number | null;
  isLowStock: boolean;
  lastKnownUnitCost: number | null;
  hasIncompleteCostMovement: boolean;
}

export async function listBoxTypes(): Promise<BoxTypeSummary[]> {
  const boxTypes = await prisma.boxType.findMany({
    include: { movements: { orderBy: { createdAt: "desc" } } },
    orderBy: { name: "asc" },
  });

  return boxTypes.map((bt) => {
    const onHand = bt.movements.reduce((sum, m) => sum + m.quantity, 0);
    const lastPurchase = bt.movements.find((m) => m.type === "PURCHASE");
    const hasIncompleteCostMovement = bt.movements.some((m) => m.type === "PURCHASE" && m.unitCost === null);
    return {
      id: bt.id,
      name: bt.name,
      status: bt.status,
      onHand,
      lowStockThreshold: bt.lowStockThreshold,
      isLowStock: bt.lowStockThreshold !== null && onHand <= bt.lowStockThreshold,
      lastKnownUnitCost: lastPurchase?.unitCost ? Number(lastPurchase.unitCost) : null,
      hasIncompleteCostMovement,
    };
  });
}

export async function getBoxType(boxTypeId: string) {
  const boxType = await prisma.boxType.findUniqueOrThrow({
    where: { id: boxTypeId },
    include: {
      supplier: true,
      movements: { orderBy: { createdAt: "desc" }, include: { shipment: true } },
      documents: { include: { document: true } },
    },
  });
  const onHand = boxType.movements.reduce((sum, m) => sum + m.quantity, 0);
  return { boxType, onHand };
}
