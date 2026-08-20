// tests/documents.test.ts
//
// REAL integration tests against a live Postgres instance and the local
// filesystem storage adapter — run with `DATABASE_URL=<test-db-url> npm
// test`. See the Phase 0 build report for whether this suite was actually
// executed and what happened when it was attempted.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma";
import { uploadDocumentForBusinessRecord, getDocumentFileForRole, searchDocuments } from "../lib/documents";
import { PermissionError } from "../lib/permissions";

describe("Document upload and visibility", () => {
  let ownerId: string;
  let ownerOnlyRecordId: string;
  let sharedRecordId: string;

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: { name: "Doc Test Owner", email: `doctest-${Date.now()}@kawkab.local`, passwordHash: "x", role: "OWNER" },
    });
    ownerId = owner.id;

    const ownerOnly = await prisma.businessRecord.create({
      data: { name: "Owner-only record", category: "Test", visibleToOperator: false },
    });
    ownerOnlyRecordId = ownerOnly.id;

    const shared = await prisma.businessRecord.create({
      data: { name: "Shared record", category: "Test", visibleToOperator: true },
    });
    sharedRecordId = shared.id;
  });

  afterAll(async () => {
    await prisma.businessRecordDocument.deleteMany({ where: { businessRecordId: { in: [ownerOnlyRecordId, sharedRecordId] } } });
    await prisma.auditLog.deleteMany({ where: { userId: ownerId } });
    await prisma.businessRecord.deleteMany({ where: { id: { in: [ownerOnlyRecordId, sharedRecordId] } } });
    await prisma.user.delete({ where: { id: ownerId } });
    await prisma.$disconnect();
  });

  it("OWNER can upload a document and it's recorded in the audit trail", async () => {
    const { document } = await uploadDocumentForBusinessRecord(
      {
        buffer: Buffer.from("test file contents"),
        filename: "test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 19,
        type: "BUSINESS_REGISTRATION",
        role: "BUSINESS_REGISTRATION",
        businessRecordId: sharedRecordId,
      },
      ownerId,
      "OWNER"
    );

    expect(document.id).toBeTruthy();
    const auditRow = await prisma.auditLog.findFirst({ where: { entityId: document.id, action: "CREATE" } });
    expect(auditRow).not.toBeNull();
  });

  it("AI_AGENT cannot upload a document at all", async () => {
    await expect(
      uploadDocumentForBusinessRecord(
        {
          buffer: Buffer.from("x"),
          filename: "x.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1,
          type: "OTHER",
          role: "OTHER",
          businessRecordId: sharedRecordId,
        },
        "some-ai-agent-id",
        "AI_AGENT"
      )
    ).rejects.toThrow(PermissionError);
  });

  it("OPERATOR cannot read a document linked only to an Owner-only record", async () => {
    const { document } = await uploadDocumentForBusinessRecord(
      {
        buffer: Buffer.from("owner only contents"),
        filename: "owner-only.pdf",
        mimeType: "application/pdf",
        sizeBytes: 20,
        type: "TAX_DOCUMENT",
        role: "TAX_DOCUMENT",
        businessRecordId: ownerOnlyRecordId,
      },
      ownerId,
      "OWNER"
    );

    await expect(getDocumentFileForRole(document.storageKey, "OPERATOR")).rejects.toThrow(/not visible/);
    // The same document IS readable by the Owner — proves this is a
    // visibility rule, not a broken read path.
    const read = await getDocumentFileForRole(document.storageKey, "OWNER");
    expect(read.buffer.toString()).toBe("owner only contents");
  });

  it("AI_AGENT cannot read any document, even one it could theoretically see", async () => {
    const { document } = await uploadDocumentForBusinessRecord(
      {
        buffer: Buffer.from("shared contents"),
        filename: "shared.pdf",
        mimeType: "application/pdf",
        sizeBytes: 16,
        type: "OTHER",
        role: "OTHER",
        businessRecordId: sharedRecordId,
      },
      ownerId,
      "OWNER"
    );

    await expect(getDocumentFileForRole(document.storageKey, "AI_AGENT")).rejects.toThrow(/AI_AGENT cannot read/);
  });

  it("searchDocuments excludes Owner-only records from an OPERATOR's results", async () => {
    const results = await searchDocuments({}, "OPERATOR");
    const linkedToOwnerOnly = results.some((d) => d.linkedTo.includes("Owner-only record"));
    expect(linkedToOwnerOnly).toBe(false);
  });
});
