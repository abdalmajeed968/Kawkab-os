// lib/audit.ts
//
// The only sanctioned way to write an AuditLog row. There is deliberately
// no updateAuditLog() or deleteAuditLog() anywhere in this codebase — audit
// history is append-only because the capability to change it was never
// built, not because a rule says not to use it.
//
// Callers pass their existing Prisma transaction client (tx) so the audit
// row commits atomically with the mutation it's recording — either both
// happen or neither does.

import { Prisma, AuditAction } from "@prisma/client";
import { TransactionSource } from "@prisma/client";
import { prisma } from "./prisma";
import { Role } from "./permissions";

export interface AuditEntry {
  userId: string | null; // null = SYSTEM
  action: AuditAction;
  entityType: string;
  entityId: string;
  fieldChanged?: string;
  oldValue?: unknown; // stored as jsonb — pass a real object/array, not a pre-stringified value
  newValue?: unknown;
  source?: TransactionSource;
}

/**
 * Backs the dashboard's Recent Activity widget — the one Phase 0 widget
 * with real data behind it. `view_audit_log` (the system-wide audit trail)
 * is Owner-only per the permission matrix, so an Owner sees recent
 * activity across the whole system; an Operator sees only their own
 * recent actions, which doesn't require that permission — seeing your own
 * action history isn't the same thing as viewing everyone's.
 */
export async function getRecentActivity(role: Role, userId: string, take = 8) {
  return prisma.auditLog.findMany({
    where: role === "OWNER" ? {} : { userId },
    orderBy: { timestamp: "desc" },
    take,
    include: { user: { select: { name: true } } },
  });
}

export async function getEntityAuditTrail(entityType: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { timestamp: "desc" },
    include: { user: { select: { name: true } } },
  });
}

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  entry: AuditEntry
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      fieldChanged: entry.fieldChanged,
      oldValue: entry.oldValue === undefined ? undefined : (entry.oldValue as Prisma.InputJsonValue),
      newValue: entry.newValue === undefined ? undefined : (entry.newValue as Prisma.InputJsonValue),
      source: entry.source ?? "MANUAL",
    },
  });
}
