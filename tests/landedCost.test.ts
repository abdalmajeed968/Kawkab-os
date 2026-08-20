// tests/landedCost.test.ts
//
// Pure unit tests, no database. These are the tests that matter most for
// section 8 of the Phase 1A spec ("missing cost ≠ zero") — the invariant
// is enforced here at the calculation layer, not just in the UI.

import { describe, it, expect } from "vitest";
import { computeLandedCost, computeUnitPurchaseCost, missingSharedCostFields } from "../lib/landedCost";

const completePurchase = {
  invoiceTotal: 240,
  tax: 0,
  discount: 0,
  supplierShipping: 20,
  localShipping: 5,
  prepCost: 10,
  packagingCost: 15,
  otherCost: 0,
};

const incompletePurchase = {
  invoiceTotal: 240,
  tax: 0,
  discount: 0,
  supplierShipping: null, // never entered — this is the case that must never become 0
  localShipping: 5,
  prepCost: 10,
  packagingCost: null,
  otherCost: 0,
};

describe("computeUnitPurchaseCost", () => {
  it("divides line item cost by quantity", () => {
    expect(computeUnitPurchaseCost({ id: "i1", productId: "p1", quantity: 20, lineItemCost: 240 })).toBe(12);
  });
});

describe("missingSharedCostFields", () => {
  it("returns an empty array when every field is a real number, including legitimate zeros", () => {
    expect(missingSharedCostFields(completePurchase)).toEqual([]);
  });

  it("flags null fields as missing, distinct from fields explicitly entered as 0", () => {
    const missing = missingSharedCostFields(incompletePurchase);
    expect(missing).toContain("supplierShipping");
    expect(missing).toContain("packagingCost");
    expect(missing).not.toContain("tax"); // tax is 0, a real entered value, not missing
  });
});

describe("computeLandedCost", () => {
  const items = [{ id: "i1", productId: "p1", quantity: 20, lineItemCost: 240 }];

  it("returns a COMPLETE landed cost when every required field is present", () => {
    const [result] = computeLandedCost(completePurchase, items);
    expect(result.landedUnitCost.isComplete).toBe(true);
    // (240 + 20 + 5 + 10 + 15 + 0 - 0) / 20 = 14.5
    expect(result.landedUnitCost.value).toBeCloseTo(14.5, 4);
  });

  it("returns INCOMPLETE, never a guessed number, when a required field is missing", () => {
    const [result] = computeLandedCost(incompletePurchase, items);
    expect(result.landedUnitCost.isComplete).toBe(false);
    expect(result.landedUnitCost.reason).toContain("supplierShipping");
    expect(result.landedUnitCost.reason).toContain("packagingCost");
  });

  it("still returns the always-available unit purchase cost even when landed cost is incomplete", () => {
    const [result] = computeLandedCost(incompletePurchase, items);
    expect(result.unitPurchaseCost).toBe(12); // 240 / 20 — doesn't depend on the missing shared costs
  });

  it("allocates shared costs proportionally across multiple line items by their value share", () => {
    const multiItems = [
      { id: "i1", productId: "p1", quantity: 10, lineItemCost: 180 }, // 75% of line value
      { id: "i2", productId: "p2", quantity: 10, lineItemCost: 60 }, // 25% of line value
    ];
    const purchase = { invoiceTotal: 240, tax: 0, discount: 0, supplierShipping: 40, localShipping: 0, prepCost: 0, packagingCost: 0, otherCost: 0 };
    const [r1, r2] = computeLandedCost(purchase, multiItems);

    // shared cost = 40, split 75/25 => 30 and 10
    expect(r1.landedUnitCost.value).toBeCloseTo((180 + 30) / 10, 4);
    expect(r2.landedUnitCost.value).toBeCloseTo((60 + 10) / 10, 4);
  });

  it("a legitimately-zero cost field does not make the result incomplete", () => {
    const zeroShippingPurchase = { ...completePurchase, supplierShipping: 0 };
    const [result] = computeLandedCost(zeroShippingPurchase, items);
    expect(result.landedUnitCost.isComplete).toBe(true);
  });
});
