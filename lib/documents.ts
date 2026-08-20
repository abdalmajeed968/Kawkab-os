// lib/documents.ts
//
// Orchestration layer for Documents + BusinessRecords. API routes call
// through here — no route touches Prisma directly for anything that needs
// a permission check or an audit entry.

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { storage } from "./storage";
import { recomputePurchaseCompleteness } from "./purchases";
import { DocumentType } from "@prisma/client";

export interface UploadDocumentInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  type: DocumentType;
  role: DocumentType; // role-in-context; defaults to `type` at the call site if not distinct
  businessRecordId: string;
  notes?: string;
}

export async function uploadDocumentForBusinessRecord(
  input: UploadDocumentInput,
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "upload_document");

  const record = await prisma.businessRecord.findUniqueOrThrow({ where: { id: input.businessRecordId } });
  if (role === "OPERATOR" && !record.visibleToOperator) {
    // Same visibility rule the read path enforces (see getBusinessRecordDocuments
    // and the file-serving route) — an Operator can't attach a document to a
    // record they aren't allowed to see, either.
    throw new Error(`BusinessRecord ${record.id} is not visible to this role.`);
  }

  const stored = await storage.save({ buffer: input.buffer, filename: input.filename, mimeType: input.mimeType });

  return prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        fileUrl: stored.url,
        storageKey: stored.storageKey,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        type: input.type,
        uploadedByUserId: actingUserId,
        notes: input.notes,
        verificationStatus: "NEEDS_REVIEW",
      },
    });

    const link = await tx.businessRecordDocument.create({
      data: { documentId: document.id, businessRecordId: input.businessRecordId, role: input.role },
    });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Document",
      entityId: document.id,
      fieldChanged: "upload",
      newValue: { filename: input.filename, type: input.type, businessRecordId: input.businessRecordId },
      source: "MANUAL",
    });

    return { document, link };
  });
}

/**
 * Fetches a document's bytes, but only after confirming the requesting
 * role is allowed to see every BusinessRecord it's linked to. This is the
 * requirement flagged explicitly in the implementation plan: the
 * file-serving route must enforce the same visibility rule as the
 * metadata, not just the upload route.
 */
export async function getDocumentFileForRole(storageKey: string, role: Role) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { storageKey },
    include: { businessRecordLinks: { include: { businessRecord: true } } },
  });

  if (role === "OPERATOR") {
    const hasOwnerOnlyLink = document.businessRecordLinks.some((l) => !l.businessRecord.visibleToOperator);
    if (hasOwnerOnlyLink) {
      throw new Error(`Document ${document.id} is linked to an Owner-only record and is not visible to this role.`);
    }
  }
  if (role === "AI_AGENT") {
    // AI_AGENT has no read-document permission in Phase 0 at all — see
    // permissions.ts. Reaching this function as AI_AGENT is already a bug
    // upstream, but the check is repeated here as the last line of defense.
    throw new Error("AI_AGENT cannot read document contents in Phase 0.");
  }

  const { buffer, mimeType } = await storage.read(document.storageKey);
  return { buffer, mimeType: mimeType ?? document.mimeType, filename: document.originalFilename };
}

export async function listBusinessRecordDocuments(businessRecordId: string, role: Role) {
  const record = await prisma.businessRecord.findUniqueOrThrow({ where: { id: businessRecordId } });
  if (role === "OPERATOR" && !record.visibleToOperator) {
    throw new Error(`BusinessRecord ${businessRecordId} is not visible to this role.`);
  }
  return prisma.businessRecordDocument.findMany({
    where: { businessRecordId },
    include: { document: true },
  });
}

export async function uploadDocumentForProduct(
  input: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    type: DocumentType;
    productId: string;
    notes?: string;
  },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "upload_document");

  await prisma.product.findUniqueOrThrow({ where: { id: input.productId } });
  const stored = await storage.save({ buffer: input.buffer, filename: input.filename, mimeType: input.mimeType });

  return prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        fileUrl: stored.url,
        storageKey: stored.storageKey,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        type: input.type,
        uploadedByUserId: actingUserId,
        notes: input.notes,
        verificationStatus: "NEEDS_REVIEW",
      },
    });

    const link = await tx.productDocument.create({
      data: { documentId: document.id, productId: input.productId, role: input.type },
    });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Document",
      entityId: document.id,
      fieldChanged: "upload",
      newValue: { filename: input.filename, type: input.type, productId: input.productId },
      source: "MANUAL",
    });

    return { document, link };
  });
}

export async function uploadDocumentForPurchase(
  input: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    type: DocumentType;
    purchaseId: string;
    notes?: string;
  },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "upload_document");

  await prisma.purchase.findUniqueOrThrow({ where: { id: input.purchaseId } });
  const stored = await storage.save({ buffer: input.buffer, filename: input.filename, mimeType: input.mimeType });

  return prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        fileUrl: stored.url,
        storageKey: stored.storageKey,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        type: input.type,
        uploadedByUserId: actingUserId,
        notes: input.notes,
        verificationStatus: "NEEDS_REVIEW",
      },
    });

    const link = await tx.purchaseDocument.create({
      data: { documentId: document.id, purchaseId: input.purchaseId, role: input.type },
    });

    // Completeness now depends on whether a document is attached, not
    // just cost fields — recompute it here, atomically with the link
    // that just resolved the "missing invoice document" reason.
    await recomputePurchaseCompleteness(tx, input.purchaseId);

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Document",
      entityId: document.id,
      fieldChanged: "upload",
      newValue: { filename: input.filename, type: input.type, purchaseId: input.purchaseId },
      source: "MANUAL",
    });

    return { document, link };
  });
}

export async function uploadDocumentForBox(
  input: { buffer: Buffer; filename: string; mimeType: string; sizeBytes: number; type: DocumentType; boxMovementId: string; notes?: string },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "upload_document");

  await prisma.boxMovement.findUniqueOrThrow({ where: { id: input.boxMovementId } });
  const stored = await storage.save({ buffer: input.buffer, filename: input.filename, mimeType: input.mimeType });

  return prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        fileUrl: stored.url,
        storageKey: stored.storageKey,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        type: input.type,
        uploadedByUserId: actingUserId,
        notes: input.notes,
        verificationStatus: "NEEDS_REVIEW",
      },
    });
    const link = await tx.boxDocument.create({
      data: { documentId: document.id, boxMovementId: input.boxMovementId, role: input.type },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Document",
      entityId: document.id,
      fieldChanged: "upload",
      newValue: { filename: input.filename, type: input.type, boxMovementId: input.boxMovementId },
      source: "MANUAL",
    });
    return { document, link };
  });
}

export async function uploadDocumentForResearch(
  input: { buffer: Buffer; filename: string; mimeType: string; sizeBytes: number; type: DocumentType; researchEntryId: string; notes?: string },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "upload_document");

  await prisma.researchEntry.findUniqueOrThrow({ where: { id: input.researchEntryId } });
  const stored = await storage.save({ buffer: input.buffer, filename: input.filename, mimeType: input.mimeType });

  return prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        fileUrl: stored.url,
        storageKey: stored.storageKey,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        type: input.type,
        uploadedByUserId: actingUserId,
        notes: input.notes,
        verificationStatus: "NEEDS_REVIEW",
      },
    });
    const link = await tx.researchDocument.create({
      data: { documentId: document.id, researchEntryId: input.researchEntryId, role: input.type },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Document",
      entityId: document.id,
      fieldChanged: "upload",
      newValue: { filename: input.filename, type: input.type, researchEntryId: input.researchEntryId },
      source: "MANUAL",
    });
    return { document, link };
  });
}

export async function uploadDocumentForBrand(
  input: { buffer: Buffer; filename: string; mimeType: string; sizeBytes: number; type: DocumentType; brandId: string; notes?: string },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "upload_document");

  await prisma.brand.findUniqueOrThrow({ where: { id: input.brandId } });
  const stored = await storage.save({ buffer: input.buffer, filename: input.filename, mimeType: input.mimeType });

  return prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        fileUrl: stored.url,
        storageKey: stored.storageKey,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        type: input.type,
        uploadedByUserId: actingUserId,
        notes: input.notes,
        verificationStatus: "NEEDS_REVIEW",
      },
    });
    const link = await tx.brandDocument.create({
      data: { documentId: document.id, brandId: input.brandId, role: input.type },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Document",
      entityId: document.id,
      fieldChanged: "upload",
      newValue: { filename: input.filename, type: input.type, brandId: input.brandId },
      source: "MANUAL",
    });
    return { document, link };
  });
}

export async function uploadDocumentForShipment(
  input: { buffer: Buffer; filename: string; mimeType: string; sizeBytes: number; type: DocumentType; shipmentId: string; notes?: string },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "upload_document");

  await prisma.shipment.findUniqueOrThrow({ where: { id: input.shipmentId } });
  const stored = await storage.save({ buffer: input.buffer, filename: input.filename, mimeType: input.mimeType });

  return prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        fileUrl: stored.url,
        storageKey: stored.storageKey,
        originalFilename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        type: input.type,
        uploadedByUserId: actingUserId,
        notes: input.notes,
        verificationStatus: "NEEDS_REVIEW",
      },
    });
    const link = await tx.shipmentDocument.create({
      data: { documentId: document.id, shipmentId: input.shipmentId, role: input.type },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Document",
      entityId: document.id,
      fieldChanged: "upload",
      newValue: { filename: input.filename, type: input.type, shipmentId: input.shipmentId },
      source: "MANUAL",
    });
    return { document, link };
  });
}

/**
 * Section 6's "Review & Confirm" step. Phase 1A has no AI extraction to
 * confirm against yet, so this is the owner confirming their own manual
 * entry is correct against the source file — but the shape is exactly
 * what Phase 2's AI-extraction confirm step will plug into: raw
 * (aiExtractedFields, currently always null) vs. final (confirmedValues)
 * both land in the audit trail, never just the final value alone.
 */
export async function verifyDocument(
  documentId: string,
  confirmedValues: Record<string, unknown> | undefined,
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "verify_document");

  return prisma.$transaction(async (tx) => {
    const before = await tx.document.findUniqueOrThrow({ where: { id: documentId } });

    const after = await tx.document.update({
      where: { id: documentId },
      data: { verificationStatus: "VERIFIED", verifiedByUserId: actingUserId, verifiedAt: new Date() },
    });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "APPROVE",
      entityType: "Document",
      entityId: documentId,
      fieldChanged: "verificationStatus",
      oldValue: { verificationStatus: before.verificationStatus, aiExtractedFields: before.aiExtractedFields },
      newValue: { verificationStatus: "VERIFIED", confirmedValues: confirmedValues ?? null },
      source: "MANUAL",
    });

    return after;
  });
}

/**
 * Document Center search — a union across every dedicated *Document join
 * table. BusinessRecordDocument was Phase 0's proof of the pattern;
 * ProductDocument and PurchaseDocument were Phase 1A's additions;
 * BoxDocument and ShipmentDocument are Phase 2's — each new phase extends
 * this query, never redesigns it.
 */
export async function searchDocuments(filters: { type?: DocumentType; search?: string }, role: Role) {
  const [businessRecordLinks, productLinks, purchaseLinks, boxLinks, shipmentLinks, brandLinks, researchLinks] = await Promise.all([
    prisma.businessRecordDocument.findMany({ include: { document: true, businessRecord: true } }),
    prisma.productDocument.findMany({ include: { document: true, product: true } }),
    prisma.purchaseDocument.findMany({ include: { document: true, purchase: { include: { supplier: true } } } }),
    prisma.boxDocument.findMany({ include: { document: true, boxMovement: { include: { boxType: true } } } }),
    prisma.shipmentDocument.findMany({ include: { document: true, shipment: true } }),
    prisma.brandDocument.findMany({ include: { document: true, brand: true } }),
    prisma.researchDocument.findMany({ include: { document: true, researchEntry: true } }),
  ]);

  const visibleBusinessRecordLinks = businessRecordLinks.filter((l) => role !== "OPERATOR" || l.businessRecord.visibleToOperator);

  const all = [
    ...visibleBusinessRecordLinks.map((l) => ({ ...l.document, role: l.role, linkedTo: `Business record: ${l.businessRecord.name}` })),
    ...productLinks.map((l) => ({ ...l.document, role: l.role, linkedTo: `Product: ${l.product.name}` })),
    ...purchaseLinks.map((l) => ({
      ...l.document,
      role: l.role,
      linkedTo: `Purchase: ${l.purchase.supplier.name} · ${l.purchase.purchaseDate.toLocaleDateString()}`,
    })),
    ...boxLinks.map((l) => ({ ...l.document, role: l.role, linkedTo: `Box: ${l.boxMovement.boxType.name}` })),
    ...shipmentLinks.map((l) => ({ ...l.document, role: l.role, linkedTo: `Shipment: ${l.shipment.reference}` })),
    ...brandLinks.map((l) => ({ ...l.document, role: l.role, linkedTo: `Brand: ${l.brand.name}` })),
    ...researchLinks.map((l) => ({ ...l.document, role: l.role, linkedTo: `Research: ${l.researchEntry.title}` })),
  ];

  return all.filter((d) => {
    if (filters.type && d.type !== filters.type) return false;
    if (filters.search && !d.originalFilename.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });
}
