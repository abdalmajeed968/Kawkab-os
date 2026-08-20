// lib/purchases.ts

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { missingSharedCostFields, computeLandedCost, MoneyLike } from "./landedCost";
import { TransactionSource, CompletenessStatus, Prisma } from "@prisma/client";

// Accepts EITHER unitCost (preferred — "the cost per unit," matching how
// an invoice usually reads) OR a direct lineItemCost override, per the
// Owner's UX correction: KAWKAB should never make the owner do math it
// can do itself, but a direct total should stay available and clearly
// labeled for the cases where that's what's actually known. lineItemCost
// stays the sole canonical stored value either way — nothing downstream
// (FIFO, landed cost) needs to know which way it was entered.
export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  unitCost?: number;
  lineItemCost?: number;
}

function resolveLineItemCost(item: PurchaseItemInput): number {
  if (item.lineItemCost !== undefined) return item.lineItemCost;
  if (item.unitCost !== undefined) return item.unitCost * item.quantity;
  throw new Error(`Line item for product ${item.productId} needs either unitCost or lineItemCost.`);
}

export interface CreatePurchaseInput {
  supplierId: string;
  purchaseDate: Date;
  invoiceNumber: string;
  invoiceTotal: number;
  tax?: number | null;
  discount?: number | null;
  supplierShipping?: number | null;
  localShipping?: number | null;
  prepCost?: number | null;
  packagingCost?: number | null;
  otherCost?: number | null;
  notes?: string;
  source?: TransactionSource;
  items: PurchaseItemInput[];
}

interface CostFieldsForCompleteness {
  tax?: MoneyLike | null;
  discount?: MoneyLike | null;
  supplierShipping?: MoneyLike | null;
  localShipping?: MoneyLike | null;
  prepCost?: MoneyLike | null;
  packagingCost?: MoneyLike | null;
  otherCost?: MoneyLike | null;
  invoiceTotal: MoneyLike;
}

/**
 * completenessStatus now depends on two independent things, both
 * required for COMPLETE: every shared cost field is a real, entered
 * value (never a guess), AND at least one document is attached. A
 * Purchase with perfect cost data but no invoice on file is still
 * INCOMPLETE — that's the Owner's explicit correction, and it's why this
 * function takes hasDocument as a real parameter rather than only
 * inspecting cost fields the way it used to.
 */
function deriveCompletenessStatus(costFields: CostFieldsForCompleteness, hasDocument: boolean): CompletenessStatus {
  const missingCosts = missingSharedCostFields({
    invoiceTotal: costFields.invoiceTotal,
    tax: costFields.tax ?? null,
    discount: costFields.discount ?? null,
    supplierShipping: costFields.supplierShipping ?? null,
    localShipping: costFields.localShipping ?? null,
    prepCost: costFields.prepCost ?? null,
    packagingCost: costFields.packagingCost ?? null,
    otherCost: costFields.otherCost ?? null,
  });
  return missingCosts.length === 0 && hasDocument ? "COMPLETE" : "INCOMPLETE";
}

/**
 * Human-readable reasons a Purchase is INCOMPLETE — used by the Purchase
 * detail page and Action Center so "MISSING INVOICE DOCUMENT" reads as
 * its own specific, high-priority reason rather than a generic
 * "incomplete" the owner has to go dig for.
 */
export function getPurchaseCompletenessReasons(
  costFields: CostFieldsForCompleteness,
  hasDocument: boolean
): string[] {
  const reasons: string[] = [];
  if (!hasDocument) reasons.push("Missing invoice document");
  const missingCosts = missingSharedCostFields({
    invoiceTotal: costFields.invoiceTotal,
    tax: costFields.tax ?? null,
    discount: costFields.discount ?? null,
    supplierShipping: costFields.supplierShipping ?? null,
    localShipping: costFields.localShipping ?? null,
    prepCost: costFields.prepCost ?? null,
    packagingCost: costFields.packagingCost ?? null,
    otherCost: costFields.otherCost ?? null,
  });
  for (const field of missingCosts) reasons.push(`Missing ${field.replace(/([A-Z])/g, " $1").toLowerCase()}`);
  return reasons;
}

export async function createPurchase(input: CreatePurchaseInput, actingUserId: string, role: Role) {
  requirePermission(role, "manage_purchases");

  if (!input.invoiceNumber?.trim()) {
    throw new Error("An invoice/order number is required to create a Purchase.");
  }
  if (input.items.length === 0) {
    throw new Error("A purchase needs at least one line item.");
  }

  // Document upload is optional at creation time — hasDocument is always
  // false here, never guessed at. If a document is attached moments
  // later in the same UI flow, that's a separate call that recomputes
  // this for real (see recomputePurchaseCompleteness below).
  const completenessStatus = deriveCompletenessStatus(input, false);

  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        supplierId: input.supplierId,
        purchaseDate: input.purchaseDate,
        invoiceNumber: input.invoiceNumber.trim(),
        invoiceTotal: input.invoiceTotal,
        tax: input.tax ?? undefined,
        discount: input.discount ?? undefined,
        supplierShipping: input.supplierShipping ?? undefined,
        localShipping: input.localShipping ?? undefined,
        prepCost: input.prepCost ?? undefined,
        packagingCost: input.packagingCost ?? undefined,
        otherCost: input.otherCost ?? undefined,
        notes: input.notes,
        source: input.source ?? "MANUAL",
        completenessStatus,
        createdByUserId: actingUserId,
        items: {
          create: input.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            lineItemCost: resolveLineItemCost(i),
          })),
        },
      },
      include: { items: true },
    });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Purchase",
      entityId: purchase.id,
      newValue: {
        supplierId: purchase.supplierId,
        invoiceNumber: purchase.invoiceNumber,
        invoiceTotal: input.invoiceTotal,
        itemCount: input.items.length,
        completenessStatus,
      },
      source: input.source ?? "MANUAL",
    });

    return purchase;
  });
}

export interface CorrectPurchaseInput {
  supplierShipping?: number | null;
  localShipping?: number | null;
  prepCost?: number | null;
  packagingCost?: number | null;
  otherCost?: number | null;
  tax?: number | null;
  discount?: number | null;
  invoiceTotal?: number;
  reason: string;
}

/**
 * Corrections are updates, not a reversal-ledger workflow — there's no
 * financial ledger yet (Finance is a later phase). What's non-negotiable
 * regardless: every correction is audited with the old value, the new
 * value, and a mandatory reason, and completenessStatus is recomputed
 * — including the document check — rather than left stale.
 */
export async function correctPurchase(purchaseId: string, input: CorrectPurchaseInput, actingUserId: string, role: Role) {
  requirePermission(role, "correct_purchase");

  if (!input.reason?.trim()) {
    throw new Error("A correction requires a reason.");
  }

  return prisma.$transaction(async (tx) => {
    const before = await tx.purchase.findUniqueOrThrow({ where: { id: purchaseId }, include: { documents: true } });

    const merged = {
      invoiceTotal: input.invoiceTotal ?? Number(before.invoiceTotal),
      tax: input.tax !== undefined ? input.tax : before.tax !== null ? Number(before.tax) : null,
      discount: input.discount !== undefined ? input.discount : before.discount !== null ? Number(before.discount) : null,
      supplierShipping:
        input.supplierShipping !== undefined
          ? input.supplierShipping
          : before.supplierShipping !== null
            ? Number(before.supplierShipping)
            : null,
      localShipping:
        input.localShipping !== undefined
          ? input.localShipping
          : before.localShipping !== null
            ? Number(before.localShipping)
            : null,
      prepCost: input.prepCost !== undefined ? input.prepCost : before.prepCost !== null ? Number(before.prepCost) : null,
      packagingCost:
        input.packagingCost !== undefined
          ? input.packagingCost
          : before.packagingCost !== null
            ? Number(before.packagingCost)
            : null,
      otherCost:
        input.otherCost !== undefined ? input.otherCost : before.otherCost !== null ? Number(before.otherCost) : null,
    };

    const completenessStatus = deriveCompletenessStatus(merged, before.documents.length > 0);

    const after = await tx.purchase.update({
      where: { id: purchaseId },
      data: { ...merged, completenessStatus },
    });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CORRECT",
      entityType: "Purchase",
      entityId: purchaseId,
      fieldChanged: "cost_fields",
      oldValue: {
        invoiceTotal: Number(before.invoiceTotal),
        tax: before.tax !== null ? Number(before.tax) : null,
        discount: before.discount !== null ? Number(before.discount) : null,
        supplierShipping: before.supplierShipping !== null ? Number(before.supplierShipping) : null,
        localShipping: before.localShipping !== null ? Number(before.localShipping) : null,
        prepCost: before.prepCost !== null ? Number(before.prepCost) : null,
        packagingCost: before.packagingCost !== null ? Number(before.packagingCost) : null,
        otherCost: before.otherCost !== null ? Number(before.otherCost) : null,
      },
      newValue: { ...merged, reason: input.reason },
      source: "MANUAL",
    });

    return after;
  });
}

/**
 * Called from lib/documents.ts after a document is linked to a Purchase
 * — completeness has to be recomputed the moment the missing-document
 * reason is resolved, not just when cost fields change. Takes the
 * caller's own transaction client so the recompute commits atomically
 * with the document link that triggered it.
 */
export async function recomputePurchaseCompleteness(tx: Prisma.TransactionClient, purchaseId: string) {
  const purchase = await tx.purchase.findUniqueOrThrow({ where: { id: purchaseId }, include: { documents: true } });
  const completenessStatus = deriveCompletenessStatus(purchase, purchase.documents.length > 0);
  if (completenessStatus !== purchase.completenessStatus) {
    await tx.purchase.update({ where: { id: purchaseId }, data: { completenessStatus } });
  }
  return completenessStatus;
}

export async function listPurchases() {
  return prisma.purchase.findMany({
    include: { supplier: true, items: { include: { product: true } }, documents: true },
    orderBy: { purchaseDate: "desc" },
  });
}

export async function getPurchase(purchaseId: string) {
  const purchase = await prisma.purchase.findUniqueOrThrow({
    where: { id: purchaseId },
    include: {
      supplier: true,
      items: { include: { product: true } },
      documents: { include: { document: true } },
    },
  });

  const landedCosts = computeLandedCost(purchase, purchase.items);
  const completenessReasons = getPurchaseCompletenessReasons(purchase, purchase.documents.length > 0);
  return { purchase, landedCosts, completenessReasons };
}
