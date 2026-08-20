// lib/productIdentifiers.ts
//
// Section 2 of the Phase 1A spec: identifier history, never overwritten.
// Setting a new "current" identifier of a given (type, marketplace) never
// deletes or edits the old one — it closes it out (isCurrent=false,
// effectiveTo=now) and inserts a new row. This is the same additive,
// audited-correction shape the rest of the codebase uses for anything
// that must remain historically reproducible.

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { IdentifierType } from "@prisma/client";

export async function setProductIdentifier(
  input: { productId: string; marketplaceId?: string | null; type: IdentifierType; value: string },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "manage_product_identifiers");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.productIdentifier.findFirst({
      where: {
        productId: input.productId,
        type: input.type,
        marketplaceId: input.marketplaceId ?? null,
        isCurrent: true,
      },
    });

    if (existing && existing.value === input.value) {
      return existing; // no-op — nothing changed
    }

    if (existing) {
      await tx.productIdentifier.update({
        where: { id: existing.id },
        data: { isCurrent: false, effectiveTo: new Date() },
      });
    }

    const created = await tx.productIdentifier.create({
      data: {
        productId: input.productId,
        marketplaceId: input.marketplaceId ?? null,
        type: input.type,
        value: input.value,
        isCurrent: true,
      },
    });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: existing ? "UPDATE" : "CREATE",
      entityType: "ProductIdentifier",
      entityId: created.id,
      fieldChanged: input.type,
      oldValue: existing ? { value: existing.value } : undefined,
      newValue: { value: created.value },
      source: "MANUAL",
    });

    return created;
  });
}

export async function getProductIdentifierHistory(productId: string) {
  return prisma.productIdentifier.findMany({
    where: { productId },
    orderBy: [{ type: "asc" }, { effectiveFrom: "desc" }],
    include: { marketplace: true },
  });
}

export async function getCurrentIdentifiers(productId: string) {
  return prisma.productIdentifier.findMany({
    where: { productId, isCurrent: true },
    include: { marketplace: true },
  });
}
