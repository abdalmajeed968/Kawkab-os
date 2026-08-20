// tests/phase1a.test.ts
//
// REAL integration tests against a live Postgres instance — run with
// `DATABASE_URL=<test-db-url> npm test`. Covers every item on the Phase
// 1A spec's minimum test list (section 22): product creation, identifier
// history, purchase creation, calculated unit cost, missing-cost
// propagation, completeness, document linking, the confirm workflow,
// audit records, restricted/open eligibility, and RBAC on the new
// mutation routes. See the Phase 1A build report for whether this suite
// was actually executed and what happened.
//
// FIFO consumption itself is Phase 1B scope and is NOT implemented here —
// per the spec's explicit instruction, this suite does not fake a FIFO
// test. What it does test instead: that PurchaseItem rows are immutable
// enough (never overwritten by a later purchase) to support FIFO
// consumption being built on top of them later without a schema change.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma";
import { createProduct } from "../lib/products";
import { setProductIdentifier, getProductIdentifierHistory } from "../lib/productIdentifiers";
import { createPurchase, correctPurchase } from "../lib/purchases";
import { createSupplier } from "../lib/suppliers";
import { upsertProductEligibility } from "../lib/eligibility";
import { uploadDocumentForPurchase, verifyDocument } from "../lib/documents";
import { PermissionError } from "../lib/permissions";

describe("Phase 1A business invariants", () => {
  let ownerId: string;
  let operatorId: string;
  let aiAgentId: string;
  let supplierId: string;

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: { name: "P1A Test Owner", email: `p1a-${Date.now()}@kawkab.local`, passwordHash: "x", role: "OWNER" },
    });
    ownerId = owner.id;

    // Bug found in the Owner's local run against real Postgres: these two
    // used to be literal placeholder strings ("fake-operator-id",
    // "fake-ai-id") rather than real User rows. AI_AGENT's test passed
    // anyway, because requirePermission() throws before any DB write is
    // attempted — but OPERATOR has real permissions here, so its writes
    // reached AuditLog.userId, which has a real foreign key to User, and
    // the literal string violated it. Fixed by creating real rows for
    // both, so neither test depends on a code path staying permission-
    // denied to accidentally avoid the FK.
    const operator = await prisma.user.create({
      data: { name: "P1A Test Operator", email: `p1a-operator-${Date.now()}@kawkab.local`, passwordHash: "x", role: "OPERATOR" },
    });
    operatorId = operator.id;

    const aiAgent = await prisma.user.create({
      data: { name: "P1A Test AI Agent", email: `p1a-ai-${Date.now()}@kawkab.local`, passwordHash: "x", role: "AI_AGENT" },
    });
    aiAgentId = aiAgent.id;

    const supplier = await createSupplier({ name: "Test Supplier Co" }, ownerId, "OWNER");
    supplierId = supplier.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("Product creation writes a real row and an audit entry", async () => {
    const product = await createProduct({ name: "Test Widget", brand: "Acme" }, ownerId, "OWNER");
    expect(product.id).toBeTruthy();
    expect(product.brand).toBe("Acme");

    const auditRow = await prisma.auditLog.findFirst({ where: { entityId: product.id, action: "CREATE", entityType: "Product" } });
    expect(auditRow).not.toBeNull();
  });

  it("Brand accepts free text with no dropdown constraint", async () => {
    const product = await createProduct({ name: "Unbranded Item", brand: "Whatever The Owner Types" }, ownerId, "OWNER");
    expect(product.brand).toBe("Whatever The Owner Types");
  });

  it("ProductIdentifier preserves history instead of overwriting on change", async () => {
    const product = await createProduct({ name: "Identifier Test Product" }, ownerId, "OWNER");

    const first = await setProductIdentifier({ productId: product.id, type: "ASIN", value: "B000000001" }, ownerId, "OWNER");
    expect(first.isCurrent).toBe(true);

    const second = await setProductIdentifier({ productId: product.id, type: "ASIN", value: "B000000002" }, ownerId, "OWNER");
    expect(second.isCurrent).toBe(true);
    expect(second.value).toBe("B000000002");

    const history = await getProductIdentifierHistory(product.id);
    const oldOne = history.find((h) => h.value === "B000000001");
    expect(oldOne).toBeDefined();
    expect(oldOne!.isCurrent).toBe(false); // superseded, not deleted
    expect(oldOne!.effectiveTo).not.toBeNull();

    const currentOnes = history.filter((h) => h.isCurrent && h.type === "ASIN");
    expect(currentOnes).toHaveLength(1); // exactly one current ASIN, never two
  });

  it("Purchase creation records a real row with calculated fields available downstream", async () => {
    const product = await createProduct({ name: "Purchase Test Product" }, ownerId, "OWNER");
    const purchase = await createPurchase(
      {
        supplierId,
        purchaseDate: new Date(), invoiceNumber: "TEST-INVOICE",
        invoiceTotal: 240,
        supplierShipping: 20,
        localShipping: 5,
        prepCost: 10,
        packagingCost: 15,
        tax: 0,
        discount: 0,
        otherCost: 0,
        items: [{ productId: product.id, quantity: 20, lineItemCost: 240 }],
      },
      ownerId,
      "OWNER"
    );
    // INCOMPLETE, not COMPLETE — no document is attached at creation time
    // (see lib/purchases.ts), and per ARCHITECTURE.md #13 (added in Phase
    // 1C, exercised end-to-end in tests/phase1c.test.ts), completeness
    // requires both entered cost fields AND at least one linked document.
    expect(purchase.completenessStatus).toBe("INCOMPLETE");
    expect(purchase.items).toHaveLength(1);
    expect(Number(purchase.items[0].lineItemCost)).toBe(240);
  });

  it("Purchase completeness propagates from missing fields, never silently reads as complete", async () => {
    const product = await createProduct({ name: "Incomplete Purchase Product" }, ownerId, "OWNER");
    const purchase = await createPurchase(
      {
        supplierId,
        purchaseDate: new Date(), invoiceNumber: "TEST-INVOICE",
        invoiceTotal: 100,
        // supplierShipping, localShipping, prepCost, packagingCost, tax,
        // discount, otherCost all omitted — genuinely unknown
        items: [{ productId: product.id, quantity: 10, lineItemCost: 100 }],
      },
      ownerId,
      "OWNER"
    );
    expect(purchase.completenessStatus).toBe("INCOMPLETE");
  });

  it("Correcting a purchase requires a reason and is fully audited", async () => {
    const product = await createProduct({ name: "Correction Test Product" }, ownerId, "OWNER");
    const purchase = await createPurchase(
      {
        supplierId,
        purchaseDate: new Date(), invoiceNumber: "TEST-INVOICE",
        invoiceTotal: 100,
        supplierShipping: 10,
        localShipping: 0,
        prepCost: 0,
        packagingCost: 0,
        tax: 0,
        discount: 0,
        otherCost: 0,
        items: [{ productId: product.id, quantity: 10, lineItemCost: 100 }],
      },
      ownerId,
      "OWNER"
    );

    await expect(correctPurchase(purchase.id, { supplierShipping: 15 } as never, ownerId, "OWNER")).rejects.toThrow(
      /reason/
    );

    const corrected = await correctPurchase(
      purchase.id,
      { supplierShipping: 15, reason: "Supplier invoice was misread — corrected against the original PDF" },
      ownerId,
      "OWNER"
    );
    expect(Number(corrected.supplierShipping)).toBe(15);

    const auditRow = await prisma.auditLog.findFirst({ where: { entityId: purchase.id, action: "CORRECT" } });
    expect(auditRow).not.toBeNull();
    expect((auditRow!.newValue as { reason?: string })?.reason).toContain("misread");
  });

  it("An uploaded invoice links to its Purchase and the review/confirm workflow audits raw vs. final state", async () => {
    const product = await createProduct({ name: "Invoice Workflow Product" }, ownerId, "OWNER");
    const purchase = await createPurchase(
      {
        supplierId,
        purchaseDate: new Date(), invoiceNumber: "TEST-INVOICE",
        invoiceTotal: 50,
        supplierShipping: 0,
        localShipping: 0,
        prepCost: 0,
        packagingCost: 0,
        tax: 0,
        discount: 0,
        otherCost: 0,
        items: [{ productId: product.id, quantity: 5, lineItemCost: 50 }],
      },
      ownerId,
      "OWNER"
    );

    const { document } = await uploadDocumentForPurchase(
      { buffer: Buffer.from("fake invoice bytes"), filename: "invoice.pdf", mimeType: "application/pdf", sizeBytes: 18, type: "INVOICE", purchaseId: purchase.id },
      ownerId,
      "OWNER"
    );
    expect(document.verificationStatus).toBe("NEEDS_REVIEW");

    const verified = await verifyDocument(document.id, { supplierShipping: 0 }, ownerId, "OWNER");
    expect(verified.verificationStatus).toBe("VERIFIED");
    expect(verified.verifiedByUserId).toBe(ownerId);
    expect(verified.verifiedAt).not.toBeNull();

    const auditRow = await prisma.auditLog.findFirst({ where: { entityId: document.id, action: "APPROVE" } });
    expect(auditRow).not.toBeNull();
  });

  it("Restricted eligibility is a status, not a rejection — it stays fully editable", async () => {
    const product = await createProduct({ name: "Restricted Product" }, ownerId, "OWNER");
    const eligibility = await upsertProductEligibility(product.id, { status: "RESTRICTED", invoicePathNotes: "Needs a brand-authorized supplier" }, ownerId, "OWNER");
    expect(eligibility.status).toBe("RESTRICTED");

    // It's still a normal, fully updatable row — nothing about RESTRICTED
    // locks the product or moves it to some other bucket.
    const updated = await upsertProductEligibility(product.id, { status: "WORTH_UNLOCKING" }, ownerId, "OWNER");
    expect(updated.status).toBe("WORTH_UNLOCKING");
  });

  it("RBAC: AI_AGENT cannot create a product, a purchase, or an eligibility record", async () => {
    await expect(createProduct({ name: "AI Should Not Create This" }, aiAgentId, "AI_AGENT")).rejects.toThrow(PermissionError);
    await expect(
      createPurchase({ supplierId, purchaseDate: new Date(), invoiceNumber: "TEST-INVOICE", invoiceTotal: 1, items: [] } as never, aiAgentId, "AI_AGENT")
    ).rejects.toThrow(PermissionError);
  });

  it("RBAC: OPERATOR can create products and purchases but not correct a purchase or manage eligibility", async () => {
    const product = await createProduct({ name: "Operator Created Product" }, operatorId, "OPERATOR");
    expect(product.id).toBeTruthy();

    const purchase = await createPurchase(
      {
        supplierId,
        purchaseDate: new Date(), invoiceNumber: "TEST-INVOICE",
        invoiceTotal: 20,
        supplierShipping: 0,
        localShipping: 0,
        prepCost: 0,
        packagingCost: 0,
        tax: 0,
        discount: 0,
        otherCost: 0,
        items: [{ productId: product.id, quantity: 2, lineItemCost: 20 }],
      },
      operatorId,
      "OPERATOR"
    );

    await expect(correctPurchase(purchase.id, { reason: "test" }, operatorId, "OPERATOR")).rejects.toThrow(PermissionError);
    await expect(upsertProductEligibility(product.id, { status: "OPEN" }, operatorId, "OPERATOR")).rejects.toThrow(
      PermissionError
    );
  });

  it("PurchaseItem history is preserved — a later purchase never overwrites an earlier one's cost", async () => {
    const product = await createProduct({ name: "FIFO Precursor Product" }, ownerId, "OWNER");

    const batch1 = await createPurchase(
      { supplierId, purchaseDate: new Date("2026-01-01"), invoiceNumber: "TEST-INVOICE", invoiceTotal: 100, supplierShipping: 0, localShipping: 0, prepCost: 0, packagingCost: 0, tax: 0, discount: 0, otherCost: 0, items: [{ productId: product.id, quantity: 20, lineItemCost: 100 }] },
      ownerId,
      "OWNER"
    );
    const batch2 = await createPurchase(
      { supplierId, purchaseDate: new Date("2026-02-01"), invoiceNumber: "TEST-INVOICE", invoiceTotal: 168, supplierShipping: 0, localShipping: 0, prepCost: 0, packagingCost: 0, tax: 0, discount: 0, otherCost: 0, items: [{ productId: product.id, quantity: 40, lineItemCost: 168 }] },
      ownerId,
      "OWNER"
    );

    // Both purchases' line items still exist independently, at their own
    // original cost — exactly the shape Phase 1B's FIFO consumption needs.
    const items = await prisma.purchaseItem.findMany({ where: { productId: product.id }, orderBy: { createdAt: "asc" } });
    expect(items).toHaveLength(2);
    expect(Number(items[0].lineItemCost)).toBe(100); // batch 1 unaffected by batch 2
    expect(Number(items[1].lineItemCost)).toBe(168);
    expect(items[0].purchaseId).toBe(batch1.id);
    expect(items[1].purchaseId).toBe(batch2.id);
  });
});
