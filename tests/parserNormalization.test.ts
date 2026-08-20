// tests/parserNormalization.test.ts
//
// Pure unit tests for the header-normalization logic that makes the
// import pipeline tolerant of real Seller Central files, which are not
// consistent about casing/spacing/separators between report types.

import { describe, it, expect } from "vitest";
import { normalizeHeader } from "../lib/salesImport";

describe("normalizeHeader", () => {
  it("lowercases and trims", () => {
    expect(normalizeHeader("  Order ID  ")).toBe("orderid");
  });

  it("treats spaces, underscores, and hyphens as equivalent separators", () => {
    expect(normalizeHeader("order-id")).toBe("orderid");
    expect(normalizeHeader("order_id")).toBe("orderid");
    expect(normalizeHeader("order id")).toBe("orderid");
    expect(normalizeHeader("Order-ID")).toBe("orderid");
    expect(normalizeHeader("ORDER_ID")).toBe("orderid");
  });

  it("collapses multiple consecutive separators", () => {
    expect(normalizeHeader("order -- id")).toBe("orderid");
    expect(normalizeHeader("order__id")).toBe("orderid");
  });

  it("real Seller Central header variants for the same field all normalize identically", () => {
    const variants = ["amazon-order-id", "Amazon Order Id", "AMAZON_ORDER_ID", "amazon order-id"];
    const normalized = variants.map(normalizeHeader);
    expect(new Set(normalized).size).toBe(1);
  });

  it("does not collapse distinct field names into the same key", () => {
    expect(normalizeHeader("order-id")).not.toBe(normalizeHeader("order-item-id"));
    expect(normalizeHeader("sku")).not.toBe(normalizeHeader("asin"));
  });
});
