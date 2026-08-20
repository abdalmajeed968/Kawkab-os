// lib/landedCost.ts
//
// Implements section 7 (True Landed Cost) and section 8 (Missing cost ≠
// zero) of the Phase 1A spec, and section 5 (calculate what KAWKAB can
// calculate).
//
// Two numbers this module deliberately keeps separate, per the Owner's
// explicit instruction not to label one as the other:
//
//   ACQUISITION LANDED COST — purchase cost + supplier shipping + local
//   shipping + prep + packaging + other attributable costs, allocated
//   per unit. This is the complete picture of what KAWKAB can know before
//   Amazon is involved.
//
//   FINAL NET PROFIT AFTER AMAZON — acquisition landed cost minus Amazon
//   fees/revenue. Not computed anywhere in this module, because Amazon
//   data doesn't exist yet in Phase 1A. Nothing in this codebase is
//   allowed to call anything "net profit" until that data is real.

// A structural stand-in for anything money-shaped: a plain number, a
// numeric string, or anything with a real toString() (which is exactly
// what Prisma's Decimal is). Deliberately NOT importing Prisma's Decimal
// class directly — this is the actual fix for the TypeScript build issue
// found in the Owner's local run: a directly-imported Decimal type from
// one module path doesn't always structurally match a Decimal produced
// through a different Prisma import path, and this codebase was working
// around that mismatch with unsafe `as never` casts wherever landed cost
// data crossed from Prisma results into this module's functions. A
// structural type sidesteps the mismatch entirely, since it only cares
// about shape, not which class produced the value — no cast needed
// anywhere that calls into this module.
export type MoneyLike = number | string | { toString(): string };

import { CompletenessAware, complete, incomplete } from "./types";

export interface PurchaseCostInputs {
  invoiceTotal: MoneyLike;
  tax: MoneyLike | null;
  discount: MoneyLike | null;
  supplierShipping: MoneyLike | null;
  localShipping: MoneyLike | null;
  prepCost: MoneyLike | null;
  packagingCost: MoneyLike | null;
  otherCost: MoneyLike | null;
}

export interface PurchaseItemInput {
  id: string;
  productId: string;
  quantity: number;
  lineItemCost: MoneyLike;
}

// Every one of these is required for a COMPLETE landed cost — not because
// each is always nonzero, but because each must be a deliberate, entered
// value (including zero) rather than an unasked question. Tax and
// discount are included for consistency with the same rule, even though
// the Owner's written example only called out shipping/packaging — see
// the Phase 1A build report for this as a flagged, reviewable decision.
const REQUIRED_SHARED_COST_FIELDS = [
  "tax",
  "discount",
  "supplierShipping",
  "localShipping",
  "prepCost",
  "packagingCost",
  "otherCost",
] as const;

function toNumber(v: MoneyLike | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v.toString());
}

export function missingSharedCostFields(purchase: PurchaseCostInputs): string[] {
  return REQUIRED_SHARED_COST_FIELDS.filter((f) => purchase[f] === null || purchase[f] === undefined);
}

/** Section 5: the one calculation the owner should never have to do by hand. */
export function computeUnitPurchaseCost(item: PurchaseItemInput): number {
  return toNumber(item.lineItemCost) / item.quantity;
}

export interface LandedUnitCostResult {
  productId: string;
  purchaseItemId: string;
  unitPurchaseCost: number; // always available — lineItemCost / quantity
  landedUnitCost: CompletenessAware<number>;
}

/**
 * Allocates a Purchase's shared costs (shipping, prep, packaging, tax,
 * discount, other) across its line items in proportion to each line's
 * share of the invoice's product value, then divides by quantity. If any
 * required shared-cost field is null, every item on the purchase comes
 * back INCOMPLETE — the allocation genuinely cannot be computed without
 * all the inputs, so returning a landed cost anyway would mean guessing.
 * The always-available unitPurchaseCost is still returned alongside it,
 * so the owner isn't left with nothing while a cost is still missing.
 */
export function computeLandedCost(purchase: PurchaseCostInputs, items: PurchaseItemInput[]): LandedUnitCostResult[] {
  const missing = missingSharedCostFields(purchase);
  const totalLineValue = items.reduce((sum, i) => sum + toNumber(i.lineItemCost), 0);

  if (missing.length > 0 || totalLineValue === 0) {
    return items.map((item) => ({
      productId: item.productId,
      purchaseItemId: item.id,
      unitPurchaseCost: computeUnitPurchaseCost(item),
      landedUnitCost: incomplete(computeUnitPurchaseCost(item), {
        missingCount: missing.length,
        excludedValue: 0,
        excludedCount: 0,
        reason:
          missing.length > 0
            ? `Missing: ${missing.join(", ")}`
            : "Cannot allocate shared costs — purchase has no line item value",
      }),
    }));
  }

  const sharedCost =
    toNumber(purchase.supplierShipping) +
    toNumber(purchase.localShipping) +
    toNumber(purchase.prepCost) +
    toNumber(purchase.packagingCost) +
    toNumber(purchase.otherCost) +
    toNumber(purchase.tax) -
    toNumber(purchase.discount);

  return items.map((item) => {
    const shareRatio = toNumber(item.lineItemCost) / totalLineValue;
    const allocatedSharedCost = sharedCost * shareRatio;
    const landedTotal = toNumber(item.lineItemCost) + allocatedSharedCost;
    const landedUnit = landedTotal / item.quantity;

    return {
      productId: item.productId,
      purchaseItemId: item.id,
      unitPurchaseCost: computeUnitPurchaseCost(item),
      landedUnitCost: complete(landedUnit),
    };
  });
}
