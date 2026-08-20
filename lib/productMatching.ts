// lib/productMatching.ts
//
// Deterministic, conservative product matching against existing
// ProductIdentifier rows. Never guesses from name similarity or partial
// matches — an unmatched row stays unmatched and visible, per the
// explicit instruction not to attach a sale to the wrong product on a
// hunch.

import { prisma } from "./prisma";
import { IdentifierType } from "@prisma/client";

export interface MatchCandidate {
  type: IdentifierType;
  value: string;
}

/**
 * Tries each candidate identifier in order (caller controls priority) and
 * returns the first exact match against a CURRENT (isCurrent: true)
 * ProductIdentifier — never a superseded one, since a superseded ASIN no
 * longer identifies the product going forward. Returns null if nothing
 * matches; never returns a "best guess."
 */
export async function matchProductByIdentifiers(candidates: MatchCandidate[]): Promise<string | null> {
  for (const candidate of candidates) {
    const value = candidate.value?.trim();
    if (!value) continue;
    const identifier = await prisma.productIdentifier.findFirst({
      where: { type: candidate.type, value, isCurrent: true },
    });
    if (identifier) return identifier.productId;
  }
  return null;
}
