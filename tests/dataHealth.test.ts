// tests/dataHealth.test.ts
//
// Pure unit tests, no database. Verifies the specific distinction the
// spec calls for: "missing required KAWKAB data" is never conflated with
// "not available until Amazon integration."

import { describe, it, expect } from "vitest";
import { computeProductDataHealth } from "../lib/dataHealth";

describe("computeProductDataHealth", () => {
  it("scores 0% for a product with no purchases at all", () => {
    const result = computeProductDataHealth({ purchaseItems: [] });
    expect(result.percent).toBe(0);
    expect(result.checks.find((c) => c.label === "Purchase recorded")?.state).toBe("MISSING");
  });

  it("scores 100% only when every KAWKAB-controllable field is present", () => {
    const result = computeProductDataHealth({
      purchaseItems: [
        {
          purchase: {
            invoiceTotal: 240,
            supplierShipping: 20,
            packagingCost: 15,
            completenessStatus: "COMPLETE",
            supplierId: "s1",
            documents: [{ id: "d1" }],
          },
        },
      ],
    });
    expect(result.percent).toBe(100);
    expect(result.checks.every((c) => c.state !== "MISSING")).toBe(true);
  });

  it("never counts the Amazon check against the percent score", () => {
    const result = computeProductDataHealth({
      purchaseItems: [
        {
          purchase: {
            invoiceTotal: 240,
            supplierShipping: 20,
            packagingCost: 15,
            completenessStatus: "COMPLETE",
            supplierId: "s1",
            documents: [{ id: "d1" }],
          },
        },
      ],
    });
    const amazonCheck = result.checks.find((c) => c.label === "Amazon data");
    expect(amazonCheck?.state).toBe("NOT_AVAILABLE_YET");
    expect(result.percent).toBe(100); // Amazon being unavailable doesn't drag this below 100
  });

  it("distinguishes MISSING (owner's responsibility) from NOT_AVAILABLE_YET (Amazon's) as different states", () => {
    const result = computeProductDataHealth({ purchaseItems: [] });
    const states = result.checks.map((c) => c.state);
    expect(states).toContain("MISSING");
    expect(states).toContain("NOT_AVAILABLE_YET");
    // They must never be the same state value doing double duty.
  });
});
