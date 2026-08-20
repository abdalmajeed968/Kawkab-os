// lib/research.ts
//
// Manual sourcing/opportunity records. assumedCost and assumedSellingPrice
// are owner-entered assumptions, labeled as such everywhere they're shown
// — never presented as real numbers, never used anywhere outside this
// module. Assumed margin is computed on read only when both are present.

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { ResearchStatus } from "@prisma/client";

export interface ResearchEntryInput {
  title: string;
  asin?: string;
  sku?: string;
  supplierId?: string | null;
  assumedCost?: number | null;
  assumedSellingPrice?: number | null;
  competitionNotes?: string;
  restrictionNotes?: string;
  status?: ResearchStatus;
  sourceUrl?: string;
  notes?: string;
}

export async function createResearchEntry(input: ResearchEntryInput, actingUserId: string, role: Role) {
  requirePermission(role, "manage_research");
  if (!input.title?.trim()) throw new Error("A title is required.");

  return prisma.$transaction(async (tx) => {
    const entry = await tx.researchEntry.create({
      data: {
        title: input.title.trim(),
        asin: input.asin,
        sku: input.sku,
        supplierId: input.supplierId ?? undefined,
        assumedCost: input.assumedCost ?? undefined,
        assumedSellingPrice: input.assumedSellingPrice ?? undefined,
        competitionNotes: input.competitionNotes,
        restrictionNotes: input.restrictionNotes,
        status: input.status ?? "IDEA",
        sourceUrl: input.sourceUrl,
        notes: input.notes,
        createdByUserId: actingUserId,
      },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "ResearchEntry",
      entityId: entry.id,
      newValue: { title: entry.title, status: entry.status },
      source: "MANUAL",
    });
    return entry;
  });
}

export async function updateResearchEntry(entryId: string, input: Partial<ResearchEntryInput>, actingUserId: string, role: Role) {
  requirePermission(role, "manage_research");

  return prisma.$transaction(async (tx) => {
    const before = await tx.researchEntry.findUniqueOrThrow({ where: { id: entryId } });
    const after = await tx.researchEntry.update({
      where: { id: entryId },
      data: {
        title: input.title,
        asin: input.asin,
        sku: input.sku,
        supplierId: input.supplierId,
        assumedCost: input.assumedCost,
        assumedSellingPrice: input.assumedSellingPrice,
        competitionNotes: input.competitionNotes,
        restrictionNotes: input.restrictionNotes,
        status: input.status,
        sourceUrl: input.sourceUrl,
        notes: input.notes,
      },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "UPDATE",
      entityType: "ResearchEntry",
      entityId: entryId,
      fieldChanged: "status",
      oldValue: { status: before.status },
      newValue: { status: after.status },
      source: "MANUAL",
    });
    return after;
  });
}

export interface ResearchEntryWithMargin {
  id: string;
  title: string;
  asin: string | null;
  sku: string | null;
  status: string;
  assumedCost: number | null;
  assumedSellingPrice: number | null;
  assumedMargin: number | null;
  supplierName: string | null;
}

function withMargin<T extends { assumedCost: unknown; assumedSellingPrice: unknown; supplier?: { name: string } | null }>(
  entry: T
): ResearchEntryWithMargin & T {
  const cost = entry.assumedCost !== null && entry.assumedCost !== undefined ? Number(entry.assumedCost) : null;
  const price = entry.assumedSellingPrice !== null && entry.assumedSellingPrice !== undefined ? Number(entry.assumedSellingPrice) : null;
  return {
    ...entry,
    assumedCost: cost,
    assumedSellingPrice: price,
    assumedMargin: cost !== null && price !== null ? price - cost : null,
    supplierName: entry.supplier?.name ?? null,
  } as ResearchEntryWithMargin & T;
}

export async function listResearchEntries() {
  const entries = await prisma.researchEntry.findMany({
    include: { supplier: true, product: true },
    orderBy: { createdAt: "desc" },
  });
  return entries.map(withMargin);
}

export async function getResearchEntry(entryId: string) {
  const entry = await prisma.researchEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: { supplier: true, product: true, documents: { include: { document: true } } },
  });
  return withMargin(entry);
}
