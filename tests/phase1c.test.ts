// tests/phase1c.test.ts
//
// REAL integration tests against a live Postgres instance — run with
// `DATABASE_URL=<test-db-url> npm test`. Covers the Section A corrections:
// required invoice number, optional-but-completeness-affecting invoice
// document, the Action Center's severity/link upgrade, and Supplier
// website. FIFO, historical COGS locking, and reversal behavior are
// unchanged in this phase (lib/fifo.ts was not touched) — tests/fifo.test.ts
// already covers them and was not rewritten, only updated to pass the
// now-required invoiceNumber through its existing createPurchase calls.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma";
import { createProduct } from "../lib/products";
import { createPurchase } from "../lib/purchases";
import { createSupplier, updateSupplier, normalizeAndValidateWebsite } from "../lib/suppliers";
import { uploadDocumentForPurchase } from "../lib/documents";
import { getActionCenterItems } from "../lib/actionCenter";

describe("Phase 1C: invoice number vs. invoice document", () => {
  let ownerId: string;
  let supplierId: string;

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: { name: "P1C Test Owner", email: `p1c-${Date.now()}@kawkab.local`, passwordHash: "x", role: "OWNER" },
    });
    ownerId = owner.id;
    const supplier = await createSupplier({ name: "P1C Test Supplier" }, ownerId, "OWNER");
    supplierId = supplier.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects creating a Purchase without an invoice number", async () => {
    await expect(
      createPurchase(
        {
          supplierId,
          purchaseDate: new Date(),
          invoiceNumber: "",
          invoiceTotal: 10,
          items: [],
        } as never,
        ownerId,
        "OWNER"
      )
    ).rejects.toThrow(/invoice/i);
  });

  it("allows creating a Purchase with no document attached — the document is optional, the number is not", async () => {
    const product = await createProduct({ name: `P1C No-Doc Product ${Date.now()}` }, ownerId, "OWNER");
    const purchase = await createPurchase(
      {
        supplierId,
        purchaseDate: new Date(),
        invoiceNumber: "INV-1001",
        invoiceTotal: 100,
        supplierShipping: 0,
        localShipping: 0,
        prepCost: 0,
        packagingCost: 0,
        tax: 0,
        discount: 0,
        otherCost: 0,
        items: [{ productId: product.id, quantity: 10, unitCost: 10 }],
      },
      ownerId,
      "OWNER"
    );
    expect(purchase.invoiceNumber).toBe("INV-1001");
    // Costs are all complete, but no document — must still be INCOMPLETE.
    expect(purchase.completenessStatus).toBe("INCOMPLETE");
  });

  it("becomes COMPLETE only once both costs AND a document are present, and flips atomically on upload", async () => {
    const product = await createProduct({ name: `P1C Doc Flip Product ${Date.now()}` }, ownerId, "OWNER");
    const purchase = await createPurchase(
      {
        supplierId,
        purchaseDate: new Date(),
        invoiceNumber: "INV-1002",
        invoiceTotal: 50,
        supplierShipping: 0,
        localShipping: 0,
        prepCost: 0,
        packagingCost: 0,
        tax: 0,
        discount: 0,
        otherCost: 0,
        items: [{ productId: product.id, quantity: 5, unitCost: 10 }],
      },
      ownerId,
      "OWNER"
    );
    expect(purchase.completenessStatus).toBe("INCOMPLETE");

    await uploadDocumentForPurchase(
      { buffer: Buffer.from("fake pdf"), filename: "inv.pdf", mimeType: "application/pdf", sizeBytes: 8, type: "INVOICE", purchaseId: purchase.id },
      ownerId,
      "OWNER"
    );

    const after = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(after.completenessStatus).toBe("COMPLETE");
  });

  it("computes lineItemCost as quantity × unitCost when unitCost is provided", async () => {
    const product = await createProduct({ name: `P1C Unit Cost Product ${Date.now()}` }, ownerId, "OWNER");
    const purchase = await createPurchase(
      {
        supplierId,
        purchaseDate: new Date(),
        invoiceNumber: "INV-1003",
        invoiceTotal: 84,
        items: [{ productId: product.id, quantity: 12, unitCost: 7 }],
      },
      ownerId,
      "OWNER"
    );
    const item = await prisma.purchaseItem.findFirstOrThrow({ where: { purchaseId: purchase.id } });
    expect(Number(item.lineItemCost)).toBe(84); // 12 × 7
  });

  it("Action Center surfaces a critical, linked item for a Purchase missing its invoice document", async () => {
    const product = await createProduct({ name: `P1C Action Center Product ${Date.now()}` }, ownerId, "OWNER");
    const purchase = await createPurchase(
      {
        supplierId,
        purchaseDate: new Date(),
        invoiceNumber: "INV-1004",
        invoiceTotal: 30,
        items: [{ productId: product.id, quantity: 3, unitCost: 10 }],
      },
      ownerId,
      "OWNER"
    );

    const items = await getActionCenterItems();
    const match = items.find((i) => i.type === "missing_invoice_document" && i.href === `/purchases/${purchase.id}`);
    expect(match).toBeDefined();
    expect(match?.severity).toBe("critical");
  });

  it("critical items sort ahead of warnings", async () => {
    const items = await getActionCenterItems();
    const firstWarningIndex = items.findIndex((i) => i.severity === "warning");
    const lastCriticalIndex = items.map((i) => i.severity).lastIndexOf("critical");
    if (firstWarningIndex !== -1 && lastCriticalIndex !== -1) {
      expect(lastCriticalIndex).toBeLessThan(firstWarningIndex === -1 ? Infinity : items.length);
      expect(items.slice(0, lastCriticalIndex + 1).every((i) => i.severity === "critical")).toBe(true);
    }
  });
});

describe("Phase 1C: Supplier website", () => {
  let ownerId: string;

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: { name: "P1C Website Test Owner", email: `p1c-website-${Date.now()}@kawkab.local`, passwordHash: "x", role: "OWNER" },
    });
    ownerId = owner.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("website is never required — a supplier can be created with none", async () => {
    const supplier = await createSupplier({ name: `No Website Supplier ${Date.now()}` }, ownerId, "OWNER");
    expect(supplier.website).toBeNull();
  });

  it("normalizes a bare domain to a full https URL", () => {
    expect(normalizeAndValidateWebsite("example-supplier.com")).toBe("https://example-supplier.com/");
  });

  it("accepts an already-complete URL unchanged in scheme", () => {
    expect(normalizeAndValidateWebsite("http://example-supplier.com")).toBe("http://example-supplier.com/");
  });

  it("rejects a string that isn't a plausible website", () => {
    expect(() => normalizeAndValidateWebsite("not a url at all")).toThrow();
  });

  it("returns undefined for empty/undefined input rather than throwing", () => {
    expect(normalizeAndValidateWebsite(undefined)).toBeUndefined();
    expect(normalizeAndValidateWebsite("")).toBeUndefined();
  });

  it("updateSupplier changes the website and writes an audit row", async () => {
    const supplier = await createSupplier({ name: `Editable Supplier ${Date.now()}` }, ownerId, "OWNER");
    const updated = await updateSupplier(supplier.id, { website: "new-supplier-site.com" }, ownerId, "OWNER");
    expect(updated.website).toBe("https://new-supplier-site.com/");

    const auditRow = await prisma.auditLog.findFirst({ where: { entityId: supplier.id, action: "UPDATE", entityType: "Supplier" } });
    expect(auditRow).not.toBeNull();
  });
});
