// tests/types.test.ts
//
// Pure unit tests for the completeness-wrapper pattern. This is the
// pattern the whole missing-cost invariant depends on downstream, so it
// gets tested even though no Phase 0 module produces a real
// CompletenessAware<T> value yet.

import { describe, it, expect } from "vitest";
import { complete, incomplete } from "../lib/types";

describe("complete()", () => {
  it("wraps a value as isComplete=true with zeroed exclusion counts", () => {
    const result = complete(42);
    expect(result.value).toBe(42);
    expect(result.isComplete).toBe(true);
    expect(result.missingCount).toBe(0);
    expect(result.excludedValue).toBe(0);
    expect(result.excludedCount).toBe(0);
  });
});

describe("incomplete()", () => {
  it("wraps a value as isComplete=false and preserves what was excluded", () => {
    const result = incomplete(120, {
      missingCount: 2,
      excludedValue: 340.5,
      excludedCount: 2,
      reason: "2 orders excluded — missing COGS",
    });
    expect(result.isComplete).toBe(false);
    expect(result.value).toBe(120); // the best-available partial number is still returned...
    expect(result.excludedValue).toBe(340.5); // ...but the exclusion is never silently dropped
    expect(result.reason).toContain("missing COGS");
  });

  it("never lets the caller mistake a partial value for a complete one without checking isComplete", () => {
    // This test exists to make the contract explicit: `value` alone is
    // never sufficient. Any code that reads `.value` without also
    // checking `.isComplete` is the exact bug this type exists to prevent.
    const result = incomplete(0, { missingCount: 1, excludedValue: 0, excludedCount: 1, reason: "no data yet" });
    expect(result.value).toBe(0); // a real zero...
    expect(result.isComplete).toBe(false); // ...that must NOT be read as "verified zero profit"
  });
});
