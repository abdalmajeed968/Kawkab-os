// lib/eligibility.ts
//
// Section 11 of the Phase 1A spec. The one rule this module exists to
// protect: RESTRICTED is a status, not a verdict. A restricted product
// stays fully visible and editable — nothing here ever moves it to some
// "rejected" bucket just because it's currently closed on Amazon. Whether
// it's worth pursuing through a brand relationship or a qualifying
// supplier invoice is exactly what this table's fields exist to track.

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { EligibilityStatus, ApprovalStatus } from "@prisma/client";

export interface UpsertEligibilityInput {
  status?: EligibilityStatus;
  approvalStatus?: ApprovalStatus;
  approvalNotes?: string;
  potentialSupplierId?: string | null;
  invoicePathNotes?: string;
  targetBuyPrice?: number | null;
  ownerNotes?: string;
}

export async function upsertProductEligibility(
  productId: string,
  input: UpsertEligibilityInput,
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "manage_eligibility");

  return prisma.$transaction(async (tx) => {
    const before = await tx.productEligibility.findUnique({ where: { productId } });

    const after = await tx.productEligibility.upsert({
      where: { productId },
      create: { productId, ...input },
      update: { ...input },
    });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: before ? "UPDATE" : "CREATE",
      entityType: "ProductEligibility",
      entityId: after.id,
      fieldChanged: "status",
      oldValue: before ? { status: before.status, approvalStatus: before.approvalStatus } : undefined,
      newValue: { status: after.status, approvalStatus: after.approvalStatus },
      source: "MANUAL",
    });

    return after;
  });
}
