// lib/types.ts
//
// Shared result shapes. The rule these types exist to enforce: any figure
// that could be affected by missing data is never returned as a bare
// number. Every consumer — UI, scoring, reports — is forced to check
// `isComplete` before treating a value as trustworthy. No Phase 0 module
// computes anything yet, but this ships now so Phase 1's finance and
// product modules import it from day one instead of reinventing it.
//
// This is deliberately paired with CompletenessStatus (see schema.prisma)
// rather than folded into it: CompletenessStatus is what gets stored on a
// row; CompletenessAware<T> is the shape a computed, in-memory result is
// returned in. A stored COMPLETE/INCOMPLETE status and a computed
// isComplete boolean should always agree, but they are not the same thing
// — one is persisted fact, the other is a computation's own report on
// itself.

export interface CompletenessAware<T> {
  value: T;
  isComplete: boolean;
  missingCount: number;
  excludedValue: number;
  excludedCount: number;
  reason?: string;
}

export function complete<T>(value: T): CompletenessAware<T> {
  return { value, isComplete: true, missingCount: 0, excludedValue: 0, excludedCount: 0 };
}

export function incomplete<T>(
  value: T,
  params: { missingCount: number; excludedValue: number; excludedCount: number; reason: string }
): CompletenessAware<T> {
  return { value, isComplete: false, ...params };
}
