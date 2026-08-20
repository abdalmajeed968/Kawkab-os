// lib/financialEvents.ts
//
// Creates SaleFinancialEvent rows — one per discrete Amazon financial
// event (revenue, a fee, a refund, a credit). Reconciliation against a
// Sale/SaleItem is attempted on a best-effort basis at creation time and
// never blocks the event from being saved: a finance report can arrive
// before the sales report that would let it resolve, and nothing here
// requires that resolution to happen first.

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { FinancialEventType } from "@prisma/client";

export interface CreateFinancialEventInput {
  eventType: FinancialEventType;
  amount: number;
  currency: string;
  eventDate: Date;
  externalEventId?: string;
  externalOrderId?: string; // used only to attempt reconciliation, not stored directly on the event
  externalLineItemId?: string; // ditto
  productId?: string | null;
  importBatchId?: string;
  importedRowId?: string;
  importFingerprint?: string;
  notes?: string;
}

export async function createFinancialEvent(input: CreateFinancialEventInput, actingUserId: string, role: Role) {
  requirePermission(role, "manage_imports");

  return prisma.$transaction(async (tx) => {
    // Best-effort reconciliation — never required. A SaleItem match is
    // tried first (more specific), falling back to a Sale-level match.
    let saleId: string | undefined;
    let saleItemId: string | undefined;

    if (input.externalLineItemId) {
      const item = await tx.saleItem.findUnique({ where: { externalLineItemId: input.externalLineItemId } });
      if (item) {
        saleItemId = item.id;
        saleId = item.saleId;
      }
    }
    if (!saleId && input.externalOrderId) {
      const sale = await tx.sale.findUnique({ where: { externalOrderId: input.externalOrderId } });
      if (sale) saleId = sale.id;
    }

    const event = await tx.saleFinancialEvent.create({
      data: {
        saleId,
        saleItemId,
        productId: input.productId ?? undefined,
        importBatchId: input.importBatchId,
        importedRowId: input.importedRowId,
        eventType: input.eventType,
        amount: input.amount,
        currency: input.currency,
        eventDate: input.eventDate,
        externalEventId: input.externalEventId,
        importFingerprint: input.importFingerprint,
        source: "FILE_IMPORT",
        notes: input.notes,
      },
    });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "SaleFinancialEvent",
      entityId: event.id,
      newValue: { eventType: input.eventType, amount: input.amount, resolvedSaleId: saleId ?? null },
      source: "FILE_IMPORT",
    });

    return event;
  });
}

/**
 * Re-attempts reconciliation for financial events that arrived before
 * their Sale existed. Call this after a SALES-report import commits, so
 * previously-orphaned finance events get linked without re-uploading the
 * finance report. Deliberately conservative: only resolves via
 * externalOrderId, and only when the raw imported row actually recorded
 * one — this stays generic on purpose, since exact finance-report column
 * names haven't been proven against a real report yet.
 */
export async function reconcileOrphanedFinancialEvents(): Promise<{ checked: number; reconciled: number }> {
  const orphaned = await prisma.saleFinancialEvent.findMany({
    where: { saleId: null, importedRowId: { not: null } },
    include: { importedRow: true },
  });

  let reconciled = 0;
  for (const event of orphaned) {
    const raw = (event.importedRow?.rawData ?? {}) as Record<string, unknown>;
    const externalOrderId = typeof raw["order-id"] === "string" ? (raw["order-id"] as string) : undefined;
    if (!externalOrderId) continue;

    const sale = await prisma.sale.findUnique({ where: { externalOrderId } });
    if (!sale) continue;

    await prisma.saleFinancialEvent.update({ where: { id: event.id }, data: { saleId: sale.id } });
    reconciled++;
  }
  return { checked: orphaned.length, reconciled };
}

export async function listFinancialEventsForSale(saleId: string) {
  return prisma.saleFinancialEvent.findMany({ where: { saleId }, orderBy: { eventDate: "asc" } });
}

export async function listUnreconciledFinancialEvents() {
  return prisma.saleFinancialEvent.findMany({
    where: { saleId: null },
    include: { product: true, importBatch: true },
    orderBy: { eventDate: "desc" },
  });
}
